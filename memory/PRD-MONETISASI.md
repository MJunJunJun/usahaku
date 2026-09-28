# PRD — Monetisasi Situska: Langganan Per-Website (Kartu Langganan + Saldo)

**Status:** Draft untuk direview Mang Jun — belum ada kode yang diubah
**Tanggal:** 28 September 2026
**Basis:** hasil diskusi bertahap (ide lama + ide baru)
**Prinsip kerja:** semua harga/aturan promo disimpan di **database settings** (bisa diubah dari Admin tanpa deploy) — bukan hardcode

---

## 1. Ringkasan

Model monetisasi lama (tier Basic/Premium/Platinum per akun + kuota website per akun) **dihapus total** dan diganti dengan:

> **Satu website = satu langganan (kartu), dibayar terpisah, diperpanjang terpisah.**

Tiga pilar:

1. **Kartu Langganan (slot)** — wadah masa aktif (hari) yang dipisah dari website, sehingga sisa masa aktif **tidak hangus** saat website dihapus.
2. **Dompet Saldo** — top up saldo → dipakai untuk beli/perpanjang kartu & auto-renew.
3. **Auto-renew per kartu** — pakai durasi terakhir yang dipilih, bisa ON/OFF kapan saja.

---

## 2. Aturan final (LOCKED)

### 2.1 Harga (Kandidat A)

| Durasi | Harga normal | Harga promo | Promo/bulan | Framing |
|---|---|---|---|---|
| 1 bulan | Rp100.000 | **Rp50.000** | Rp50.000 | Hemat 50% |
| 3 bulan | Rp300.000 | **Rp135.000** | Rp45.000 | Hemat 55% |
| 6 bulan | Rp600.000 | **Rp250.000** | Rp41.667 | Hemat 58% |
| 12 bulan | Rp1.200.000 | **Rp450.000** | Rp37.500 | Hemat 62% + label **PALING HEMAT** |

- Di bawah harga **wajib ada text framing** "Hemat X%" + "setara Rp…/bulan" + jumlah hari
- Basis hari: **30 hari/bulan** → 30 / 90 / 180 / 360 hari
- Harga per **website**, bukan per akun
- Semua angka disimpan di `settings.packages` (Admin bisa ubah)

### 2.2 Trial

- **Gratis 14 hari**, hanya **1× per akun** (diikat ke nomor WA terverifikasi)
- Saat trial: maks **3 produk** per website, badge "Dibuat dengan Situska" **tampil**
- Habis trial → **Halaman Masa Aktif Habis** (website beku, data aman)

### 2.3 Status berlangganan (kartu terisi)

- **Produk tanpa batas**
- Badge "Dibuat dengan Situska" **HILANG**
- Website bisa publish/live

### 2.4 Kartu

- Kartu baru wajib **minimal 30 hari (Rp50.000)** — dari saldo **atau** bayar langsung. Tidak ada kartu gratis di luar trial
- Durasi terakhir yang dipilih tersimpan sebagai `planMonths` (dipakai auto-renew)
- **Tambah hari = stacking (nabung)**: sisa hari + hari yang dibeli (mis. trial sisa 6 + beli 30 = 36 hari). Termasuk masa trial bisa ditambah hari dan **otomatis jadi premium saat langganan**
- **Tidak ada pause** — hitungan hari **jalan terus**, termasuk saat kartu kosong
- Notifikasi kartu kosong: **H+1, H+3, H+7, lalu kelipatan +7 hari** sejak website dihapus (§3)
- **Hari tidak bisa dikonversi ke saldo rupiah** (mencegah arbitrase paket tahunan)
- Aturan siklus:
  - Kartu **kosong** + hari habis → **KARTU DIHAPUS OTOMATIS**
  - Kartu **terisi** + hari habis → **kartu DIBIARKAN**, website **BEKU**

### 2.5 Website

