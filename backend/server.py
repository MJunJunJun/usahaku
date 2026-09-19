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
import os, uuid, re, secrets, logging, json, requests, bcrypt, jwt, asyncio
import hmac as _hmac

import wa_service
from wa_templates import render_template, rupiah

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    HAS_EMERGENT = True
except ImportError:
    HAS_EMERGENT = False

try:
    from mongomock_motor import AsyncMongoMockClient
    HAS_MONGOMOCK = True
except ImportError:
    HAS_MONGOMOCK = False

class DatabaseProxy:
    def __init__(self):
        self._db = None
    def set_db(self, actual_db):
        self._db = actual_db
    def __getattr__(self, name):
        return getattr(self._db, name)
    def __getitem__(self, name):
        return self._db[name]

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'usahaku')
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
db_proxy = DatabaseProxy()
db_proxy.set_db(client[db_name])
db = db_proxy
app = FastAPI(title="Situska API")
api = APIRouter(prefix="/api")
log = logging.getLogger("usahaku")
JWT_ALGORITHM = "HS256"
TRIAL_DAYS = 30
# Durasi sesi login (hari). Setelah login, user tetap masuk selama ini
# tanpa perlu login ulang setiap membuka website.
AUTH_COOKIE_DAYS = int(os.environ.get("AUTH_COOKIE_DAYS", "30"))
ADDITIONAL_WEBSITE_PRICE = 25000
storage_key = None

def load_jwt_secret():
    """Use the configured secret, or persist a local-development secret.

    The fallback prevents every local restart from breaking login. Production
    should still provide JWT_SECRET so multiple containers share one key.
    """
    configured = (os.environ.get("JWT_SECRET") or "").strip()
    if configured:
        return configured
    secret_file = Path(os.environ.get("JWT_SECRET_FILE") or (ROOT_DIR / ".runtime" / "jwt-secret"))
    if secret_file.exists():
        saved = secret_file.read_text(encoding="utf-8").strip()
        if saved:
            return saved
    secret_file.parent.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(64)
    secret_file.write_text(generated, encoding="utf-8")
    log.warning("JWT_SECRET belum diatur; memakai secret lokal persisten di %s", secret_file)
    return generated

JWT_SECRET = load_jwt_secret()
COOKIE_DOMAIN = (os.environ.get("COOKIE_DOMAIN") or "").strip() or None
COOKIE_SAMESITE = (os.environ.get("COOKIE_SAMESITE") or "lax").strip().lower()
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    COOKIE_SAMESITE = "lax"

def request_is_secure(request: Request):
    configured = (os.environ.get("COOKIE_SECURE") or "auto").strip().lower()
    if configured in {"1", "true", "yes", "on"}:
        return True
    if configured in {"0", "false", "no", "off"}:
        return False
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower()
    return request.url.scheme == "https" or forwarded_proto == "https"

def set_auth_cookie(response: Response, request: Request, value: str):
    response.set_cookie(
        "access_token", value,
        httponly=True, samesite=COOKIE_SAMESITE,
        max_age=AUTH_COOKIE_DAYS * 86400, secure=request_is_secure(request),
        domain=COOKIE_DOMAIN, path="/",
    )

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

DEFAULT_PLANS = [
    {"id": "trial", "slug": "trial", "name": "Gratis", "monthlyPrice": 0, "websiteLimit": 1, "features": ["1 website", "AI generation", "Katalog produk", "WhatsApp & Google Maps"], "isActive": True, "isDefault": True, "allowsAdditional": False},
    {"id": "basic", "slug": "basic", "name": "Basic", "monthlyPrice": 50000, "websiteLimit": 1, "features": ["1 website", "AI generation & editing", "Katalog tanpa batas", "Dukungan prioritas"], "isActive": True, "allowsAdditional": False},
    {"id": "premium", "slug": "premium", "name": "Premium", "monthlyPrice": 100000, "websiteLimit": 3, "features": ["3 website", "AI generation & editing", "Katalog tanpa batas", "Dukungan prioritas"], "isActive": True, "allowsAdditional": False},
    {"id": "platinum", "slug": "platinum", "name": "Platinum", "monthlyPrice": 100000, "websiteLimit": 3, "features": ["3 website + bisa ditambah", "+Rp25.000 per website tambahan", "AI generation & editing", "Dukungan prioritas"], "isActive": True, "allowsAdditional": True},
]

DEFAULT_SETTINGS = {
    "id": "platform",
    "applicationName": os.environ.get("APP_NAME", "Situska"),
    "supportEmail": os.environ.get("SUPPORT_EMAIL", "hello@buildza.id"),
    "adminWhatsapp": "6281234567890",
    "bankName": "Bank BCA",
    "accountName": "PT Situska Digital Indonesia",
    "accountNumber": "1234567890",
    "paymentInstructions": "Silakan transfer sejumlah total tagihan ke rekening di atas. Setelah transfer, unggah bukti pembayaran dan hubungi admin melalui WhatsApp untuk verifikasi lebih cepat.",
    "additionalWebsitePrice": ADDITIONAL_WEBSITE_PRICE,
}

