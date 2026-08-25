"""Seed helper: creates an expired-trial user with a published website for UI maintenance testing."""
import sys
from datetime import datetime, timezone, timedelta

import requests
from pymongo import MongoClient
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
be = dotenv_values("/app/backend/.env")
API = fe["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]

email = sys.argv[1] if len(sys.argv) > 1 else "qa_expired@qa-usahaku.com"
pwd = "TestPass123!"
s = requests.Session()
r = s.post(f"{API}/auth/register", json={"name": "QA Expired Owner", "email": email, "password": pwd})
if r.status_code == 409:
    s.post(f"{API}/auth/login", json={"email": email, "password": pwd})
w = s.get(f"{API}/websites").json()
if not w:
    w = [s.post(f"{API}/websites", json={"businessName": "QA Warung Maintenance", "whatsapp": "628999888777", "city": "Semarang"}).json()]
site_id = w[0]["id"]
slug = s.post(f"{API}/websites/{site_id}/publish").json()["slug"]
db.users.update_one({"email": email}, {"$set": {
    "subscriptionStatus": "TRIAL_ACTIVE",
    "trialEndDate": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
}})
print("email:", email, "slug:", slug)
print("public:", requests.get(f"{API}/public/{slug}").json())