- 1 akun boleh punya **banyak website** — tiap website punya kartu & siklus sendiri (tanggal, durasi, auto-renew mandiri)
- **Website dihapus oleh user = langsung permanen** (produk & foto hilang, tanpa tong sampah)
- Saat website dihapus: sisa hari **aman** di kartu, kartu jadi kosong ("Buat Website"), auto-renew **otomatis OFF**

### 2.6 Auto-renew

- ON/OFF **fleksibel kapan saja**, per kartu
- **Hanya berlaku untuk kartu yang terisi website** (kartu kosong tidak memotong saldo)
- Memakai **durasi terakhir yang dipilih** (1/3/6/12 bulan)
- Sistem cek **H-3, H-1, hari H**: saldo cukup → potong → masa aktif diperpanjang → notif WA
- **Saldo kurang → tidak diperpanjang** (tanpa masa tenggang) → website beku saat masuk 0 hari
- Jika user **top up sebelum expired** → sistem langsung mencoba memotong lagi

### 2.7 Saldo & Top Up

- **Halaman Top Up Saldo** dengan preset nominal + keterangan "setara berapa bulan"
- **Promo top up pertama**: min Rp100.000 → **bonus Rp50.000** — berlaku selamanya, tapi **1 akun 1×** (diikat nomor WA terverifikasi)
- Bonus **tidak bisa ditarik/diuangkan** — hanya untuk langganan
- Riwayat mutasi wajib jelas: top up, bonus, potong auto-renew, potong pembelian

### 2.8 Kuota & tampilan

- Tampil: **"Website: X aktif dari Y"** + daftar **kartu kosong** terpisah
- Kartu kosong diurutkan **sisa hari paling kecil** (yang paling cepat hangus di atas)
- Saldo akun tampil di header dashboard

---

## 3. Notifikasi WhatsApp (WA gateway sudah tersedia)

> **Catatan existing:** `settings.waMessageTemplates` **sudah ada 20 template** (reminder H-7/H-3/H-1, kedaluwarsa, promo, referral, dll) → tinggal dipakai/diperluas untuk notifikasi di bawah, tidak perlu bikin dari nol. Nomor WA admin = `settings.adminWhatsapp` (sudah diisi nomor asli).

| Kode | Kapan | Isi (ringkas) |
|---|---|---|
| `card_empty_reminder` | **H+1, H+3, H+7, lalu kelipatan +7 hari** (dihitung dari tanggal website dihapus) | Kartu "**{nama}**" kosong tidak ada website yang sudah dibuat, masa aktif **{hari} hari** (sampai {tanggal}), silakan buat website agar kartu "**{nama}**" bisa digunakan lebih bermanfaat |
| `card_empty_expiring` | H-3 & H-1 sebelum hari kartu habis | Sisa {hari} hari — segera buat website, harinya akan hangus |
| `trial_ending` | H-7, H-3, H-1 | Website {nama} masa trial berakhir {tanggal} |
| `sub_ending` | H-7, H-3, H-1 | Website {nama} berakhir {tanggal}, perpanjang atau auto-renew |
| `autorenew_success` | saat potong berhasil | Saldo dipotong Rp{amount}, diperpanjang {hari} hari s/d {tanggal} |
| `autorenew_failed` | saldo kurang | Saldo kurang Rp{kurang}, top up sebelum {tanggal} |
| `website_frozen` | masuk 0 hari | Masa aktif habis, website dinonaktifkan — perpanjang untuk mengaktifkan |
| `payment_approved` | admin approve | Pembayaran disetujui, +{hari} hari |

---

## 4. Halaman & UX

1. **Halaman Harga** — 4 kartu durasi, jelas "per website", harga normal dicoret, framing "Hemat X%", label PALING HEMAT di 12 bulan
2. **Dashboard Website** — "Website: X aktif dari Y" + kartu website + kartu kosong + saldo
3. **Halaman Detail Langganan per Website** — sisa hari, tanggal berakhir, toggle auto-renew, durasi, tombol tambah hari, riwayat
4. **Halaman Top Up Saldo** — preset nominal, banner promo first top up, riwayat mutasi
5. **Halaman "Masa Aktif Habis"** — Perpanjang Website **atau** Hubungi Admin Kami (WA) untuk bantuan teknis
6. **Halaman publik website beku** — "Website ini sedang tidak aktif" + tombol WA admin (bukan 404)
7. **Admin** — monitor kartu/saldo/pembayaran per user, approve manual, kelola paket & bonus promo

