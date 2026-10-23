import httpx

from .billing_helpers import subscribe
from .conftest import LOCAL_URL, OPENROUTER_URL, SEARXNG_URL, read_events, register


def new_conversation(client, headers) -> str:
    return client.post("/api/conversations", headers=headers).json()["id"]


def ask(client, headers, conversation_id, content, **options):
    return client.post(
        f"/api/conversations/{conversation_id}/messages",
        headers=headers,
        json={"content": content, **options},
    )


def test_free_user_simple_question_is_answered_locally_with_citations(client, network):
    headers = register(client)
    conversation_id = new_conversation(client, headers)

    events = read_events(ask(client, headers, conversation_id, "What is the capital?"))

    assert [e["type"] for e in events] == ["meta", "delta", "done"]
    done = events[-1]
    assert done["route"] == "local_general"
    assert done["sources"][0]["cited"] is True
    assert done["title"] == "What is the capital?"
    assert not network.calls_to(OPENROUTER_URL)

    saved = client.get(f"/api/conversations/{conversation_id}", headers=headers).json()
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["content"] == "Local answer [1]."


def test_pro_user_complex_question_goes_to_openrouter_and_records_cost(client, network):
    headers = register(client)
    subscribe(client, network, headers, "pro")
    conversation_id = new_conversation(client, headers)

    events = read_events(
        ask(client, headers, conversation_id, "Compare bKash and Nagad fees in detail")
    )

    done = events[-1]
    assert done["route"] == "openrouter"
    # [9] does not exist, so only [1] counts as cited.
    assert [s["cited"] for s in done["sources"]] == [True]
    usage = client.get("/api/account/usage", headers=headers).json()
    assert usage["plan_id"] == "pro" and usage["used_this_month"] == 1


def test_local_outage_falls_back_before_any_text_is_sent(client, network):
    def local_down(request):
        raise httpx.ConnectError("refused", request=request)

    network.on(f"{LOCAL_URL}/chat/completions", local_down)
    headers = register(client)
    events = read_events(ask(client, headers, new_conversation(client, headers), "Hi there"))

    metas = [e for e in events if e["type"] == "meta"]
    assert [m["route"] for m in metas] == ["local_general", "openrouter"]
    assert events[-1]["type"] == "done" and events[-1]["route"] == "openrouter"


def test_all_models_down_reports_an_error_and_does_not_use_quota(client, network):
    network.on(f"{LOCAL_URL}/chat/completions", lambda r: httpx.Response(500))
    network.on(f"{OPENROUTER_URL}/chat/completions", lambda r: httpx.Response(500))
    headers = register(client)

    events = read_events(ask(client, headers, new_conversation(client, headers), "Hi"))

    assert events[-1]["type"] == "error"
    assert client.get("/api/account/usage", headers=headers).json()["used_this_month"] == 0


def test_failed_search_is_reported_not_hidden(client, network):
    network.on(f"{SEARXNG_URL}/search", lambda r: httpx.Response(502))
    headers = register(client)

    events = read_events(ask(client, headers, new_conversation(client, headers), "Hi"))

    assert events[0] == {"type": "notice", "message": "Web search is unavailable right now."}
    assert events[-1]["type"] == "done" and events[-1]["sources"] == []


def test_repeated_standalone_question_is_served_from_cache(client, network):
    headers = register(client)
    ask(client, headers, new_conversation(client, headers), "What is bKash?")
    events = read_events(ask(client, headers, new_conversation(client, headers), "what is  BKASH?"))

    assert events[-1]["route"] == "cache"
    assert len(network.calls_to(f"{LOCAL_URL}/chat/completions")) == 1


def test_free_daily_limit_returns_429(client):
    headers = register(client)
    conversation_id = new_conversation(client, headers)
    for index in range(5):
        assert ask(client, headers, conversation_id, f"Question {index}").status_code == 200

    response = ask(client, headers, conversation_id, "One more")

    assert response.status_code == 429
    assert "today's limit of 5" in response.json()["detail"]


def test_free_user_cannot_pick_a_paid_model(client, settings):
    headers = register(client)
    response = ask(
        client,
        headers,
        new_conversation(client, headers),
        "Hi",
        model=settings.openrouter_default_model,
    )
    assert response.status_code == 403


def test_users_cannot_read_each_others_conversations(client):
    owner = register(client, "owner@example.com")
    intruder = register(client, "intruder@example.com")
    conversation_id = new_conversation(client, owner)

    assert client.get(f"/api/conversations/{conversation_id}", headers=intruder).status_code == 404
    assert ask(client, intruder, conversation_id, "Hi").status_code == 404
    assert (
        client.delete(f"/api/conversations/{conversation_id}", headers=intruder).status_code == 404
    )


def test_rename_and_delete_conversation(client):
    headers = register(client)
    conversation_id = new_conversation(client, headers)

    renamed = client.patch(
        f"/api/conversations/{conversation_id}", headers=headers, json={"title": "Thesis"}
    )
    assert renamed.json()["title"] == "Thesis"
    assert (
        client.delete(f"/api/conversations/{conversation_id}", headers=headers).status_code == 204
    )
    assert client.get("/api/conversations", headers=headers).json() == []


def test_bibliography_export_is_education_only(client):
    headers = register(client)
    conversation_id = new_conversation(client, headers)
    done = read_events(ask(client, headers, conversation_id, "Hi"))[-1]

    response = client.get(
        f"/api/conversations/{conversation_id}/messages/{done['message_id']}/bibliography",
        headers=headers,
    )
    assert response.status_code == 403
