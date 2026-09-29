"""Logika monetisasi Situska — langganan PER WEBSITE.

Modul ini SENGAJA murni (tanpa DB, tanpa I/O) supaya aturan bisnis bisa diuji
langsung dengan `python3` tanpa dependensi apa pun.

Aturan inti yang diwakili di sini:
  * Masa aktif sebuah KARTU disimpan sebagai `expiresAt` (ISO datetime).
  * "Tidak ada pause": sisa hari SELALU dihitung dari expiresAt — termasuk saat
    kartu sedang kosong (websitenya sudah dihapus).
  * Kartu kosong + hari habis  -> kartu DIHAPUS otomatis.
  * Kartu terisi + hari habis  -> kartu DIBIARKAN, website BEKU.
  * Beli/nambah hari = DITAMBAHKAN ke sisa (nabung), bukan reset.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------- konstanta
MIN_PURCHASE_DAYS = 30          # kartu baru wajib minimal 30 hari (Rp50.000)
AUTORENEW_WINDOW_DAYS = 0       # perpanjang bulanan saat masa aktif berakhir

STATE_TRIAL = "TRIAL"           # kartu trial, sudah ada website
STATE_ACTIVE = "ACTIVE"         # kartu berbayar, sudah ada website
STATE_EMPTY = "EMPTY"           # kartu kosong -> tampil "Buat Website"
STATE_FROZEN = "FROZEN"         # ada website tapi hari habis -> website beku
ACTION_DELETE_CARD = "DELETE_CARD"  # kartu kosong + hari habis -> hapus

# Kandidat A (disetujui Mang Jun, 2026-09-28). Basis 30 hari per bulan.
DEFAULT_PACKAGES = [
    {"months": 1, "days": 30, "normalPrice": 100000, "promoPrice": 50000},
    {"months": 3, "days": 90, "normalPrice": 300000, "promoPrice": 135000},
    {"months": 6, "days": 180, "normalPrice": 600000, "promoPrice": 250000},
    {"months": 12, "days": 360, "normalPrice": 1200000, "promoPrice": 450000},
]

DEFAULT_TRIAL = {"days": 14, "maxProducts": 3, "oncePerAccount": True}
DEFAULT_TOPUP_BONUS = {"enabled": True, "minTopup": 100000, "bonus": 50000, "oncePerAccount": True}
DEFAULT_UNLIMITED_ROLES = ["SYSTEM"]   # akun sistem/demo (website showcase di halaman utama)


def is_unlimited(user, cfg=None):
    """True bila akun bebas limit (mis. website demo/showcase di halaman utama).

    Efek: tanpa batas jumlah produk, tidak pernah dibekukan, tanpa badge Situska.
    Sumber aturan TIDAK di-hardcode: settings {id:"platform"} -> `unlimitedRoles`
    (default ["SYSTEM"]), atau per akun lewat field `unlimited: true`.
    """
    if not user:
        return False
    if user.get("unlimited") is True:
        return True
    roles = (cfg or {}).get("unlimitedRoles") or DEFAULT_UNLIMITED_ROLES
    role = str(user.get("role") or "").upper()
    return role in [str(r).upper() for r in roles]


# ---------------------------------------------------------------- waktu
def parse_dt(value):
    """Terima ISO string / datetime -> datetime aware (atau None bila kosong)."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


MONTH_LABELS = {1: "1 bulan", 3: "3 bulan", 6: "6 bulan", 12: "1 tahun"}


def month_label(months):
    """Label durasi: 1 bulan / 3 bulan / 6 bulan / 1 tahun."""
    mm = int(months)
    return MONTH_LABELS.get(mm, "%d bulan" % mm)


STATE_LABELS = {
    STATE_TRIAL: "Masa Gratis",
    STATE_ACTIVE: "Berlangganan",
    STATE_EMPTY: "Kartu Kosong",
    STATE_FROZEN: "Website Beku",
}


def state_label(state):
    """Label Indonesia untuk status kartu."""
    return STATE_LABELS.get(state, state or "-")


def iso(dt):
    """datetime -> ISO string (UTC) untuk disimpan ke DB."""
    d = parse_dt(dt)
    return d.isoformat() if d else None


def utcnow():
    return datetime.now(timezone.utc)


def days_remaining(expires_at, now=None):
    """Sisa hari (dibulatkan KE ATAS, minimal 0).

    Dibulatkan ke atas supaya hari terakhir tetap tampil "1 hari" — bukan "0
    hari" padahal website masih hidup beberapa jam lagi.
    """
    exp = parse_dt(expires_at)
    if not exp:
        return 0
    now = parse_dt(now) or utcnow()
    seconds = (exp - now).total_seconds()
    if seconds <= 0:
        return 0
    return max(0, math.ceil(seconds / 86400))


