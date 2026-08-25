from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, re, secrets, logging, json, requests, bcrypt, jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
app = FastAPI(title="UsahaKu API")
api = APIRouter(prefix="/api")
log = logging.getLogger("usahaku")
JWT_ALGORITHM = "HS256"
TRIAL_DAYS = 30
ADDITIONAL_WEBSITE_PRICE = 25000
storage_key = None
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

DEFAULT_PLANS = [
    {"id": "trial", "slug": "trial", "name": "Trial Gratis", "monthlyPrice": 0, "websiteLimit": 1, "features": ["1 website", "AI generation", "Katalog produk", "WhatsApp & Google Maps"], "isActive": True, "isDefault": True, "allowsAdditional": False},
    {"id": "basic", "slug": "basic", "name": "Basic", "monthlyPrice": 50000, "websiteLimit": 1, "features": ["1 website", "AI generation & editing", "Katalog tanpa batas", "Dukungan prioritas"], "isActive": True, "allowsAdditional": False},
    {"id": "premium", "slug": "premium", "name": "Premium", "monthlyPrice": 100000, "websiteLimit": 3, "features": ["3 website", "AI generation & editing", "Katalog tanpa batas", "Dukungan prioritas"], "isActive": True, "allowsAdditional": False},
    {"id": "platinum", "slug": "platinum", "name": "Platinum", "monthlyPrice": 100000, "websiteLimit": 3, "features": ["3 website + bisa ditambah", "+Rp25.000 per website tambahan", "AI generation & editing", "Dukungan prioritas"], "isActive": True, "allowsAdditional": True},
]

DEFAULT_SETTINGS = {
    "id": "platform",
    "applicationName": "UsahaKu",
    "supportEmail": "hello@usahaku.id",
    "adminWhatsapp": "6281234567890",
    "bankName": "Bank BCA",
    "accountName": "PT UsahaKu Digital Indonesia",
    "accountNumber": "1234567890",
    "paymentInstructions": "Silakan transfer sejumlah total tagihan ke rekening di atas. Setelah transfer, unggah bukti pembayaran dan hubungi admin melalui WhatsApp untuk verifikasi lebih cepat.",
    "additionalWebsitePrice": ADDITIONAL_WEBSITE_PRICE,
}

