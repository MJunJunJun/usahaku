# helper payload to insert into server.py

check_wa_handler = '''
@api.post("/auth/check-wa")
async def check_wa(payload: dict):
    """Check whether a WhatsApp number is already registered. Returns 409 if taken."""
    phone_raw = payload.get("phone") if isinstance(payload, dict) else getattr(payload, "phone", "")
    phone = wa_service.normalize_number(phone_raw)
    if not phone:
        raise HTTPException(400, "Nomor WhatsApp tidak valid")
    # Scan users collection and compare normalized numbers to avoid format mismatch
    async for u in db.users.find({}, {"whatsapp": 1}):
        if wa_service.normalize_number(u.get("whatsapp", "")) == phone:
            raise HTTPException(409, "Nomor WhatsApp sudah terdaftar")
    return {"ok": True}
'''

print('ok')