**Mockup dashboard:**
```
Website: 1 aktif dari 2      Kartu kosong: 1      Saldo: Rp150.000   [Top Up]
──────────────────────────────────────────────────────────────────────────────
🟢 Kopi Kenangan        AKTIF
   Masa aktif 23 hari lagi (s/d 18 Nov 2026) • Auto-renew ON (Rp50.000/30hr)
──────────────────────────────────────────────────────────────────────────────
⚪ Kartu Buat Website    sisa 22 hari (berakhir 16 Nov 2026 — jalan terus)
   [ Buat Website Sekarang ]
```

---

## 5. Struktur Data

### 5.1 Koleksi baru: `cards`

```json
{
  "id": "card_xxx",
  "userId": "user_xxx",
  "name": "Kopi Senja",
  "websiteId": "site_xxx",
  "planMonths": 1,
  "expiresAt": "2026-11-16T00:00:00",
  "autoRenew": true,
  "isTrialCard": false,
  "source": "PURCHASE",
  "createdAt": "...", "updatedAt": "..."
}
```
- Sumber kebenaran masa aktif = **`expiresAt`**; sisa hari dihitung dari situ
  (`sisa = ceil((expiresAt - now)/1 hari)`, min 0)
- `websiteId = null` → kartu kosong ("Buat Website")
- Status diturunkan (derived), tidak disimpan ganda:
  - `expiresAt > now` & ada website → **ACTIVE** (atau **TRIAL** bila `isTrialCard`)
  - `expiresAt > now` & tanpa website → **EMPTY**
  - `expiresAt <= now` & ada website → **FROZEN**
  - `expiresAt <= now` & tanpa website → **dihapus otomatis**

### 5.2 `wallet_transactions`

```json
{ "id": "...", "userId": "...", "type": "TOPUP|BONUS|DEDUCT_PURCHASE|DEDUCT_AUTORENEW|ADJUST",
  "amount": 50000, "balanceAfter": 150000, "cardId": "card_xxx",
  "orderId": "...", "note": "...", "createdAt": "..." }
```
`users.walletBalance` (integer rupiah), `users.firstTopupBonusClaimed` (bool), `users.trialUsed` (bool)

### 5.3 `payments` (diperluas)
Tambah `cardId`, `packageMonths`, `method: TRANSFER|SALDO`, `amount`

### 5.4 `settings` (non-hardcode)
```json
{
  "trialDays": 14,
  "trialMaxProducts": 3,
  "trialPerAccount": 1,
  "packages": [
    {"months":1, "normalPrice":100000, "promoPrice":50000, "days":30},
    {"months":3, "normalPrice":300000, "promoPrice":135000, "days":90},
    {"months":6, "normalPrice":600000, "promoPrice":250000, "days":180},
    {"months":12,"normalPrice":1200000,"promoPrice":450000,"days":360}
  ],
  "topupBonus": {"enabled": true, "minTopup": 100000, "bonus": 50000, "oncePerAccount": true}
}
```

### 5.5 Field lama yang dinonaktifkan
`websiteQuota`, `additionalWebsiteQuota`, `planSlug`, `subscriptionStatus`, `subscriptionExpiryDate` (level user) → **digantikan** oleh kartu. Tetap dibaca sebagai fallback selama masa transisi migrasi.

---

## 6. Job & Otomasi

**Job harian (`daily_card_job`, jalan tiap jam / harian 00:05):**
1. Update status kartu & website (derived)
2. Kartu kosong 0 hari → **hapus kartu** (simpan log)
3. Kartu terisi 0 hari → website **FROZEN** + notif `website_frozen`
4. **Auto-renew attempt** untuk kartu `autoRenew=true` + terisi + sisa ≤ 3 hari: cukup → potong, `expiresAt += days`, notif; kurang → notif `autorenew_failed`
5. Kirim notif terjadwal (`trial_ending`, `sub_ending`, `card_empty_expiring`, `card_empty_created`)

