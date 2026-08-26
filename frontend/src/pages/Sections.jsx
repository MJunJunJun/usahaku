import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Sparkles, Star, MapPin, Clock, Phone, LayoutTemplate, Trophy,
  MessageSquareQuote, HelpCircle, MapPinned, ChevronDown, Plus, Trash2,
  Check, EyeOff, Wand2, ShieldCheck, Award, HeartHandshake, Coffee,
  MessageCircle, Flame, Gift, CheckCircle2, Wrench, Calendar, Truck, RefreshCw,
} from "lucide-react";
import { api, errorText } from "../lib/api";
import { Button, FormError, Loading } from "../lib/shared";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const ICON_MAP = {
  ShieldCheck, Sparkles, Award, HeartHandshake, Coffee, MessageCircle, Flame,
  Gift, CheckCircle2, Wrench, Calendar, Truck, RefreshCw, Clock,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const GENERIC_TESTIMONIALS = [
  { name: "Siti Rahma", role: "Pelanggan", comment: "Kualitasnya tidak pernah mengecewakan. Pasti order lagi!", rating: 5 },
  { name: "Andi Pratama", role: "Pelanggan Baru", comment: "Awalnya ragu, ternyata pelayanannya ramah dan sangat responsif.", rating: 4 },
];
const GENERIC_FAQ = [
  { q: "Berapa lama estimasi pengiriman?", a: "Estimasi 1-3 hari kerja untuk Pulau Jawa, 3-7 hari kerja untuk luar Jawa." },
  { q: "Apakah bisa retur atau tukar barang?", a: "Bisa, hubungi kami maksimal 3 hari setelah barang diterima dengan kondisi masih baik." },
];
const pad5 = (specific, generic) => [...specific, ...generic].slice(0, 5);

const DEFAULT_TESTIMONIALS = [
  { name: "Rina Wijaya", role: "Pelanggan Setia", comment: "Pelayanannya cepat dan produknya sangat memuaskan. Sangat direkomendasikan!", rating: 5 },
  { name: "Budi Santoso", role: "Pelanggan", comment: "Pemesanan praktis, barang sampai tepat waktu dan sesuai deskripsi.", rating: 5 },
  ...GENERIC_TESTIMONIALS,
  { name: "Dewi Lestari", role: "Pelanggan Setia", comment: "Sudah langganan lama dan selalu puas. Terima kasih!", rating: 5 },
];
const DEFAULT_FAQ = [
  { q: "Bagaimana cara memesan produk?", a: "Pilih produk pada katalog, lalu klik tombol 'Pesan via WhatsApp'. Tim kami akan segera merespons." },
  { q: "Metode pembayaran apa saja yang tersedia?", a: "Kami menerima transfer bank, e-wallet (QRIS), serta pembayaran langsung di tempat." },
  { q: "Apakah bisa dikirim ke luar kota?", a: "Ya, kami melayani pengiriman dengan ekspedisi terpercaya dan packing yang aman." },
  ...GENERIC_FAQ,
];

const PRESETS = {
  kopi: {
    label: "Kopi & Cafe",
    highlights: [
      { title: "Biji Kopi Nusantara", desc: "100% biji kopi lokal pilihan berkualitas premium.", icon: "Coffee" },
      { title: "Racikan Barista Ahli", desc: "Konsistensi rasa terjaga di setiap cangkir kopi.", icon: "Sparkles" },
      { title: "Order WhatsApp Cepat", desc: "Pesan takeaway atau dine-in tanpa antre panjang.", icon: "MessageCircle" },
    ],
    testimonials: pad5([
      { name: "Dimas Anggara", role: "Penikmat Kopi", comment: "Kopi susunya juara! Manisnya pas dan aroma kopinya kuat banget.", rating: 5 },
      { name: "Sarah Oktaviani", role: "Pelanggan", comment: "Pelayanan cepat dan ramah, kemasan takeaway-nya juga aman dan rapi.", rating: 5 },
      { name: "Reza Mahendra", role: "Freelancer", comment: "Tempat kerja favorit, wifi kencang dan kopinya konsisten enak.", rating: 5 },
    ], GENERIC_TESTIMONIALS),
    faq: pad5([
      { q: "Bagaimana cara memesan lewat WhatsApp?", a: "Pilih menu favorit Anda, klik tombol 'Pesan via WhatsApp', dan pesan otomatis terkirim ke barista kami." },
      { q: "Apakah bisa pesan untuk acara?", a: "Tentu! Kami melayani paket kopi botolan dan booth kopi untuk acara kantor maupun pernikahan." },
      { q: "Tersedia pilihan susu non-dairy?", a: "Ya, kami menyediakan opsi Oat Milk dan Soy Milk untuk beberapa varian minuman." },
    ], GENERIC_FAQ),
    hours: "Senin - Minggu: 08:00 - 22:00 WIB",
  },
  kuliner: {
    label: "Makanan & Kuliner",
    highlights: [
      { title: "Bahan Segar Setiap Hari", desc: "Tanpa bahan pengawet, diolah langsung dari bahan segar.", icon: "ShieldCheck" },
      { title: "Rempah Otentik", desc: "Perpaduan bumbu kaya rasa yang meresap sempurna.", icon: "Flame" },
      { title: "Pengiriman Cepat & Hangat", desc: "Dikemas higienis agar sampai dalam kondisi terbaik.", icon: "Truck" },
    ],
    testimonials: pad5([
      { name: "Hendra Kurniawan", role: "Pelanggan", comment: "Porsinya banyak, rasanya nagih! Bumbu rempahnya bener-bener berasa.", rating: 5 },
      { name: "Maya Sasmita", role: "Food Enthusiast", comment: "Pesan catering untuk syukuran kantor, semua teman bilang enak banget!", rating: 5 },
      { name: "Ibu Wati", role: "Pelanggan Langganan", comment: "Tiap minggu pasti pesan. Masakan rasanya seperti masakan sendiri.", rating: 5 },
    ], GENERIC_TESTIMONIALS),
    faq: pad5([
      { q: "Apakah menerima pesanan nasi box / katering?", a: "Ya, kami menerima pesanan nasi box dalam jumlah besar untuk berbagai acara dengan konfirmasi H-1." },
      { q: "Bagaimana cara melakukan pembayaran?", a: "Kami menerima transfer bank, QRIS (GoPay, OVO, ShopeePay, Dana), serta tunai saat pick-up." },
      { q: "Apakah makanannya halal?", a: "Ya, semua bahan kami halal dan diolah secara higienis setiap hari." },
    ], GENERIC_FAQ),
    hours: "Senin - Sabtu: 09:00 - 21:00 WIB · Minggu: 10:00 - 20:00 WIB",
  },
  fashion: {
    label: "Fashion & Retail",
    highlights: [
      { title: "Bahan Nyaman & Adem", desc: "Pilihan kain premium yang nyaman dipakai seharian.", icon: "ShieldCheck" },
      { title: "Model Selalu Update", desc: "Desain kekinian yang cocok untuk casual maupun formal.", icon: "Sparkles" },
      { title: "Garansi Tukar Ukuran", desc: "Kemudahan retur jika ukuran tidak sesuai.", icon: "Award" },
    ],
    testimonials: pad5([
      { name: "Bella Anindya", role: "Pelanggan", comment: "Jahitannya sangat rapi, bahannya jatuh dan adem banget saat dipakai.", rating: 5 },
      { name: "Rizky Pratama", role: "Pelanggan Setia", comment: "Pengiriman cepat dan pengemasan rapi. Bakal langganan terus!", rating: 5 },
      { name: "Nadia Putri", role: "Pelanggan", comment: "Ukurannya pas sesuai size chart, warnanya juga sesuai foto.", rating: 5 },
    ], GENERIC_TESTIMONIALS),
    faq: pad5([
      { q: "Bagaimana panduan ukurannya?", a: "Setiap produk dilengkapi size chart detail. Bisa juga konsultasi ukuran via WhatsApp." },
      { q: "Apakah bisa kirim ke seluruh Indonesia?", a: "Ya, kami bekerja sama dengan berbagai ekspedisi reguler maupun kilat ke seluruh Indonesia." },
      { q: "Apakah warna sesuai foto?", a: "Kami selalu berusaha menampilkan foto apa adanya, meski bisa ada perbedaan tipis karena cahaya." },
    ], GENERIC_FAQ),
    hours: "Senin - Minggu: 10:00 - 21:00 WIB",
  },
  jasa: {
    label: "Jasa Profesional",
    highlights: [
      { title: "Hasil Berkualitas Tinggi", desc: "Dikerjakan dengan standar profesional dan teliti.", icon: "Award" },
      { title: "Pengerjaan Tepat Waktu", desc: "Komitmen deadline yang terjaga sesuai kesepakatan.", icon: "Calendar" },
      { title: "Konsultasi Responsif", desc: "Diskusi mudah dan cepat via WhatsApp setiap saat.", icon: "MessageCircle" },
    ],
    testimonials: pad5([
      { name: "Agus Salim", role: "Klien", comment: "Sangat komunikatif dan hasil kerjanya rapi serta tepat waktu. Recommended!", rating: 5 },
      { name: "Dewi Lestari", role: "Klien Bisnis", comment: "Proses pengerjaan transparan, hasil melebihi ekspektasi kami.", rating: 5 },
      { name: "Fajar Ramadhan", role: "Klien", comment: "Sudah 3x pakai jasanya, kualitasnya selalu konsisten bagus.", rating: 5 },
    ], GENERIC_TESTIMONIALS),
    faq: pad5([
      { q: "Bagaimana alur kerja layanannya?", a: "Mulai dari konsultasi kebutuhan via WhatsApp, penawaran harga, proses pengerjaan, hingga serah terima hasil." },
      { q: "Apakah bisa konsultasi gratis?", a: "Ya, konsultasi awal via WhatsApp sepenuhnya gratis tanpa komitmen." },
      { q: "Bagaimana sistem pembayarannya?", a: "DP 50% di awal pengerjaan, pelunasan setelah pekerjaan selesai dan disetujui." },
    ], GENERIC_FAQ),
    hours: "Senin - Sabtu: 08:00 - 17:00 WIB",
  },
  otomotif: {
    label: "Otomotif & Bengkel",
    highlights: [
      { title: "Sparepart Original", desc: "Jaminan suku cadang asli dan bergaransi resmi.", icon: "ShieldCheck" },
      { title: "Mekanik Berpengalaman", desc: "Pengerjaan teliti dengan peralatan modern.", icon: "Wrench" },
      { title: "Garansi Hasil Service", desc: "Garansi perbaikan untuk ketenangan Anda.", icon: "CheckCircle2" },
    ],
    testimonials: pad5([
      { name: "Bambang Sudiro", role: "Pelanggan", comment: "Mekaniknya jujur dan detail ngejelasin masalah mesin. Harganya transparan.", rating: 5 },
      { name: "Andi Wijaya", role: "Pelanggan", comment: "Booking service gampang, pengerjaan cepat dan rapi.", rating: 5 },
      { name: "Gunawan Halim", role: "Pelanggan Setia", comment: "5 tahun langganan di sini, motor selalu dalam kondisi prima.", rating: 5 },
    ], GENERIC_TESTIMONIALS),
    faq: pad5([
      { q: "Apakah ada estimasi biaya sebelum pengerjaan?", a: "Ya! Kami selalu memberikan rincian estimasi biaya dan konfirmasi sebelum melakukan penggantian part." },
      { q: "Berapa lama waktu pengerjaan service?", a: "Service rutin umumnya 1-2 jam, perbaikan besar akan dikonfirmasi setelah pemeriksaan awal." },
      { q: "Apakah hasil servis bergaransi?", a: "Ya, semua pengerjaan dan sparepart bergaransi sesuai ketentuan yang berlaku." },
    ], GENERIC_FAQ),
    hours: "Senin - Sabtu: 08:00 - 18:00 WIB · Minggu: 09:00 - 15:00 WIB",
  },
  umum: {
    label: "Umum / Default",
    highlights: [
      { title: "Kualitas Terjamin", desc: "Produk teruji dengan standar mutu terbaik untuk Anda.", icon: "ShieldCheck" },
      { title: "Layanan Ramah & Cepat", desc: "Respons sigap dan bersahabat untuk setiap pertanyaan.", icon: "Sparkles" },
      { title: "Pemesanan Praktis", desc: "Mudah terhubung langsung melalui kontak WhatsApp kami.", icon: "MessageCircle" },
    ],
    testimonials: DEFAULT_TESTIMONIALS,
    faq: DEFAULT_FAQ,
    hours: "Senin - Minggu: 08:00 - 22:00 WIB",
  },
};

const emptyHighlight = () => ({ title: "", desc: "", icon: "ShieldCheck" });
const emptyTestimonial = () => ({ name: "", role: "Pelanggan", comment: "", rating: 5 });
const emptyFaq = () => ({ q: "", a: "" });

export const makeDefaultSections = () => ({
  highlightsVisible: true,
  testimonialsVisible: true,
  faqVisible: true,
  contactVisible: true,
  contactCards: { address: true, hours: true, social: true },
  mapsUrl: "",
  highlights: [emptyHighlight(), emptyHighlight(), emptyHighlight()],
  testimonials: DEFAULT_TESTIMONIALS.map((t) => ({ ...t })),
  faq: DEFAULT_FAQ.map((f) => ({ ...f })),
  businessHours: "",
});

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </div>
);

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400";