def is_active(card, now=None):
    exp = parse_dt(card.get("expiresAt"))
    return bool(exp) and exp > (now or utcnow())


def add_days(base, days):
    """Tambah hari lalu NORMALISASI ke tengah malam.

    Jadi `expiresAt` selalu tepat 00:00 pada hari pertama kartu TIDAK aktif lagi
    (batas eksklusif). Contoh: beli 30 hari tanggal 5 Okt (jam berapa pun)
    -> expiresAt 4 Nov 00:00, dan masa aktif terakhir = 3 Nov.
    """
    dt = parse_dt(base) or utcnow()
    target = (dt + timedelta(days=int(days))).date()
    return datetime.combine(target, datetime.min.time(), tzinfo=timezone.utc)


def last_active_date(expires_at):
    """Tanggal terakhir kartu masih aktif (= expiresAt - 1 hari)."""
    exp = parse_dt(expires_at)
    return (exp - timedelta(days=1)).date() if exp else None


# ---------------------------------------------------------------- kartu
def card_state(card, now=None):
    """Status kartu + aksi otomatis yang harus dijalankan job harian."""
    now = parse_dt(now) or utcnow()
    remaining = days_remaining(card.get("expiresAt"), now)
    has_website = bool(card.get("websiteId"))
    active = remaining > 0
    if active and has_website:
        state = STATE_TRIAL if card.get("isTrialCard") else STATE_ACTIVE
    elif active:
        state = STATE_EMPTY
    elif has_website:
        state = STATE_FROZEN
    else:
        state = STATE_EMPTY
    return {
        "state": state,
        "isActive": active,
        "hasWebsite": has_website,
        "daysRemaining": remaining,
        "autoDelete": (not active and not has_website and bool(card.get("expiresAt"))),
        "freezeWebsite": (not active and has_website),
    }


def card_name_for(website):
    """Nama kartu = nama usaha website-nya (dipakai di notifikasi kartu kosong)."""
    if not website:
        return "Kartu Langganan"
    return (website.get("businessName") or "Kartu Langganan").strip()


def card_label(card):
    return (card or {}).get("name") or "Kartu Langganan"


# ---------------------------------------------------------------- harga
def package_by_months(packages, months):
    for pkg in packages or []:
        if int(pkg.get("months", 0)) == int(months):
            return pkg
    return None


def price_for(pkg, mode="promo"):
    if not pkg:
        return 0
    key = "promoPrice" if mode == "promo" else "normalPrice"
    value = pkg.get(key, pkg.get("promoPrice" if mode == "promo" else "normalPrice", 0))
    return int(round(float(value)))


def saving_percent(pkg):
    """Persentase hemat untuk framing "Hemat X%" di bawah harga."""
    normal = float(pkg.get("normalPrice") or 0)
    promo = float(pkg.get("promoPrice") or 0)
    if normal <= 0 or promo <= 0 or promo >= normal:
        return 0.0
    return round((normal - promo) / normal * 100, 1)


def per_month(pkg):
    """Harga promo dibagi jumlah bulan (>0) — untuk teks "setara Rp X/bulan"."""
    months = int(pkg.get("months") or 0)
    if months <= 0:
        return 0
    return int(round(price_for(pkg, "promo") / months))


def package_is_purchasable(pkg):
    """Kartu baru wajib minimal 30 hari."""
    return bool(pkg) and int(pkg.get("days") or 0) >= MIN_PURCHASE_DAYS


# ---------------------------------------------------------------- pembelian
def purchase_extension(card, pkg, now=None):
    """Tanggal kedaluwarsa baru setelah membeli paket (NABUNG, bukan reset).

    Sisa hari ditambahkan ke masa aktif yang masih berjalan. Kalau kartunya
    sudah habis, hitungan dimulai dari sekarang.
    """
    now = parse_dt(now) or utcnow()
    current = parse_dt((card or {}).get("expiresAt"))
    base = current if (current and current > now) else now
    return add_days(base, pkg["days"])


def apply_purchase(card, pkg, now=None):
    """Hasil pembelian: sisa hari ditambah (nabung), trial naik kelas premium."""
    now = parse_dt(now) or utcnow()
    card = card or {}
    exp = purchase_extension(card, pkg, now)
    return {
        "expiresAt": iso(exp),
        "isTrialCard": False,
        "planMonths": int(pkg["months"]),
        "daysTotal": int(card.get("daysTotal") or 0) + int(pkg["days"]),
        "autoRenew": bool(card.get("websiteId")) and bool(card.get("autoRenew", True)),
        "updatedAt": iso(now),
    }