**Trigger event:**
- Top up sukses → langsung coba auto-renew untuk kartu bersisa ≤3 hari
- Website dihapus → kartu jadi kosong, `autoRenew=false`, jadwalkan notif H+1
- Admin approve pembayaran → tambah hari ke kartu target

---

## 7. Migrasi dari sistem sekarang

**Temuan audit produksi (28 Sep 2026):**
- 8 akun (1 ADMIN, 1 SYSTEM showcase, 6 akun test), **0 user yang menyelesaikan 1 website**, **0 pembayaran**
- 7 website = 6 demo showcase + 1 website admin (slug kosong)
- Sumber kebenaran langganan sekarang ada di **level user**, bukan per website → perlu dipindah ke kartu

**Langkah:**
1. Buat kartu untuk setiap website existing (1 kartu : 1 website)
2. Akun **ADMIN/SYSTEM** → kartu `expiresAt` jauh / exempt (jangan pernah beku)
3. User `TRIAL_ACTIVE` → kartu trial dengan sisa hari dari `trialEndDate`
4. Set `trialUsed = true` untuk akun yang sudah pernah trial
5. Saldo awal Rp0 untuk semua akun
6. Uji: DEMO showcase tetap live, tidak ada website produksi yang mendadak beku

---

## 8. Rencana Implementasi Bertahap

| Fase | Isi | Est. |
|---|---|---|
| **1. Fondasi** | `settings.packages` + koleksi `cards` + `wallet_transactions` + endpoint CRUD kartu + skrip migrasi (dry-run dulu) | 1 hari |
| **2. Beli & Top Up** | Halaman Top Up + promo first top up; beli paket via saldo / bayar langsung; kartu baru min 30 hari; tambah hari (stacking); riwayat mutasi | 1 hari |
| **3. Auto & Job** | Auto-renew + job harian + 8 template notif WA + retry saat top up masuk | 1 hari |
| **4. UI Dashboard** | "X aktif dari Y" + kartu kosong + detail langganan per website + Halaman Masa Aktif Habis + halaman publik beku + badge gating + trial 14 hari 1×/akun + produk tanpa batas vs 3 produk | 1–2 hari |
| **5. Harga, Admin, Uji** | Halaman harga baru (4 durasi + framing %) + panel admin (kartu/saldo/paket/bonus) + uji end-to-end + deploy | 1 hari |

**Total estimasi: 5–6 hari kerja.** Tiap fase di-commit & bisa direview sebelum lanjut.

**File yang akan berubah:**
- `backend/server.py` (kartu, saldo, auto-renew, job, notif, migrasi)
- `frontend/src/pages/` → `Subscription.jsx`, `Dashboard.jsx`, `Landing.jsx`, `Admin.jsx`, halaman baru `Wallet.jsx` + `CardExpired.jsx`, `PublicWebsiteView.jsx` (badge & halaman beku)
- `README`/`memory/PRD.md` (update dokumentasi)

**Verifikasi tiap fase:** uji API (kartu dibuat, hari bertambah, saldo terpotong), uji lint/build bersih (`CI=true yarn build` = 0 warning), cek bundle live, lalu uji klik manual oleh Mang Jun (env ini tidak punya browser).

---

## 9. Risiko & Hal yang Belum Diputuskan

**Risiko:**
1. **Rekening & WA admin** → **sudah diisi di Settings live**: BRI a.n. Muhammad Junaedi + WA admin `628117079625` (nomor rekening disimpan di DB Settings, tidak ditulis di dokumen repo) → jalur "bayar langsung" sudah siap menerima uang. Sisa risiko: verifikasi pembayaran masih **manual**
2. **Belum ada payment gateway** → verifikasi pembayaran masih manual = plafon pertumbuhan
3. **Hari hangus di kartu kosong** (konsekuensi "tidak ada pause") → wajib notif **H+1, H+3, H+7, kelipatan +7** (plus H-3 & H-1 sebelum habis) supaya user tidak merasa dirugikan
4. **1× trial per akun** → pengaman anti-abuse = nomor WA terverifikasi (sudah ada)
5. Tidak ada browser di lingkungan kerja Hermes → uji interaksi diserahkan ke Mang Jun

