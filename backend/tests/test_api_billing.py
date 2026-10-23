from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from kothora.config import Settings
from kothora.main import create_app
from kothora.models import User

from .billing_helpers import SSLCOMMERZ, mock_gateway, subscribe
from .conftest import read_events, register


def test_plan_catalog_lists_per_month_and_per_period_prices(client):
    plans = {p["id"]: p for p in client.get("/api/billing/plans").json()}
    pro_prices = {p["cycle"]: p for p in plans["pro"]["prices"]}

    assert pro_prices["quarterly"] == {
        "cycle": "quarterly",
        "total_bdt": 4050,
        "per_month_bdt": 1350,
    }
    assert pro_prices["yearly"]["per_month_bdt"] == 1275
    assert plans["enterprise"]["prices"] == []
    assert plans["business_basic"]["prices"][0]["total_bdt"] == 2500  # per seat


def test_successful_payment_activates_the_plan(client, network):
    headers = register(client)
    tran_id = subscribe(client, network, headers, "premium", cycle="yearly")

    usage = client.get("/api/account/usage", headers=headers).json()
    payments = client.get("/api/account/payments", headers=headers).json()
    assert usage["plan_id"] == "premium"
    assert usage["monthly_limit"] == 3000
    assert len(usage["allowed_models"]) > 2
    assert payments[0]["tran_id"] == tran_id
    assert payments[0]["amount_bdt"] == 20400
    assert payments[0]["gateway_card_type"] == "BKASH-BKash"


def test_checkout_sends_the_amount_and_callbacks_to_the_gateway(client, network):
    mock_gateway(network)
    headers = register(client)

    response = client.post(
        "/api/billing/checkout", headers=headers, json={"plan_id": "pro", "cycle": "quarterly"}
    )

    form = dict(httpx.QueryParams(network.calls_to(SSLCOMMERZ)[0].content.decode()))
    assert response.json()["gateway_url"].startswith(SSLCOMMERZ)
    assert form["total_amount"] == "4050.00" and form["currency"] == "BDT"
    assert form["ipn_url"] == "http://api.test/api/billing/sslcommerz/ipn"


def test_duplicate_ipn_does_not_create_a_second_period(client, network):
    headers = register(client)
    tran_id = subscribe(client, network, headers, "pro")
    again = client.post(
        "/api/billing/sslcommerz/ipn", data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"}
    )

    assert again.json()["status"] == "paid"
    period_end = client.get("/api/account/usage", headers=headers).json()["period_ends_at"]
    ends_at = datetime.fromisoformat(period_end)
    assert ends_at - datetime.now(UTC) < timedelta(days=32)


@pytest.mark.parametrize(("override", "risk"), [(1.0, 0), (None, 1)])
def test_wrong_amount_or_risky_payment_is_not_activated(client, network, override, risk):
    mock_gateway(network, amount_override=override, risk=risk)
    headers = register(client)
    tran_id = client.post("/api/billing/checkout", headers=headers, json={"plan_id": "pro"}).json()[
        "tran_id"
    ]

    ipn = client.post(
        "/api/billing/sslcommerz/ipn", data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"}
    )

    assert ipn.json()["status"] == ("review" if risk else "failed")
    assert client.get("/api/account/usage", headers=headers).json()["plan_id"] == "free"


def test_browser_return_redirects_to_the_web_app(client, network):
    mock_gateway(network)
    headers = register(client)
    tran_id = client.post(
        "/api/billing/checkout", headers=headers, json={"plan_id": "basic"}
    ).json()["tran_id"]

    cancelled = client.post(
        "/api/billing/sslcommerz/return/cancel", data={"tran_id": tran_id}, follow_redirects=False
    )

    assert cancelled.status_code == 303
    assert cancelled.headers["location"] == "http://app.test/billing?payment=cancelled"


def test_unknown_transaction_in_ipn_is_404(client, network):
    mock_gateway(network)
    response = client.post("/api/billing/sslcommerz/ipn", data={"tran_id": "nope", "val_id": "x"})
    assert response.status_code == 404


def test_education_plan_needs_verification(client, network):
    mock_gateway(network)
    headers = register(client)
    response = client.post("/api/billing/checkout", headers=headers, json={"plan_id": "education"})
    assert response.status_code == 403


def test_verified_student_gets_scholarly_search_and_bibliography(client, network, settings):
    network.on(
        "https://api.openalex.org/works",
        lambda r: httpx.Response(
            200,
            json={
                "results": [
                    {
                        "display_name": "Mobile money adoption",
                        "doi": "https://doi.org/10.1/mm",
                        "publication_year": 2023,
                        "authorships": [{"author": {"display_name": "Nusrat Jahan"}}],
                        "abstract_inverted_index": {"Adoption": [0], "grew": [1]},
                    }
                ]
            },
        ),
    )
    headers = register(client, "student@example.com")
    _make_admin_verify(client, "student@example.com")
    subscribe(client, network, headers, "education")
    conversation_id = client.post("/api/conversations", headers=headers).json()["id"]

    events = read_events(
        client.post(
            f"/api/conversations/{conversation_id}/messages",
            headers=headers,
            json={"content": "mobile money", "web_search": False, "scholarly_search": True},
        )
    )
    done = events[-1]
    bibtex = client.get(
        f"/api/conversations/{conversation_id}/messages/{done['message_id']}/bibliography",
        headers=headers,
    )

    assert done["sources"][0]["kind"] == "scholarly"
    assert bibtex.status_code == 200
    assert "@article{jahan2023mobile," in bibtex.text


def test_checkout_without_gateway_config_is_503(database_url, network):
    settings = Settings(
        env="test",
        database_url=database_url,
        jwt_secret="test-secret-that-is-long-enough-for-hs256",
    )
    with TestClient(create_app(settings, httpx.MockTransport(network))) as bare:
        headers = register(bare)
        response = bare.post("/api/billing/checkout", headers=headers, json={"plan_id": "pro"})
    assert response.status_code == 503


def _make_admin_verify(client, student_email: str) -> None:
    """Promote a fresh admin directly in the database, then verify the student via the API."""
    admin_headers = register(client, "admin@example.com")
    services = client.app.state.services

    async def promote() -> None:
        async with services.sessionmaker() as session:
            await session.execute(
                update(User).where(User.email == "admin@example.com").values(is_admin=True)
            )
            await session.commit()

    client.portal.call(promote)
    response = client.post(
        "/api/account/admin/education-verification",
        headers=admin_headers,
        json={
            "email": student_email,
            "verified_until": (datetime.now(UTC) + timedelta(days=180)).isoformat(),
        },
    )
    assert response.status_code == 200, response.text
