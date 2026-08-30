"""
WhatsApp service — pembungkus (wrapper) API GoWA
(https://github.com/aldinokemal/go-whatsapp-web-multidevice)

Aturan penting:
- Fungsi kirim TIDAK PERNAH melempar exception. Semua kegagalan dicatat ke
  koleksi `wa_logs` dan dikembalikan sebagai dict {"ok": False, "error": ...}.
  Checkout / approve / webhook TIDAK BOLEH gagal karena WA mati.
- Nomor dinormalisasi otomatis: 08xx -> 628xx.

Konfigurasi via backend/.env:
  GOWA_BASE_URL=http://localhost:3000
  GOWA_USER=admin
  GOWA_PASS=admin123
  ADMIN_WA_NUMBER=628xxxxxxxxxx
  WHATSAPP_WEBHOOK_SECRET=rahasia_webhook
"""

import os
import re
import base64
import hmac
import hashlib
import logging
from datetime import datetime, timezone

import httpx
import asyncio

log = logging.getLogger("usahaku.wa")

GOWA_BASE_URL = os.environ.get("GOWA_BASE_URL", "http://localhost:3000").rstrip("/")
GOWA_USER = os.environ.get("GOWA_USER", "admin")
GOWA_PASS = os.environ.get("GOWA_PASS", "admin123")
ADMIN_WA_NUMBER = os.environ.get("ADMIN_WA_NUMBER", "")
WHATSAPP_WEBHOOK_SECRET = os.environ.get("WHATSAPP_WEBHOOK_SECRET", "")
GOWA_DEVICE_ID = os.environ.get("GOWA_DEVICE_ID", "usahaku")

WA_TIMEOUT = float(os.environ.get("WA_TIMEOUT", "15"))


def _headers(extra: dict = None) -> dict:
    """Header dasar + scoping device (GoWA >= v9 multi-device)."""
    h = {"X-Device-Id": GOWA_DEVICE_ID}
    if extra:
        h.update(extra)
    return h


async def ensure_device() -> str:
    """Pastikan ada device terdaftar di GoWA v9; kembalikan device_id."""
    try:
        async with httpx.AsyncClient(timeout=WA_TIMEOUT) as c:
            r = await c.get(f"{GOWA_BASE_URL}/devices", auth=_auth())
            data = r.json() if r.status_code == 200 else {}
            results = data.get("results") or []
            if results:
                return results[0].get("id", "")
            # belum ada device -> buat
            r2 = await c.post(f"{GOWA_BASE_URL}/devices", auth=_auth(),
                              json={"name": GOWA_DEVICE_ID})
            d2 = r2.json() if r2.status_code < 300 else {}
            return (d2.get("results") or {}).get("id", "")
    except Exception as e:
        log.warning("ensure_device gagal: %s", e)
        return ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_number(raw: str) -> str:
    """
    Normalisasi nomor Indonesia ke format internasional tanpa '+'.
      08123456789        -> 628123456789
      +62 812-3456-789   -> 628123456789
      62812xxx@s.whats.. -> 62812xxx
    Mengembalikan string kosong bila tidak valid.
    """
    if not raw:
        return ""
    num = re.sub(r"\D", "", str(raw).split("@")[0])
    if not num:
        return ""
    if num.startswith("0"):
        num = "62" + num[1:]
    elif num.startswith("8"):
        num = "62" + num
    return num


def _auth() -> tuple:
    return (GOWA_USER, GOWA_PASS)


async def _log_wa(db, *, event: str, target: str, message: str, ok: bool,
                  error: str = "", ref_id: str = "", direction: str = "OUT",
                  extra: dict = None):
    """Catat setiap percobaan kirim ke wa_logs (untuk panel admin & resend)."""
    try:
        doc = {
            "id": os.urandom(8).hex(),
            "event": event,
            "target": target,
            "message": message[:2000],
            "status": "sent" if ok else "failed",
            "error": error[:500],
            "refId": ref_id,
            "direction": direction,
            "createdAt": now_iso(),
        }
        if extra:
            doc.update(extra)
        await db["wa_logs"].insert_one(doc)
    except Exception as e:  # logging DB tidak boleh bikin crash
        log.warning("wa_log insert gagal: %s", e)


# ------------------------------------------------------------------
# API GoWA dasar
# ------------------------------------------------------------------