**Belum diputuskan:**
- Harga promo berlaku permanen atau ada batas waktu promo?
- Basis 30 hari/bulan (dipakai di dokumen ini) vs bulan kalender?
- Pilihan payment gateway (Midtrans / Xendit / Tripay) — kalau nanti mau otomatis
- Apakah angka harga juga ditampilkan di landing page atau hanya di halaman harga?

---

## 10. Kriteria Sukses

- User bisa bikin website ke-2 **hanya setelah bayar/ambil saldo min 30 hari** ✅
- Hapus website → sisa hari tetap aman di kartu, kartu tampil "Buat Website" dengan hitungan jalan ✅
- Kartu kosong habis → hilang otomatis; kartu terisi habis → website beku tapi data aman ✅
- Auto-renew jalan tanpa interaksi user & berhenti sendiri kalau saldo kurang ✅
- Tidak ada lagi tier Basic/Premium/Platinum di seluruh UI ✅

---

## 11. Status Implementasi (bertahap)

### Konvensi tanggal (FINAL — sudah terkunci di kode)
- `expiresAt` = **00:00 hari pertama kartu TIDAK aktif lagi** (batas eksklusif).
- `sisa hari` = pembulatan KE ATAS dari (expiresAt − sekarang) → beli hari ini selalu tampil penuh (30/90/180/360) ✅
- Tanggal "sampai …" yang ditampilkan ke user = **satu hari sebelum expiresAt** (hari terakhir aktif).
- **Koreksi contoh awal** (off-by-one): 20 Okt → habis 3 Nov = **sisa 15 hari** (bukan 14); 25 Okt → habis 7 Jan 2027 = **sisa 75 hari** (bukan 74).

### Fase 1 — Fondasi (SELESAI 28 Sep 2026, belum deploy)
| Item | Hasil |
|---|---|
| `backend/monetization.py` (logika murni, tanpa DB) | ✅ harga, sisa hari, status kartu, nabung hari, auto-renew, promo top up, jadwal notifikasi |
| `backend/tests/test_monetization.py` | ✅ **15/15 lulus** |
| `settings.packages` di DB (bukan hardcode) | ✅ Kandidat A + `trialDays:14`, `trialMaxProducts:3`, `topupBonus{min 100rb, bonus 50rb, 1×/akun}`, `monetizationEnabled:false`, `monetizationVersion:1` |
| Skrip migrasi **dry-run** (read-only) | ✅ 8 akun, 7 website, 0 pembayaran → **0 kartu perlu dibuat**, 2 akun exempt |
| Deploy / ubah perilaku live | ❌ belum (0 file di-deploy) |

### Keputusan menunggu (hasil dry-run)
- **5 akun** pernah menyalakan trial tapi **tidak pernah bikin website** → usul: trial **direset ke TRIAL_PENDING** (tetap dapat gratis 14 hari saat benar-benar bikin website pertama). Alternatif lebih ketat: trial dianggap sudah terpakai.
- Saldo lama: **tidak ada** → semua user mulai Rp0 ✅
- Admin & showcase (7 website) → **kartu UNLIMITED**, tidak ikut aturan trial/kartu.

