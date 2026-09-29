"""Isolated local UI preview: python tools/preview_billing.py (requires frontend build).

Open http://127.0.0.1:3015/__preview/user or /__preview/admin.
Only synthetic data in a disposable local MongoDB database; no external services.
"""
import asyncio
import os
import sys
import tempfile
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[1]
NAME = "situska_billing_preview_" + uuid.uuid4().hex
UPLOADS = tempfile.TemporaryDirectory(prefix="situska-billing-preview-")
os.environ.update(MONGO_URL="mongodb://127.0.0.1:27017", DB_NAME=NAME,
    UPLOAD_DIR=UPLOADS.name, EMERGENT_LLM_KEY="", JWT_SECRET=uuid.uuid4().hex,
    REQUIRE_DISTRIBUTED_RATE_LIMIT="false", REQUIRE_ADMIN_MFA="false", COOKIE_SECURE="false", COOKIE_DOMAIN="")
sys.path.insert(0, str(ROOT / "backend"))
import uvicorn
from fastapi.responses import FileResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient
import server


@server.app.middleware("http")
async def local_preview(request, call_next):
    path = request.url.path
    if path in ("/__preview/user", "/__preview/admin"):
        admin = path.endswith("admin")
        response = RedirectResponse("/admin/payment-requests" if admin else "/dashboard/subscription")
        server.set_auth_cookie(response, request, server.token("preview-admin" if admin else "preview-user"))
        return response
    if path.startswith("/api/"):
        return await call_next(request)
    build = (ROOT / "frontend/build").resolve()
    asset = (build / path.lstrip("/")).resolve()
    if not asset.is_relative_to(build) or not asset.is_file():
        asset = build / "index.html"
    return FileResponse(asset)


async def main():
    mongo = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = mongo[NAME]; server.db_proxy.set_db(db)
    now = datetime.now(timezone.utc)
    for uid, role in [("preview-user", "USER"), ("preview-admin", "ADMIN")]:
        await db.users.insert_one({"id": uid, "name": "Pengguna Preview" if role == "USER" else "Admin Preview", "email": f"{uid}@example.test", "role": role,
            "accountStatus": "ACTIVE", "subscriptionStatus": "ACTIVE", "walletBalance": 0,
            "createdAt": now.isoformat(), "waVerified": True, "whatsapp": "628000000000", "trialUsed": True})
    await db.settings.insert_one({"id": "platform", "bankName": "BRI (contoh)", "accountName": "Situska Preview", "accountNumber": "000000000000", "adminWhatsapp": "628000000000"})
    await db.websites.insert_one({"id": "preview-site", "userId": "preview-user", "businessName": "Kopi Senja", "status": "DRAFT", "slug": "preview-kopi", "createdAt": now.isoformat(), "cardId": "preview-card"})
    await db.cards.insert_one({"id": "preview-card", "userId": "preview-user", "name": "Kopi Senja", "websiteId": "preview-site", "expiresAt": (now+timedelta(days=13)).isoformat(), "isTrialCard": True, "autoRenew": True, "createdAt": now.isoformat()})
    print(f"Local preview database: {NAME}", flush=True)
    try:
        await uvicorn.Server(uvicorn.Config(server.app, host="127.0.0.1", port=3015, lifespan="off", log_level="warning")).serve()
    finally:
        await mongo.drop_database(NAME); mongo.close(); UPLOADS.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
