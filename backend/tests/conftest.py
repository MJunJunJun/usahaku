import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = BASE_URL + "/api"


def creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def admin_credentials():
    return creds()


@pytest.fixture(scope="session")
def admin_client(admin_credentials):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=admin_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return s


def new_user(session=None):
    s = session or requests.Session()
    email = f"test_{uuid.uuid4().hex[:10]}@qa-usahaku.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": "TestPass123!"}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Register failed {r.status_code}: {r.text[:300]}")
    return s, r.json(), email


@pytest.fixture
def user_client():
    s, user, email = new_user()
    yield s, user