### Fase 2 — API & Saldo (SELESAI 28 Sep 2026, sudah live)
| Item | Hasil |
|---|---|
| `backend/monetization_service.py` | ✅ layanan DB: paket, saldo (debit/credit + riwayat), kartu (beli, perpanjang/nabung, auto-renew, pasang/lepas website), trial, approve pembayaran |
| `backend/monetization_api.py` | ✅ 10 endpoint baru (prefix `/api`) |
| Uji end-to-end DB live | ✅ **11/11 PASS**: top up + bonus 50rb, approve → saldo 150.000, beli 3 bln → 90 hari, potong saldo 135.000 (sisa 15.000), saldo kurang DITOLAK, nabung 90+30=120 hari, attach → ACTIVE, auto-renew ON, detach → EMPTY, auto-renew kartu kosong DITOLAK; data tes dihapus bersih |
| Uji unit logika | ✅ 15/15 |
| Indeks DB | ✅ `cards.userId`, `cards.websiteId`, `wallet_transactions.userId` |
| Endpoint baru | `GET /api/packages` (publik) · `GET /api/wallet` · `POST /api/wallet/topup` · `GET/POST /api/cards` · `GET /api/cards/{id}` · `POST /api/cards/{id}/purchase` · `PATCH /api/cards/{id}/autorenew` · `POST /api/cards/{id}/attach` · `POST /api/cards/{id}/detach` |
| Mode | `monetizationEnabled:false` → alur lama belum berubah (endpoint baru bersifat tambahan) |
| Catatan | Panel admin belum mengenal jenis pembayaran baru (`kind: topup/card`) → perlu penyesuaian UI (Fase 5) |

### Fase 3 — Otomasi & Notifikasi (SELESAI 28 Sep 2026, sudah live)

Modul baru `backend/monetization_jobs.py` (kelas `MonetizationJobs`), job harian **idempoten** dan **hanya menyentuh website yang punya kartu**:

- **Sinkron status website**: kartu habis → `websites.frozenAt` diisi (beku); kartu aktif lagi → `frozenAt` dilepas.
- **Reminder mau habis**: H-7, H-3, H-1 sekali per offset (`remindedExpiryOffsets`); H-7/H-3 dilewati bila auto-renew ON & saldo cukup.
- **Reminder kartu kosong**: H+1, H+3, H+7 lalu kelipatan +7 sejak website dihapus (`emptySince`); hanya kartu yang masih aktif (yang sudah habis langsung dihapus).
- **Auto-renew**: kartu berisi website + toggle ON + sisa ≤3 hari → saldo dipotong & durasi terakhir diperpanjang; saldo kurang → notifikasi sekali (`renewRemindedAt`).
- **Hapus kartu kosong**: tanpa website & masa aktif habis → kartu dihapus + notifikasi.
- Template WA dari DB `settings.waMessageTemplates`: tpl-01..04 (H-7/H-3/H-1/kedaluwarsa) + **tpl-21..24 baru** (kartu kosong, auto-renew berhasil/gagal, kartu dihapus) — bisa diedit admin tanpa ubah kode.
- Scheduler: task background saat startup, cek tiap 24 jam, **hanya jalan bila `monetizationEnabled:true`**.
- Endpoint admin: `POST /api/admin/monetization/run-jobs` (default `dryRun:true`) + `GET /api/admin/monetization/jobs-history`; riwayat di koleksi `monetization_jobs`.
- Bukti uji: **17/17 PASS** di DB live (beku, lepas beku, H-7, kartu kosong, auto-renew potong saldo 60rb→10rb, hapus kartu, dry-run tidak mengubah DB & tidak kirim notifikasi, RUN kedua idempoten) + verifikasi objek app asli (`server.jobs`) & pipeline WA asli.

### Fase 4 — UI Kartu & Alur Bikin Website (SELESAI 28 Sep 2026, sudah live)

**Keputusan Mang Jun (28 Sep):** bikin website **wajib punya kartu**; masa gratis **14 hari dimulai saat pertama kali mencoba bikin website** (bukan saat daftar); akun terdaftar yang belum bikin website diingatkan **H+1, H+3, H+7**; masa gratis dibatasi **per akun + per nomor WA terverifikasi**.