async def app_status() -> dict:
    """Cek status koneksi. GoWA v9: GET /devices/{id}/status; fallback /app/status."""
    try:
        device_id = await ensure_device()
        async with httpx.AsyncClient(timeout=WA_TIMEOUT) as c:
            if device_id:
                r = await c.get(f"{GOWA_BASE_URL}/devices/{device_id}/status", auth=_auth())
                data = r.json() if r.status_code == 200 else {}
                results = data.get("results") or {}
                state = str(results.get("state", "")).lower()
                connected = bool(
                    results.get("is_connected")
                    or results.get("is_logged_in")
                    or state in ("connected", "logged_in", "loggedin")
                )
                return {"ok": True, "connected": connected,
                        "state": state or ("connected" if connected else "disconnected"),
                        "deviceId": device_id, "raw": data}
            # fallback lama (GoWA < v9)
            r = await c.get(f"{GOWA_BASE_URL}/app/status", auth=_auth(), headers=_headers())
            data = r.json() if r.status_code == 200 else {}
            connected = bool(data.get("connected") or data.get("data", {}).get("connected"))
            return {"ok": True, "connected": connected, "raw": data}
    except Exception as e:
        return {"ok": False, "connected": False, "error": str(e), "raw": {}}


async def login_qr() -> dict:
    """Minta QR login. GoWA v9: GET /devices/{id}/login -> qr_link (URL PNG).
    Gambar QR diunduh server-side (dengan Basic Auth) lalu dikirim sebagai
    base64 supaya browser TIDAK perlu login ke GoWA langsung."""
    try:
        device_id = await ensure_device()
        async with httpx.AsyncClient(timeout=60) as c:
            if device_id:
                r = await c.get(f"{GOWA_BASE_URL}/devices/{device_id}/login", auth=_auth())
                data = r.json() if r.status_code == 200 else {}
                results = data.get("results") or {}
                qr_link = results.get("qr_link", "")
                qr_b64 = ""
                if qr_link:
                    try:
                        img = await c.get(qr_link, auth=_auth())
                        if img.status_code == 200:
                            qr_b64 = base64.b64encode(img.content).decode()
                    except Exception as e:
                        log.warning("gagal unduh gambar QR: %s", e)
                return {"ok": True, "qr": qr_b64, "qr_b64": qr_b64,
                        "qr_link": qr_link,
                        "qr_duration": results.get("qr_duration"), "deviceId": device_id,
                        "raw": {"code": data.get("code"), "message": data.get("message")}}
            # fallback lama
            r = await c.get(f"{GOWA_BASE_URL}/app/login", auth=_auth(), headers=_headers())
            try:
                data = r.json()
            except Exception:
                data = {}
            qr = ""
            node = data.get("data", data)
            for key in ("qr", "qr_link"):
                val = node.get(key) if isinstance(node, dict) else None
                if isinstance(val, str) and len(val) > 20:
                    qr = val
                    break
            return {"ok": True, "qr": qr, "qr_b64": "", "qr_link": "", "raw": data}
    except Exception as e:
        return {"ok": False, "qr": "", "qr_b64": "", "qr_link": "", "error": str(e)}


async def logout() -> dict:
    try:
        device_id = await ensure_device()
        async with httpx.AsyncClient(timeout=WA_TIMEOUT) as c:
            if device_id:
                r = await c.post(f"{GOWA_BASE_URL}/devices/{device_id}/logout", auth=_auth())
            else:
                r = await c.post(f"{GOWA_BASE_URL}/app/logout", auth=_auth(), headers=_headers())
            return {"ok": r.status_code < 400, "code": r.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def send_text(db, to: str, message: str, *, event: str = "message",
                    ref_id: str = "", record: bool = True) -> dict:
    """POST /send/message. Tidak pernah raise."""
    target = normalize_number(to)
    result = {"ok": False, "target": target, "error": ""}
    if not target:
        result["error"] = "nomor tujuan kosong/tidak valid"
        if record:
            await _log_wa(db, event=event, target=target, message=message, ok=False,
                          error=result["error"], ref_id=ref_id)
        return result
    try:
        async with httpx.AsyncClient(timeout=WA_TIMEOUT) as c:
            r = await c.post(
                f"{GOWA_BASE_URL}/send/message",
                auth=_auth(),
                json={"phone": target, "message": message}, headers=_headers(),
            )
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = 200 <= r.status_code < 300 and not body.get("error")
            result.update({"ok": ok, "response": body})
            if not ok:
                result["error"] = f"HTTP {r.status_code}: {str(body)[:200]}"
    except Exception as e:
        result["error"] = str(e)

    if record:
        await _log_wa(db, event=event, target=target, message=message,
                      ok=result["ok"], error=result.get("error", ""), ref_id=ref_id)
    return result


async def send_image_url(db, to: str, image_url: str, caption: str = "",
                         *, event: str = "image", ref_id: str = "") -> dict:
    """POST /send/image dengan sumber URL. Tidak pernah raise."""
    target = normalize_number(to)
    result = {"ok": False, "target": target, "error": ""}
    if not target:
        result["error"] = "nomor tujuan kosong/tidak valid"
        await _log_wa(db, event=event, target=target, message=caption, ok=False,
                      error=result["error"], ref_id=ref_id)
        return result
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{GOWA_BASE_URL}/send/image",
                auth=_auth(),
                headers=_headers(), json={"phone": target, "caption": caption, "url": image_url,
                      "view_once": False},
            )
            body = {}
            try:
                body = r.json()
            except Exception:
                pass
            ok = 200 <= r.status_code < 300 and not body.get("error")
            result.update({"ok": ok, "response": body})
            if not ok:
                result["error"] = f"HTTP {r.status_code}: {str(body)[:200]}"
    except Exception as e:
        result["error"] = str(e)

    await _log_wa(db, event=event, target=target, message=caption,
                  ok=result["ok"], error=result.get("error", ""), ref_id=ref_id)
    return result


