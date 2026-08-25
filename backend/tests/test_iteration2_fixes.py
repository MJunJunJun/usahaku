"""Iteration 2 fix verification: PDF proof contentType + owner-access refresh_status."""
import datetime
import io
import os

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

from conftest import API, new_user

benv = dotenv_values("/app/backend/.env")
_mc = MongoClient(benv["MONGO_URL"])
_db = _mc[benv["DB_NAME"]]

MIN_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


# FIX 1: PDF proof detection via proofContentType
class TestProofContentType:
    def test_pdf_proof_returns_pdf_content_type(self, admin_client):
        s, user, email = new_user()
        up = s.post(f"{API}/uploads", files={"file": ("bukti.pdf", io.BytesIO(MIN_PDF), "application/pdf")}, timeout=60)
        assert up.status_code == 200, up.text[:300]
        proof_url = up.json()["url"]
        assert proof_url.startswith("/api/uploads/")

        pay = s.post(f"{API}/payments", json={
            "planSlug": "premium-1",
            "transferDate": datetime.date.today().isoformat(),
            "proofUrl": proof_url,
            "notes": "TEST pdf proof",
        }, timeout=30)
        assert pay.status_code == 200, pay.text[:300]
        pid = pay.json()["id"]

        # user-side detail
        got = s.get(f"{API}/payments/{pid}", timeout=30)
        assert got.status_code == 200
        assert got.json().get("proofContentType") == "application/pdf", got.json()

        # user-side list
        mine = s.get(f"{API}/payments/mine", timeout=30)
        assert mine.status_code == 200
        assert mine.json()[0].get("proofContentType") == "application/pdf"

        # admin-side detail
        adm = admin_client.get(f"{API}/admin/payments/{pid}", timeout=30)
        assert adm.status_code == 200, adm.text[:300]
        assert adm.json().get("proofContentType") == "application/pdf", adm.json()

    def test_image_proof_returns_image_content_type(self, admin_client):
        s, user, email = new_user()
        up = s.post(f"{API}/uploads", files={"file": ("bukti.png", io.BytesIO(PNG), "image/png")}, timeout=60)
        assert up.status_code == 200, up.text[:300]
        pay = s.post(f"{API}/payments", json={
            "planSlug": "premium-1",
            "transferDate": datetime.date.today().isoformat(),
            "proofUrl": up.json()["url"],
        }, timeout=30)
        assert pay.status_code == 200
        pid = pay.json()["id"]
        adm = admin_client.get(f"{API}/admin/payments/{pid}", timeout=30)
        assert adm.status_code == 200
        assert adm.json().get("proofContentType") == "image/png"


# FIX 7: owner-access must refresh status (no stale TRIAL_ACTIVE)
class TestOwnerAccessRefresh:
    def test_owner_access_reports_trial_expired_without_prior_auth_me(self):
        s, user, email = new_user()
        c = s.post(f"{API}/websites", json={"businessName": "TEST OwnerRefresh", "category": "Kuliner"}, timeout=30)
        assert c.status_code == 200, c.text[:300]
        sid = c.json()["id"]
        slug = f"test-owner-refresh-{sid[:8]}"
        p = s.post(f"{API}/websites/{sid}/publish", json={"slug": slug}, timeout=30)
        assert p.status_code == 200, p.text[:300]
        slug = p.json()["slug"]

        past = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)).isoformat()
        _db.users.update_one({"id": user["id"]}, {"$set": {"trialEndDate": past}})
        assert _db.users.find_one({"id": user["id"]})["subscriptionStatus"] == "TRIAL_ACTIVE"

        # fresh session (login) -> straight to owner-access, no /auth/me first
        s2 = requests.Session()
        lr = s2.post(f"{API}/auth/login", json={"email": email, "password": "TestPass123!"}, timeout=30)
        assert lr.status_code == 200
        oa = s2.get(f"{API}/owner-access/{slug}", timeout=30)
        assert oa.status_code == 200, oa.text[:300]
        assert oa.json()["owner"]["subscriptionStatus"] == "TRIAL_EXPIRED", oa.json()
        assert oa.json()["owner"]["trialEndDate"], "trialEndDate must be present for the UI date"

        # and the public site is in maintenance
        pub = requests.get(f"{API}/public/{slug}", timeout=30)
        assert pub.status_code == 200
        assert pub.json().get("maintenance") is True
