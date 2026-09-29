"""Real MongoDB + ASGI integration tests; uses an isolated, disposable LOCAL database.

Run: python tools/test_billing_flow.py
No production credentials, startup jobs, cloud uploads, or WhatsApp sends are used.
"""
import asyncio
import io
import os
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

TEST_DB = "situska_billing_test_" + uuid.uuid4().hex
UPLOADS = tempfile.TemporaryDirectory(prefix="situska-billing-test-")
os.environ.update(MONGO_URL="mongodb://127.0.0.1:27017", DB_NAME=TEST_DB,
                  UPLOAD_DIR=UPLOADS.name, EMERGENT_LLM_KEY="", JWT_SECRET="local-test-only",
                  REQUIRE_DISTRIBUTED_RATE_LIMIT="false", COOKIE_SECURE="false", COOKIE_DOMAIN="")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import httpx
from PIL import Image
from motor.motor_asyncio import AsyncIOMotorClient
import server


class BillingFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=2000)
        self.db = self.mongo[TEST_DB]
        await self.mongo.drop_database(TEST_DB)
        server.db_proxy.set_db(self.db)
        self.user = {"id": "customer", "name": "Customer Test", "email": "billing@example.test", "role": "USER", "walletBalance": 0}
        self.admin = {"id": "admin-test", "name": "Admin", "email": "admin@example.test", "role": "ADMIN"}
        await self.db.users.insert_many([dict(self.user), dict(self.admin)])
        await self.db.settings.insert_one({"id": "platform", "adminWhatsapp": "628000000000", "bankName": "Bank Test", "accountNumber": "000000", "accountName": "Test"})
        async def user_override(): return self.user
        async def admin_override(): return self.admin
        server.app.dependency_overrides[server.current_user] = user_override
        server.app.dependency_overrides[server.admin_user] = admin_override
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://testserver",
                                      cookies={"csrf_token": "billing-test"}, headers={"X-CSRF-Token": "billing-test"})

    async def asyncTearDown(self):
        await self.http.aclose()
        server.app.dependency_overrides.clear()
        await self.mongo.drop_database(TEST_DB)
        self.mongo.close()

    async def invoice(self, amount=100000, submitted=False):
        r = await self.http.post("/api/wallet/topup", json={"amount": amount})
        self.assertEqual(r.status_code, 200, r.text)
        pid = r.json()["payment"]["id"]
        if submitted:
            await self.upload(pid)
            r = await self.http.post(f"/api/payments/{pid}/submit")
            self.assertEqual(r.status_code, 200, r.text)
        return pid

    async def upload(self, pid, fmt="PNG"):
        buf = io.BytesIO(); Image.new("RGB", (12, 12), "white").save(buf, format=fmt)
        ext, mime = ("jpg", "image/jpeg") if fmt == "JPEG" else ("png", "image/png")
        r = await self.http.post(f"/api/payments/{pid}/proof", files={"file": (f"proof.{ext}", buf.getvalue(), mime)})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    async def approve(self, pid, amount=None, note=""):
        payload = {"note": note}
        if amount is not None: payload["approvedAmount"] = amount
        return await self.http.post(f"/api/admin/payments/{pid}/approve", json=payload)

    async def test_invoice_draft_delete_replace_submit_and_lock(self):
        pid = await self.invoice()
        history = (await self.http.get("/api/payments/mine")).json()
        self.assertEqual(history[0]["status"], "AWAITING_PAYMENT")
        self.assertEqual(history[0]["userName"], "Customer Test")
        self.assertEqual((await self.http.post(f"/api/payments/{pid}/submit")).status_code, 400)
        first = await self.upload(pid)
        self.assertEqual(first["status"], "PROOF_DRAFT")
        self.assertEqual((await self.http.get(f"/api/payments/{pid}")).json()["proofUrl"], first["proofUrl"])
        self.assertEqual((await self.http.delete(f"/api/payments/{pid}/proof")).json()["status"], "AWAITING_PAYMENT")
        second = await self.upload(pid, "JPEG")
        self.assertNotEqual(first["proofUrl"], second["proofUrl"])
        self.assertEqual((await self.http.post(f"/api/payments/{pid}/submit")).json()["status"], "PENDING")
        self.assertEqual((await self.http.delete(f"/api/payments/{pid}/proof")).status_code, 409)
        self.assertEqual((await self.http.post(f"/api/payments/{pid}/submit")).status_code, 409)

    async def test_reject_pdf_webp_disguised_and_oversize(self):
        pid = await self.invoice()
        for name, body, mime in [("proof.pdf", b"%PDF-1.4", "application/pdf"), ("proof.webp", b"RIFF0000WEBP", "image/webp"), ("proof.png", b"%PDF-1.4", "image/png"), ("proof.jpg", b"\xff\xd8\xffgarbage", "image/jpeg")]:
            r = await self.http.post(f"/api/payments/{pid}/proof", files={"file": (name, body, mime)})
            self.assertEqual(r.status_code, 400, (name, r.text))
        r = await self.http.post(f"/api/payments/{pid}/proof", files={"file": ("large.png", b"x" * (8*1024*1024+1), "image/png")})
        self.assertEqual(r.status_code, 413)

    async def test_whatsapp_server_timer_survives_reload(self):
        pid = await self.invoice(submitted=True)
        self.assertEqual((await self.http.get(f"/api/payments/{pid}/whatsapp")).status_code, 409)
        before = (await self.http.get(f"/api/payments/{pid}")).json()["waAvailableAt"]
        self.assertEqual(before, (await self.http.get(f"/api/payments/{pid}")).json()["waAvailableAt"])
        await self.db.payments.update_one({"id": pid}, {"$set": {"submittedAt": (datetime.now(timezone.utc)-timedelta(minutes=6)).isoformat()}})
        self.assertEqual((await self.http.get(f"/api/payments/{pid}/whatsapp")).status_code, 200)
        await self.approve(pid)
        self.assertEqual((await self.http.get(f"/api/payments/{pid}/whatsapp")).status_code, 409)

    async def test_bonus_separate_and_repeat_approval_safe(self):
        pid = await self.invoice(submitted=True)
        r = await self.approve(pid); self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((await self.approve(pid)).status_code, 200)
        wallet = (await self.http.get("/api/wallet")).json()
        self.assertEqual(wallet["balance"], 150000)
        txs = {t["type"]: t for t in wallet["transactions"]}
        self.assertEqual(len(wallet["transactions"]), 2)
        self.assertEqual(txs["TOPUP"]["amount"], 100000)
        self.assertEqual(txs["BONUS"]["amount"], 50000)
        self.assertEqual(txs["BONUS"]["note"], "Bonus pengguna pertama")
        second = await self.invoice(submitted=True); await self.approve(second)
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 250000)

    async def test_adjusted_amount_and_first_small_topup_consumes_bonus(self):
        pid = await self.invoice(50000, submitted=True)
        self.assertEqual((await self.approve(pid, 45000)).status_code, 400)
        self.assertEqual((await self.approve(pid, 45000, "Transfer diterima Rp45.000")).status_code, 200)
        p = (await self.http.get(f"/api/payments/{pid}")).json()
        self.assertEqual(p["amount"], 50000); self.assertEqual(p["approvedAmount"], 45000)
        self.assertEqual(p["bonusAmount"], 0)
        second = await self.invoice(submitted=True); await self.approve(second)
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 145000)

    async def test_two_concurrent_topups_one_bonus(self):
        ids = [await self.invoice(submitted=True), await self.invoice(submitted=True)]
        results = await asyncio.gather(*(self.approve(pid) for pid in ids))
        for r in results: self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 250000)
        self.assertEqual(await self.db.wallet_transactions.count_documents({"type": "BONUS"}), 1)

    async def test_concurrent_duplicate_approval(self):
        pid = await self.invoice(submitted=True)
        results = await asyncio.gather(*(self.approve(pid) for _ in range(5)))
        self.assertTrue(all(r.status_code in (200, 409) for r in results), [r.text for r in results])
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 150000)
        self.assertEqual(await self.db.wallet_transactions.count_documents({}), 2)

    async def test_revision_and_resubmit_restarts_timer(self):
        pid = await self.invoice(submitted=True)
        self.assertEqual((await self.http.post(f"/api/admin/payments/{pid}/revision", json={"reason": "Gambar kurang jelas"})).status_code, 200)
        self.assertEqual((await self.approve(pid)).status_code, 409)
        await self.upload(pid)
        r = await self.http.post(f"/api/payments/{pid}/submit")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((await self.http.get(f"/api/payments/{pid}/whatsapp")).status_code, 409)
        p = await self.db.payments.find_one({"id": pid})
        self.assertEqual(len(p["proofHistory"]), 2)

    async def test_ownership_and_unsubmitted_approval(self):
        pid = await self.invoice()
        self.assertEqual((await self.approve(pid)).status_code, 409)
        self.user = {"id": "outsider", "role": "USER"}
        self.assertEqual((await self.http.get(f"/api/payments/{pid}")).status_code, 404)
        self.assertEqual((await self.http.delete(f"/api/payments/{pid}/proof")).status_code, 404)

    async def test_wallet_correction_is_separate_no_bonus(self):
        r = await self.http.post("/api/admin/monetization/wallet", json={"userId": "customer", "amount": 100000, "note": "Koreksi", "bonus": True})
        self.assertEqual(r.status_code, 200, r.text)
        wallet = (await self.http.get("/api/wallet")).json()
        self.assertEqual(wallet["balance"], 100000); self.assertEqual(wallet["transactions"][0]["type"], "ADJUST")
        self.assertFalse(wallet["bonusClaimed"])
        r = await self.http.post("/api/admin/monetization/wallet", json={"userId": "customer", "amount": -150000, "note": "Koreksi"})
        self.assertEqual(r.status_code, 400)

    async def test_interrupted_settlement_resumes_without_extra_credit(self):
        pid = await self.invoice(submitted=True)
        await self.db.payments.update_one({"id": pid}, {"$set": {"status": "PROCESSING", "approvedAmount": 100000}})
        p = await self.db.payments.find_one({"id": pid})
        await server.monetization.settle_topup(p)
        await self.db.wallet_transactions.delete_many({"refId": pid})
        self.assertEqual((await self.approve(pid)).status_code, 200)
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 150000)
        self.assertEqual(await self.db.wallet_transactions.count_documents({}), 2)

    async def test_auto_renew_is_monthly_and_debits_once_per_expiry_cycle(self):
        now = datetime.now(timezone.utc)
        await self.db.users.update_one({"id": "customer"}, {"$set": {"walletBalance": 60000}})
        card = {"id": "renew-card", "userId": "customer", "name": "Kopi Test", "websiteId": "site-renew",
                "expiresAt": (now - timedelta(minutes=1)).isoformat(), "autoRenew": True,
                "planMonths": 12, "planPrice": 450000, "createdAt": now.isoformat()}
        await self.db.cards.insert_one(card)
        first = await server.monetization.renew_card(self.user, card)
        self.assertIsNotNone(first)
        fresh = await self.db.cards.find_one({"id": "renew-card"}, {"_id": 0})
        self.assertEqual(fresh["planMonths"], 1)
        self.assertEqual(fresh["planPrice"], 50000)
        self.assertGreater(server.monetization.card_view(fresh)["daysRemaining"], 29)
        self.assertIsNone(await server.monetization.renew_card(self.user, fresh))
        self.assertEqual((await self.http.get("/api/wallet")).json()["balance"], 10000)
        txs = await self.db.wallet_transactions.find({"type": "AUTORENEW"}).to_list(10)
        self.assertEqual(len(txs), 1)


if __name__ == "__main__":
    try:
        unittest.main(verbosity=2)
    finally:
        UPLOADS.cleanup()