async def download_media(message_id: str):
    """GET /message/{id}/download -> bytes atau None."""
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.get(f"{GOWA_BASE_URL}/message/{message_id}/download", auth=_auth(), headers=_headers())
            if r.status_code == 200:
                ctype = r.headers.get("content-type", "application/octet-stream")
                return r.content, ctype
    except Exception as e:
        log.warning("download_media gagal: %s", e)
    return None


# ------------------------------------------------------------------
# Webhook signature
# ------------------------------------------------------------------

def verify_webhook_signature(raw_body: bytes, header_value: str) -> bool:
    """Validasi X-Hub-Signature-256 (= sha256=<hex>) bila secret diset.
    Bila header tidak ada / secret kosong -> True (mode toleran)."""
    if not WHATSAPP_WEBHOOK_SECRET:
        return True
    if not header_value:
        return False
    expected = "sha256=" + hmac.new(
        WHATSAPP_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header_value)


def verify_webhook_secret_param(secret_param: str) -> bool:
    """Alternatif validasi via query ?secret=..."""
    if not WHATSAPP_WEBHOOK_SECRET:
        return True
    return hmac.compare_digest(WHATSAPP_WEBHOOK_SECRET, secret_param or "")


# ------------------------------------------------------------------
# Notifikasi level aplikasi (dipanggil dari alur bisnis)
# ------------------------------------------------------------------

async def notify_admin(db, text: str, *, event: str, ref_id: str = ""):
    """Kirim pesan ke nomor admin (ADMIN_WA_NUMBER). Tidak pernah raise."""
    if not ADMIN_WA_NUMBER:
        await _log_wa(db, event=event, target="", message=text, ok=False,
                      error="ADMIN_WA_NUMBER belum diset", ref_id=ref_id)
        return
    await send_text(db, ADMIN_WA_NUMBER, text, event=event, ref_id=ref_id)


def fire_and_forget(coro):
    """Jalankan coroutine di background; error ditelan agar request utama aman."""
    try:
        asyncio.get_running_loop().create_task(_swallow(coro))
    except RuntimeError:
        log.warning("fire_and_forget dipanggil tanpa event loop aktif")


async def _swallow(coro):
    try:
        await coro
    except Exception as e:
        log.warning("background WA task gagal: %s", e)


# ------------------------------------------------------------------
# Broadcast (jeda acak 3-8 detik antar pesan, anti-banned)
# ------------------------------------------------------------------

async def broadcast(db, broadcast_id: str, numbers: list, message: str):
    """Kirim massal berurutan dengan jeda acak. Dijalankan sebagai background task."""
    import random
    total = len(numbers)
    for i, raw in enumerate(numbers):
        target = normalize_number(raw)
        if i > 0:
            delay = random.uniform(3.0, 8.0)
            await asyncio.sleep(delay)
        res = await send_text(db, raw, message, event=f"broadcast:{broadcast_id}",
                              ref_id=broadcast_id, record=True)
        # update progress dokumen broadcast
        try:
            await db["wa_broadcasts"].update_one(
                {"id": broadcast_id},
                {"$set": {"sentCount": i + 1,
                          "lastStatus": "sent" if res.get("ok") else "failed",
                          "updatedAt": now_iso()},
                 "$inc": {"failCount": 0 if res.get("ok") else 1}},
            )
        except Exception as e:
            log.warning("broadcast progress update gagal: %s", e)
    try:
        await db["wa_broadcasts"].update_one({"id": broadcast_id},
                                             {"$set": {"done": True, "total": total,
                                                       "finishedAt": now_iso()}})
    except Exception:
        pass