const contentCls = "bg-white border border-slate-200 shadow-xl rounded-xl";
const itemCls = "focus:bg-emerald-50";

function IconSelect({ value, onChange, disabled }) {
  return (
    <Select value={value || "ShieldCheck"} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentCls}>
        {ICON_OPTIONS.map((ic) => {
          const Icon = ICON_MAP[ic];
          return (
            <SelectItem key={ic} value={ic} className={itemCls}>
              <span className="flex items-center gap-2">
                <Icon size={14} className="text-emerald-600" />
                <span className="text-xs">{ic}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function SectionCard({ icon: Icon, tint, title, subtitle, visible, onToggle, onPreset, presetDisabled, children, testid }) {
  return (
    <section data-testid={testid} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
            <Icon size={20} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onPreset && (
            <Select onValueChange={onPreset} value="">
              <SelectTrigger className="h-9 w-[170px] rounded-lg border-slate-200 bg-white text-xs font-medium" disabled={presetDisabled}>
                <span className="!flex items-center gap-1.5 text-slate-600"><Wand2 size={13} className="shrink-0 text-emerald-600" /><SelectValue placeholder="Preset template..." /></span>
              </SelectTrigger>
              <SelectContent className={contentCls}>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key} className={itemCls}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <span className={`text-xs font-semibold ${visible ? "text-emerald-600" : "text-slate-400"}`}>
              {visible ? "Tampil" : "Disembunyikan"}
            </span>
            <Switch checked={visible} onCheckedChange={onToggle} />
          </label>
        </div>
      </div>
      <div className={visible ? "" : "pointer-events-none select-none opacity-40"}>{children}</div>
    </section>
  );
}

const addItemBtnCls =
  "flex w-full items-center justify-center gap-1.5 py-3 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40";

export function SectionForm({ site = {}, cfg, set }) {
  const [openFaq, setOpenFaq] = useState(0);
  const setCard = (key, val) => set({ contactCards: { ...cfg.contactCards, [key]: val } });

  const applyPreset = (section, key) => {
    const p = PRESETS[key];
    if (!p) return;
    if (section === "highlights") set({ highlights: p.highlights.map((x) => ({ ...x })) });
    if (section === "testimonials") set({ testimonials: p.testimonials.map((x) => ({ ...x })) });
    if (section === "faq") { set({ faq: p.faq.map((x) => ({ ...x })) }); setOpenFaq(0); }
    if (section === "contact") set({ businessHours: p.hours });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
        <EyeOff size={16} className="mt-0.5 shrink-0 text-emerald-600" />
        <span>Section yang dimatikan <b>(OFF)</b> tidak akan muncul di halaman utama website. Gunakan dropdown <b>Preset template</b> untuk mengisi konten secara instan.</span>
      </div>

      {/* SECTION 1: KEUNGGULAN */}
      <SectionCard testid="section-highlights" icon={Trophy} tint="bg-amber-50 text-amber-600"
        title="Section 1 · Keunggulan" subtitle="3 kartu berisi ikon, judul, dan deskripsi unggulan usaha"
        visible={cfg.highlightsVisible} onToggle={(v) => set({ highlightsVisible: v })}
        onPreset={(k) => applyPreset("highlights", k)} presetDisabled={!cfg.highlightsVisible}>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {cfg.highlights.slice(0, 3).map((h, i) => {
            const Preview = ICON_MAP[h.icon] || ShieldCheck;
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <Preview size={16} />
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Card {i + 1}</span>
                </div>
                <div className="space-y-3">
                  <Field label="Ikon">
                    <IconSelect value={h.icon} disabled={!cfg.highlightsVisible}
                      onChange={(v) => { const x = [...cfg.highlights]; x[i].icon = v; set({ highlights: x }); }} />
                  </Field>
                  <Field label="Judul">
                    <input data-testid={`highlight-${i}-title`} className={inputCls} value={h.title} disabled={!cfg.highlightsVisible}
                      onChange={(e) => { const x = [...cfg.highlights]; x[i].title = e.target.value; set({ highlights: x }); }}
                      placeholder="Contoh: Kualitas Terjamin" />
                  </Field>
                  <Field label="Deskripsi">
                    <textarea rows={3} className={inputCls} value={h.desc} disabled={!cfg.highlightsVisible}
                      onChange={(e) => { const x = [...cfg.highlights]; x[i].desc = e.target.value; set({ highlights: x }); }}
                      placeholder="Jelaskan keunggulan ini singkat saja..." />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* SECTION 2: ULASAN PELANGGAN — satu container, item di dalamnya */}
      <SectionCard testid="section-testimonials" icon={MessageSquareQuote} tint="bg-violet-50 text-violet-600"
        title="Section 2 · Ulasan Pelanggan" subtitle={`Kartu rating bintang, kutipan, nama, dan label status · ${cfg.testimonials.length} ulasan`}
        visible={cfg.testimonialsVisible} onToggle={(v) => set({ testimonialsVisible: v })}
        onPreset={(k) => applyPreset("testimonials", k)} presetDisabled={!cfg.testimonialsVisible}>
        <div className="p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {cfg.testimonials.map((t, i) => (
                <div key={i} className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-[11px] font-bold text-violet-600">{i + 1}</span>
                      {[...Array(t.rating || 5)].map((_, s) => <Star key={s} size={13} fill="#FBBF24" color="#FBBF24" />)}
                    </div>
                    {cfg.testimonials.length > 1 && (
                      <button data-testid={`remove-testimonial-${i}`} onClick={() => set({ testimonials: cfg.testimonials.filter((_, j) => j !== i) })}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Hapus ulasan ini">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Rating bintang">
                      <Select value={String(t.rating || 5)} onValueChange={(v) => { const x = [...cfg.testimonials]; x[i].rating = Number(v); set({ testimonials: x }); }} disabled={!cfg.testimonialsVisible}>
                        <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className={contentCls}>
                          {[5, 4, 3, 2, 1].map((n) => (
                            <SelectItem key={n} value={String(n)} className={itemCls}>
                              <span className="flex items-center gap-1.5">
                                {[...Array(n)].map((_, s) => <Star key={s} size={11} fill="#FBBF24" color="#FBBF24" />)}
                                <span className="text-xs">{n} bintang</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Nama pelanggan">
                      <input data-testid={`testimonial-${i}-name`} className={inputCls} value={t.name} disabled={!cfg.testimonialsVisible}
                        onChange={(e) => { const x = [...cfg.testimonials]; x[i].name = e.target.value; set({ testimonials: x }); }} placeholder="Contoh: Rina Wijaya" />
                    </Field>
                    <Field label="Label status">
                      <input data-testid={`testimonial-${i}-role`} className={inputCls} value={t.role} disabled={!cfg.testimonialsVisible}
                        onChange={(e) => { const x = [...cfg.testimonials]; x[i].role = e.target.value; set({ testimonials: x }); }} placeholder="Contoh: Pelanggan Setia" />
                    </Field>
                    <Field label="Kutipan ulasan">
                      <textarea rows={2} className={inputCls} value={t.comment} disabled={!cfg.testimonialsVisible}
                        onChange={(e) => { const x = [...cfg.testimonials]; x[i].comment = e.target.value; set({ testimonials: x }); }} placeholder="Tulis pengalaman positif pelanggan..." />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <button data-testid="add-testimonial-button" onClick={() => set({ testimonials: [...cfg.testimonials, emptyTestimonial()] })}
              className={addItemBtnCls} disabled={cfg.testimonials.length >= 9}>
              <Plus size={14} /> Tambah ulasan ({cfg.testimonials.length}/9)
            </button>
          </div>
        </div>
      </SectionCard>

      {/* SECTION 3: FAQ — satu container accordion */}
      <SectionCard testid="section-faq" icon={HelpCircle} tint="bg-sky-50 text-sky-600"
        title="Section 3 · FAQ" subtitle={`Accordion pertanyaan umum · ${cfg.faq.length} pertanyaan`}
        visible={cfg.faqVisible} onToggle={(v) => set({ faqVisible: v })}
        onPreset={(k) => applyPreset("faq", k)} presetDisabled={!cfg.faqVisible}>
        <div className="p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {cfg.faq.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div key={i}>
                    <button type="button" data-testid={`faq-toggle-${i}`} onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
                      <span className="flex items-center gap-2 truncate">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-[11px] font-bold text-sky-600">{i + 1}</span>
                        <span className="truncate text-sm font-semibold text-slate-700">{f.q || `Pertanyaan ${i + 1}`}</span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                        <Field label="Pertanyaan">
                          <input data-testid={`faq-${i}-question`} className={inputCls} value={f.q} disabled={!cfg.faqVisible}
                            onChange={(e) => { const x = [...cfg.faq]; x[i].q = e.target.value; set({ faq: x }); }} placeholder="Contoh: Bagaimana cara memesan?" />
                        </Field>
                        <Field label="Jawaban">
                          <textarea rows={2} data-testid={`faq-${i}-answer`} className={inputCls} value={f.a} disabled={!cfg.faqVisible}
                            onChange={(e) => { const x = [...cfg.faq]; x[i].a = e.target.value; set({ faq: x }); }} placeholder="Tulis jawaban yang jelas dan ramah..." />
                        </Field>
                        {cfg.faq.length > 1 && (
                          <button data-testid={`remove-faq-${i}`} onClick={() => { set({ faq: cfg.faq.filter((_, j) => j !== i) }); setOpenFaq(null); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600">
                            <Trash2 size={13} /> Hapus pertanyaan ini
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button data-testid="add-faq-button" onClick={() => { set({ faq: [...cfg.faq, emptyFaq()] }); setOpenFaq(cfg.faq.length); }}
              className={addItemBtnCls} disabled={cfg.faq.length >= 10}>
              <Plus size={14} /> Tambah pertanyaan ({cfg.faq.length}/10)
            </button>
          </div>
        </div>
      </SectionCard>

      {/* SECTION 4: KONTAK & LOKASI */}
      <SectionCard testid="section-contact" icon={MapPinned} tint="bg-emerald-50 text-emerald-600"
        title="Section 4 · Kontak & Lokasi" subtitle="3 kartu kontak — tiap kartu bisa dinyalakan/dimatikan sendiri"
        visible={cfg.contactVisible} onToggle={(v) => set({ contactVisible: v })}
        onPreset={(k) => applyPreset("contact", k)} presetDisabled={!cfg.contactVisible}>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          {/* Card 1: Alamat + Maps */}
          <div className={`flex flex-col rounded-xl border p-4 ${cfg.contactVisible && cfg.contactCards.address ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/60"}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-emerald-600" />
                <b className="text-sm text-slate-800">Alamat & Maps</b>
              </div>
              <Switch data-testid="contact-card-address-switch" checked={cfg.contactCards.address} onCheckedChange={(v) => setCard("address", v)} />
            </div>
            <p className="mb-3 line-clamp-2 text-xs text-slate-500">{site.address || "Alamat belum diisi"}{site.city ? `, ${site.city}` : ""}</p>
            <Field label="Link Google Maps">
              <input data-testid="maps-url-input" className={inputCls} value={cfg.mapsUrl} disabled={!cfg.contactVisible || !cfg.contactCards.address}
                onChange={(e) => set({ mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
            </Field>
          </div>

          {/* Card 2: Jam Operasional */}
          <div className={`flex flex-col rounded-xl border p-4 ${cfg.contactVisible && cfg.contactCards.hours ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/60"}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-emerald-600" />
                <b className="text-sm text-slate-800">Jam Operasional</b>
              </div>
              <Switch data-testid="contact-card-hours-switch" checked={cfg.contactCards.hours} onCheckedChange={(v) => setCard("hours", v)} />
            </div>
            <Field label="Jam buka">
              <textarea rows={3} data-testid="business-hours-input" className={inputCls} value={cfg.businessHours} disabled={!cfg.contactVisible || !cfg.contactCards.hours}
                onChange={(e) => set({ businessHours: e.target.value })} placeholder="Senin - Minggu: 08:00 - 22:00 WIB" />
            </Field>
          </div>

          {/* Card 3: Media Sosial + WA */}
          <div className={`flex flex-col rounded-xl border p-4 ${cfg.contactVisible && cfg.contactCards.social ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/60"}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-emerald-600" />
                <b className="text-sm text-slate-800">Media Sosial & WA</b>
              </div>
              <Switch data-testid="contact-card-social-switch" checked={cfg.contactCards.social} onCheckedChange={(v) => setCard("social", v)} />
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>WhatsApp: <b className="text-slate-800">{site.whatsapp || "-"}</b></li>
              <li>Instagram: <b className="text-slate-800">{site.instagram || "-"}</b></li>
              <li>Facebook: <b className="text-slate-800">{site.facebook || "-"}</b></li>
              <li>TikTok: <b className="text-slate-800">{site.tiktok || "-"}</b></li>
            </ul>
            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-slate-400">Data kontak diambil dari informasi usaha. Ubah lewat menu “Edit manual”.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function SectionManager() {
  const { id } = useParams();
  const nav = useNavigate();
  const [w, setW] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState(makeDefaultSections());

  useEffect(() => {
    api.get(`/websites/${id}`).then((r) => {
      const site = r.data;
      setW(site);
      const ai = site.aiGeneratedContent || {};
      const vis = site.sectionVisibility || {};
      const normHl = (ai.highlights || []).map((h) =>
        typeof h === "string" ? { title: h, desc: "", icon: "ShieldCheck" } : h
      );
      const d = makeDefaultSections();
      setCfg({
        ...d,
        highlightsVisible: vis.highlights !== false,
        testimonialsVisible: vis.testimonials !== false,
        faqVisible: vis.faq !== false,
        contactVisible: vis.contact !== false,
        contactCards: { address: true, hours: true, social: true, ...(site.contactCards || {}) },
        mapsUrl: site.mapsUrl || "",
        highlights: normHl.length ? normHl.map((h) => ({ ...emptyHighlight(), ...h })) : d.highlights,
        testimonials: (ai.testimonials || []).length ? ai.testimonials.map((t) => ({ ...emptyTestimonial(), ...t })) : d.testimonials,
        faq: (ai.faq || []).length ? ai.faq.map((f) => ({ ...emptyFaq(), ...f })) : d.faq,
        businessHours: typeof ai.businessHours === "string" ? ai.businessHours : "",
      });
    });
  }, [id]);

  if (!w) return <Loading text="Menyiapkan pengelolaan section..." />;

  const set = (patch) => { setCfg({ ...cfg, ...patch }); setSaved(false); };

  const save = async () => {
    setSaving(true); setErr("");
    try {
      await api.put(`/websites/${id}/sections`, cfg);
      setSaved(true);
      setTimeout(() => nav(`/dashboard/websites/${id}`), 700);
    } catch (e) { setErr(errorText(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link data-testid="sections-back" to={`/dashboard/websites/${id}`} className="mb-0.5 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600">
              ← Kembali ke website
            </Link>
            <h1 data-testid="sections-title" className="text-xl font-bold tracking-tight text-slate-900">Kelola Section Website</h1>
            <p className="text-sm text-slate-500">Atur tampil/sembunyi dan isi konten tiap bagian <b>{w.businessName}</b>.</p>
          </div>
          <Button data-testid="sections-save-button" onClick={save} disabled={saving} className="rounded-xl px-5">
            {saving ? "Menyimpan..." : saved ? (<><Check size={16} /> Tersimpan</>) : "Simpan perubahan"}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <SectionForm site={w} cfg={cfg} set={set} />
        <FormError msg={err} />
        <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <LayoutTemplate size={15} className="text-emerald-600" />
            Perubahan tampil setelah tombol simpan ditekan.
          </span>
          <Button data-testid="sections-save-footer-button" onClick={save} disabled={saving} className="rounded-xl px-5">
            {saving ? "Menyimpan..." : saved ? (<><Check size={16} /> Berhasil!</>) : (<><Sparkles size={15} /> Simpan perubahan</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