def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return str(uuid.uuid4())
def public(doc):
    if not doc: return None
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
def hash_password(value): return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()
def verify_password(value, hashed): return bcrypt.checkpw(value.encode(), hashed.encode())
def token(user_id, kind="access", days=7):
    return jwt.encode({"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + timedelta(days=days)}, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-") or "website"

async def current_user(request: Request):
    raw = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not raw: raise HTTPException(401, "Silakan masuk terlebih dahulu")
    try:
        payload = jwt.decode(raw, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sesi sudah berakhir. Silakan masuk lagi.")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user: raise HTTPException(401, "Akun tidak ditemukan")
    if user.get("accountStatus") == "SUSPENDED":
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin UsahaKu.")
    return user

async def admin_user(user=Depends(current_user)):
    if user.get("role") != "ADMIN": raise HTTPException(403, "Akses admin diperlukan")
    return user

async def refresh_status(user):
    status = user.get("subscriptionStatus")
    new_status = None
    if status == "TRIAL_ACTIVE" and user.get("trialEndDate", "") < now():
        new_status = "TRIAL_EXPIRED"
    elif status == "ACTIVE" and user.get("subscriptionExpiryDate", "") and user.get("subscriptionExpiryDate", "") < now():
        new_status = "EXPIRED"
    if new_status:
        await db.users.update_one({"id": user["id"]}, {"$set": {"subscriptionStatus": new_status}})
        user["subscriptionStatus"] = new_status
        await notify(user["id"], "Status berlangganan diperbarui", "Berlangganan atau trial Anda telah berakhir. Perpanjang untuk menghidupkan kembali website.")
    return user

def is_owner_active(user):
    return user.get("role") == "ADMIN" or user.get("subscriptionStatus") in ("TRIAL_ACTIVE", "ACTIVE")

def quota_for(user):
    if user.get("role") == "ADMIN": return 999
    if user.get("subscriptionStatus") == "ACTIVE": return int(user.get("websiteQuota", 1))
    if user.get("subscriptionStatus") == "TRIAL_ACTIVE": return int(user.get("websiteQuota", 1))
    return 0

async def notify(user_id, title, message):
    await db.notifications.insert_one({"id": uid(), "userId": user_id, "title": title, "message": message, "isRead": False, "createdAt": now()})

async def log_activity(admin_id, action, target_user_id=None, target_resource_id=None, notes=""):
    await db.activity_logs.insert_one({"id": uid(), "adminId": admin_id, "action": action, "targetUserId": target_user_id, "targetResourceId": target_resource_id, "notes": notes, "createdAt": now()})

class AuthInput(BaseModel):
    email: EmailStr
    password: str

class RegisterInput(AuthInput):
    name: str

class WebsiteInput(BaseModel):
    businessName: str
    category: str = "Lainnya"
    description: str = ""
    logoUrl: str = ""
    coverImageUrl: str = ""
    whatsapp: str = ""
    phone: str = ""
    email: str = ""
    instagram: str = ""
    facebook: str = ""
    tiktok: str = ""
    address: str = ""
    city: str = ""
    province: str = ""
    postalCode: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    customDomain: str = ""

class TrackInput(BaseModel):
    type: str  # view | whatsapp

class ProductInput(BaseModel):
    name: str
    description: str = ""
    price: float = 0
    category: str = ""
    images: List[str] = []

class AIEditInput(BaseModel):
    command: str

class ThemeInput(BaseModel):
    primary: Optional[str] = None
    accent: Optional[str] = None
    style: Optional[str] = None
    heroTitle: Optional[str] = None
    heroSubtitle: Optional[str] = None
    about: Optional[str] = None

class PaymentCreateInput(BaseModel):
    planSlug: str
    additionalWebsiteCount: int = 0
    transferDate: str = ""
    proofUrl: str = ""
    notes: str = ""
    couponCode: str = ""

class CouponInput(BaseModel):
    code: str
    discountType: str
    discountValue: float
    maxUses: Optional[int] = None
    expiresAt: Optional[str] = None
    isActive: bool = True
    description: str = ""

class PaymentRejectInput(BaseModel):
    reason: str

class PlanUpdateInput(BaseModel):
    name: Optional[str] = None
    monthlyPrice: Optional[float] = None
    websiteLimit: Optional[int] = None
    features: Optional[List[str]] = None
    isActive: Optional[bool] = None

class SettingsInput(BaseModel):
    applicationName: Optional[str] = None
    supportEmail: Optional[str] = None
    adminWhatsapp: Optional[str] = None
    bankName: Optional[str] = None
    accountName: Optional[str] = None
    accountNumber: Optional[str] = None
    paymentInstructions: Optional[str] = None
    additionalWebsitePrice: Optional[int] = None

class UserAdminAction(BaseModel):
    action: str
    reason: Optional[str] = ""
    planSlug: Optional[str] = None
    extraDays: Optional[int] = None
    additionalWebsites: Optional[int] = None

class ResetInput(BaseModel):
    token: str
    password: str

class ForgotInput(BaseModel):
    email: EmailStr

def init_storage():
    global storage_key
    if storage_key: return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key

@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Format file harus JPG, PNG, WebP, atau PDF")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Ukuran file maksimal 8MB")
    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin").lower()
    path = f"usahaku/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        key = init_storage()
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": file.content_type}, data=data, timeout=120)
        r.raise_for_status()
    except Exception as exc:
        log.exception("Upload failed")
        raise HTTPException(502, "Upload belum berhasil. Silakan coba lagi.") from exc
    record = {"id": uid(), "userId": user["id"], "storagePath": r.json().get("path", path), "contentType": file.content_type, "originalFilename": file.filename, "size": len(data), "createdAt": now()}
    await db.files.insert_one(record)
    return {"id": record["id"], "url": f"/api/uploads/{record['id']}", "contentType": file.content_type}

@api.get("/uploads/{file_id}")
async def download_file(file_id: str):
    rec = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not rec: raise HTTPException(404, "File tidak ditemukan")
    try:
        key = init_storage()
        r = requests.get(f"{STORAGE_URL}/objects/{rec['storagePath']}", headers={"X-Storage-Key": key}, timeout=60)
        r.raise_for_status()
    except Exception as exc:
        raise HTTPException(404, "File tidak tersedia") from exc
    return Response(content=r.content, media_type=rec["contentType"])

@api.get("/")
async def root(): return {"message": "UsahaKu API aktif"}

@api.get("/settings/public")
async def public_settings():
    s = await db.settings.find_one({"id": "platform"}, {"_id": 0}) or DEFAULT_SETTINGS
    return {"applicationName": s.get("applicationName"), "supportEmail": s.get("supportEmail"), "adminWhatsapp": s.get("adminWhatsapp"), "bankName": s.get("bankName"), "accountName": s.get("accountName"), "accountNumber": s.get("accountNumber"), "paymentInstructions": s.get("paymentInstructions"), "additionalWebsitePrice": s.get("additionalWebsitePrice", ADDITIONAL_WEBSITE_PRICE)}

@api.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(409, "Email sudah terdaftar")
    if len(data.password) < 6: raise HTTPException(400, "Password minimal 6 karakter")
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=TRIAL_DAYS)
    user = {"id": uid(), "name": data.name.strip(), "email": email, "password_hash": hash_password(data.password), "role": "USER", "accountStatus": "ACTIVE", "subscriptionStatus": "TRIAL_ACTIVE", "trialStartDate": start.isoformat(), "trialEndDate": end.isoformat(), "planSlug": "trial", "websiteQuota": 1, "additionalWebsiteQuota": 0, "createdAt": now()}
    await db.users.insert_one(user)
    await notify(user["id"], "Selamat datang di UsahaKu", "Trial gratis 30 hari kamu sudah aktif. Yuk buat website pertamamu!")
    response.set_cookie("access_token", token(user["id"], days=7), httponly=True, samesite="lax", max_age=7*86400, secure=True)
    return public(user)

@api.post("/auth/login")
async def login(data: AuthInput, response: Response):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email atau password salah")
    if user.get("accountStatus") == "SUSPENDED":
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin UsahaKu.")
    await refresh_status(user)
    response.set_cookie("access_token", token(user["id"], days=7), httponly=True, samesite="lax", max_age=7*86400, secure=True)
    return public(user)

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public(await refresh_status(user))

@api.post("/auth/forgot-password")
async def forgot(data: ForgotInput):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if user:
        raw = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": raw, "userId": user["id"], "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "used": False, "createdAt": now()})
        log.info("Password reset token for %s: %s", user["email"], raw)
    return {"message": "Jika email terdaftar, instruksi reset sudah dibuat.", "hint": "Cek email atau hubungi admin untuk mendapatkan link reset."}

@api.post("/auth/reset-password")
async def reset(data: ResetInput):
    rec = await db.password_reset_tokens.find_one({"token": data.token, "used": False})
    if not rec or rec.get("expiresAt", "") < now():
        raise HTTPException(400, "Token reset tidak berlaku atau sudah kedaluwarsa.")
    if len(data.password) < 6: raise HTTPException(400, "Password minimal 6 karakter")
    await db.users.update_one({"id": rec["userId"]}, {"$set": {"password_hash": hash_password(data.password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True, "usedAt": now()}})
    return {"ok": True, "message": "Password berhasil diperbarui."}

@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    user = await refresh_status(user)
    websites = await db.websites.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)
    for w in websites:
        w["productCount"] = await db.products.count_documents({"websiteId": w["id"]})
    stats = {"total": len(websites), "published": sum(1 for w in websites if w.get("status") == "PUBLISHED"), "draft": sum(1 for w in websites if w.get("status") != "PUBLISHED"), "products": sum(w["productCount"] for w in websites)}
    return {"user": public(user), "websites": websites, "stats": stats, "quota": quota_for(user)}