# Website ini hanya untuk halaman "Contoh" di landing page. Produk disimpan
# seperti produk biasa agar pengunjung dapat melihat katalog yang realistis.
SHOWCASE_SITES = [
    {"slug": "demo-kopi-senja", "name": "Kopi Senja", "category": "Coffee Shop", "style": "modern", "primary": "#7a4c2e", "cover": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1600&auto=format&fit=crop", "hero": "Temukan jeda di setiap teguk.", "description": "Kedai kopi lokal dengan suasana hangat untuk bekerja dan berbincang.", "products": [("Es Kopi Gula Aren", 28000), ("Cappuccino Klasik", 32000), ("Americano", 24000), ("Matcha Latte", 33000), ("Croissant Butter", 22000), ("Banana Bread", 24000), ("Paket Kopi Pagi", 45000)]},
    {"slug": "demo-rumah-roti", "name": "Rumah Roti", "category": "Bakery", "style": "modern", "primary": "#a16207", "cover": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1600&auto=format&fit=crop", "hero": "Roti hangat, dibuat setiap pagi.", "description": "Bakery rumahan dengan roti segar, kue lembut, dan bahan pilihan.", "products": [("Sourdough Original", 45000), ("Roti Sobek Cokelat", 30000), ("Croissant Almond", 28000), ("Cinnamon Roll", 26000), ("Pain au Chocolat", 29000), ("Donat Kentang", 18000), ("Paket Sarapan", 55000)]},
    {"slug": "demo-nusa-craft", "name": "Nusa Craft", "category": "Fashion", "style": "modern", "primary": "#0f766e", "cover": "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1600&auto=format&fit=crop", "hero": "Karya lokal untuk gaya yang berkarakter.", "description": "Koleksi fashion dan aksesori pilihan yang memadukan karya lokal dan gaya modern.", "products": [("Kemeja Linen Aruna", 245000), ("Outer Tenun Sumba", 389000), ("Tote Bag Kanvas", 125000), ("Scarf Motif Nusa", 99000), ("Celana Santai Rami", 215000), ("Dompet Kulit Mini", 159000), ("Gift Set Nusantara", 325000)]},
    {"slug": "demo-barber-co", "name": "Barber Co", "category": "Barbershop", "style": "modern", "primary": "#1f2937", "cover": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop", "hero": "Potongan rapi, percaya diri setiap hari.", "description": "Barbershop modern dengan barber berpengalaman dan suasana santai.", "products": [("Classic Haircut", 50000), ("Skin Fade", 65000), ("Haircut + Wash", 75000), ("Beard Trim", 35000), ("Hot Towel Shave", 55000), ("Kids Haircut", 40000), ("Paket Grooming", 115000)]},
    {"slug": "demo-sari-beauty", "name": "Sari Beauty", "category": "Beauty", "style": "modern", "primary": "#db2777", "cover": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1600&auto=format&fit=crop", "hero": "Rawat diri, pancarkan versi terbaikmu.", "description": "Perawatan kecantikan yang personal, nyaman, dan ditangani terapis terpercaya.", "products": [("Basic Facial", 125000), ("Brightening Facial", 180000), ("Manicure Express", 85000), ("Gel Polish", 120000), ("Lash Lift", 175000), ("Hair Spa", 150000), ("Paket Glow Up", 350000)]},
    {"slug": "demo-warung-sundari", "name": "Warung Sundari", "category": "Restaurant", "style": "modern", "primary": "#b45309", "cover": "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=80&w=1600&auto=format&fit=crop", "hero": "Rasa rumahan yang selalu dirindukan.", "description": "Masakan Nusantara sehari-hari dengan bumbu segar dan cita rasa rumahan.", "products": [("Nasi Ayam Bakar", 32000), ("Nasi Rendang", 35000), ("Soto Ayam", 28000), ("Gado-Gado", 25000), ("Sate Ayam", 30000), ("Es Teh Manis", 8000), ("Paket Keluarga", 125000)]},
]

async def ensure_showcase_sites(admin_whatsapp: str):
    showcase_owner_id = "usahaku-showcase-owner"
    if not await db.users.find_one({"id": showcase_owner_id}):
        await db.users.insert_one({"id": showcase_owner_id, "name": "Situska Showcase", "email": "showcase@usahaku.internal", "password_hash": "", "role": "SYSTEM", "accountStatus": "ACTIVE", "subscriptionStatus": "ACTIVE", "planSlug": "premium", "websiteQuota": 999, "createdAt": now()})
    for spec in SHOWCASE_SITES:
        site = await db.websites.find_one({"slug": spec["slug"]}, {"_id": 0})
        website_id = site["id"] if site else uid()
        website = {
            "id": website_id, "userId": showcase_owner_id, "isShowcase": True,
            "businessName": spec["name"], "category": spec["category"], "description": spec["description"],
            "logoUrl": f"/api/showcase/logo/{spec['slug']}", "coverImageUrl": f"/assets/showcase/{spec['slug'].replace('demo-', '')}-cover.png", "whatsapp": admin_whatsapp, "phone": "", "email": "", "instagram": "", "facebook": "", "tiktok": "", "address": "Indonesia", "city": "", "province": "", "postalCode": "", "latitude": None, "longitude": None, "customDomain": "", "status": "PUBLISHED", "slug": spec["slug"], "templateStyle": "modern",
            "themeConfig": {"primary": spec["primary"], "accent": spec["primary"], "style": spec["style"]},
            "aiGeneratedContent": {"heroTitle": spec["hero"], "heroSubtitle": spec["description"], "heroCta": "Lihat katalog", "about": spec["description"], "highlights": ["Pilihan berkualitas", "Mudah dipesan", "Pelayanan ramah"], "productHeadline": "Pilihan favorit", "primaryColor": spec["primary"], "accentColor": spec["primary"], "style": spec["style"]},
            "businessHours": [], "updatedAt": now(), "createdAt": site.get("createdAt", now()) if site else now(),
        }
        await db.websites.update_one({"id": website_id}, {"$set": website}, upsert=True)
        await db.products.delete_many({"websiteId": website_id})
        for index, (name, price) in enumerate(spec["products"]):
            image_url = f"/assets/showcase/{spec['slug'].replace('demo-', '')}-{slugify(name)}.png"
            await db.products.insert_one({"id": uid(), "websiteId": website_id, "name": name, "description": f"{name} pilihan {spec['name']}, disiapkan dengan bahan berkualitas dan perhatian pada setiap detail.", "price": price, "images": [image_url], "category": spec["category"], "sortOrder": index, "createdAt": now()})

def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return str(uuid.uuid4())
def public(doc):
    if not doc: return None
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
def hash_password(value): return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()
def verify_password(value, hashed): return bcrypt.checkpw(value.encode(), hashed.encode())
def token(user_id, kind="access", days=7):
    return jwt.encode({"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + timedelta(days=days)}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-") or "website"

async def current_user(request: Request):
    raw = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not raw: raise HTTPException(401, "Silakan masuk terlebih dahulu")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sesi sudah berakhir. Silakan masuk lagi.")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user: raise HTTPException(401, "Akun tidak ditemukan")
    if user.get("accountStatus") == "SUSPENDED":
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin Situska.")
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
        await notify(user["id"], "Status berlangganan diperbarui", "Akses paket Anda telah berakhir. Pilih paket untuk menghidupkan kembali website.")
    return user

def is_owner_active(user):
    return user.get("role") == "ADMIN" or user.get("subscriptionStatus") in ("TRIAL_PENDING", "TRIAL_ACTIVE", "ACTIVE")

def quota_for(user):
    if user.get("role") == "ADMIN": return 999
    if user.get("subscriptionStatus") == "ACTIVE": return int(user.get("websiteQuota", 1))
    if user.get("subscriptionStatus") in ("TRIAL_PENDING", "TRIAL_ACTIVE"): return int(user.get("websiteQuota", 1))
    return 0

def product_limit_for(user):
    """Trial Gratis may show up to three catalogue items per website."""
    if user.get("role") == "ADMIN": return None
    return 3 if user.get("planSlug") == "trial" else None

async def notify(user_id, title, message):
    await db.notifications.insert_one({"id": uid(), "userId": user_id, "title": title, "message": message, "isRead": False, "createdAt": now()})

async def log_activity(admin_id, action, target_user_id=None, target_resource_id=None, notes=""):
    await db.activity_logs.insert_one({"id": uid(), "adminId": admin_id, "action": action, "targetUserId": target_user_id, "targetResourceId": target_resource_id, "notes": notes, "createdAt": now()})

class AuthInput(BaseModel):
    email: EmailStr
    password: str

class RegisterInput(AuthInput):
    name: str
    whatsapp: str = ""
    phone: str = ""

class WaSendInput(BaseModel):
    phone: str
    name: Optional[str] = None

class WaVerifyInput(BaseModel):
    phone: str
    code: str
    name: Optional[str] = None

class WebsiteInput(BaseModel):
    businessName: str
    storeSlug: str = ""
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
    templateStyle: Optional[str] = "modern"
    themeConfig: Optional[dict] = None

class TrackInput(BaseModel):
    type: str  # view | whatsapp

class ProductInput(BaseModel):
    name: str
    description: str = ""
    price: float = 0
    category: str = ""
    images: List[str] = []

class ArticleInput(BaseModel):
    title: str
    excerpt: str = ""
    content: str = ""
    coverImageUrl: str = ""
    status: str = "DRAFT"

class AIEditInput(BaseModel):
    command: str

class ThemeInput(BaseModel):
    primary: Optional[str] = None
    accent: Optional[str] = None
    style: Optional[str] = None
    heroTitle: Optional[str] = None
    heroSubtitle: Optional[str] = None
    about: Optional[str] = None

class HighlightCardInput(BaseModel):
    title: str = ""
    desc: str = ""
    icon: str = "ShieldCheck"

class TestimonialCardInput(BaseModel):
    name: str = ""
    role: str = ""
    comment: str = ""
    rating: int = 5

class FaqItemInput(BaseModel):
    q: str = ""
    a: str = ""

class ContactCardsInput(BaseModel):
    address: bool = True
    hours: bool = True
    social: bool = True

class SectionsConfigInput(BaseModel):
    heroTitle: Optional[str] = None
    heroSubtitle: Optional[str] = None
    about: Optional[str] = None
    highlightsVisible: Optional[bool] = None
    testimonialsVisible: Optional[bool] = None
    faqVisible: Optional[bool] = None
    contactVisible: Optional[bool] = None
    contactCards: Optional[ContactCardsInput] = None
    mapsUrl: Optional[str] = None
    highlights: Optional[List[HighlightCardInput]] = None
    testimonials: Optional[List[TestimonialCardInput]] = None
    faq: Optional[List[FaqItemInput]] = None
    businessHours: Optional[str] = None

DEFAULT_SECTION_VISIBILITY = {"highlights": True, "testimonials": True, "faq": True, "contact": True}
DEFAULT_CONTACT_CARDS = {"address": True, "hours": True, "social": True}

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
    waMessageTemplates: Optional[List[dict]] = None

class GeneratorTemplateCatalogInput(BaseModel):
    catalog: dict

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

_upload_setting = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR = (_upload_setting if _upload_setting.is_absolute() else ROOT_DIR / _upload_setting).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def init_storage():
    global storage_key
    if storage_key: return storage_key
    if not os.environ.get("EMERGENT_LLM_KEY"): return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=10)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        return storage_key
    except Exception:
        return None

@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), user=Depends(current_user)):
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Format file harus JPG, PNG, WebP, atau PDF")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Ukuran file maksimal 8MB")
    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin").lower()
    file_id = uid()
    local_file_path = UPLOAD_DIR / f"{file_id}.{ext}"
    with open(local_file_path, "wb") as f:
        f.write(data)

    cloud_path = f"usahaku/uploads/{user['id']}/{file_id}.{ext}"
    try:
        key = init_storage()
        if key:
            r = requests.put(f"{STORAGE_URL}/objects/{cloud_path}", headers={"X-Storage-Key": key, "Content-Type": file.content_type}, data=data, timeout=15)
            if r.ok: cloud_path = r.json().get("path", cloud_path)
    except Exception:
        pass

    # Simpan nama file relatif agar database tetap valid saat pindah server/folder.
    record = {"id": file_id, "userId": user["id"], "localPath": local_file_path.name, "storagePath": cloud_path, "contentType": file.content_type, "originalFilename": file.filename, "size": len(data), "createdAt": now()}
    await db.files.insert_one(record)
    return {"id": record["id"], "url": f"/api/uploads/{record['id']}", "contentType": file.content_type}

@api.get("/uploads/{file_id}")
async def download_file(file_id: str):
    rec = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not rec: raise HTTPException(404, "File tidak ditemukan")
    stored_path = rec.get("localPath", "")
    local_path = Path(stored_path)
    if not local_path.is_absolute():
        local_path = UPLOAD_DIR / local_path.name
    elif not local_path.exists():
        # Pulihkan record lama yang menyimpan absolute path komputer sebelumnya.
        local_path = UPLOAD_DIR / local_path.name
    if stored_path and local_path.exists():
        with open(local_path, "rb") as f:
            return Response(content=f.read(), media_type=rec["contentType"])
    try:
        key = init_storage()
        if key:
            r = requests.get(f"{STORAGE_URL}/objects/{rec['storagePath']}", headers={"X-Storage-Key": key}, timeout=15)
            r.raise_for_status()
            return Response(content=r.content, media_type=rec["contentType"])
    except Exception as exc:
        pass
    raise HTTPException(404, "File tidak tersedia")

@api.get("/")
async def root(): return {"message": "Situska API aktif"}

@api.get("/settings/public")
async def public_settings():
    s = await db.settings.find_one({"id": "platform"}, {"_id": 0}) or DEFAULT_SETTINGS
    return {"applicationName": s.get("applicationName"), "supportEmail": s.get("supportEmail"), "adminWhatsapp": s.get("adminWhatsapp"), "bankName": s.get("bankName"), "accountName": s.get("accountName"), "accountNumber": s.get("accountNumber"), "paymentInstructions": s.get("paymentInstructions"), "additionalWebsitePrice": s.get("additionalWebsitePrice", ADDITIONAL_WEBSITE_PRICE)}

@api.get("/showcase/logo/{slug}")
async def showcase_logo(slug: str):
    """Logo SVG ringan untuk setiap website contoh; dapat dipakai seperti file gambar."""
    marks = {
        "demo-kopi-senja": ("KS", "M24 42h48v28H24z M31 33a17 17 0 0 1 34 0 M72 47h8a10 10 0 0 1 0 18h-8"),
        "demo-rumah-roti": ("RR", "M22 61c0-21 52-21 52 0v12H22z M34 42c4 8 4 16 0 22 M48 39c4 9 4 18 0 25 M62 42c4 8 4 16 0 22"),
        "demo-nusa-craft": ("NC", "M25 29h46v46H25z M25 44h46M40 29v46M56 29v46"),
        "demo-barber-co": ("BC", "M29 30l38 38M67 30L29 68M29 30a8 8 0 1 0 0 .1M67 68a8 8 0 1 0 0 .1"),
        "demo-sari-beauty": ("SB", "M48 24c7 13 18 17 18 28S55 67 48 76C41 67 30 63 30 52s11-15 18-28z M26 30l4 4m40-4-4 4"),
        "demo-warung-sundari": ("WS", "M22 57h52v16H22z M27 52c8-14 30-14 38 0 M35 29c-7 8 3 10-3 19m16-19c-7 8 3 10-3 19m16-19c-7 8 3 10-3 19"),
    }
    spec = next((item for item in SHOWCASE_SITES if item["slug"] == slug), None)
    if not spec or slug not in marks:
        raise HTTPException(404, "Logo contoh tidak ditemukan")
    initials, path = marks[slug]
    primary = spec["primary"]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="{spec['name']}">
      <rect width="96" height="96" rx="24" fill="{primary}"/>
      <path d="{path}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="48" y="90" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="9" font-weight="700">{initials}</text>
    </svg>'''
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})

@api.post("/auth/register")
async def register(data: RegisterInput, response: Response, request: Request):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(409, "Email sudah terdaftar")
    if len(data.password) < 6: raise HTTPException(400, "Password minimal 6 karakter")
    phone_raw = (data.whatsapp or data.phone or "").strip()
    phone = wa_service.normalize_number(phone_raw)
    if phone_raw and not phone:
        raise HTTPException(400, "Nomor WhatsApp tidak valid")
    if phone:
        rec = await db.wa_verifications.find_one({"phone": phone}, {"_id": 0})
        is_verified = bool(rec and rec.get("verified") and rec.get("expiresAt", "") >= now())
        if not is_verified:
            raise HTTPException(400, "Nomor WhatsApp belum diverifikasi. Masukkan kode verifikasi terlebih dahulu.")
    # The 30-day period begins only when the owner creates their first website.
    user = {"id": uid(), "name": data.name.strip(), "email": email, "password_hash": hash_password(data.password), "role": "USER", "accountStatus": "ACTIVE", "subscriptionStatus": "TRIAL_PENDING", "trialStartDate": "", "trialEndDate": "", "planSlug": "trial", "websiteQuota": 1, "additionalWebsiteQuota": 0, "whatsapp": phone, "phone": phone, "createdAt": now()}
    try:

        await db.users.insert_one(user)

    except DuplicateKeyError:

        raise HTTPException(409, "Nomor WhatsApp sudah terdaftar pada akun lain")

    await notify(user["id"], "Selamat datang di Situska", "Buat website pertamamu untuk memulai masa Gratis 30 hari.")
    if phone:
        await db.wa_verifications.delete_one({"phone": phone})
    set_auth_cookie(response, request, token(user["id"], days=AUTH_COOKIE_DAYS))
    return public(user)

@api.post("/auth/send-wa-code")
async def send_wa_code(data: WaSendInput):
    phone = wa_service.normalize_number(data.phone)
    if not phone:
        raise HTTPException(400, "Nomor WhatsApp tidak valid")
    code = f"{secrets.randbelow(1000000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.wa_verifications.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expiresAt": expires, "verified": False, "name": (data.name or ""), "createdAt": now(), "updatedAt": now()}},
        upsert=True,
    )
    msg = f"Kode verifikasi Situska: {code}. Berlaku 10 menit."
    send_res = await wa_service.send_text(db, phone, msg, event="wa_verify")
    if not send_res.get("ok"):
        await wa_service.notify_admin(
            db,
            f"Kode verifikasi pendaftaran untuk {phone}: {code}. Mohon kirim ke calon pengguna.",
            event="wa_verify_admin_fallback",
        )
        return {"ok": True, "message": "Kode verifikasi dibuat. Admin akan mengirimkan kode ke WhatsApp Anda."}
    return {"ok": True, "message": "Kode verifikasi terkirim ke WhatsApp Anda."}

@api.post("/auth/verify-wa")
async def verify_wa(data: WaVerifyInput):
    phone = wa_service.normalize_number(data.phone)
    if not phone:
        raise HTTPException(400, "Nomor WhatsApp tidak valid")
    rec = await db.wa_verifications.find_one({"phone": phone}, {"_id": 0})
    if not rec or rec.get("code") != data.code.strip() or rec.get("expiresAt", "") < now():
        raise HTTPException(400, "Kode verifikasi tidak valid atau sudah kedaluwarsa")
    await db.wa_verifications.update_one(
        {"phone": phone},
        {"$set": {"verified": True, "verifiedAt": now(), "name": (data.name or rec.get("name", "")), "updatedAt": now()}},
    )
    await upsert_wa_contact(phone, name=(data.name or rec.get("name", "")), source="verification")
    return {"ok": True, "message": "Nomor WhatsApp berhasil diverifikasi"}

@api.post("/auth/login")
async def login(data: AuthInput, response: Response, request: Request):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email atau password salah")
    if user.get("accountStatus") == "SUSPENDED":
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin Situska.")
    await refresh_status(user)
    set_auth_cookie(response, request, token(user["id"], days=AUTH_COOKIE_DAYS))
    return public(user)

@api.post("/auth/logout")
async def logout(response: Response, request: Request):
    response.delete_cookie(
        "access_token", path="/", domain=COOKIE_DOMAIN,
        secure=request_is_secure(request), samesite=COOKIE_SAMESITE,
    )
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
    if user.get("subscriptionStatus") == "TRIAL_PENDING" and count == 0:
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=TRIAL_DAYS)
        await db.users.update_one(
            {"id": user["id"], "subscriptionStatus": "TRIAL_PENDING"},
            {"$set": {"subscriptionStatus": "TRIAL_ACTIVE", "trialStartDate": trial_start.isoformat(), "trialEndDate": trial_end.isoformat()}},
        )
        user.update({"subscriptionStatus": "TRIAL_ACTIVE", "trialStartDate": trial_start.isoformat(), "trialEndDate": trial_end.isoformat()})
        await notify(user["id"], "Masa Gratis 30 hari dimulai", "Website pertama berhasil dibuat. Masa Gratis Anda aktif selama 30 hari.")
    requested_slug = slugify(data.storeSlug or data.businessName)
    duplicate = await db.websites.find_one({"$or": [{"slug": requested_slug}, {"storeSlug": requested_slug}]}, {"_id": 0})
    if duplicate:
        raise HTTPException(409, "Alamat toko sudah digunakan. Silakan pilih alamat lain.")
    t_style = data.templateStyle or "modern"
    t_config = data.themeConfig or {"primary": "#0077B6", "accent": "#03045E", "style": t_style}
    if "style" not in t_config: t_config["style"] = t_style
    website_data = data.model_dump()
    website_data["storeSlug"] = requested_slug
    website = {"id": uid(), "userId": user["id"], **website_data, "status": "DRAFT", "slug": "", "templateStyle": t_style, "themeConfig": t_config, "aiGeneratedContent": {}, "businessHours": [], "sectionVisibility": dict(DEFAULT_SECTION_VISIBILITY), "contactCards": dict(DEFAULT_CONTACT_CARDS), "mapsUrl": "", "createdAt": now(), "updatedAt": now()}
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

async def owned_article(article_id, user):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article: raise HTTPException(404, "Artikel tidak ditemukan")
    await owned_site(article["websiteId"], user)
    return article

@api.get("/websites/{site_id}/articles")
async def list_articles(site_id: str, user=Depends(current_user)):
    await owned_site(site_id, user)
    return await db.articles.find({"websiteId": site_id}, {"_id": 0}).sort("updatedAt", -1).to_list(200)

@api.post("/websites/{site_id}/articles")
async def create_article(site_id: str, data: ArticleInput, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    title = data.title.strip()
    if not title: raise HTTPException(400, "Judul artikel wajib diisi")
    base_slug = slugify(title)
    slug = base_slug
    number = 2
    while await db.articles.find_one({"websiteId": site_id, "slug": slug}):
        slug = f"{base_slug}-{number}"; number += 1
    article = {"id": uid(), "websiteId": site_id, "websiteSlug": site.get("slug") or site.get("storeSlug", ""), "title": title, "slug": slug, "excerpt": data.excerpt.strip(), "content": data.content.strip(), "coverImageUrl": data.coverImageUrl.strip(), "status": "PUBLISHED" if data.status == "PUBLISHED" else "DRAFT", "createdAt": now(), "updatedAt": now()}
    if article["status"] == "PUBLISHED": article["publishedAt"] = now()
    await db.articles.insert_one(article)
    return public(article)

@api.put("/articles/{article_id}")
async def update_article(article_id: str, data: ArticleInput, user=Depends(current_user)):
    article = await owned_article(article_id, user)
    title = data.title.strip()
    if not title: raise HTTPException(400, "Judul artikel wajib diisi")
    updates = {"title": title, "excerpt": data.excerpt.strip(), "content": data.content.strip(), "coverImageUrl": data.coverImageUrl.strip(), "status": "PUBLISHED" if data.status == "PUBLISHED" else "DRAFT", "updatedAt": now()}
    if updates["status"] == "PUBLISHED" and not article.get("publishedAt"): updates["publishedAt"] = now()
    await db.articles.update_one({"id": article_id}, {"$set": updates})
    return public(await db.articles.find_one({"id": article_id}, {"_id": 0}))

@api.delete("/articles/{article_id}")
async def delete_article(article_id: str, user=Depends(current_user)):
    await owned_article(article_id, user)
    await db.articles.delete_one({"id": article_id})
    return {"ok": True}

@api.get("/store-address/check")
async def check_store_address(slug: str, siteId: str = "", user=Depends(current_user)):
    normalized = slugify(slug)
    if not slug.strip():
        return {"slug": "", "available": False}
    query = {"$or": [{"slug": normalized}, {"storeSlug": normalized}]}
    if siteId:
        query["id"] = {"$ne": siteId}
    duplicate = await db.websites.find_one(query, {"_id": 0, "id": 1})
    return {"slug": normalized, "available": not bool(duplicate)}

@api.put("/websites/{site_id}")
async def update_website(site_id: str, data: WebsiteInput, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    updates = data.model_dump()
    requested_slug = slugify(updates.get("storeSlug") or site.get("storeSlug") or site.get("slug") or site["businessName"])
    current_slug = site.get("storeSlug") or site.get("slug") or slugify(site["businessName"])
    is_free = user.get("planSlug") == "trial"
    if is_free:
        # Nama usaha adalah identitas permanen untuk website Gratis.
        updates["businessName"] = site["businessName"]
        if site.get("status") == "PUBLISHED" and requested_slug != current_slug:
            raise HTTPException(403, "Alamat toko paket Gratis tidak dapat diubah setelah website dipublikasikan.")
    if requested_slug != current_slug:
        duplicate = await db.websites.find_one({"id": {"$ne": site_id}, "$or": [{"slug": requested_slug}, {"storeSlug": requested_slug}]}, {"_id": 0})
        if duplicate:
            raise HTTPException(409, "Alamat toko sudah digunakan. Silakan pilih alamat lain.")
    updates["storeSlug"] = current_slug if (is_free and site.get("status") == "PUBLISHED") else requested_slug
    await db.websites.update_one({"id": site_id}, {"$set": {**updates, "updatedAt": now()}})
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

@api.put("/websites/{site_id}/sections")
async def update_sections(site_id: str, data: SectionsConfigInput, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    vis = {**DEFAULT_SECTION_VISIBILITY, **(site.get("sectionVisibility") or {})}
    if data.highlightsVisible is not None: vis["highlights"] = data.highlightsVisible
    if data.testimonialsVisible is not None: vis["testimonials"] = data.testimonialsVisible
    if data.faqVisible is not None: vis["faq"] = data.faqVisible
    if data.contactVisible is not None: vis["contact"] = data.contactVisible
    updates = {"sectionVisibility": vis, "updatedAt": now()}
    if data.contactCards is not None:
        updates["contactCards"] = {**DEFAULT_CONTACT_CARDS, **data.contactCards.model_dump(exclude_none=True)}
    if data.mapsUrl is not None: updates["mapsUrl"] = (data.mapsUrl or "").strip()
    ai = {**(site.get("aiGeneratedContent") or {})}
    if data.heroTitle is not None: ai["heroTitle"] = data.heroTitle.strip()
    if data.heroSubtitle is not None: ai["heroSubtitle"] = data.heroSubtitle.strip()
    if data.about is not None: ai["about"] = data.about.strip()
    if data.highlights is not None: ai["highlights"] = [h.model_dump() for h in data.highlights][:6]
    if data.testimonials is not None: ai["testimonials"] = [t.model_dump() for t in data.testimonials][:9]
    if data.faq is not None: ai["faq"] = [f.model_dump() for f in data.faq][:10]
    if data.businessHours is not None: ai["businessHours"] = data.businessHours
    updates["aiGeneratedContent"] = ai
    await db.websites.update_one({"id": site_id}, {"$set": updates})
    return await get_website(site_id, user)

@api.delete("/websites/{site_id}")
async def delete_website(site_id: str, user=Depends(current_user)):
    site = await owned_site(site_id, user)
    if user.get("planSlug") == "trial":
        raise HTTPException(403, "Website paket Gratis tidak dapat dihapus. Upgrade paket untuk menghapus website.")
    await db.products.delete_many({"websiteId": site_id})
    await db.websites.delete_one({"id": site_id})
    return {"ok": True}

@api.post("/websites/{site_id}/products")
async def add_product(site_id: str, data: ProductInput, user=Depends(current_user)):
    await owned_site(site_id, user)
    if len(data.images) > 3: raise HTTPException(400, "Maksimal 3 gambar per produk")
    product_count = await db.products.count_documents({"websiteId": site_id})
    product_limit = product_limit_for(user)
    if product_limit is not None and product_count >= product_limit:
        raise HTTPException(403, "Paket Gratis maksimal 3 produk per website. Upgrade paket untuk katalog tanpa batas.")
    item = {"id": uid(), "websiteId": site_id, **data.model_dump(), "sortOrder": product_count, "createdAt": now()}
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

CATEGORY_KNOWLEDGE = {
    "kopi": {
        "badge": "☕ CITARASA KOPI OTENTIK",
        "heroTitle": "Temukan Jeda di Setiap Tegukan Kopi Pilihan.",
        "heroSubtitle": "Disajikan dari biji kopi lokal terbaik dengan racikan barista berpengalaman.",
        "cta": "Lihat Menu & Pesan",
        "about": "Kami hadir untuk menemani setiap momen berharga Anda. Dengan biji kopi pilihan nusantara yang disangrai sempurna, kami menyajikan kenikmatan rasa dan suasana hangat untuk bekerja, berbincang, atau sekadar melepas lelah.",
        "highlights": [
            {"title": "Biji Kopi Nusantara", "desc": "100% biji kopi lokal pilihan berkualitas premium.", "icon": "Coffee"},
            {"title": "Racikan Barista Ahli", "desc": "Konsistensi rasa terjaga di setiap cangkir kopi.", "icon": "Sparkles"},
            {"title": "Order WhatsApp Cepat", "desc": "Pesan takeaway atau dine-in tanpa antre panjang.", "icon": "MessageCircle"}
        ],
        "headline": "Menu Kopi & Cemilan Favorit",
        "subheadline": "Pilihan racikan kopi segar dan camilan lezat pendamping hari Anda.",
        "primary": "#0077B6", "accent": "#03045E", "style": "warm",
        "cover": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah bisa pesan untuk acara atau catering?", "a": "Tentu saja! Kami melayani pemesanan paket kopi botolan dan booth kopi untuk acara kantor, ulang tahun, atau pernikahan."},
            {"q": "Bagaimana cara memesan lewat WhatsApp?", "a": "Pilih menu favorit Anda di atas, klik tombol 'Pesan via WhatsApp', dan pesan otomatis akan terkirim ke barista kami."},
            {"q": "Tersedia pilihan susu non-dairy?", "a": "Ya, kami menyediakan opsi Oat Milk dan Soy Milk untuk beberapa varian minuman."}
        ],
        "testimonials": [
            {"name": "Dimas Anggara", "role": "Penikmat Kopi", "comment": "Kopi susunya juara! Manisnya pas dan aroma kopinya kuat banget. Tempat andalan kalau WFC.", "rating": 5},
            {"name": "Sarah Oktaviani", "role": "Pelanggan", "comment": "Pelayanan cepat dan ramah, kemasan takeaway-nya juga aman dan rapi.", "rating": 5}
        ]
    },
    "makanan": {
        "badge": "🍲 CITA RASA SPESIAL & HIGIENIS",
        "heroTitle": "Sajian Lezat Penuh Rasa untuk Keluarga Anda.",
        "heroSubtitle": "Resep istimewa dengan bahan rempah segar pilihan yang memanjakan lidah.",
        "cta": "Pesan Menu Sekarang",
        "about": "Menghadirkan kehangatan masakan dengan resep warisan keluarga yang diolah secara higienis. Kami percaya bahwa makanan enak berawal dari bahan segar dan ketulusan dalam menyajikan setiap porsi.",
        "highlights": [
            {"title": "Bahan Segar Setiap Hari", "desc": "Tanpa bahan pengawet, diolah langsung dari bahan segar.", "icon": "ShieldCheck"},
            {"title": "Rempah Otentik", "desc": "Perpaduan bumbu kaya rasa yang meresap sempurna.", "icon": "Flame"},
            {"title": "Pengiriman Cepat & Hangat", "desc": "Dikemas higienis agar sampai dalam kondisi terbaik.", "icon": "Truck"}
        ],
        "headline": "Pilihan Menu Terfavorit",
        "subheadline": "Daftar hidangan lezat yang paling sering dipesan pelanggan setia.",
        "primary": "#DC2626", "accent": "#991B1B", "style": "warm",
        "cover": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah menerima pesanan nasi box / katering?", "a": "Ya, kami menerima pesanan nasi box dalam jumlah besar untuk berbagai acara dengan konfirmasi H-1."},
            {"q": "Bagaimana cara melakukan pembayaran?", "a": "Kami menerima transfer bank, QRIS (GoPay, OVO, ShopeePay, Dana), serta tunai saat pick-up."},
            {"q": "Berapa lama estimasi pengiriman?", "a": "Estimasi 20-40 menit tergantung jarak lokasi pengantaran."}
        ],
        "testimonials": [
            {"name": "Hendra Kurniawan", "role": "Pelanggan", "comment": "Porsinya banyak, rasanya nagih! Bumbu rempahnya bener-bener berasa dan dagingnya empuk.", "rating": 5},
            {"name": "Maya Sasmita", "role": "Food Enthusiast", "comment": "Pesan catering untuk syukuran kantor, semua teman kantor bilang enak banget!", "rating": 5}
        ]
    },
    "bakery": {
        "badge": "🥐 FRESH FROM THE OVEN",
        "heroTitle": "Roti & Kue Lembut dengan Aroma Menggoda.",
        "heroSubtitle": "Dipanggang setiap pagi menggunakan butter premium pilihan tanpa bahan pengawet.",
        "cta": "Pesan Kue & Roti",
        "about": "Setiap gigitan roti dan kue kami adalah perpaduan kelembutan tekstur dan rasa manis yang pas. Kami memanggang setiap hari untuk memastikan kesegaran kualitas terbaik di meja makan Anda.",
        "highlights": [
            {"title": "Dipanggang Segar Tiap Hari", "desc": "Selalu fresh langsung dari oven setiap pagi.", "icon": "Sparkles"},
            {"title": "100% Butter Premium", "desc": "Rasa gurih alami tanpa pemanis buatan berlebih.", "icon": "Award"},
            {"title": "Custom Cake & Hampers", "desc": "Bisa custom ucapan untuk ulang tahun dan hari raya.", "icon": "Gift"}
        ],
        "headline": "Koleksi Roti & Pastry Terbaik",
        "subheadline": "Temukan varian roti manis, gurih, dan kue spesial hari ini.",
        "primary": "#D97706", "accent": "#78350F", "style": "warm",
        "cover": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah kue bisa dikirim ke luar kota?", "a": "Untuk cookies dan roti kering bisa dikirim ke luar kota dengan packaging bubble wrap tebal."},
            {"q": "Berapa lama ketahanan roti?", "a": "Karena tanpa pengawet, roti kami bertahan 3-4 hari di suhu ruang atau 1 minggu di dalam kulkas."}
        ],
        "testimonials": [
            {"name": "Lestari Putri", "role": "Pelanggan", "comment": "Rotinya lembut banget bahkan sampai hari ketiga! Isian coklatnya juga melimpah.", "rating": 5}
        ]
    },
    "fashion": {
        "badge": "✨ TAMPIL PERCAYA DIRI & MODIS",
        "heroTitle": "Koleksi Busana Trendy & Nyaman Setiap Hari.",
        "heroSubtitle": "Pilihan outfit modern dengan bahan berkualitas tinggi dan potongan yang presisi.",
        "cta": "Lihat Katalog Koleksi",
        "about": "Kami percaya bahwa gaya adalah ekspresi diri yang menyenangkan. Koleksi kami dirancang untuk menemani aktivitas harian Anda dengan bahan adem, jahitan rapi, dan desain yang selalu up-to-date.",
        "highlights": [
            {"title": "Bahan Nyaman & Adem", "desc": "Pilihan kain premium yang nyaman dipakai seharian.", "icon": "ShieldCheck"},
            {"title": "Model Selalu Update", "desc": "Desain kekinian yang cocok untuk casual maupun formal.", "icon": "Sparkles"},
            {"title": "Garansi Tukar Ukuran", "desc": "Kemudahan retur jika ukuran tidak sesuai.", "icon": "Award"}
        ],
        "headline": "Koleksi Paling Populer",
        "subheadline": "Pilihan outfit favorit yang siap melengkapi penampilan terbaik Anda.",
        "primary": "#4F46E5", "accent": "#312E81", "style": "elegant",
        "cover": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Bagaimana panduan ukurannya?", "a": "Setiap produk dilengkapi size chart detail. Anda juga bisa konsultasi ukuran via WhatsApp langsung dengan tim kami."},
            {"q": "Apakah bisa kirim ke seluruh Indonesia?", "a": "Ya, kami bekerja sama dengan berbagai ekspedisi reguler maupun kilat ke seluruh Indonesia."}
        ],
        "testimonials": [
            {"name": "Bella Anindya", "role": "Pelanggan", "comment": "Jahitannya sangat rapi, bahannya jatuh dan adem banget saat dipakai. Bakal langganan terus!", "rating": 5}
        ]
    },
    "salon": {
        "badge": "💆 PERAWATAN TERBAIK UNTUK ANDA",
        "heroTitle": "Tampil Lebih Segar, Percaya Diri, dan Memukau.",
        "heroSubtitle": "Layanan perawatan kecantikan dan rambut profesional dengan terapis berpengalaman.",
        "cta": "Reservasi Jadwal Sekarang",
        "about": "Manjakan diri Anda dengan rangkaian perawatan relaksasi dan kecantikan menyeluruh. Kami menghadirkan suasana yang tenang dan produk berkualitas untuk hasil terbaik Anda.",
        "highlights": [
            {"title": "Terapis Profesional", "desc": "Ditangani tenaga ahli bersertifikat dan berpengalaman.", "icon": "Award"},
            {"title": "Produk Berkualitas", "desc": "Aman untuk kulit dan rambut, teruji secara klinis.", "icon": "ShieldCheck"},
            {"title": "Reservasi Praktis", "desc": "Atur jadwal kedatangan tanpa perlu antre lama.", "icon": "Sparkles"}
        ],
        "headline": "Layanan Perawatan Favorit",
        "subheadline": "Pilihan treatment terbaik untuk menyegarkan kembali tubuh dan penampilan Anda.",
        "primary": "#DB2777", "accent": "#831843", "style": "elegant",
        "cover": "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah harus booking terlebih dahulu?", "a": "Kami menyarankan booking via WhatsApp agar Anda mendapatkan slot waktu terbaik tanpa menunggu lama."}
        ],
        "testimonials": [
            {"name": "Citra Kirana", "role": "Pelanggan", "comment": "Tempatnya bersih, wangi, dan pelayanannya sangat memuaskan. Keluar salon langsung fresh!", "rating": 5}
        ]
    },
    "otomotif": {
        "badge": "🔧 SERVICE CEPAT & TERPERCAYA",
        "heroTitle": "Performa Kendaraan Optimal, Perjalanan Nyaman.",
        "heroSubtitle": "Solusi perawatan, perbaikan mesin, dan sparepart original dengan mekanik handal.",
        "cta": "Konsultasi & Booking Service",
        "about": "Kendaraan Anda adalah partner mobilitas harian. Kami memberikan diagnosa akurat, pengerjaan teliti, dan transparansi biaya untuk memastikan keamanan berkendara Anda.",
        "highlights": [
            {"title": "Sparepart Original", "desc": "Jaminan suku cadang asli dan bergaransi resmi.", "icon": "ShieldCheck"},
            {"title": "Mekanik Berpengalaman", "desc": "Pengerjaan teliti dengan peralatan modern.", "icon": "Award"},
            {"title": "Garansi Hasil Service", "desc": "Garansi perbaikan untuk kepuasan dan ketenangan Anda.", "icon": "Sparkles"}
        ],
        "headline": "Paket Perawatan & Suku Cadang",
        "subheadline": "Pilihan layanan servis berkala dan suku cadang terbaik untuk kendaraan Anda.",
        "primary": "#0284C7", "accent": "#0369A1", "style": "professional",
        "cover": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah ada estimasi biaya sebelum pengerjaan?", "a": "Ya! Kami selalu memberikan rincian estimasi biaya dan konfirmasi sebelum melakukan penggantian part."}
        ],
        "testimonials": [
            {"name": "Bambang Sudiro", "role": "Pelanggan", "comment": "Mekaniknya jujur dan detail ngejelasin masalah mesin. Harganya juga transparan banget.", "rating": 5}
        ]
    },
    "jasa": {
        "badge": "💼 SOLUSI PROFESIONAL & TERUJI",
        "heroTitle": "Wujudkan Kebutuhan Bisnis Anda Bersama Kami.",
        "heroSubtitle": "Layanan profesional, tepat waktu, dan berorientasi pada hasil terbaik.",
        "cta": "Konsultasi Gratis Sekarang",
        "about": "Kami berkomitmen memberikan hasil kerja berkualitas tinggi yang menjawab tantangan Anda. Dengan komunikasi transparan dan dedikasi penuh, kami siap menjadi partner terpercaya Anda.",
        "highlights": [
            {"title": "Hasil Berkualitas Tinggi", "desc": "Dikerjakan dengan standar profesional dan teliti.", "icon": "Award"},
            {"title": "Pengerjaan Tepat Waktu", "desc": "Komitmen deadline yang terjaga sesuai kesepakatan.", "icon": "Sparkles"},
            {"title": "Konsultasi Responsif", "desc": "Diskusi mudah dan cepat via WhatsApp setiap saat.", "icon": "MessageCircle"}
        ],
        "headline": "Layanan Unggulan Kami",
        "subheadline": "Pilihan solusi terpadu untuk kebutuhan pribadi maupun bisnis Anda.",
        "primary": "#2563EB", "accent": "#1E3A8A", "style": "professional",
        "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Bagaimana alur kerja layanannya?", "a": "Mulai dari konsultasi kebutuhan via WhatsApp, penawaran harga, proses pengerjaan, hingga serah terima hasil."}
        ],
        "testimonials": [
            {"name": "Agus Salim", "role": "Klien", "comment": "Sangat komunikatif dan hasil kerjanya rapi serta tepat waktu. Sangat recommended!", "rating": 5}
        ]
    },
    "kesehatan": {
        "badge": "🩺 KESEHATAN KELUARGA PRIORITAS KAMI",
        "heroTitle": "Pelayanan Medis Terpercaya, Ramah, dan Nyaman.",
        "heroSubtitle": "Pemeriksaan kesehatan, konsultasi medis, dan obat-obatan lengkap untuk Anda.",
        "cta": "Konsultasi & Buat Janji",
        "about": "Kesehatan Anda dan keluarga adalah hal terpenting. Kami hadir memberikan pelayanan kesehatan dengan fasilitas bersih, tenaga medis ramah, dan penjelasan yang mudah dipahami.",
        "highlights": [
            {"title": "Tenaga Medis Kompeten", "desc": "Ditangani dokter dan tenaga medis berpengalaman.", "icon": "Award"},
            {"title": "Obat & Alkes Lengkap", "desc": "Tersedia produk farmasi resmi dan berizin BPOM.", "icon": "ShieldCheck"},
            {"title": "Konsultasi Mudah", "desc": "Tanya jadwal dan info layanan via WhatsApp cepat.", "icon": "MessageCircle"}
        ],
        "headline": "Layanan & Produk Kesehatan",
        "subheadline": "Daftar paket pemeriksaan dan produk farmasi untuk perlindungan keluarga.",
        "primary": "#0D9488", "accent": "#115E59", "style": "modern",
        "cover": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop",
        "faq": [
            {"q": "Apakah melayani resep dokter dari luar?", "a": "Ya, kami melayani penebusan resep dokter resmi dengan stok obat lengkap."}
        ],
        "testimonials": [
            {"name": "Nurul Hidayah", "role": "Pasien", "comment": "Dokter dan perawatnya sangat ramah, penjelasannya detail dan ruangannya bersih banget.", "rating": 5}
        ]
    }
}

DEFAULT_KNOWLEDGE = {
    "badge": "⭐ KUALITAS TERBAIK & TERPERCAYA",
    "heroTitle": "Solusi dan Produk Terbaik untuk Kebutuhan Anda.",
    "heroSubtitle": "Menghadirkan pelayanan prima, produk berkualitas, dan kemudahan pemesanan.",
    "cta": "Pesan via WhatsApp",
    "about": "Kami berdedikasi menghadirkan produk dan layanan terbaik dengan mengutamakan kepuasan pelanggan. Setiap pesanan diproses dengan teliti, cepat, dan penuh rasa tanggung jawab.",
    "highlights": [
        {"title": "Kualitas Terjamin", "desc": "Produk teruji dengan standar mutu terbaik untuk Anda.", "icon": "ShieldCheck"},
        {"title": "Layanan Ramah & Cepat", "desc": "Respons sigap dan bersahabat melayani setiap pertanyaan.", "icon": "Sparkles"},
        {"title": "Pemesanan Praktis", "desc": "Mudah terhubung langsung melalui kontak WhatsApp kami.", "icon": "MessageCircle"}
    ],
    "headline": "Produk & Layanan Unggulan",
    "subheadline": "Pilihan produk berkualitas yang siap melengkapi kebutuhan harian Anda.",
    "primary": "#0077B6", "accent": "#03045E", "style": "modern",
    "cover": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?q=80&w=1200&auto=format&fit=crop",
    "faq": [
        {"q": "Bagaimana cara memesan produk?", "a": "Pilih produk yang Anda inginkan pada katalog, lalu klik tombol 'Pesan via WhatsApp'. Tim kami akan segera merespons Anda."},
        {"q": "Metode pembayaran apa saja yang tersedia?", "a": "Kami menerima transfer bank, e-wallet (QRIS), serta pembayaran langsung di tempat."}
    ],
    "testimonials": [
        {"name": "Rina Wijaya", "role": "Pelanggan Setia", "comment": "Pelayanannya cepat dan produknya sangat memuaskan. Sangat direkomendasikan!", "rating": 5}
    ]
}

def detect_category_knowledge(category_str, name_str):
    text = f"{(category_str or '').lower()} {(name_str or '').lower()}"
    if any(k in text for k in ["kopi", "coffee", "cafe", "kafe", "kedai"]): return CATEGORY_KNOWLEDGE["kopi"]
    if any(k in text for k in ["makanan", "kuliner", "resto", "restoran", "warung", "catering", "dapur", "nasi", "ayam", "bebek", "soto", "bakso"]): return CATEGORY_KNOWLEDGE["makanan"]
    if any(k in text for k in ["bakery", "roti", "kue", "pastry", "cake", "donat", "bolu"]): return CATEGORY_KNOWLEDGE["bakery"]
    if any(k in text for k in ["fashion", "pakaian", "baju", "butik", "distro", "hijab", "gamis", "sepatu", "tas"]): return CATEGORY_KNOWLEDGE["fashion"]
    if any(k in text for k in ["salon", "barber", "barbershop", "kecantikan", "spa", "skincare", "facial", "nail"]): return CATEGORY_KNOWLEDGE["salon"]
    if any(k in text for k in ["otomotif", "bengkel", "motor", "mobil", "cuci", "ban", "oli"]): return CATEGORY_KNOWLEDGE["otomotif"]
    if any(k in text for k in ["kesehatan", "klinik", "apotek", "dokter", "gigi", "dental", "medis"]): return CATEGORY_KNOWLEDGE["kesehatan"]
    if any(k in text for k in ["jasa", "konsultan", "fotografi", "desain", "studio", "service", "laundry", "cleaning"]): return CATEGORY_KNOWLEDGE["jasa"]
    return DEFAULT_KNOWLEDGE

async def ai_json(site, products, command=""):
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
    prompt = f"""Buat konfigurasi website UMKM Indonesia. Kembalikan JSON valid saja.
Jangan mengarang informasi bisnis yang tidak diberikan.
Data bisnis: {json.dumps({'business': {k: site.get(k) for k in ('businessName', 'category', 'description', 'city', 'province', 'whatsapp', 'instagram')}, 'products': [{'name': p.get('name'), 'price': p.get('price'), 'description': p.get('description')} for p in products]}, ensure_ascii=False)}
Instruksi tambahan dari pemilik: {command or 'tidak ada'}
Struktur JSON yang wajib: {{
  "heroBadge": string label singkat menarik (max 5 kata),
  "heroTitle": string singkat (max 8 kata),
  "heroSubtitle": string 1-2 kalimat menarik,
  "heroCta": string call to action singkat,
  "about": string paragraf tentang bisnis (2-4 kalimat),
  "highlights": array 3 object [{{"title": string, "desc": string, "icon": string}}],
  "productHeadline": string judul bagian produk,
  "productSubheadline": string pengantar katalog produk,
  "primaryColor": hex color yang cocok dengan karakter bisnis,
  "accentColor": hex color pelengkap,
  "style": salah satu dari [modern, minimal, elegant, playful, professional, warm],
  "businessHours": string jam operasional (contoh: "Senin - Minggu: 08:00 - 22:00 WIB"),
  "faq": array 2-3 object [{{"q": string pertanyaan, "a": string jawaban}}],
  "testimonials": array 2 object [{{"name": string, "role": string, "comment": string, "rating": 5}}]
}}"""

    if HAS_EMERGENT and os.environ.get("EMERGENT_LLM_KEY"):
        try:
            chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=uid(), system_message="You create Indonesian website content in valid JSON only. Never invent facts not present in the input.").with_model("gemini", "gemini-3-flash-preview")
            chunks = []
            async for event in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(event, TextDelta): chunks.append(event.content)
                if isinstance(event, StreamDone): break
            raw = "".join(chunks).strip().replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            log.warning("Emergent LLM call failed: %s", e)

    if gemini_key:
        try:
            from google import genai
            client_ai = genai.Client(api_key=gemini_key)
            response = client_ai.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            raw = response.text.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            log.warning("Google GenAI call failed: %s", e)

    # Smart Template Engine Fallback
    b_name = site.get("businessName") or "Usaha Kami"
    cat = site.get("category") or "Lainnya"
    city = site.get("city") or "Indonesia"
    desc = site.get("description")
    
    tpl = detect_category_knowledge(cat, b_name)
    
    pri = tpl["primary"]
    acc = tpl["accent"]
    sty = tpl["style"]
    
    if command:
        cmd_l = command.lower()
        if "elegan" in cmd_l: sty = "elegant"; pri = "#1E293B"; acc = "#0F172A"
        elif "hijau" in cmd_l: pri = "#16A34A"; acc = "#14532D"
        elif "biru" in cmd_l: pri = "#2563EB"; acc = "#1E3A8A"
        elif "merah" in cmd_l: pri = "#DC2626"; acc = "#991B1B"
        elif "modern" in cmd_l: sty = "modern"
        elif "hangat" in cmd_l: sty = "warm"; pri = "#B45309"; acc = "#78350F"

    return {
        "heroBadge": tpl["badge"],
        "heroTitle": tpl["heroTitle"].replace("Usaha Anda", b_name),
        "heroSubtitle": tpl["heroSubtitle"],
        "heroCta": tpl["cta"],
        "about": desc if (desc and len(desc) > 30) else f"{b_name} berlokasi di {city}. {tpl['about']}",
        "highlights": tpl["highlights"],
        "productHeadline": tpl["headline"],
        "productSubheadline": tpl["subheadline"],
        "primaryColor": pri,
        "accentColor": acc,
        "style": sty,
        "businessHours": "Senin - Minggu: 08:00 - 22:00 WIB",
        "faq": tpl["faq"],
        "testimonials": tpl["testimonials"]
    }

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
    # Tema dipilih pengguna pada wizard harus selalu menang atas rekomendasi AI.
    # AI hanya menyediakan warna fallback untuk website lama yang belum memiliki tema.
    selected_theme = site.get("themeConfig") or {}
    theme = {
        "primary": selected_theme.get("primary") or content.get("primaryColor", "#0077B6"),
        "accent": selected_theme.get("accent") or content.get("accentColor", "#03045E"),
        "style": site.get("templateStyle") or selected_theme.get("style") or content.get("style", "modern"),
    }
    await db.websites.update_one({"id": site_id}, {"$set": {"aiGeneratedContent": content, "themeConfig": theme, "updatedAt": now()}})
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
    # Perintah AI dapat mengubah konten, tetapi tidak boleh diam-diam mengganti
    # palet dan template yang telah dipilih pemilik website.
    await db.websites.update_one({"id": site_id}, {"$set": {"aiGeneratedContent": content, "updatedAt": now()}})
    return await get_website(site_id, user)

@api.post("/websites/{site_id}/publish")
async def publish(site_id: str, user=Depends(current_user)):
    user = await refresh_status(user)
    if not is_owner_active(user):
        raise HTTPException(403, "Website hanya dapat dipublikasikan saat berlangganan aktif.")
    site = await owned_site(site_id, user)
    slug = site.get("slug") or site.get("storeSlug") or slugify(site["businessName"])
    duplicate = await db.websites.find_one({"slug": slug, "id": {"$ne": site_id}}, {"_id": 0})
    if duplicate:
        raise HTTPException(409, "Alamat toko sudah digunakan. Silakan ubah alamat toko sebelum dipublikasikan.")
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

@api.get("/public/{slug}/articles")
async def public_articles(slug: str):
    site = await db.websites.find_one({"slug": slug, "status": "PUBLISHED"}, {"_id": 0})
    if not site: raise HTTPException(404, "Website belum dipublikasikan")
    return await db.articles.find({"websiteId": site["id"], "status": "PUBLISHED"}, {"_id": 0, "content": 0}).sort("publishedAt", -1).to_list(200)

@api.get("/public/{slug}/articles/{article_slug}")
async def public_article(slug: str, article_slug: str):
    site = await db.websites.find_one({"slug": slug, "status": "PUBLISHED"}, {"_id": 0})
    if not site: raise HTTPException(404, "Website belum dipublikasikan")
    article = await db.articles.find_one({"websiteId": site["id"], "slug": article_slug, "status": "PUBLISHED"}, {"_id": 0})
    if not article: raise HTTPException(404, "Artikel tidak ditemukan")
    return {"website": {"businessName": site["businessName"], "category": site.get("category", ""), "slug": slug, "logoUrl": site.get("logoUrl", "")}, "article": article}

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

    # ===== Notifikasi WhatsApp (tidak menggagalkan checkout bila gagal) =====
    async def _wa_order_notifications():
        tpl_vars = dict(nama=user.get("name", ""), id=p["id"], paket=plan["name"],
                        total=rupiah(amount), email=user.get("email", ""))
        cust_msg = render_template("order_new_customer", **tpl_vars)
        await wa_service.send_text(db, user.get("whatsapp", ""), cust_msg,
                                   event="order_new_customer", ref_id=payment["id"])
        admin_msg = render_template("order_new_admin", **tpl_vars)
        await wa_service.notify_admin(db, admin_msg, event="order_new_admin",
                                      ref_id=payment["id"])
        # Auto-capture kontak pemesan + tautkan ke akun user
        try:
            await upsert_wa_contact(user.get("whatsapp", ""), name=user.get("name", ""),
                                    category=plan.get("name", ""), source="order",
                                    user_id=p["userId"])
            await enrich_contact_from_website(user.get("whatsapp", ""))
        except Exception as e:
            log.warning("capture kontak order gagal: %s", e)
    wa_service.fire_and_forget(_wa_order_notifications())

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

@api.delete("/admin/users/{uid_}")
async def admin_user_delete(uid_: str, admin=Depends(admin_user)):
    user = await db.users.find_one({"id": uid_}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1})
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if user.get("role") == "ADMIN":
        raise HTTPException(400, "Akun admin tidak dapat dihapus")

    file_docs = await db.files.find({"userId": uid_}, {"_id": 0, "localPath": 1}).to_list(500)
    for f in file_docs:
        local_path = f.get("localPath")
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass

    await db.users.delete_one({"id": uid_})
    await db.websites.delete_many({"userId": uid_})
    await db.payments.delete_many({"userId": uid_})
    await db.notifications.delete_many({"userId": uid_})
    await db.password_reset_tokens.delete_many({"userId": uid_})
    await db.files.delete_many({"userId": uid_})
    await db.coupon_redemptions.delete_many({"userId": uid_})

    await log_activity(admin["id"], "delete_user", target_user_id=uid_, notes=f"Hapus user {user.get('email', '')}")
    return {"ok": True}

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

@api.get("/admin/articles")
async def admin_articles(_=Depends(admin_user)):
    articles = await db.articles.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(500)
    sites = await db.websites.find({"id": {"$in": list({a.get("websiteId") for a in articles})}}, {"_id": 0, "id": 1, "businessName": 1, "slug": 1}).to_list(500)
    lookup = {site["id"]: site for site in sites}
    for article in articles: article["website"] = lookup.get(article.get("websiteId"), {})
    return articles

@api.get("/admin/buildza-articles")
async def admin_buildza_articles(_=Depends(admin_user)):
    return await db.platform_articles.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(500)

@api.post("/admin/buildza-articles")
async def create_buildza_article(data: ArticleInput, admin=Depends(admin_user)):
    title = data.title.strip()
    if not title: raise HTTPException(400, "Judul artikel wajib diisi")
    base_slug, slug, number = slugify(title), slugify(title), 2
    while await db.platform_articles.find_one({"slug": slug}):
        slug = f"{base_slug}-{number}"; number += 1
    article = {"id": uid(), "title": title, "slug": slug, "excerpt": data.excerpt.strip(), "content": data.content.strip(), "coverImageUrl": data.coverImageUrl.strip(), "status": "PUBLISHED" if data.status == "PUBLISHED" else "DRAFT", "createdAt": now(), "updatedAt": now(), "authorId": admin["id"]}
    if article["status"] == "PUBLISHED": article["publishedAt"] = now()
    await db.platform_articles.insert_one(article)
    await log_activity(admin["id"], "create_buildza_article", None, article["id"], title)
    return public(article)

@api.put("/admin/buildza-articles/{article_id}")
async def update_buildza_article(article_id: str, data: ArticleInput, admin=Depends(admin_user)):
    article = await db.platform_articles.find_one({"id": article_id}, {"_id": 0})
    if not article: raise HTTPException(404, "Artikel Situska tidak ditemukan")
    if not data.title.strip(): raise HTTPException(400, "Judul artikel wajib diisi")
    updates = {"title": data.title.strip(), "excerpt": data.excerpt.strip(), "content": data.content.strip(), "coverImageUrl": data.coverImageUrl.strip(), "status": "PUBLISHED" if data.status == "PUBLISHED" else "DRAFT", "updatedAt": now()}
    if updates["status"] == "PUBLISHED" and not article.get("publishedAt"): updates["publishedAt"] = now()
    await db.platform_articles.update_one({"id": article_id}, {"$set": updates})
    return public(await db.platform_articles.find_one({"id": article_id}, {"_id": 0}))

@api.delete("/admin/buildza-articles/{article_id}")
async def delete_buildza_article(article_id: str, admin=Depends(admin_user)):
    result = await db.platform_articles.delete_one({"id": article_id})
    if not result.deleted_count: raise HTTPException(404, "Artikel Situska tidak ditemukan")
    await log_activity(admin["id"], "delete_buildza_article", None, article_id, "Artikel Situska dihapus")
    return {"ok": True}

@api.get("/content/buildza-articles")
async def public_buildza_articles():
    return await db.platform_articles.find({"status": "PUBLISHED"}, {"_id": 0, "content": 0}).sort("publishedAt", -1).to_list(200)

@api.get("/content/buildza-articles/{article_slug}")
async def public_buildza_article(article_slug: str):
    article = await db.platform_articles.find_one({"slug": article_slug, "status": "PUBLISHED"}, {"_id": 0})
    if not article: raise HTTPException(404, "Artikel tidak ditemukan")
    return article

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
    wa_message = f"Halo {user.get('name', '')}, pembayaran paket {plan['name']} sebesar Rp{int(p['amount']):,} telah disetujui. Berlangganan Anda aktif hingga {expiry.strftime('%d %B %Y')}{bonus_note}. Terima kasih telah menggunakan Situska.".replace(",", ".")
    wa_link = f"https://wa.me/{(user.get('whatsapp') or '').replace('+','').replace(' ','')}?text={wa_message}" if user.get('whatsapp') else ""

    # ===== Notifikasi WhatsApp: pesanan disetujui (tidak menggagalkan approve) =====
    async def _wa_approved():
        msg = render_template("approved", nama=user.get("name", ""), id=p["id"],
                              paket=plan["name"], berlaku=expiry.strftime("%d %B %Y"),
                              bonus=f" (+{coupon_days} hari bonus)" if coupon_days else "")
        await wa_service.send_text(db, user.get("whatsapp", ""), msg,
                                   event="order_approved", ref_id=pid)
    wa_service.fire_and_forget(_wa_approved())

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
    wa_message = f"Halo {user.get('name', '') if user else ''}, mohon maaf pembayaran paket {p.get('planName', '')} tidak dapat kami verifikasi. Alasan: {data.reason}. Silakan kirim ulang bukti transfer via Situska."

    # ===== Notifikasi WhatsApp: pesanan ditolak (tidak menggagalkan reject) =====
    async def _wa_rejected():
        msg = render_template("rejected", nama=user.get("name", "") if user else "",
                              id=p["id"], alasan=data.reason)
        await wa_service.send_text(db, (user or {}).get("whatsapp", ""), msg,
                                   event="order_rejected", ref_id=pid)
    wa_service.fire_and_forget(_wa_rejected())

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

class PlanCreateInput(BaseModel):
    name: str
    monthlyPrice: float = 0
    websiteLimit: int = 1
    features: List[str] = []
    allowsAdditional: bool = False
    isActive: bool = True

@api.post("/admin/plans")
async def admin_create_plan(data: PlanCreateInput, admin=Depends(admin_user)):
    name = data.name.strip()
    if not name: raise HTTPException(400, "Nama paket wajib diisi")
    slug = slugify(name)
    if await db.plans.find_one({"slug": slug}):
        raise HTTPException(409, f"Paket dengan nama '{name}' sudah ada")
    doc = {"id": uid(), "slug": slug, "name": name, "monthlyPrice": data.monthlyPrice, "websiteLimit": data.websiteLimit, "features": data.features, "isActive": data.isActive, "allowsAdditional": data.allowsAdditional, "createdAt": now()}
    await db.plans.insert_one(doc)
    await log_activity(admin["id"], "create_plan", None, slug, json.dumps({"monthlyPrice": data.monthlyPrice, "websiteLimit": data.websiteLimit}))
    return public(doc)

@api.delete("/admin/plans/{slug}")
async def admin_delete_plan(slug: str, admin=Depends(admin_user)):
    plan = await db.plans.find_one({"slug": slug})
    if not plan: raise HTTPException(404, "Paket tidak ditemukan")
    if slug == "trial" or plan.get("isDefault"):
        raise HTTPException(400, "Paket trial bawaan tidak bisa dihapus. Nonaktifkan saja jika tidak dipakai.")
    inUse = await db.users.count_documents({"planSlug": slug})
    if inUse > 0:
        raise HTTPException(400, f"Paket masih dipakai {inUse} pengguna. Nonaktifkan paket ini alih-alih menghapusnya.")
    await db.plans.delete_one({"slug": slug})
    await log_activity(admin["id"], "delete_plan", None, slug, plan.get("name", ""))
    return {"ok": True}

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

# Generator templates are intentionally kept in a single portable catalogue.
# The frontend has defaults for a fresh installation; after an admin saves,
# every generator screen reads this document regardless of the active domain.
@api.get("/generator-templates")
async def generator_templates_get():
    doc = await db.settings.find_one({"id": "generator-template-catalog"}, {"_id": 0})
    return {"catalog": doc.get("catalog") if doc else None}

@api.get("/sitemap.xml")
async def sitemap(request: Request):
    """Domain-aware sitemap for the platform and every public generated site."""
    from xml.sax.saxutils import escape
    configured = (os.environ.get("PUBLIC_APP_URL") or "https://situska.com").strip().rstrip("/")
    base = configured
    seo_pages = ["website-usaha", "website-umkm", "website-toko-online", "website-cafe", "website-restoran", "website-bengkel", "website-barbershop", "website-bakery", "website-jasa", "artikel"]
    pages = [(f"{base}/", None), *[(f"{base}/{path}", None) for path in seo_pages]]
    # Only index public websites that contain enough real business information.
    # Drafts, empty shells, and explicitly opted-out sites stay out of Google.
    indexable_query = {"status": "PUBLISHED", "seoNoIndex": {"$ne": True}, "businessName": {"$exists": True, "$ne": ""}, "$or": [{"description": {"$exists": True, "$ne": ""}}, {"aiGeneratedContent.heroTitle": {"$exists": True, "$ne": ""}}]}
    sites = await db.websites.find(indexable_query, {"_id": 0, "id": 1, "slug": 1, "updatedAt": 1}).to_list(50000)
    for site in sites:
        if site.get("slug"):
            pages.append((f"{base}/site/{site['slug']}", site.get("updatedAt")))
    site_slugs = {site.get("id"): site.get("slug") for site in sites}
    articles = await db.articles.find({"status": "PUBLISHED"}, {"_id": 0, "websiteId": 1, "slug": 1, "updatedAt": 1}).to_list(50000)
    for article in articles:
        website_slug = site_slugs.get(article.get("websiteId"))
        if website_slug and article.get("slug"):
            pages.append((f"{base}/site/{website_slug}/artikel/{article['slug']}", article.get("updatedAt")))
    platform_articles = await db.platform_articles.find({"status": "PUBLISHED"}, {"_id": 0, "slug": 1, "updatedAt": 1}).to_list(50000)
    for article in platform_articles:
        if article.get("slug"):
            pages.append((f"{base}/artikel/{article['slug']}", article.get("updatedAt")))
    urls = "".join(f"<url><loc>{escape(url)}</loc>{f'<lastmod>{escape(updated[:10])}</lastmod>' if updated else ''}</url>" for url, updated in pages)
    return Response(content=f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>', media_type="application/xml")

@api.get("/admin/generator-templates")
async def admin_generator_templates_get(_=Depends(admin_user)):
    doc = await db.settings.find_one({"id": "generator-template-catalog"}, {"_id": 0})
    return {"catalog": doc.get("catalog") if doc else None, "updatedAt": doc.get("updatedAt") if doc else None}

@api.put("/admin/generator-templates")
async def admin_generator_templates_update(data: GeneratorTemplateCatalogInput, admin=Depends(admin_user)):
    catalog = data.catalog or {}
    for key in ("contents", "logos", "covers"):
        if not isinstance(catalog.get(key, []), list):
            raise HTTPException(400, f"Data {key} harus berupa daftar template")
    await db.settings.update_one(
        {"id": "generator-template-catalog"},
        {"$set": {"catalog": catalog, "updatedAt": now(), "updatedBy": admin["id"]}},
        upsert=True,
    )
    await log_activity(admin["id"], "update_generator_templates", None, "generator-template-catalog", "Katalog template generator diperbarui")
    return {"ok": True, "catalog": catalog}

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
    result = await db.coupons.delete_one({"code": code.upper()})
    if result.deleted_count == 0: raise HTTPException(404, "Kupon tidak ditemukan")
    await log_activity(admin["id"], "delete_coupon", None, code.upper(), "")
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
        raise HTTPException(403, "Aktifkan paket atau berlangganan untuk memakai demo.")
    count = await db.websites.count_documents({"userId": user["id"]})
    q = quota_for(user)
    if count >= q:
        raise HTTPException(403, "Limit website Anda sudah tercapai. Silakan upgrade paket.")
    website = {"id": uid(), "userId": user["id"], "businessName": "Kopi Senja", "category": "Coffee Shop", "description": "Kedai kopi kecil dengan biji lokal pilihan dan suasana hangat. Cocok untuk bersantai, berbincang, atau bekerja santai.", "logoUrl": "", "coverImageUrl": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1600&auto=format&fit=crop", "whatsapp": "6281234567890", "phone": "", "email": "halo@kopisenja.id", "instagram": "@kopisenja", "facebook": "", "tiktok": "", "address": "Jl. Kemang Raya No. 12", "city": "Jakarta Selatan", "province": "DKI Jakarta", "postalCode": "12730", "latitude": None, "longitude": None, "customDomain": "", "status": "DRAFT", "slug": "", "themeConfig": {"primary": "#0077B6", "accent": "#03045E", "style": "warm"}, "aiGeneratedContent": {"heroTitle": "Temukan jeda di setiap teguk.", "heroSubtitle": "Kopi pilihan, suasana hangat, dan cerita yang dekat setiap hari.", "heroCta": "Jelajahi menu", "about": "Kopi Senja adalah kedai kopi kecil di Kemang yang menyajikan biji lokal pilihan. Kami percaya kopi bukan hanya minuman—tapi jeda hangat di tengah hari yang sibuk.", "highlights": ["Biji kopi lokal pilihan", "Suasana hangat & tenang", "Cocok untuk santai dan kerja"], "productHeadline": "Menu favorit", "primaryColor": "#0077B6", "accentColor": "#03045E", "style": "warm"}, "businessHours": [], "createdAt": now(), "updatedAt": now()}
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

# ========== WhatsApp Gateway (GoWA): Webhook, Inbox Chat, Broadcast, Monitoring ==========

class WaModeInput(BaseModel):
    mode: str  # AUTO / MANUAL

class WaConfigInput(BaseModel):
    globalAuto: bool

class WaReplyInput(BaseModel):
    text: str

class WaBroadcastInput(BaseModel):
    numbers: List[str] = []
    message: str = ""
    category: str = ""

class WaContactImportInput(BaseModel):
    numbers: List[str]
    category: str = ""
    defaultName: str = ""

class WaContactUpdateInput(BaseModel):
    name: Optional[str] = None
    websiteName: Optional[str] = None
    categories: Optional[List[str]] = None
    notes: Optional[str] = None

class WaContactSendInput(BaseModel):
    text: str

# ---------- Helper buku kontak WA (auto-capture & enrich) ----------

async def upsert_wa_contact(phone_raw: str, *, name: str = "", website_name: str = "",
                            category: str = "", source: str = "auto",
                            user_id: str = "", website_id: str = "") -> Optional[dict]:
    """Simpan/perbarui kontak WA otomatis + tautkan ke user & website bila diketahui."""
    phone = wa_service.normalize_number(phone_raw)
    if not phone:
        return None
    existing = await db.wa_contacts.find_one({"phone": phone}, {"_id": 0})
    t = now()
    if not existing:
        doc = {"id": uuid.uuid4().hex, "phone": phone,
               "name": name or "", "websiteName": website_name or "",
               "categories": [category] if category else [],
               "source": source, "notes": "",
               "userId": user_id,            # pemilik akun Buildza (bila cocok)
               "websiteId": website_id,      # website bisnis milik nomor ini (bila cocok)
               "lastContactAt": t, "createdAt": t}
        await db.wa_contacts.insert_one(doc)
        return doc
    upd = {"$set": {"lastContactAt": t}}
    if name and not existing.get("name"):
        upd["$set"]["name"] = name
    if website_name and not existing.get("websiteName"):
        upd["$set"]["websiteName"] = website_name
    if user_id and not existing.get("userId"):
        upd["$set"]["userId"] = user_id
    if website_id and not existing.get("websiteId"):
        upd["$set"]["websiteId"] = website_id
    if category and category not in existing.get("categories", []):
        upd["$addToSet"] = {"categories": category}
    await db.wa_contacts.update_one({"id": existing["id"]}, upd)
    return {**existing, **upd.get("$set", {})}

async def enrich_contact_from_website(phone_raw: str):
    """Isi nama/web/kategori + tautan userId & websiteId otomatis
    dari data website bisnis yang nomor WhatsApp-nya cocok."""
    phone = wa_service.normalize_number(phone_raw)
    if not phone:
        return
    sites = await db.websites.find({"whatsapp": {"$nin": ["", None]}},
                                   {"_id": 0, "id": 1, "userId": 1, "businessName": 1,
                                    "whatsapp": 1, "category": 1}).to_list(1000)
    for s in sites:
        if wa_service.normalize_number(s.get("whatsapp", "")) == phone:
            await upsert_wa_contact(phone,
                                    name=s.get("businessName", ""),
                                    website_name=s.get("businessName", ""),
                                    category=s.get("category", ""),
                                    source="website",
                                    user_id=s.get("userId", ""),
                                    website_id=s.get("id", ""))
            return

@api.post("/admin/wa/contacts/import")
async def wa_contacts_import(data: WaContactImportInput, admin=Depends(admin_user)):
    """Impor massal nomor (hasil scraping grup / daftar manual).
    Nomor sudah terdaftar hanya diperbarui kategorinya (tidak dobel)."""
    added, updated, invalid = 0, 0, []
    seen_in_batch = set()
    for raw in (data.numbers or []):
        phone = wa_service.normalize_number(raw)
        if not phone or phone in seen_in_batch:
            if raw.strip():
                invalid.append(raw.strip())
            continue
        seen_in_batch.add(phone)
        exists = await db.wa_contacts.find_one({"phone": phone})
        if exists:
            upd: dict = {}
            if data.category and data.category not in exists.get("categories", []):
                upd["$addToSet"] = {"categories": data.category}
            if data.defaultName and not exists.get("name"):
                upd["$set"] = {"name": data.defaultName}
            if upd:
                await db.wa_contacts.update_one({"phone": phone}, upd)
            updated += 1
        else:
            await db.wa_contacts.insert_one({
                "id": uuid.uuid4().hex, "phone": phone,
                "name": data.defaultName or "", "websiteName": "",
                "categories": [data.category] if data.category else [],
                "source": "import", "notes": "",
                "lastContactAt": "", "createdAt": now()})
            added += 1
    await log_activity(admin["id"], "wa_contacts_import", None, f"{added}+{updated}", f"invalid:{len(invalid)}")
    return {"ok": True, "added": added, "updated": updated, "invalid": invalid[:20], "invalidCount": len(invalid)}

@api.get("/admin/wa/contacts")
async def wa_contacts_list(q: str = "", category: str = "", _=Depends(admin_user)):
    query = {}
    if category.strip() and category != "ALL":
        query["categories"] = category.strip()
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"phone": rx}, {"websiteName": rx}]
    items = await db.wa_contacts.find(query, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return items

@api.get("/admin/wa/contacts/categories")
async def wa_contact_categories(_=Depends(admin_user)):
    cats = await db.wa_contacts.distinct("categories")
    return sorted([c for c in cats if c])

class WaContactCreateInput(BaseModel):
    phone: str
    name: str = ""
    websiteName: str = ""
    categories: List[str] = []
    notes: str = ""

@api.post("/admin/wa/contacts")
async def wa_contact_create(data: WaContactCreateInput, admin=Depends(admin_user)):
    phone = wa_service.normalize_number(data.phone)
    if not phone:
        raise HTTPException(400, "Nomor tidak valid")
    if await db.wa_contacts.find_one({"phone": phone}):
        raise HTTPException(409, "Nomor sudah terdaftar")
    doc = {"id": uuid.uuid4().hex, "phone": phone, "name": data.name.strip(),
           "websiteName": data.websiteName.strip(), "categories": [c.strip() for c in data.categories if c.strip()],
           "source": "manual", "notes": data.notes, "lastContactAt": "", "createdAt": now()}
    await db.wa_contacts.insert_one(doc)
    return public(doc)

@api.put("/admin/wa/contacts/{cid}")
async def wa_contact_update(cid: str, data: WaContactUpdateInput, admin=Depends(admin_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Tidak ada perubahan")
    if "categories" in updates:
        updates["categories"] = [c.strip() for c in updates["categories"] if c.strip()]
    r = await db.wa_contacts.update_one({"id": cid}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Kontak tidak ditemukan")
    return await db.wa_contacts.find_one({"id": cid}, {"_id": 0})

@api.delete("/admin/wa/contacts/{cid}")
async def wa_contact_delete(cid: str, admin=Depends(admin_user)):
    r = await db.wa_contacts.delete_one({"id": cid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Kontak tidak ditemukan")
    return {"ok": True}

@api.post("/admin/wa/contacts/{cid}/send")
async def wa_contact_send(cid: str, data: WaContactSendInput, admin=Depends(admin_user)):
    """Send one outreach message; follow-up is intentionally handled in WhatsApp by the admin."""
    text = data.text.strip()
    if not text:
        raise HTTPException(400, "Pesan tidak boleh kosong")
    contact = await db.wa_contacts.find_one({"id": cid}, {"_id": 0})
    if not contact:
        raise HTTPException(404, "Kontak tidak ditemukan")
    res = await wa_service.send_text(db, contact["phone"], text, event="wa_contact_manual", ref_id=cid)
    await db.wa_contacts.update_one({"id": cid}, {"$set": {"lastContactAt": now()}})
    await log_activity(admin["id"], "wa_contact_manual_send", None, cid, "")
    return {"ok": res.get("ok", False), "error": res.get("error", "")}

# ---------- Broadcast: dukung filter kategori ----------
@api.post("/admin/wa/broadcast")
async def wa_broadcast_send(data: WaBroadcastInput, admin=Depends(admin_user)):
    numbers = [n for n in (data.numbers or []) if n.strip()]
    if data.category and data.category != "ALL":
        contacts = await db.wa_contacts.find({"categories": data.category}, {"_id": 0, "phone": 1}).to_list(2000)
        numbers = [c["phone"] for c in contacts]
    numbers = list(dict.fromkeys(numbers))
    if not numbers:
        raise HTTPException(400, "Daftar nomor kosong (atau kategori tidak punya kontak)")
    if not data.message.strip():
        raise HTTPException(400, "Pesan tidak boleh kosong")
    bid = uuid.uuid4().hex[:12]
    doc = {"id": bid, "total": len(numbers), "sentCount": 0, "failCount": 0,
           "done": False, "message": data.message.strip(), "category": data.category or "",
           "createdBy": admin.get("email", "admin"), "createdAt": now()}
    await db.wa_broadcasts.insert_one(doc)
    wa_service.fire_and_forget(wa_service.broadcast(db, bid, numbers, data.message.strip()))
    return {"ok": True, "broadcastId": bid, "total": len(numbers)}

def _parse_gowa_message(payload: dict):
    """Parsing toleran payload webhook GoWA (format antar versi berbeda).
    Mengembalikan dict normalisasi atau None jika bukan event pesan masuk."""
    def walk(node):
        """Cari dict kandidat yang punya penanda pesan."""
        found = []
        if isinstance(node, dict):
            keys = set(node.keys())
            marker = keys & {"message_id", "chat_jid", "remoteJid", "key"}
            has_textish = keys & {"text", "body", "conversation", "content", "message"}
            if marker or (has_textish and ("from_me" in keys or "fromMe" in keys)):
                found.append(node)
            for v in node.values():
                found.extend(walk(v))
        elif isinstance(node, list):
            for v in node:
                found.extend(walk(v))
        return found

    candidates = walk(payload)
    src = {}
    for cand in candidates:
        # pilih kandidat terlengkap
        if len(cand) >= len(src):
            src = cand

    if not src:
        return None

    def pick(*names, default=None):
        for n in names:
            if n in src and src[n] not in (None, ""):
                return src[n]
        return default

    mid = pick("message_id", "messageId", "id", "ID", default="")
    chat = pick("chat_jid", "chatJid", "remote_jid", "remoteJid", "chat", default="")
    sender = pick("sender_jid", "senderJid", "participant", default="")
    push = pick("pushname", "push_name", "PushName", "notify", default="")
    text = pick("text", "body", "conversation", "caption", default="")
    mtype = pick("message_type", "messageType", "type", "Type", default="text")
    ts = pick("timestamp", "ts", "MessageTimestamp", default=None)

    # from_me bisa bool langsung atau di dalam sub-dict key.fromMe (baileys style)
    from_me = pick("from_me", "fromMe", "FromMe", default=None)
    if from_me is None and isinstance(src.get("key"), dict):
        from_me = src["key"].get("fromMe")

    if not mid or not chat:
        return None

    # Hanya chat pribadi (bukan grup @g.us / broadcast status@broadcast)
    if chat.endswith("@g.us") or chat.endswith("@broadcast") or chat == "status@broadcast":
        return None

    phone = wa_service.normalize_number(chat)
    if not phone:
        return None

    created = now()
    try:
        if ts:
            t = float(ts)
            if t > 10_000_000_000:  # milidetik
                t = t / 1000
            created = datetime.fromtimestamp(t, tz=timezone.utc).isoformat()
    except Exception:
        pass

    return {
        "mid": str(mid), "phone": phone, "jid": str(chat),
        "sender": str(sender) if sender else str(chat),
        "push": str(push) if push else "",
        "text": str(text or ""), "type": str(mtype),
        "from_me": bool(from_me) if from_me is not None else False,
        "createdAt": created,
    }

@api.post("/wa/webhook")
async def wa_webhook(request: Request):
    """Webhook GoWA -> simpan pesan masuk + balas otomatis bila mode AUTO.
    Idempotent: gowa_message_id unik, pesan sama tidak tersimpan dobel."""
    raw = await request.body()

    # Validasi signature X-Hub-Signature-256 (toleran bila secret/header kosong)
    sig = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Hub-Signature")
    if not wa_service.verify_webhook_signature(raw, sig):
        q = request.query_params.get("secret", "")
        if not wa_service.verify_webhook_secret_param(q):
            raise HTTPException(401, "Signature webhook tidak valid")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Body webhook bukan JSON valid")

    msg = _parse_gowa_message(payload)
    if not msg:
        return {"ok": True, "ignored": True}

    if msg["from_me"]:
        return {"ok": True, "ignored": "outgoing"}

    # Idempotensi: cek duplikat SEBELUM menyentuh unread_count
    exists = await db.wa_messages.find_one({"gowaMessageId": msg["mid"]}, {"_id": 0})
    if exists:
        return {"ok": True, "duplicate": True}

    # Upsert percakapan
    conv = await db.wa_conversations.find_one({"phone": msg["phone"]})
    if not conv:
        conv = {"id": uuid.uuid4().hex, "phone": msg["phone"], "name": msg["push"] or msg["phone"],
                "lastMessageAt": msg["createdAt"], "unreadCount": 1,
                "mode": "AUTO", "lastBotReplyAt": "", "createdAt": now()}
        await db.wa_conversations.insert_one(conv)
    else:
        upd = {"$set": {"lastMessageAt": msg["createdAt"], "lastMessagePreview": msg["text"][:120]}}
        if msg["push"]:
            upd["$set"]["name"] = msg["push"]
        upd["$inc"] = {"unreadCount": 1}
        await db.wa_conversations.update_one({"id": conv["id"]}, upd)

    doc = {"id": uuid.uuid4().hex, "conversationId": conv["id"], "phone": msg["phone"],
           "direction": "IN", "body": msg["text"], "type": msg["type"],
           "status": "received", "gowaMessageId": msg["mid"],
           "mediaId": "", "createdAt": msg["createdAt"]}
    try:
        await db.wa_messages.insert_one(doc)
    except Exception as e:
        if "duplicate" in str(e).lower() or "E11000" in str(e):
            return {"ok": True, "duplicate": True}
        raise

    # Inbox tidak digunakan: semua tindak lanjut pelanggan dilakukan manual di aplikasi WhatsApp admin.
    # Pesan masuk tetap dapat dipakai untuk memperbarui buku kontak, tetapi tidak pernah dibalas otomatis.
    reply_sent = False

    # ===== Auto-capture buku kontak WA (nama dari push_name, web & kategori dari data bisnis) =====
    async def _capture_contact():
        try:
            await upsert_wa_contact(msg["phone"], name=msg["push"], source="inbox")
            await enrich_contact_from_website(msg["phone"])
        except Exception as e:
            log.warning("auto-capture kontak gagal: %s", e)
    wa_service.fire_and_forget(_capture_contact())

    return {"ok": True, "autoReplied": reply_sent}

@api.get("/admin/wa/status")
async def wa_status(_=Depends(admin_user)):
    st = await wa_service.app_status()
    cfg = await db.settings.find_one({"id": "wa_config"}, {"_id": 0}) or {"globalAuto": True}
    pending_logs = await db.wa_logs.count_documents({"status": "failed"})
    unread = await db.wa_conversations.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$unreadCount"}}}
    ]).to_list(1)
    return {"connected": st.get("connected", False), "gowaReachable": st.get("ok", False),
            "error": st.get("error", ""), "config": cfg,
            "failedCount": pending_logs,
            "totalUnread": (unread[0]["total"] if unread else 0)}

@api.get("/admin/wa/qr")
async def wa_qr(_=Depends(admin_user)):
    return await wa_service.login_qr()

@api.post("/admin/wa/logout")
async def wa_logout(_=Depends(admin_user)):
    return await wa_service.logout()

@api.get("/admin/wa/config")
async def wa_get_config(_=Depends(admin_user)):
    cfg = await db.settings.find_one({"id": "wa_config"}, {"_id": 0})
    return cfg or {"globalAuto": True}

@api.put("/admin/wa/config")
async def wa_set_config(data: WaConfigInput, admin=Depends(admin_user)):
    await db.settings.update_one({"id": "wa_config"},
                                 {"$set": {"globalAuto": data.globalAuto, "updatedAt": now(),
                                           "updatedBy": admin["id"]}}, upsert=True)
    return {"ok": True, "globalAuto": data.globalAuto}

@api.get("/admin/wa/conversations")
async def wa_conversations_list(filter: str = "all", q: str = "", _=Depends(admin_user)):
    query = {}
    if filter == "unread":
        query["unreadCount"] = {"$gt": 0}
    elif filter in ("AUTO", "MANUAL"):
        query["mode"] = filter
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"phone": rx}]
    items = await db.wa_conversations.find(query, {"_id": 0}).sort("lastMessageAt", -1).to_list(200)
    return items

@api.get("/admin/wa/conversations/{cid}/messages")
async def wa_messages_list(cid: str, limit: int = 100, _=Depends(admin_user)):
    msgs = await db.wa_messages.find({"conversationId": cid}, {"_id": 0}).sort("createdAt", 1).to_list(limit)
    return msgs

@api.post("/admin/wa/conversations/{cid}/read")
async def wa_mark_read(cid: str, _=Depends(admin_user)):
    await db.wa_conversations.update_one({"id": cid}, {"$set": {"unreadCount": 0}})
    return {"ok": True}

@api.put("/admin/wa/conversations/{cid}/mode")
async def wa_set_mode(cid: str, data: WaModeInput, admin=Depends(admin_user)):
    if data.mode not in ("AUTO", "MANUAL"):
        raise HTTPException(400, "Mode harus AUTO atau MANUAL")
    r = await db.wa_conversations.update_one({"id": cid}, {"$set": {"mode": data.mode}})
    if r.matched_count == 0: raise HTTPException(404, "Percakapan tidak ditemukan")
    await log_activity(admin["id"], f"wa_mode_{data.mode.lower()}", None, cid, "")
    return {"ok": True, "mode": data.mode}

@api.post("/admin/wa/conversations/{cid}/reply")
async def wa_reply(cid: str, data: WaReplyInput, admin=Depends(admin_user)):
    if not data.text.strip(): raise HTTPException(400, "Balasan tidak boleh kosong")
    conv = await db.wa_conversations.find_one({"id": cid}, {"_id": 0})
    if not conv: raise HTTPException(404, "Percakapan tidak ditemukan")
    res = await wa_service.send_text(db, conv["phone"], data.text.strip(),
                                     event="wa_manual_reply", ref_id=cid, record=False)
    out = {"id": uuid.uuid4().hex, "conversationId": cid, "phone": conv["phone"],
           "direction": "OUT", "body": data.text.strip(), "type": "text",
           "status": "sent" if res.get("ok") else "failed",
           "error": res.get("error", ""), "isBot": False,
           "sentBy": admin.get("email", "admin"),
           "gowaMessageId": "", "createdAt": now()}
    await db.wa_messages.insert_one(out)
    await db.wa_conversations.update_one(
        {"id": cid},
        {"$set": {"mode": "MANUAL",              # balas manual otomatis mematikan AUTO
                  "lastMessageAt": now(),
                  "lastMessagePreview": data.text.strip()[:120],
                  "unreadCount": 0}})
    await log_activity(admin["id"], "wa_reply", None, cid, "")
    return {"ok": res.get("ok", False), "error": res.get("error", ""),
            "mode": "MANUAL", "message": public(out)}

@api.get("/admin/wa/logs")
async def wa_logs_list(event: str = "", status: str = "", _=Depends(admin_user)):
    query = {}
    if event.startswith("broadcast:") is False and event:
        query["event"] = {"$regex": re.escape(event)}
    elif event.startswith("broadcast:"):
        query["refId"] = event.split(":", 1)[1]
    if status in ("sent", "failed"):
        query["status"] = status
    logs = await db.wa_logs.find(query, {"_id": 0}).sort("createdAt", -1).to_list(200)
    return logs

@api.post("/admin/wa/logs/{log_id}/resend")
async def wa_log_resend(log_id: str, admin=Depends(admin_user)):
    entry = await db.wa_logs.find_one({"id": log_id}, {"_id": 0})
    if not entry: raise HTTPException(404, "Log tidak ditemukan")
    res = await wa_service.send_text(db, entry["target"], entry["message"],
                                     event=entry.get("event", "resend"),
                                     ref_id=f"resend:{log_id}")
    return {"ok": res.get("ok", False), "error": res.get("error", "")}

@api.get("/admin/wa/broadcasts")
async def wa_broadcast_list(_=Depends(admin_user)):
    return await db.wa_broadcasts.find({}, {"_id": 0}).sort("createdAt", -1).to_list(50)

@api.get("/admin/wa/media/{message_id}")
async def wa_media_download(message_id: str, _=Depends(admin_user)):
    from fastapi.responses import Response as FastResp
    got = await wa_service.download_media(message_id)
    if not got: raise HTTPException(404, "Media tidak ditemukan / gateway mati")
    content, ctype = got
    ext = ctype.split("/")[-1].split(";")[0][:8]
    return FastResp(content=content, media_type=ctype,
                    headers={"Content-Disposition": f'attachment; filename="wa-{message_id[:12]}.{ext}"'})


@api.post("/auth/check-wa")
async def check_wa(payload: dict):
    """Check whether a WhatsApp number is already registered. Returns 409 if taken."""
    phone_raw = payload.get("phone") if isinstance(payload, dict) else getattr(payload, "phone", "")
    phone = wa_service.normalize_number(phone_raw)
    if not phone:
        raise HTTPException(400, "Nomor WhatsApp tidak valid")
    async for u in db.users.find({}, {"whatsapp": 1}):
        if wa_service.normalize_number(u.get("whatsapp", "")) == phone:
            raise HTTPException(409, "Nomor WhatsApp sudah terdaftar")
    return {"ok": True}

app.include_router(api)

# Search engines conventionally request /sitemap.xml at the site root. Keep the
# API form available for local tooling, but expose the production-friendly path.
@app.get("/sitemap.xml")
async def sitemap_at_root(request: Request):
    return await sitemap(request)
cors_origins = [origin.strip().rstrip("/") for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
cors_origin_regex = (os.environ.get("CORS_ORIGIN_REGEX") or r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$").strip() or None
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    global client
    try:
        await client.admin.command("ping")
        log.info("Terhubung ke MongoDB server.")
    except Exception as e:
        log.warning("Tidak dapat terhubung ke MongoDB server (%s). Menggunakan database in-memory (MongoMock).", e)
        if HAS_MONGOMOCK:
            client = AsyncMongoMockClient()
            db_proxy.set_db(client[db_name])

    try:
        await db.users.create_index("email", unique=True)
        existing_idx = await db.websites.index_information()
        if "slug_1" in existing_idx:
            await db.websites.drop_index("slug_1")
        await db.websites.create_index("slug", unique=True, name="slug_unique_nonempty", partialFilterExpression={"slug": {"$gt": ""}})
        await db.payments.create_index("userId")
        await db.notifications.create_index("userId")
        await db.coupons.create_index("code", unique=True)
        # WhatsApp inbox: idempotensi webhook + lookup cepat
        # gowaMessageId unik HANYA untuk pesan dari gateway (pesan internal kosong tidak ikut unik)
        try:
            _idx = await db.wa_messages.index_information()
            if "gowaMessageId_1" in _idx:
                await db.wa_messages.drop_index("gowaMessageId_1")
        except Exception:
            pass
        await db.wa_messages.create_index("gowaMessageId", unique=True,
                                          partialFilterExpression={"gowaMessageId": {"$gt": ""}})
        await db.wa_conversations.create_index("phone", unique=True)
        await db.wa_messages.create_index("conversationId")
        await db.wa_logs.create_index("createdAt")
        # Buku kontak WA: nomor unik
        await db.wa_contacts.create_index("phone", unique=True)
        await db.wa_contacts.create_index("categories")
        await db.wa_verifications.create_index("phone", unique=True)
    except Exception as exc:
        log.warning("Index creation note: %s", exc)

    # Migrate old plans
    try:
        await db.plans.delete_many({"slug": {"$in": ["premium-1", "premium-3"]}})
    except Exception:
        pass

    for plan in DEFAULT_PLANS:
        existing = await db.plans.find_one({"slug": plan["slug"]})
        if not existing:
            await db.plans.insert_one({**plan, "createdAt": now()})

    # Nama paket gratis lama diperbarui agar istilah trial tidak muncul lagi di UI.
    await db.plans.update_many({"slug": "trial", "name": "Trial Gratis"}, {"$set": {"name": "Gratis"}})

    # Migrate old user planSlug values
    try:
        await db.users.update_many({"planSlug": "premium-1"}, {"$set": {"planSlug": "basic"}})
        await db.users.update_many({"planSlug": "premium-3", "additionalWebsiteQuota": {"$gt": 0}}, {"$set": {"planSlug": "platinum"}})
        await db.users.update_many({"planSlug": "premium-3"}, {"$set": {"planSlug": "premium"}})
    except Exception:
        pass

    if not await db.settings.find_one({"id": "platform"}):
        await db.settings.insert_one({**DEFAULT_SETTINGS, "createdAt": now()})

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@usahaku.id").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": uid(),
            "name": "Admin Situska",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "ADMIN",
            "accountStatus": "ACTIVE",
            "subscriptionStatus": "ACTIVE",
            "websiteQuota": 999,
            "createdAt": now()
        })

    platform_settings = await db.settings.find_one({"id": "platform"}, {"_id": 0}) or DEFAULT_SETTINGS
    await ensure_showcase_sites(platform_settings.get("adminWhatsapp", DEFAULT_SETTINGS["adminWhatsapp"]))

@app.on_event("shutdown")
async def shutdown():
    try:
        client.close()
    except Exception:
        pass
