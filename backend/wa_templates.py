"""
Template pesan WhatsApp terpusat untuk seluruh aplikasi UsahaKu.
Edit teks di sini saja — semua modul (notifikasi, auto-reply, broadcast)
mengambil dari WA_TEMPLATES lewat render_template().
Placeholder memakai format {nama_kunci} dan diisi lewat keyword arguments.
"""

WA_TEMPLATES = {
    # ===== BAGIAN A: NOTIFIKASI PESANAN (payment request) =====
    "order_new_customer": (
        "Halo {nama}, pesanan #{id} kami terima.\n"
        "Paket: *{paket}*\n"
        "Total: *Rp{total}*\n\n"
        "Menunggu verifikasi admin. Kami kabari segera ya 🙏"
    ),
    "order_new_admin": (
        "🛎️ PESANAN BARU\n"
        "ID: #{id}\n"
        "Nama: {nama}\n"
        "Email: {email}\n"
        "Paket: {paket}\n"
        "Total: Rp{total}\n\n"
        "Cek panel admin untuk verifikasi."
    ),
    "approved": (
        "Halo {nama}, pesanan #{id} Anda SUDAH DISETUJUI ✅\n"
        "Paket *{paket}* aktif sampai {berlaku}.{bonus}\n\n"
        "Terima kasih telah menggunakan UsahaKu!"
    ),
    "rejected": (
        "Halo {nama}, maaf pesanan #{id} ditolak.\n"
        "Alasan: {alasan}\n"
        "Silakan ajukan ulang atau hubungi kami untuk info lebih lanjut."
    ),

    # ===== BAGIAN B: AUTO REPLY INBOX =====
    "autoreply": (
        "Hai {nama}, pesan kamu sudah kami terima ✅\n"
        "Tim kami akan membalas segera. Untuk respons cepat, "
        "sebutkan nama usaha & kendala kamu ya."
    ),
}

# Template default broadcast (dipakai kalau admin tidak isi pesan khusus)
BROADCAST_DEFAULT = "{pesan}"


def render_template(key: str, **vars) -> str:
    """Render template by key; placeholder yang tidak diisi dibiarkan apa adanya."""
    tpl = WA_TEMPLATES.get(key, "")
    out = tpl
    for k, v in vars.items():
        out = out.replace("{" + str(k) + "}", "" if v is None else str(v))
    return out


def rupiah(value) -> str:
    """Format angka jadi ribuan gaya Indonesia: 150000 -> 150.000"""
    try:
        return f"{int(round(float(value))):,}".replace(",", ".")
    except Exception:
        return str(value)