def trial_extension(card, trial_days, now=None):
    """Trial juga bisa diberi hari, dan naik kelas jadi premium saat langganan."""
    now = parse_dt(now) or utcnow()
    current = parse_dt((card or {}).get("expiresAt"))
    base = current if (current and current > now) else now
    return add_days(base, trial_days)


# ---------------------------------------------------------------- saldo
def topup_bonus_for(amount, cfg=None, already_claimed=False):
    """Bonus promo top up pertama (min Rp100.000 -> +Rp50.000, 1x per akun)."""
    cfg = cfg or DEFAULT_TOPUP_BONUS
    if not cfg.get("enabled", True):
        return 0
    if cfg.get("oncePerAccount", True) and already_claimed:
        return 0
    if float(amount or 0) < float(cfg.get("minTopup") or 0):
        return 0
    return int(cfg.get("bonus") or 0)


def can_afford(balance, price):
    return float(balance or 0) >= float(price or 0)


def auto_renew_decision(card, balance, packages, now=None, window=AUTORENEW_WINDOW_DAYS):
    """Putusan auto-renew untuk SATU kartu.

    Aturan: hanya kartu yang PUNYA website, auto-renew ON, masuk jendela
    saat masa aktif habis, dan saldo cukup. Durasi selalu bulanan. Kartu kosong tidak pernah dipotong otomatis.
    """
    now = parse_dt(now) or utcnow()
    card = card or {}
    if not card.get("autoRenew"):
        return {"renew": False, "reason": "auto_renew_off"}
    if not card.get("websiteId"):
        return {"renew": False, "reason": "card_empty"}
    remaining = days_remaining(card.get("expiresAt"), now)
    if remaining > window:
        return {"renew": False, "reason": "not_due", "daysRemaining": remaining}
    pkg = package_by_months(packages, 1)
    if not pkg:
        return {"renew": False, "reason": "package_missing"}
    price = price_for(pkg, "promo")
    if not can_afford(balance, price):
        return {"renew": False, "reason": "insufficient_balance", "short": int(price - float(balance or 0)),
                "price": price, "daysRemaining": remaining}
    return {
        "renew": True,
        "reason": "ok",
        "price": price,
        "months": pkg["months"],
        "days": pkg["days"],
        "newExpiresAt": purchase_extension(card, pkg, now),
        "daysRemaining": remaining,
    }


# ---------------------------------------------------------------- notifikasi
EMPTY_CARD_REMINDER_OFFSETS = (1, 3)


def should_remind_empty_card(days_since_deleted):
    """H+1, H+3, H+7, lalu tiap kelipatan +7 hari sejak website dihapus."""
    d = int(days_since_deleted or 0)
    if d <= 0:
        return False
    if d in EMPTY_CARD_REMINDER_OFFSETS:
        return True
    return d >= 7 and (d - 7) % 7 == 0


def is_expiring_soon(days_remaining_value, thresholds=(7, 3, 1)):
    return int(days_remaining_value or 0) in set(thresholds)


# ---------------------------------------------------------------- format
def rupiah(value):
    return "Rp" + "{:,.0f}".format(round(float(value or 0))).replace(",", ".")


def format_date(value, fmt="%d %B %Y"):
    dt = parse_dt(value)
    return dt.strftime(fmt) if dt else "-"


def saving_label(pkg):
    """Teks framing di bawah harga, mis. "Hemat 55% · setara Rp45.000/bulan"."""
    pct = saving_percent(pkg)
    if pct <= 0:
        return ""
    pct_text = "{:g}".format(pct).replace(".", ",")
    return f"Hemat {pct_text}% · setara {rupiah(per_month(pkg))}/bulan"


def empty_card_message(card, now=None):
    """Pesan notifikasi (dan notifikasi WA) untuk kartu kosong."""
    now = parse_dt(now) or utcnow()
    remaining = days_remaining(card.get("expiresAt"), now)
    last_day = last_active_date(card.get("expiresAt"))
    exp_text = last_day.strftime("%d %B %Y") if last_day else "-"
    name = card_label(card)
    return (f'Kartu "{name}" kosong tidak ada website yang sudah dibuat, '
            f"masa aktif {remaining} hari (sampai {exp_text}), silakan buat website "
            f'agar kartu "{name}" bisa digunakan lebih bermanfaat.')