import httpx
from fastapi.testclient import TestClient

from .conftest import FakeNetwork

SSLCOMMERZ = "https://sandbox.sslcommerz.com"


def mock_gateway(network: FakeNetwork, *, amount_override: float | None = None, risk: int = 0):
    """Accept every session, and validate val_ids as paid for the amount we were sent."""
    amounts: dict[str, str] = {}

    def create_session(request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        amounts[form["tran_id"]] = form["total_amount"]
        return httpx.Response(
            200, json={"status": "SUCCESS", "GatewayPageURL": f"{SSLCOMMERZ}/pay/{form['tran_id']}"}
        )

    def validate(request: httpx.Request) -> httpx.Response:
        tran_id = request.url.params["val_id"].removeprefix("VAL-")
        amount = amount_override if amount_override is not None else amounts[tran_id]
        return httpx.Response(
            200,
            json={
                "status": "VALID",
                "tran_id": tran_id,
                "amount": str(amount),
                "currency": "BDT",
                "card_type": "BKASH-BKash",
                "risk_level": str(risk),
            },
        )

    network.on(f"{SSLCOMMERZ}/gwprocess/v4/api.php", create_session)
    network.on(f"{SSLCOMMERZ}/validator/api/validationserverAPI.php", validate)


def subscribe(
    client: TestClient, network: FakeNetwork, headers: dict, plan_id: str, **checkout
) -> str:
    mock_gateway(network)
    response = client.post(
        "/api/billing/checkout", headers=headers, json={"plan_id": plan_id, **checkout}
    )
    assert response.status_code == 200, response.text
    tran_id = response.json()["tran_id"]
    ipn = client.post(
        "/api/billing/sslcommerz/ipn", data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"}
    )
    assert ipn.json()["status"] == "paid", ipn.text
    return tran_id