**Backend** (`monetization_service.py`, `server.py`, `monetization_jobs.py`, `monetization_api.py`):
- `TRIAL_DAYS` 30 → **14**; gerbang lama (`is_owner_active`/`quota_for`/`product_limit_for`) tidak lagi dipakai di alur bikin website.
- Metode baru: `trial_eligibility()` (1×/akun + 1×/nomor WA), `quota_info()`, `card_for_new_site()` (pakai kartu kosong dulu; kalau tidak ada → otomatis kartu masa gratis 14 hari), `product_limit_for_site()` (masa gratis maks 3 produk, kartu berbayar tanpa batas), `site_public_state()` (beku + badge).
- Koleksi baru `trial_phones` sebagai pengaman masa gratis per nomor WA.
- `POST /api/websites` + `POST /api/websites/demo` → gerbang kartu & auto-pasang kartu; endpoint baru `GET /api/quota-info`; `GET /api/dashboard` menambah `cardQuota`.
- Job harian: `_remind_no_website()` → pengingat **H+1/H+3/H+7** (jendela 8 hari, idempoten via `remindedNoSiteOffsets`, template **tpl-25**).
- `GET /api/public/{slug}`: kartu habis → halaman **masa aktif habis** (beku); badge "Dibuat dengan Situska" **hilang saat kartu berbayar aktif**, tampil saat masa gratis/beku. Situs legacy tanpa kartu masih ikut aturan lama → **migrasi kartu website existing = tugas Fase 5**.
- Reset masa gratis 5 akun (trial nyala tapi belum pernah bikin website): `teguh`, `wa-test-1`, `test-delete-1`, `deltest-*`, `juna@gmail` ✅.

**Frontend:**
- `Subscription.jsx` ditulis ulang → **"Langganan & Kartu"**: daftar kartu (status, sisa hari, tanggal aktif terakhir, website terpasang), beli/perpanjang (tabel harga Kandidat A + label hemat), toggle auto-renew, pasang/lepas kartu, top up saldo (+ info bonus & rekening), riwayat saldo.
- `Dashboard.jsx` alur bikin website: kuota model kartu, info "masa gratis 14 hari akan dipakai" / "kartu X siap dipakai", batas 3 produk saat masa gratis.
- `PublicSite.jsx`: halaman **masa aktif habis** + tombol "Perpanjang masa aktif"; `PublicWebsiteView.jsx`: badge kredit gating.
- Komponen legacy `PaymentFlow`/`PaymentDetail` dipindah ke `pages/PaymentFlow.jsx` (App.js diperbarui).

**Bukti uji (kode live, 28 Sep):**
- Inti Fase 4 **17/17 PASS** (DB live): website pertama → kartu masa gratis 14 hari otomatis; website ke-2 tanpa kartu DITOLAK; produk ke-4 saat masa gratis DITOLAK; website ke-3 dengan kartu kosong → boleh + produk tanpa batas; akun tanpa WA terverifikasi tidak dapat masa gratis; `quota-info`/`cardQuota` benar; data uji dibersihkan.
- Halaman publik & badge **6/6 PASS**: legacy hidup · masa gratis hidup + badge tampil · kartu berbayar → badge HILANG · kartu habis → beku.
- Pengingat akun tanpa website **9/9 PASS**: dry-run mendeteksi, kirim sekali per offset, idempoten, akun >8 hari dilewati.
- Build frontend bersih & bundle live memuat teks UI baru (verifikasi in-container).

### Fase 5 — Harga & Panel Admin (SELESAI 28 Sep 2026, sudah live)

**API admin baru (`server.py`, penjaga `admin_user`):**
- `GET /api/admin/monetization/summary` — ringkasan: statistik kartu (aktif/beku/kosong/masa gratis/berbayar), jumlah website tanpa kartu, pendapatan kartu, daftar kartu + pemilik + website, daftar dompet, 200 transaksi saldo terakhir, tabel paket, bonus, status otomasi.
- `POST /api/admin/monetization/wallet` — tambah/kurangi saldo user (approve top up transfer manual) + bonus top up pertama (sekali per akun), menolak saldo minus.
- `POST /api/admin/monetization/packages` — simpan tabel harga (durasi bulan/hari + harga normal/promo), minimal 1 paket.
- `POST /api/admin/monetization/bonus` — simpan bonus top up (`enabled`, `minTopup`, `bonus`).
- `POST /api/admin/monetization/toggle` — nyalakan/matikan otomasi (`monetizationEnabled`).
- Metode service baru `Monetization.admin_credit(user_id, amount, note, apply_bonus)`.
- Jalur lama `POST /api/admin/payments/{id}/approve` tetap jalan (sudah menangani `kind: topup|card`).

