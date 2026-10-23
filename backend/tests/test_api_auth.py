from .conftest import register


def test_register_then_fetch_profile(client):
    headers = register(client, "Asha@Example.com")
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["email"] == "asha@example.com"


def test_duplicate_email_is_rejected(client):
    register(client)
    response = client.post(
        "/api/auth/register",
        json={"email": "USER@example.com", "name": "Again", "password": "password123"},
    )
    assert response.status_code == 409


def test_login_with_correct_and_wrong_password(client):
    register(client)
    ok = client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": "password123"}
    )
    wrong = client.post("/api/auth/login", json={"email": "user@example.com", "password": "nope"})
    unknown = client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "password123"}
    )
    assert ok.status_code == 200 and "access_token" in ok.json()
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_short_and_overlong_passwords_are_rejected(client):
    for password in ("short", "x" * 73):
        response = client.post(
            "/api/auth/register",
            json={"email": "a@example.com", "name": "A", "password": password},
        )
        assert response.status_code == 422


def test_protected_routes_need_a_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    bad = {"Authorization": "Bearer not-a-token"}
    assert client.get("/api/conversations", headers=bad).status_code == 401
