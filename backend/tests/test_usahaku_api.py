"""Legacy regression coverage (BASE_URL now resolved from /app/frontend/.env via conftest)."""
import time
import requests
import pytest

from conftest import API as _API, creds

BASE_URL = _API.rsplit("/api", 1)[0]
ADMIN = creds()


@pytest.fixture
def client():
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"
    return session


@pytest.fixture
def trial_client(client):
    unique = f"test_api_{int(time.time() * 1000)}@qa-usahaku.com"
    response = client.post(f"{BASE_URL}/api/auth/register", json={
        "name": "TEST API User", "email": unique, "password": "TestPass123!"
    })
    assert response.status_code == 200, response.text
    return client


def test_health_and_plans(client):
    health = client.get(f"{BASE_URL}/api/")
    assert health.status_code == 200 and health.json()["message"]
    plans = client.get(f"{BASE_URL}/api/plans")
    assert plans.status_code == 200
    assert {p["slug"] for p in plans.json()} >= {"premium-1", "premium-3"}
    assert all(p["slug"] != "trial" for p in plans.json())


def test_register_trial_cookie_and_invalid_login(client):
    email = f"test_auth_{int(time.time() * 1000)}@qa-usahaku.com"
    registered = client.post(f"{BASE_URL}/api/auth/register", json={
        "name": "TEST Trial", "email": email, "password": "TestPass123!"
    })
    assert registered.status_code == 200
    data = registered.json()
    assert data["subscriptionStatus"] == "TRIAL_ACTIVE"
    assert data["trialStartDate"] and data["trialEndDate"]
    assert "password" not in data and "password_hash" not in data
    assert "access_token" in client.cookies
    assert client.get(f"{BASE_URL}/api/auth/me").json()["email"] == email
    bad = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad.status_code == 401


def test_trial_one_website_product_persistence_and_image_limit(trial_client):
    payload = {"businessName": "TEST Kopi", "category": "Coffee Shop", "description": "Kopi lokal"}
    created = trial_client.post(f"{BASE_URL}/api/websites", json=payload)
    assert created.status_code == 200, created.text
    website = created.json()
    fetched = trial_client.get(f"{BASE_URL}/api/websites/{website['id']}")
    assert fetched.status_code == 200 and fetched.json()["businessName"] == "TEST Kopi"
    product = trial_client.post(f"{BASE_URL}/api/websites/{website['id']}/products", json={
        "name": "TEST Espresso", "price": 18000, "images": ["a.jpg", "b.jpg", "c.jpg"]
    })
    assert product.status_code == 200 and product.json()["name"] == "TEST Espresso"
    too_many = trial_client.post(f"{BASE_URL}/api/websites/{website['id']}/products", json={
        "name": "Too many", "images": ["1", "2", "3", "4"]
    })
    assert too_many.status_code == 400
    second = trial_client.post(f"{BASE_URL}/api/websites", json={"businessName": "TEST Second"})
    assert second.status_code == 403


def test_admin_isolated_from_normal_user(trial_client):
    normal = trial_client.get(f"{BASE_URL}/api/admin/overview")
    assert normal.status_code == 403
    admin = requests.Session()
    login = admin.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert login.status_code == 200 and login.json()["role"] == "ADMIN"
    overview = admin.get(f"{BASE_URL}/api/admin/overview")
    assert overview.status_code == 200 and "totalUsers" in overview.json()


def test_protected_upload_rejects_unauthenticated_and_bad_type(client):
    unauth = client.post(f"{BASE_URL}/api/uploads", files={"file": ("x.exe", b"x", "application/octet-stream")})
    assert unauth.status_code == 401
    auth = requests.Session()
    auth.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    bad = auth.post(f"{BASE_URL}/api/uploads", files={"file": ("x.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 400