**Frontend:**
- `AdminMonetization.jsx` (BARU) — panel **Paket & Kartu**: ringkasan, tabel kartu (pemilik, status, sisa hari, aktif s/d, website), tabel dompet + aksi **Tambah saldo** (nominal/catatan/opsi bonus), editor tabel harga (tambah/hapus durasi), editor bonus top up, riwayat saldo, saklar otomasi. Editor tier lama (`AdminPlans`) dihapus — route `/admin/plans` kini menyajikan panel baru.
- `Landing.jsx` — bagian harga mengikuti tabel harga live (`GET /api/packages`, fallback Kandidat A): kartu **Masa Gratis 14 hari** + 4 durasi dengan **harga normal dicoret**, **harga promo per bulan**, framing **% hemat** di bawah harga, label **🏆 PALING HEMAT** untuk 12 bulan.

**Bukti uji (kode live, 28 Sep 2026):** uji end-to-end **19/19 PASS** (ringkasan admin, top up 100rb+bonus 50rb sekali pakai, tolak saldo minus, bonus kedua tidak diberikan, riwayat saldo, simpan/tolak tabel harga, simpan bonus, saklar otomasi, `GET /api/packages` publik: 4 paket, 12 bln promo 450rb = 37,5rb/bln, masa gratis 14 hari). Regresi Fase 4 **17/17** + halaman publik/beku **5/5**. Bundle frontend live memuat panel & harga baru (verifikasi in-container).

**Bug ditemukan & diperbaiki saat uji:** `admin_credit` memanggil `_write_tx` dengan urutan argumen salah (`note` terkirim sebagai `ref_id`) → penyesuaian saldo negatif akan error; sudah diperbaiki.

**Skrip migrasi:** `backend/migrate_cards.py` (dry-run default) — memasukkan website lama ke model kartu dengan kartu internal gratis (default 12 bulan, harga 0), opsi `--apply`, `--months`, `--only-published`.

### Go-live 28 Sep 2026 (SELESAI)
1. ✅ **Migrasi kartu SELESAI** — 7 website lama (6 showcase + 1 draft "Test") dapat kartu internal **12 bulan** (harga 0, `isTrialCard: true`) → website tanpa kartu **0**.
2. ✅ **Otomatisasi AKTIF** — `monetizationEnabled: true` di settings `{id:"platform"}`; job harian pengingat jalan otomatis (pratinjau + run nyata: belum ada yang jatuh tempo).
3. ✅ **Healthcheck WA diperbaiki** — gowa pakai `/health` (dulu `/` → false UNHEALTHY); sekarang `healthy`.
4. ✅ **Nomor WA admin & notifikasi admin DIPERBAIKI** — nomor resmi = `6285117079625` (dikonfirmasi Mang Jun). Bug: `wa_service.notify_admin` memakai env `ADMIN_WA_NUMBER` yang **tidak pernah diset** → semua notifikasi admin gagal senyap (`"ADMIN_WA_NUMBER belum diset"` di `wa_logs`). Sekarang `notify_admin` membaca **Settings `adminWhatsapp`** (fallback env). Uji: `admin_number` → `6285117079625`, kirim WA error kosong ✅. Kontak WA 6 situs showcase juga diarahkan ke nomor resmi.
5. ⏳ **Belum:** commit + push Fase 1–5 ke `origin/main` (masih di working tree).

### Bug fix 28 Sep 2026 (verifikasi WA vs masa gratis)
- **Gejala:** akun sudah verifikasi WA (juna@gmail.com) tetap diblokir saat bikin kartu.