@api.get("/notifications")
async def notifications(user=Depends(current_user)):
    return await db.notifications.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(50)

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(current_user)):
    await db.notifications.update_one({"id": nid, "userId": user["id"]}, {"$set": {"isRead": True}})
    return {"ok": True}

@api.get("/websites")
async def websites_list(user=Depends(current_user)):
    return await db.websites.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)

@api.post("/websites")
async def create_website(data: WebsiteInput, user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Trial atau berlangganan Anda telah berakhir. Silakan pilih paket untuk lanjut membuat website.")
    count = await db.websites.count_documents({"userId": user["id"]})
    q = quota_for(user)
    if count >= q:
        raise HTTPException(403, "Limit website Anda sudah tercapai. Silakan upgrade paket atau tambah kuota website.")
    website = {"id": uid(), "userId": user["id"], **data.model_dump(), "status": "DRAFT", "slug": "", "themeConfig": {"primary": "#16A34A", "style": "modern"}, "aiGeneratedContent": {}, "businessHours": [], "createdAt": now(), "updatedAt": now()}
    await db.websites.insert_one(website)
    return public(website)

async def owned_site(site_id, user):
    site = await db.websites.find_one({"id": site_id, "userId": user["id"]}, {"_id": 0}) if user.get("role") != "ADMIN" else await db.websites.find_one({"id": site_id}, {"_id": 0})
    if not site: raise HTTPException(404, "Website tidak ditemukan")
    return site

@api.get("/websites/{site_id}")
async def get_website(site_id: str, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    site["products"] = await db.products.find({"websiteId": site_id}, {"_id": 0}).sort("sortOrder", 1).to_list(200)
    return site

@api.put("/websites/{site_id}")
async def update_website(site_id: str, data: WebsiteInput, user=Depends(current_user)):
    await owned_site(site_id, user)
    await db.websites.update_one({"id": site_id}, {"$set": {**data.model_dump(), "updatedAt": now()}})
    return await get_website(site_id, user)

@api.put("/websites/{site_id}/theme")
async def update_theme(site_id: str, data: ThemeInput, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    theme = {**(site.get("themeConfig") or {})}
    ai = {**(site.get("aiGeneratedContent") or {})}
    if data.primary: theme["primary"] = data.primary
    if data.accent: theme["accent"] = data.accent
    if data.style: theme["style"] = data.style
    if data.heroTitle is not None: ai["heroTitle"] = data.heroTitle
    if data.heroSubtitle is not None: ai["heroSubtitle"] = data.heroSubtitle
    if data.about is not None: ai["about"] = data.about
    await db.websites.update_one({"id": site_id}, {"$set": {"themeConfig": theme, "aiGeneratedContent": ai, "updatedAt": now()}})
    return await get_website(site_id, user)

@api.delete("/websites/{site_id}")
async def delete_website(site_id: str, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    await db.products.delete_many({"websiteId": site_id})
    await db.websites.delete_one({"id": site_id})
    return {"ok": True}

@api.post("/websites/{site_id}/products")
async def add_product(site_id: str, data: ProductInput, user=Depends(current_user)):
    await owned_site(site_id, user)
    if len(data.images) > 3: raise HTTPException(400, "Maksimal 3 gambar per produk")
    item = {"id": uid(), "websiteId": site_id, **data.model_dump(), "sortOrder": await db.products.count_documents({"websiteId": site_id}), "createdAt": now()}
    await db.products.insert_one(item)
    return public(item)

@api.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductInput, user=Depends(current_user)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Produk tidak ditemukan")
    site = await db.websites.find_one({"id": p["websiteId"]}, {"_id": 0})
    if not site or (user.get("role") != "ADMIN" and site["userId"] != user["id"]):
        raise HTTPException(404, "Produk tidak ditemukan")
    if len(data.images) > 3: raise HTTPException(400, "Maksimal 3 gambar per produk")
    await db.products.update_one({"id": product_id}, {"$set": {**data.model_dump(), "updatedAt": now()}})
    return public(await db.products.find_one({"id": product_id}, {"_id": 0}))

@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(current_user)):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Produk tidak ditemukan")
    site = await db.websites.find_one({"id": p["websiteId"]}, {"_id": 0})
    if not site or (user.get("role") != "ADMIN" and site["userId"] != user["id"]):
        raise HTTPException(404, "Produk tidak ditemukan")
    await db.products.delete_one({"id": product_id})
    return {"ok": True}

async def ai_json(site, products, command=""):
    key = os.environ.get("EMERGENT_LLM_KEY")
    prompt = f"""Buat konfigurasi website UMKM Indonesia. Kembalikan JSON valid saja.
Jangan mengarang informasi bisnis yang tidak diberikan.
Data bisnis: {json.dumps({'business': {k: site.get(k) for k in ('businessName', 'category', 'description', 'city', 'province', 'whatsapp', 'instagram')}, 'products': [{'name': p.get('name'), 'price': p.get('price'), 'description': p.get('description')} for p in products]}, ensure_ascii=False)}
Instruksi tambahan dari pemilik: {command or 'tidak ada'}
Struktur JSON yang wajib: {{
  "heroTitle": string singkat (max 8 kata),
  "heroSubtitle": string 1 kalimat menarik,
  "heroCta": string call to action singkat,
  "about": string paragraf tentang bisnis (2-3 kalimat),
  "highlights": array 3 string keunggulan singkat,
  "productHeadline": string judul bagian produk,
  "primaryColor": hex color yang cocok dengan karakter bisnis,
  "accentColor": hex color pelengkap,
  "style": salah satu dari [modern, minimal, elegant, playful, professional, warm]
}}"""
    chat = LlmChat(api_key=key, session_id=uid(), system_message="You create Indonesian website content in valid JSON only. Never invent facts not present in the input.").with_model("gemini", "gemini-3-flash-preview")
    chunks = []
    async for event in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(event, TextDelta): chunks.append(event.content)
        if isinstance(event, StreamDone): break
    raw = "".join(chunks).strip().replace("```json", "").replace("```", "").strip()
    return json.loads(raw)

@api.post("/websites/{site_id}/generate")
async def generate(site_id: str, user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Trial atau berlangganan Anda telah berakhir. Perpanjang paket untuk menggunakan AI.")
    site = await owned_site(site_id, user)
    products = await db.products.find({"websiteId": site_id}, {"_id": 0}).to_list(100)
    try:
        content = await ai_json(site, products)
    except Exception as exc:
        log.exception("AI generation failed")
        raise HTTPException(502, "AI belum dapat membuat website. Silakan coba lagi.") from exc
    await db.websites.update_one({"id": site_id}, {"$set": {"aiGeneratedContent": content, "themeConfig": {"primary": content.get("primaryColor", "#16A34A"), "accent": content.get("accentColor", "#14532D"), "style": content.get("style", "modern")}, "updatedAt": now()}})
    return await get_website(site_id, user)

@api.post("/websites/{site_id}/ai-edit")
async def ai_edit(site_id: str, data: AIEditInput, user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Trial atau berlangganan Anda telah berakhir. Perpanjang paket untuk menggunakan AI.")
    site = await owned_site(site_id, user)
    products = await db.products.find({"websiteId": site_id}, {"_id": 0}).to_list(100)
    try:
        content = await ai_json(site, products, data.command)
    except Exception as exc:
        log.exception("AI edit failed")
        raise HTTPException(502, "AI belum dapat memperbarui website. Silakan coba lagi.") from exc
    await db.websites.update_one({"id": site_id}, {"$set": {"aiGeneratedContent": content, "themeConfig.primary": content.get("primaryColor", "#16A34A"), "themeConfig.accent": content.get("accentColor", "#14532D"), "themeConfig.style": content.get("style", "modern"), "updatedAt": now()}})
    return await get_website(site_id, user)

@api.post("/websites/{site_id}/publish")
async def publish(site_id: str, user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Website hanya dapat dipublikasikan saat berlangganan aktif.")
    site = await owned_site(site_id, user)
    slug = site.get("slug") or slugify(site["businessName"])
    base = slug
    n = 1
    while await db.websites.find_one({"slug": slug, "id": {"$ne": site_id}}):
        n += 1
        slug = f"{base}-{n}"
    await db.websites.update_one({"id": site_id}, {"$set": {"slug": slug, "status": "PUBLISHED", "publishedAt": now(), "updatedAt": now()}})
    return {"slug": slug, "status": "PUBLISHED"}

@api.post("/websites/{site_id}/unpublish")
async def unpublish(site_id: str, user=Depends(current_user)):
    await owned_site(site_id, user)
    await db.websites.update_one({"id": site_id}, {"$set": {"status": "DRAFT", "updatedAt": now()}})
    return {"ok": True}

@api.get("/public/{slug}")
async def public_site(slug: str):
    site = await db.websites.find_one({"slug": slug, "status": "PUBLISHED"}, {"_id": 0})
    if not site: raise HTTPException(404, "Website belum dipublikasikan")
    owner = await db.users.find_one({"id": site["userId"]}, {"_id": 0})
    if not owner: raise HTTPException(404, "Website tidak tersedia")
    await refresh_status(owner)
    owner = await db.users.find_one({"id": site["userId"]}, {"_id": 0})
    if not is_owner_active(owner):
        return {"maintenance": True, "slug": slug, "businessName": site.get("businessName", "")}
    await db.websites.update_one({"slug": slug}, {"$inc": {"pageViews": 1}})
    site["products"] = await db.products.find({"websiteId": site["id"]}, {"_id": 0}).sort("sortOrder", 1).to_list(200)
    site["maintenance"] = False
    return site

@api.get("/owner-access/{slug}")
async def owner_access(slug: str, user=Depends(current_user)):
    site = await db.websites.find_one({"slug": slug}, {"_id": 0})
    if not site: raise HTTPException(404, "Website tidak ditemukan")
    if site["userId"] != user["id"] and user.get("role") != "ADMIN":
        raise HTTPException(403, "Website ini bukan bagian dari akun Anda.")
    owner = await db.users.find_one({"id": site["userId"]}, {"_id": 0})
    if owner:
        await refresh_status(owner)
        owner = await db.users.find_one({"id": site["userId"]}, {"_id": 0})
    return {"website": public(site), "owner": {"subscriptionStatus": owner.get("subscriptionStatus"), "trialEndDate": owner.get("trialEndDate"), "subscriptionExpiryDate": owner.get("subscriptionExpiryDate"), "planSlug": owner.get("planSlug")}}

@api.get("/plans")
async def plans_list():
    plans = await db.plans.find({"isActive": True}, {"_id": 0}).to_list(20)
    if not plans:
        return [p for p in DEFAULT_PLANS if p.get("isActive") and p.get("slug") != "trial"]
    return [p for p in plans if p.get("slug") != "trial"]

@api.post("/payments")
async def create_payment(data: PaymentCreateInput, user=Depends(current_user)):
    plan = await db.plans.find_one({"slug": data.planSlug, "isActive": True}, {"_id": 0})
    if not plan or data.planSlug == "trial":
        raise HTTPException(400, "Paket tidak ditemukan")
    settings = await db.settings.find_one({"id": "platform"}, {"_id": 0}) or DEFAULT_SETTINGS
    add_price = settings.get("additionalWebsitePrice", ADDITIONAL_WEBSITE_PRICE)
    extra = max(0, int(data.additionalWebsiteCount or 0))
    if not plan.get("allowsAdditional") and extra > 0:
        raise HTTPException(400, "Website tambahan hanya tersedia untuk paket Platinum")
    amount = float(plan["monthlyPrice"]) + extra * add_price
    # Apply coupon if provided
    coupon = None
    coupon_days_added = 0
    if data.couponCode:
        coupon = await db.coupons.find_one({"code": data.couponCode.upper().strip(), "isActive": True}, {"_id": 0})
        if not coupon: raise HTTPException(400, "Kode kupon tidak valid")
        if coupon.get("expiresAt", "") and coupon.get("expiresAt", "") < now():
            raise HTTPException(400, "Kupon sudah kedaluwarsa")
        if coupon.get("maxUses") and coupon.get("usedCount", 0) >= coupon["maxUses"]:
            raise HTTPException(400, "Kupon sudah mencapai batas penggunaan")
        dtype = coupon.get("discountType")
        dval = float(coupon.get("discountValue", 0))
        if dtype == "percentage":
            amount = max(0, amount * (1 - dval / 100))
        elif dtype == "fixed":
            amount = max(0, amount - dval)
        elif dtype == "days":
            coupon_days_added = int(dval)
    payment = {"id": uid(), "userId": user["id"], "userEmail": user["email"], "userName": user.get("name", ""), "planSlug": data.planSlug, "planName": plan["name"], "amount": amount, "originalAmount": float(plan["monthlyPrice"]) + extra * add_price, "additionalWebsiteCount": extra, "additionalWebsitePrice": add_price, "transferDate": data.transferDate, "proofUrl": data.proofUrl, "notes": data.notes, "couponCode": (coupon["code"] if coupon else ""), "couponDaysAdded": coupon_days_added, "status": "PENDING", "createdAt": now()}
    await db.payments.insert_one(payment)
    if coupon:
        await db.coupons.update_one({"code": coupon["code"]}, {"$inc": {"usedCount": 1}})
        await db.coupon_redemptions.insert_one({"id": uid(), "couponCode": coupon["code"], "userId": user["id"], "paymentId": payment["id"], "redeemedAt": now()})
    await notify(user["id"], "Permintaan pembayaran diterima", f"Pembayaran {plan['name']} sebesar Rp{int(amount):,} sedang menunggu verifikasi admin.".replace(",", "."))
    return public(payment)

async def _proof_content_type(proof_url):
    if not proof_url or "/api/uploads/" not in proof_url:
        return ""
    file_id = proof_url.rsplit("/", 1)[-1]
    rec = await db.files.find_one({"id": file_id}, {"_id": 0, "contentType": 1})
    return rec.get("contentType") if rec else ""

@api.get("/payments/mine")
async def my_payments(user=Depends(current_user)):
    payments = await db.payments.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(50)
    for p in payments:
        p["proofContentType"] = await _proof_content_type(p.get("proofUrl"))
    return payments

@api.get("/payments/{pid}")
async def get_payment(pid: str, user=Depends(current_user)):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p or (p["userId"] != user["id"] and user.get("role") != "ADMIN"):
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    p["proofContentType"] = await _proof_content_type(p.get("proofUrl"))
    return p

@api.get("/admin/overview")
async def admin_overview(_=Depends(admin_user)):
    users = await db.users.find({"role": "USER"}, {"_id": 0}).to_list(1000)
    return {
        "totalUsers": len(users),
        "activeUsers": sum(1 for u in users if u.get("accountStatus") == "ACTIVE"),
        "trialUsers": sum(1 for u in users if u.get("subscriptionStatus") == "TRIAL_ACTIVE"),
        "trialExpired": sum(1 for u in users if u.get("subscriptionStatus") == "TRIAL_EXPIRED"),
        "premiumUsers": sum(1 for u in users if u.get("subscriptionStatus") == "ACTIVE"),
        "expiredUsers": sum(1 for u in users if u.get("subscriptionStatus") == "EXPIRED"),
        "totalWebsites": await db.websites.count_documents({}),
        "publishedWebsites": await db.websites.count_documents({"status": "PUBLISHED"}),
        "pendingPayments": await db.payments.count_documents({"status": "PENDING"}),
        "approvedPayments": await db.payments.count_documents({"status": "APPROVED"}),
    }

@api.get("/admin/users")
async def admin_users(_=Depends(admin_user)):
    users = await db.users.find({"role": "USER"}, {"_id": 0, "password_hash": 0}).sort("createdAt", -1).to_list(500)
    for u in users:
        u["websiteCount"] = await db.websites.count_documents({"userId": u["id"]})
    return users

@api.get("/admin/users/{uid_}")
async def admin_user_detail(uid_: str, _=Depends(admin_user)):
    u = await db.users.find_one({"id": uid_}, {"_id": 0, "password_hash": 0})
    if not u: raise HTTPException(404, "User tidak ditemukan")
    u["websites"] = await db.websites.find({"userId": uid_}, {"_id": 0}).to_list(100)
    u["payments"] = await db.payments.find({"userId": uid_}, {"_id": 0}).sort("createdAt", -1).to_list(50)
    return u

@api.post("/admin/users/{uid_}/action")
async def admin_user_action(uid_: str, data: UserAdminAction, admin=Depends(admin_user)):
    u = await db.users.find_one({"id": uid_}, {"_id": 0})
    if not u: raise HTTPException(404, "User tidak ditemukan")
    updates = {}
    action = data.action.lower()
    if action == "suspend":
        updates["accountStatus"] = "SUSPENDED"
        await notify(uid_, "Akun dinonaktifkan", data.reason or "Silakan hubungi admin.")
    elif action == "activate":
        updates["accountStatus"] = "ACTIVE"
        await notify(uid_, "Akun aktif kembali", "Akun Anda sudah dapat digunakan.")
    elif action == "extend":
        days = int(data.extraDays or 30)
        base_str = u.get("subscriptionExpiryDate") or now()
        try:
            base = datetime.fromisoformat(base_str.replace("Z", "+00:00"))
        except Exception:
            base = datetime.now(timezone.utc)
        if base < datetime.now(timezone.utc): base = datetime.now(timezone.utc)
        updates["subscriptionExpiryDate"] = (base + timedelta(days=days)).isoformat()
        updates["subscriptionStatus"] = "ACTIVE"
        await notify(uid_, "Berlangganan diperpanjang", f"Berlangganan diperpanjang {days} hari oleh admin.")
    elif action == "change_plan":
        plan = await db.plans.find_one({"slug": data.planSlug, "isActive": True}, {"_id": 0}) if data.planSlug else None
        if not plan: raise HTTPException(400, "Paket tidak ditemukan")
        updates["planSlug"] = plan["slug"]
        updates["websiteQuota"] = int(plan["websiteLimit"]) + int(data.additionalWebsites or 0)
        updates["additionalWebsiteQuota"] = int(data.additionalWebsites or 0)
        updates["subscriptionStatus"] = "ACTIVE"
        expiry = datetime.now(timezone.utc) + timedelta(days=30)
        updates["subscriptionExpiryDate"] = expiry.isoformat()
        updates["subscriptionStartDate"] = now()
        await notify(uid_, "Paket diperbarui admin", f"Paket Anda diperbarui menjadi {plan['name']}.")
    elif action == "add_quota":
        add = int(data.additionalWebsites or 1)
        updates["websiteQuota"] = int(u.get("websiteQuota", 1)) + add
        updates["additionalWebsiteQuota"] = int(u.get("additionalWebsiteQuota", 0)) + add
    elif action == "cancel":
        updates["subscriptionStatus"] = "EXPIRED"
        await notify(uid_, "Berlangganan dibatalkan", "Admin membatalkan berlangganan Anda.")
    elif action == "reset_password":
        raw = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": raw, "userId": uid_, "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(), "used": False, "createdAt": now()})
        await log_activity(admin["id"], "reset_password", uid_, notes="Password reset diinisiasi admin")
        return {"ok": True, "resetToken": raw, "resetLink": f"/reset-password?token={raw}"}
    else:
        raise HTTPException(400, "Aksi tidak dikenal")
    if updates:
        await db.users.update_one({"id": uid_}, {"$set": updates})
    await log_activity(admin["id"], action, uid_, notes=data.reason or "")
    return {"ok": True}

@api.get("/admin/websites")
async def admin_websites(_=Depends(admin_user)):
    sites = await db.websites.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    for s in sites:
        u = await db.users.find_one({"id": s["userId"]}, {"_id": 0, "password_hash": 0})
        s["ownerName"] = u.get("name") if u else "-"
        s["ownerEmail"] = u.get("email") if u else "-"
        s["productCount"] = await db.products.count_documents({"websiteId": s["id"]})
    return sites

@api.get("/admin/payments")
async def admin_payments(_=Depends(admin_user)):
    return await db.payments.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)

@api.get("/admin/payments/{pid}")
async def admin_payment_detail(pid: str, _=Depends(admin_user)):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Pembayaran tidak ditemukan")
    u = await db.users.find_one({"id": p["userId"]}, {"_id": 0, "password_hash": 0})
    p["proofContentType"] = await _proof_content_type(p.get("proofUrl"))
    return {**p, "user": public(u) if u else None}

@api.post("/admin/payments/{pid}/approve")
async def approve_payment(pid: str, admin=Depends(admin_user)):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Pembayaran tidak ditemukan")
    if p.get("status") != "PENDING": raise HTTPException(400, "Pembayaran ini sudah diproses.")
    plan = await db.plans.find_one({"slug": p["planSlug"]}, {"_id": 0})
    if not plan: raise HTTPException(400, "Paket tidak ditemukan")
    extra = int(p.get("additionalWebsiteCount", 0))
    quota_val = int(plan["websiteLimit"]) + extra
    coupon_days = int(p.get("couponDaysAdded", 0))
    days_total = 30 + coupon_days
    start = datetime.now(timezone.utc)
    expiry = start + timedelta(days=days_total)
    await db.payments.update_one({"id": pid}, {"$set": {"status": "APPROVED", "reviewedAt": now(), "reviewedBy": admin["id"]}})
    await db.users.update_one({"id": p["userId"]}, {"$set": {"subscriptionStatus": "ACTIVE", "planSlug": p["planSlug"], "websiteQuota": quota_val, "additionalWebsiteQuota": extra, "subscriptionStartDate": start.isoformat(), "subscriptionExpiryDate": expiry.isoformat()}})
    bonus_note = f" (+ {coupon_days} hari bonus kupon)" if coupon_days else ""
    await notify(p["userId"], "Pembayaran disetujui", f"Berlangganan {plan['name']} aktif hingga {expiry.strftime('%d %B %Y')}{bonus_note}. Website Anda kembali online.")
    await log_activity(admin["id"], "approve_payment", p["userId"], pid, f"Approved {plan['name']} for Rp{int(p['amount'])}")
    user = await db.users.find_one({"id": p["userId"]}, {"_id": 0})
    settings = await db.settings.find_one({"id": "platform"}, {"_id": 0}) or DEFAULT_SETTINGS
    wa_message = f"Halo {user.get('name', '')}, pembayaran paket {plan['name']} sebesar Rp{int(p['amount']):,} telah disetujui. Berlangganan Anda aktif hingga {expiry.strftime('%d %B %Y')}{bonus_note}. Terima kasih telah menggunakan UsahaKu.".replace(",", ".")
    wa_link = f"https://wa.me/{(user.get('whatsapp') or '').replace('+','').replace(' ','')}?text={wa_message}" if user.get('whatsapp') else ""
    return {"ok": True, "websiteQuota": quota_val, "expiry": expiry.isoformat(), "userWhatsapp": user.get("whatsapp", ""), "whatsappMessage": wa_message, "adminWhatsapp": settings.get("adminWhatsapp", "")}

@api.post("/admin/payments/{pid}/reject")
async def reject_payment(pid: str, data: PaymentRejectInput, admin=Depends(admin_user)):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Pembayaran tidak ditemukan")
    if p.get("status") != "PENDING": raise HTTPException(400, "Pembayaran ini sudah diproses.")
    if not data.reason.strip(): raise HTTPException(400, "Alasan penolakan wajib diisi")
    await db.payments.update_one({"id": pid}, {"$set": {"status": "REJECTED", "reviewedAt": now(), "reviewedBy": admin["id"], "adminNotes": data.reason}})
    await notify(p["userId"], "Pembayaran ditolak", f"Pembayaran ditolak: {data.reason}. Silakan submit ulang bukti pembayaran.")
    await log_activity(admin["id"], "reject_payment", p["userId"], pid, data.reason)
    user = await db.users.find_one({"id": p["userId"]}, {"_id": 0})
    wa_message = f"Halo {user.get('name', '') if user else ''}, mohon maaf pembayaran paket {p.get('planName', '')} tidak dapat kami verifikasi. Alasan: {data.reason}. Silakan kirim ulang bukti transfer via UsahaKu."
    return {"ok": True, "userWhatsapp": user.get("whatsapp", "") if user else "", "whatsappMessage": wa_message}

@api.get("/admin/plans")
async def admin_plans_list(_=Depends(admin_user)):
    return await db.plans.find({}, {"_id": 0}).to_list(20)

@api.put("/admin/plans/{slug}")
async def admin_update_plan(slug: str, data: PlanUpdateInput, admin=Depends(admin_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "Tidak ada perubahan")
    updates["updatedAt"] = now()
    result = await db.plans.update_one({"slug": slug}, {"$set": updates})
    if result.matched_count == 0: raise HTTPException(404, "Paket tidak ditemukan")
    await log_activity(admin["id"], "update_plan", None, slug, json.dumps(updates))
    return await db.plans.find_one({"slug": slug}, {"_id": 0})

@api.get("/admin/activity-logs")
async def activity_logs(_=Depends(admin_user)):
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("createdAt", -1).to_list(200)
    for l in logs:
        if l.get("adminId"):
            a = await db.users.find_one({"id": l["adminId"]}, {"_id": 0, "password_hash": 0})
            l["adminName"] = a.get("name") if a else "-"
        if l.get("targetUserId"):
            t = await db.users.find_one({"id": l["targetUserId"]}, {"_id": 0, "password_hash": 0})
            l["targetName"] = t.get("name") if t else "-"
            l["targetEmail"] = t.get("email") if t else "-"
    return logs

@api.get("/admin/settings")
async def admin_settings_get(_=Depends(admin_user)):
    s = await db.settings.find_one({"id": "platform"}, {"_id": 0})
    return s or DEFAULT_SETTINGS

@api.put("/admin/settings")
async def admin_settings_update(data: SettingsInput, admin=Depends(admin_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "Tidak ada perubahan")
    updates["updatedAt"] = now()
    await db.settings.update_one({"id": "platform"}, {"$set": updates}, upsert=True)
    await log_activity(admin["id"], "update_settings", None, "platform", json.dumps(updates))
    return await db.settings.find_one({"id": "platform"}, {"_id": 0})

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origin_regex=".*", allow_methods=["*"], allow_headers=["*"])

# ========== Coupons, Demo Seed, Analytics ==========

@api.post("/coupons/validate")
async def validate_coupon(data: dict, user=Depends(current_user)):
    code = str(data.get("code", "")).upper().strip()
    if not code: raise HTTPException(400, "Kode kupon wajib diisi")
    c = await db.coupons.find_one({"code": code, "isActive": True}, {"_id": 0})
    if not c: raise HTTPException(404, "Kode kupon tidak ditemukan")
    if c.get("expiresAt", "") and c.get("expiresAt", "") < now():
        raise HTTPException(400, "Kupon sudah kedaluwarsa")
    if c.get("maxUses") and c.get("usedCount", 0) >= c["maxUses"]:
        raise HTTPException(400, "Kupon sudah mencapai batas penggunaan")
    return {"code": c["code"], "discountType": c["discountType"], "discountValue": c["discountValue"], "description": c.get("description", "")}

@api.get("/admin/coupons")
async def admin_coupons(_=Depends(admin_user)):
    return await db.coupons.find({}, {"_id": 0}).sort("createdAt", -1).to_list(200)

@api.post("/admin/coupons")
async def admin_create_coupon(data: CouponInput, admin=Depends(admin_user)):
    code = data.code.upper().strip()
    if not code: raise HTTPException(400, "Kode kupon wajib diisi")
    if data.discountType not in ("percentage", "fixed", "days"):
        raise HTTPException(400, "Tipe diskon tidak valid")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(409, "Kode kupon sudah ada")
    doc = {"id": uid(), "code": code, "discountType": data.discountType, "discountValue": data.discountValue, "maxUses": data.maxUses, "usedCount": 0, "expiresAt": data.expiresAt or "", "isActive": data.isActive, "description": data.description, "createdAt": now()}
    await db.coupons.insert_one(doc)
    await log_activity(admin["id"], "create_coupon", None, code, f"{data.discountType}={data.discountValue}")
    return public(doc)

@api.put("/admin/coupons/{code}")
async def admin_update_coupon(code: str, data: CouponInput, admin=Depends(admin_user)):
    result = await db.coupons.update_one({"code": code.upper()}, {"$set": {"discountType": data.discountType, "discountValue": data.discountValue, "maxUses": data.maxUses, "expiresAt": data.expiresAt or "", "isActive": data.isActive, "description": data.description}})
    if result.matched_count == 0: raise HTTPException(404, "Kupon tidak ditemukan")
    await log_activity(admin["id"], "update_coupon", None, code.upper(), "")
    return await db.coupons.find_one({"code": code.upper()}, {"_id": 0})

@api.delete("/admin/coupons/{code}")
async def admin_delete_coupon(code: str, admin=Depends(admin_user)):
    result = await db.coupons.update_one({"code": code.upper()}, {"$set": {"isActive": False}})
    if result.matched_count == 0: raise HTTPException(404, "Kupon tidak ditemukan")
    await log_activity(admin["id"], "deactivate_coupon", None, code.upper(), "")
    return {"ok": True}

@api.post("/public/{slug}/track")
async def track_event(slug: str, data: TrackInput):
    field = "pageViews" if data.type == "view" else "whatsappClicks" if data.type == "whatsapp" else None
    if not field: raise HTTPException(400, "Tipe tidak dikenal")
    await db.websites.update_one({"slug": slug, "status": "PUBLISHED"}, {"$inc": {field: 1}})
    return {"ok": True}

@api.get("/websites/{site_id}/analytics")
async def website_analytics(site_id: str, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    return {"pageViews": site.get("pageViews", 0), "whatsappClicks": site.get("whatsappClicks", 0)}

@api.post("/demo/seed")
async def demo_seed(user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Aktifkan trial atau berlangganan untuk memakai demo.")
    count = await db.websites.count_documents({"userId": user["id"]})
    q = quota_for(user)
    if count >= q:
        raise HTTPException(403, "Limit website Anda sudah tercapai. Silakan upgrade paket.")
    website = {"id": uid(), "userId": user["id"], "businessName": "Kopi Senja", "category": "Coffee Shop", "description": "Kedai kopi kecil dengan biji lokal pilihan dan suasana hangat. Cocok untuk bersantai, berbincang, atau bekerja santai.", "logoUrl": "", "coverImageUrl": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1600&auto=format&fit=crop", "whatsapp": "6281234567890", "phone": "", "email": "halo@kopisenja.id", "instagram": "@kopisenja", "facebook": "", "tiktok": "", "address": "Jl. Kemang Raya No. 12", "city": "Jakarta Selatan", "province": "DKI Jakarta", "postalCode": "12730", "latitude": None, "longitude": None, "customDomain": "", "status": "DRAFT", "slug": "", "themeConfig": {"primary": "#166534", "accent": "#14532D", "style": "warm"}, "aiGeneratedContent": {"heroTitle": "Temukan jeda di setiap teguk.", "heroSubtitle": "Kopi pilihan, suasana hangat, dan cerita yang dekat setiap hari.", "heroCta": "Jelajahi menu", "about": "Kopi Senja adalah kedai kopi kecil di Kemang yang menyajikan biji kopi lokal pilihan. Kami percaya kopi bukan hanya minuman—tapi jeda hangat di tengah hari yang sibuk.", "highlights": ["Biji kopi lokal pilihan", "Suasana hangat & tenang", "Cocok untuk santai dan kerja"], "productHeadline": "Menu favorit", "primaryColor": "#166534", "accentColor": "#14532D", "style": "warm"}, "businessHours": [], "createdAt": now(), "updatedAt": now()}
    await db.websites.insert_one(website)
    demo_products = [
        {"name": "Es Kopi Gula Aren", "description": "Kopi susu dengan gula aren khas, disajikan dingin.", "price": 28000, "images": []},
        {"name": "Matcha Latte", "description": "Matcha premium dengan susu segar.", "price": 32000, "images": []},
        {"name": "Americano", "description": "Espresso murni dengan air panas.", "price": 24000, "images": []},
        {"name": "Croissant Coklat", "description": "Croissant butter dengan isian coklat lumer.", "price": 22000, "images": []},
    ]
    for i, p in enumerate(demo_products):
        await db.products.insert_one({"id": uid(), "websiteId": website["id"], **p, "category": "", "sortOrder": i, "createdAt": now()})
    return public(website)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    existing_idx = await db.websites.index_information()
    if "slug_1" in existing_idx:
        await db.websites.drop_index("slug_1")
    await db.websites.create_index("slug", unique=True, name="slug_unique_nonempty", partialFilterExpression={"slug": {"$gt": ""}})
    await db.payments.create_index("userId")
    await db.notifications.create_index("userId")
    await db.coupons.create_index("code", unique=True)
    # Migrate old plans
    await db.plans.delete_many({"slug": {"$in": ["premium-1", "premium-3"]}})
    for plan in DEFAULT_PLANS:
        existing = await db.plans.find_one({"slug": plan["slug"]})
        if not existing:
            await db.plans.insert_one({**plan, "createdAt": now()})
    # Migrate old user planSlug values
    await db.users.update_many({"planSlug": "premium-1"}, {"$set": {"planSlug": "basic"}})
    await db.users.update_many({"planSlug": "premium-3", "additionalWebsiteQuota": {"$gt": 0}}, {"$set": {"planSlug": "platinum"}})
    await db.users.update_many({"planSlug": "premium-3"}, {"$set": {"planSlug": "premium"}})
    if not await db.settings.find_one({"id": "platform"}):
        await db.settings.insert_one({**DEFAULT_SETTINGS, "createdAt": now()})
    if not await db.users.find_one({"email": os.environ["ADMIN_EMAIL"].lower()}):
        await db.users.insert_one({"id": uid(), "name": "Admin UsahaKu", "email": os.environ["ADMIN_EMAIL"].lower(), "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]), "role": "ADMIN", "accountStatus": "ACTIVE", "subscriptionStatus": "ACTIVE", "websiteQuota": 999, "createdAt": now()})

@app.on_event("shutdown")
async def shutdown():
    client.close()
