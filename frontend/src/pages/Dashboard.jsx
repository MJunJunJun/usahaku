import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, ExternalLink, Plus, Sparkles, X, Store, MessageCircle, Check, Upload, Image as ImageIcon, Trash2, LayoutTemplate, Palette, CheckCircle2, Zap, Coffee, Smile } from "lucide-react";
import { api, errorText, uploadFile, daysUntil, money, formatDate } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";
import { WEBSITE_TEMPLATES, COLOR_PALETTES } from "../lib/templates";
import PublicWebsiteView from "./PublicWebsiteView";
import { SectionForm, makeDefaultSections } from "./Sections";

const Stat = ({ label, value, icon }) => (
  <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>
);

const WebsiteCard = ({ w }) => (
  <Link data-testid={`website-card-${w.id}`} className="website-card" to={`/dashboard/websites/${w.id}`}>
    <div className="website-thumb" style={{ background: w.themeConfig?.primary ? `linear-gradient(135deg, ${w.themeConfig.primary}, #14532d)` : undefined }}>
      <div className="thumb-nav"><b>{w.businessName}</b><i /></div>
      <div className="thumb-hero" style={{ backgroundImage: `url(${w.coverImageUrl ? (w.coverImageUrl.startsWith("http") ? w.coverImageUrl : (process.env.REACT_APP_BACKEND_URL + w.coverImageUrl)) : "https://images.unsplash.com/photo-1445116572660-236099ec97a0?q=80&w=500&auto=format&fit=crop"})` }} />
      <div className="thumb-bottom"><span>{w.category}</span><span>{w.productCount || 0} produk</span></div>
    </div>
    <div className="website-info">
      <div><h3>{w.businessName}</h3><StatusBadge status={w.status || "DRAFT"} /></div>
      <ChevronRight size={18} />
    </div>
  </Link>
);

const planName = (slug) => ({ trial: "Trial Gratis", basic: "Basic", premium: "Premium", platinum: "Platinum" })[slug] || "Trial";

const EmptyState = () => {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const seedDemo = async () => {
    setBusy(true);
    try {
      const r = await api.post("/demo/seed");
      nav(`/dashboard/websites/${r.data.id}`);
    } catch (e) { alert(errorText(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="empty-state">
      <div className="empty-icon"><Store /></div>
      <h3>Belum ada website</h3>
      <p>Mulai digitalisasi bisnis kamu dengan membuat website pertama, atau coba dulu dengan contoh bisnis.</p>
      <div className="empty-actions">
        <Link data-testid="empty-create-button" className="btn btn-primary" to="/dashboard/websites/create"><Plus size={17} />Buat website</Link>
        <button data-testid="empty-demo-button" className="btn btn-outline" onClick={seedDemo} disabled={busy}>
          <Sparkles size={16} />{busy ? "Menyiapkan..." : "Coba dengan demo Kopi Senja"}
        </button>
      </div>
    </div>
  );
};

const TrialBanner = ({ user, websiteCount }) => {
  const status = user.subscriptionStatus;
  if (status === "ACTIVE") return null;
  // Don't show trial banner if user hasn't created any website yet (avoid urgency for brand-new users)
  if (status === "TRIAL_ACTIVE" && websiteCount === 0) return null;
  const trial = daysUntil(user.trialEndDate);
  let label, sub, variant = "";
  if (status === "TRIAL_ACTIVE") {
    if (trial <= 1) { label = "Trial kamu berakhir besok."; sub = "Pilih paket sebelum website berhenti tampil."; variant = "warning"; }
    else if (trial <= 3) { label = `Trial gratis tersisa ${trial} hari.`; sub = "Waktunya pilih paket agar bisnis tetap tampil online."; variant = "warning"; }
    else if (trial <= 7) { label = `Trial gratis tersisa ${trial} hari.`; sub = "Nikmati semua fitur UsahaKu selama trial."; variant = "info"; }
    else { label = `Trial gratis aktif · ${trial} hari tersisa.`; sub = "Nikmati semua fitur UsahaKu tanpa batas."; variant = "info"; }
  } else if (status === "TRIAL_EXPIRED") { label = "Trial gratis 30 hari kamu telah berakhir."; sub = "Berlangganan untuk melanjutkan penggunaan UsahaKu."; variant = "expired"; }
  else if (status === "EXPIRED") { label = "Berlangganan kamu telah berakhir."; sub = "Perpanjang paket untuk mengaktifkan kembali website."; variant = "expired"; }
  return (
    <div data-testid="trial-banner" className={`trial-banner ${variant}`}>
      <div className="trial-icon"><Sparkles size={19} /></div>
      <div><b>{label}</b><span>{sub}</span></div>
      <Link data-testid="trial-upgrade-button" to="/dashboard/subscription">Lihat paket <ArrowRight size={15} /></Link>
    </div>
  );
};

export function Dashboard() {
  const [data, setData] = useState(null);
  const load = () => api.get("/dashboard").then(r => setData(r.data));
  useEffect(() => { load(); }, []);
  if (!data) return <Loading text="Memuat ringkasan..." />;
  const u = data.user;
  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">RINGKASAN</div>
          <h1>Selamat datang, {u.name.split(" ")[0]} <span>👋</span></h1>
          <p>Kelola semua website bisnis kamu dari satu tempat.</p>
        </div>
        <Link data-testid="dashboard-create-button" className="btn btn-primary" to="/dashboard/websites/create"><Plus size={17} />Buat website</Link>
      </div>
      <TrialBanner user={u} websiteCount={data.stats.total} />
      <div className="stat-grid">
        <Stat label="Total website" value={data.stats.total} icon="◈" />
        <Stat label="Sudah publish" value={data.stats.published} icon="↗" />
        <Stat label="Masih draft" value={data.stats.draft} icon="◌" />
        <Stat label="Total produk" value={data.stats.products} icon="▦" />
      </div>
      <section className="dashboard-section">
        <div className="section-row">
          <div><h2>Website kamu</h2><p>Semua bisnis yang sedang kamu bangun.</p></div>
          <Link data-testid="view-all-websites" className="text-link" to="/dashboard/websites">Lihat semua <ChevronRight size={16} /></Link>
        </div>
        {data.websites.length ? <div className="website-grid">{data.websites.slice(0, 3).map(w => <WebsiteCard key={w.id} w={w} />)}</div> : <EmptyState />}
      </section>
      <section className="dashboard-section">
        <div className="section-row">
          <div><h2>Status berlangganan</h2><p>Paket dan kuota website saat ini.</p></div>
          <Link data-testid="manage-subscription-link" className="text-link" to="/dashboard/subscription">Kelola <ChevronRight size={16} /></Link>
        </div>
        <div className="sub-summary">
          <div><small>PAKET</small><b>{planName(u.planSlug)}</b></div>
          <div><small>WEBSITE</small><b>{data.stats.total} / {data.quota}</b></div>
          <div><small>{u.subscriptionStatus === "TRIAL_ACTIVE" ? "TRIAL BERAKHIR" : "BERAKHIR"}</small><b>{formatDate(u.subscriptionStatus === "TRIAL_ACTIVE" ? u.trialEndDate : u.subscriptionExpiryDate)}</b></div>
          <div><small>STATUS</small><StatusBadge status={u.subscriptionStatus} /></div>
        </div>
      </section>
    </div>
  );
}

export function WebsiteList() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/dashboard").then(r => setList(r.data)); }, []);
  if (!list) return <Loading text="Memuat website..." />;
  const used = list.stats.total;
  const quota = list.quota;
  const full = used >= quota;
  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">WEBSITE SAYA</div>
          <h1>Semua bisnismu di satu tempat.</h1>
          <p>Kelola website, produk, dan tampilan dari sini.</p>
        </div>
        {full
          ? <Link data-testid="list-upgrade-button" className="btn btn-outline" to="/dashboard/subscription"><ArrowRight size={16} />Upgrade kuota ({used}/{quota})</Link>
          : <Link data-testid="list-create-button" className="btn btn-primary" to="/dashboard/websites/create"><Plus size={17} />Buat website</Link>}
      </div>
      {list.websites.length > 0 && (
        <div className={`quota-pill${full ? " is-full" : ""}`} data-testid="list-quota-info">
          <span>Kuota website terpakai</span>
          <b>{used} / {quota}</b>
          <i className="quota-track"><i className="quota-fill" style={{ width: `${Math.min(100, Math.round((used / Math.max(quota, 1)) * 100))}%` }} /></i>
        </div>
      )}
      {list.websites.length ? <div className="website-grid">{list.websites.map(w => <WebsiteCard key={w.id} w={w} />)}</div> : <EmptyState />}
    </div>
  );
}

const CATEGORIES = ["Coffee Shop", "Restaurant", "Bakery", "Fashion", "Beauty", "Barbershop", "Retail", "Jasa", "Pendidikan", "Lainnya"];

export function CreateWebsite() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ businessName: "", category: "Coffee Shop", description: "", logoUrl: "", coverImageUrl: "", whatsapp: "", phone: "", email: "", instagram: "", facebook: "", tiktok: "", address: "", city: "", province: "" });
  const [products, setProducts] = useState([{ name: "", description: "", price: "", images: [] }]);
  const [sections, setSections] = useState(makeDefaultSections());
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [selectedPalette, setSelectedPalette] = useState("emerald");
  const [primaryColor, setPrimaryColor] = useState("#16A34A");
  const [accentColor, setAccentColor] = useState("#14532D");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quotaInfo, setQuotaInfo] = useState(null);
  useEffect(() => { api.get("/dashboard").then(r => setQuotaInfo({ used: r.data.stats.total, quota: r.data.quota })); }, []);
  const quotaFull = quotaInfo && quotaInfo.used >= quotaInfo.quota;
  const set = (key, val) => setForm({ ...form, [key]: val });
  const setSectionCfg = (patch) => setSections({ ...sections, ...patch });

  const handlePaletteSelect = (pal) => {
    setSelectedPalette(pal.id);
    setPrimaryColor(pal.primary);
    setAccentColor(pal.accent);
  };

  const uploadLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await uploadFile(f); set("logoUrl", r.url); } catch (ex) { setErr(errorText(ex)); }
  };
  const uploadCover = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await uploadFile(f); set("coverImageUrl", r.url); } catch (ex) { setErr(errorText(ex)); }
  };
  const uploadProductImage = async (i, e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if ((products[i].images || []).length >= 3) { setErr("Maksimal 3 gambar per produk"); return; }
    try {
      const r = await uploadFile(f);
      const list = [...products]; list[i].images = [...(list[i].images || []), r.url]; setProducts(list);
    } catch (ex) { setErr(errorText(ex)); }
  };
  const removeProductImage = (i, j) => {
    const list = [...products]; list[i].images = list[i].images.filter((_, k) => k !== j); setProducts(list);
  };

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const createPayload = {
        ...form,
        templateStyle: selectedTemplate,
        themeConfig: { primary: primaryColor, accent: accentColor, style: selectedTemplate },
      };
      const w = (await api.post("/websites", createPayload)).data;
      for (const p of products.filter(x => x.name)) {
        await api.post(`/websites/${w.id}/products`, { ...p, price: Number(p.price) || 0 });
      }
      try { await api.post(`/websites/${w.id}/generate`); }
      catch (aiErr) {
        // AI failed but website exists — apply section config, redirect, let user retry generation on detail page
        try { await api.put(`/websites/${w.id}/sections`, sections); } catch (_) {}
        nav(`/dashboard/websites/${w.id}`);
        setTimeout(() => alert("Website berhasil dibuat, tapi AI belum berhasil membuat konten. Coba tekan 'Generate' di halaman website."), 300);
        return;
      }
      try { await api.put(`/websites/${w.id}/sections`, sections); } catch (_) {}
      nav(`/dashboard/websites/${w.id}`);
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  if (quotaFull) return (
    <div className="wizard-page">
      <div className="page-head compact">
        <div>
          <Link data-testid="wizard-back" className="back-link" to="/dashboard">← Kembali ke ringkasan</Link>
          <h1>Buat website baru</h1>
        </div>
      </div>
      <div className="wizard-card quota-block-card" data-testid="quota-full-block">
        <div className="eyebrow">KUOTA PENUH</div>
        <h2>Kuota websitemu sudah habis.</h2>
        <p className="form-intro">Paket kamu mengizinkan {quotaInfo.quota} website dan semuanya sudah terpakai ({quotaInfo.used}/{quotaInfo.quota}). Upgrade paket untuk menambah kuota website.</p>
        <Link data-testid="quota-upgrade-button" className="btn btn-primary" to="/dashboard/subscription">Lihat paket &amp; upgrade <ArrowRight size={15} /></Link>
      </div>
    </div>
  );

  return (
    <div className="wizard-page">
      <div className="page-head compact">
        <div>
          <Link data-testid="wizard-back" className="back-link" to="/dashboard">← Kembali ke ringkasan</Link>
          <h1>Buat website baru</h1>
          <p>Ceritakan sedikit tentang usahamu. Sisanya kami bantu.</p>
        </div>
        <span className="wizard-count">Langkah {step} dari 4</span>
      </div>
      {quotaInfo && (
        <div className="quota-pill" data-testid="create-quota-info">
          <span>Kuota website terpakai</span>
          <b>{quotaInfo.used} / {quotaInfo.quota}</b>
          <i className="quota-track"><i className="quota-fill" style={{ width: `${Math.min(100, Math.round((quotaInfo.used / Math.max(quotaInfo.quota, 1)) * 100))}%` }} /></i>
        </div>
      )}
      <div className="wizard-steps">
        <span className={step >= 1 ? "active" : ""}><b>1</b> Usaha</span><i />
        <span className={step >= 2 ? "active" : ""}><b>2</b> Produk</span><i />
        <span className={step >= 3 ? "active" : ""}><b>3</b> Section</span><i />
        <span className={step >= 4 ? "active" : ""}><b>4</b> Siap dibuat</span>
      </div>
      <div className="wizard-card">
        {step === 1 && (
          <>
            <div className="eyebrow">TENTANG USAHAMU</div>
            <h2>Mulai dari yang paling penting.</h2>
            <p className="form-intro">Informasi ini akan membantu AI memahami karakter bisnismu.</p>
            <div className="form-grid">
              <label>Nama usaha<input data-testid="business-name-input" value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder="Contoh: Kopi Senja" required /></label>
              <label>Jenis usaha<select data-testid="business-category-select" value={form.category} onChange={e => set("category", e.target.value)}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
              <label className="full">Ceritakan tentang usahamu<textarea data-testid="business-description-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Contoh: Kedai kopi kecil dengan biji kopi lokal dan suasana tenang untuk bekerja..." /></label>
              <label className="upload-label">Logo usaha
                <div data-testid="logo-upload" className="upload-box">
                  {form.logoUrl ? <img src={form.logoUrl.startsWith("http") ? form.logoUrl : process.env.REACT_APP_BACKEND_URL + form.logoUrl} alt="logo" /> : <><Upload size={18} /><span>Upload logo</span></>}
                  <input type="file" accept="image/*" onChange={uploadLogo} data-testid="logo-input" />
                </div>
              </label>
              <label className="upload-label">Cover image
                <div data-testid="cover-upload" className="upload-box">
                  {form.coverImageUrl ? <img src={form.coverImageUrl.startsWith("http") ? form.coverImageUrl : process.env.REACT_APP_BACKEND_URL + form.coverImageUrl} alt="cover" /> : <><Upload size={18} /><span>Upload cover</span></>}
                  <input type="file" accept="image/*" onChange={uploadCover} data-testid="cover-input" />
                </div>
              </label>
              <label>WhatsApp<input data-testid="business-whatsapp-input" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="628123456789" /></label>
              <label>Telepon<input data-testid="business-phone-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Nomor telepon" /></label>
              <label>Instagram<input data-testid="business-instagram-input" value={form.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@kopisenja" /></label>
              <label>Facebook<input data-testid="business-facebook-input" value={form.facebook} onChange={e => set("facebook", e.target.value)} placeholder="fb.com/usaha" /></label>
              <label className="full">Alamat lengkap<input data-testid="business-address-input" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Jl. Kemang Raya No. 12" /></label>
              <label>Kota<input data-testid="business-city-input" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Jakarta Selatan" /></label>
              <label>Provinsi<input data-testid="business-province-input" value={form.province} onChange={e => set("province", e.target.value)} placeholder="DKI Jakarta" /></label>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="eyebrow">KATALOG PRODUK</div>
            <h2>Produk apa yang ingin ditampilkan?</h2>
            <p className="form-intro">Tambahkan beberapa produk favorit. Kamu bisa mengubahnya kapan saja.</p>
            {products.map((p, i) => (
              <div className="product-row" key={i}>
                <div className="product-number">0{i + 1}</div>
                <div className="product-fields">
                  <input data-testid={`product-${i}-name-input`} value={p.name} onChange={e => { const x = [...products]; x[i].name = e.target.value; setProducts(x); }} placeholder="Nama produk" />
                  <input data-testid={`product-${i}-price-input`} value={p.price} onChange={e => { const x = [...products]; x[i].price = e.target.value; setProducts(x); }} placeholder="Harga (Rp)" type="number" />
                  <input data-testid={`product-${i}-description-input`} value={p.description} onChange={e => { const x = [...products]; x[i].description = e.target.value; setProducts(x); }} placeholder="Deskripsi singkat (opsional)" />
                  <div className="product-images">
                    {(p.images || []).map((img, j) => (
                      <div key={j} className="product-image-thumb">
                        <img src={img.startsWith("http") ? img : process.env.REACT_APP_BACKEND_URL + img} alt="" />
                        <button data-testid={`remove-product-${i}-image-${j}`} onClick={() => removeProductImage(i, j)}><X size={12} /></button>
                      </div>
                    ))}
                    {(p.images || []).length < 3 && (
                      <label className="product-image-add" data-testid={`add-product-${i}-image`}>
                        <ImageIcon size={14} /><span>Foto</span>
                        <input type="file" accept="image/*" onChange={(e) => uploadProductImage(i, e)} />
                      </label>
                    )}
                  </div>
                </div>
                {products.length > 1 && (
                  <button data-testid={`remove-product-${i}-button`} className="icon-button" onClick={() => setProducts(products.filter((_, j) => j !== i))}><X size={17} /></button>
                )}
              </div>
            ))}
            <button data-testid="add-product-button" className="add-product" onClick={() => setProducts([...products, { name: "", description: "", price: "", images: [] }])}>
              <Plus size={16} /> Tambah produk
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <div className="eyebrow">ATUR SECTION HALAMAN</div>
            <h2>Susun bagian halaman website-mu.</h2>
            <p className="form-intro">Nyalakan/matikan tiap bagian, atau pakai preset template untuk mengisi konten secara instan. Semua bisa diubah lagi nanti.</p>
            <SectionForm site={form} cfg={sections} set={setSectionCfg} />
          </>
        )}
        {step === 4 && (
          <div className="space-y-6" data-testid="wizard-step-4">
            <div>
              <div className="eyebrow">LANGKAH TERAKHIR · TEMPLATE & PALET WARNA</div>
              <h2 className="text-xl font-extrabold text-slate-900">Pilih Template & Warna Website</h2>
              <p className="form-intro">Pilih dari 5 alternatif desain template dan skema warna impian usahamu.</p>
            </div>

            {/* Pemilih Template Website */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Pilih Template Website (5 Alternatif)</label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {WEBSITE_TEMPLATES.map((tpl) => {
                  const active = selectedTemplate === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      data-testid={`template-option-${tpl.id}`}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`relative cursor-pointer rounded-xl border p-4 transition ${
                        active
                          ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-400/30 shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {tpl.badge}
                        </span>
                        {active && <CheckCircle2 size={18} className="text-emerald-600" />}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{tpl.name}</h4>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{tpl.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pemilih Palet Warna */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Pilih Skema / Palet Warna</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COLOR_PALETTES.map((pal) => {
                  const active = selectedPalette === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      data-testid={`palette-option-${pal.id}`}
                      onClick={() => handlePaletteSelect(pal)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                        active
                          ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400/20"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex shrink-0 -space-x-1.5">
                        <span className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ background: pal.primary }} />
                        <span className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ background: pal.accent }} />
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-700">{pal.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-slate-500 font-medium">Atau warna utama kustom:</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setSelectedPalette("custom");
                  }}
                  className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                  title="Pilih warna utama kustom"
                />
                <span className="font-mono text-xs font-semibold text-slate-700 uppercase">{primaryColor}</span>
              </div>
            </div>

            {/* Ringkasan AI Generate */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles size={16} className="text-emerald-600" />
                <span>Website {form.businessName || "Usaha"} Siap Dibuat dengan AI</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                UsahaKu AI akan menyusun copywriting &amp; layout berdasarkan template <b>{WEBSITE_TEMPLATES.find(t=>t.id===selectedTemplate)?.name}</b> dengan warna <b>{primaryColor}</b>.
              </p>
            </div>
          </div>
        )}
        <FormError msg={err} />
        <div className="wizard-actions">
          {step > 1 && <Button data-testid="wizard-previous-button" variant="outline" onClick={() => setStep(step - 1)}>Kembali</Button>}
          {step < 4 ? (
            <Button data-testid="wizard-next-button" onClick={() => { if (step === 1 && !form.businessName) { setErr("Nama usaha wajib diisi"); return; } setErr(""); setStep(step + 1); }}>
              Lanjut <ArrowRight size={16} />
            </Button>
          ) : (
            <Button data-testid="generate-website-button" onClick={create} disabled={busy}>
              {busy ? <><span className="button-spinner" /> AI sedang membuat...</> : <>Buat website dengan AI <Sparkles size={16} /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function WebsiteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [w, setW] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState("");
  const [device, setDevice] = useState("desktop");
  const load = () => api.get(`/websites/${id}`).then(r => setW(r.data));
  const loadAnalytics = () => api.get(`/websites/${id}/analytics`).then(r => setAnalytics(r.data)).catch(() => {});
  useEffect(() => { load(); loadAnalytics(); }, [id]);
  if (!w) return <Loading text="Menyiapkan website..." />;

  const generate = async () => {
    setBusy(true);
    try { await api.post(`/websites/${id}/generate`); await load(); } catch (e) { alert(errorText(e)); }
    finally { setBusy(false); }
  };
  const edit = async () => {
    if (!command) return;
    setBusy(true);
    try { await api.post(`/websites/${id}/ai-edit`, { command }); setCommand(""); await load(); } catch (e) { alert(errorText(e)); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    try { const r = await api.post(`/websites/${id}/publish`); nav(`/site/${r.data.slug}`); } catch (e) { alert(errorText(e)); }
  };
  const removeSite = async () => {
    if (!window.confirm(`Hapus website ${w.businessName}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await api.delete(`/websites/${id}`); nav("/dashboard/websites"); } catch (e) { alert(errorText(e)); }
  };

  return (
    <div className="detail-page">
      <div className="page-head compact">
        <div>
          <Link data-testid="detail-back" className="back-link" to="/dashboard/websites">← Website saya</Link>
          <h1>{w.businessName}</h1>
          <p>{w.category} · <StatusBadge status={w.status} /></p>
        </div>
        <div className="head-actions">
          <Button data-testid="sections-manager-button" variant="outline" onClick={() => nav(`/dashboard/websites/${id}/sections`)}><LayoutTemplate size={16} /> Kelola section</Button>
          <Button data-testid="edit-manual-button" variant="outline" onClick={() => nav(`/dashboard/websites/${id}/edit`)}>Edit manual</Button>
          <Button data-testid="publish-website-button" onClick={publish}>
            <ExternalLink size={16} /> {w.status === "PUBLISHED" ? "Perbarui online" : "Publish website"}
          </Button>
        </div>
      </div>
      <div className="editor-layout">
        <div className="preview-frame">
          {w.status === "PUBLISHED" && analytics && (
            <div className="analytics-strip" data-testid="analytics-strip">
              <div><small>KUNJUNGAN</small><b>{analytics.pageViews || 0}</b></div>
              <div><small>KLIK WHATSAPP</small><b>{analytics.whatsappClicks || 0}</b></div>
              {w.customDomain && <div><small>DOMAIN</small><b>{w.customDomain}</b></div>}
            </div>
          )}
          <div className="preview-toolbar">
            <span><i className="status-dot" /> Live preview</span>
            <div>
              <button data-testid="desktop-preview-button" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>Desktop</button>
              <button data-testid="tablet-preview-button" className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")}>Tablet</button>
              <button data-testid="mobile-preview-button" className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>Mobile</button>
            </div>
            {w.status === "PUBLISHED" && w.slug && (
              <a data-testid="open-public-link" href={`/site/${w.slug}`} target="_blank" rel="noreferrer" className="text-link">Buka publik <ExternalLink size={14} /></a>
            )}
          </div>
          <div className={`device-frame device-${device}`}>
            <PublicWebsiteView data={w} embedded />
          </div>
        </div>
        <div className="ai-panel">
          <div className="ai-panel-head">
            <span className="ai-spark"><Sparkles size={17} /></span>
            <div><b>Bantu edit dengan AI</b><small>Ceritakan perubahan yang kamu mau</small></div>
          </div>
          <div className="prompt-box">
            <textarea data-testid="ai-edit-input" value={command} onChange={e => setCommand(e.target.value)} placeholder={"Contoh: “Buat website saya lebih elegan”"} />
            <Button data-testid="ai-edit-submit-button" onClick={edit} disabled={busy || !command}>
              {busy ? <span className="button-spinner" /> : <Sparkles size={15} />} Terapkan
            </Button>
          </div>
          <div className="suggestion-label">COBA PERINTAH INI</div>
          <div className="suggestions">
            <button data-testid="ai-suggestion-elegant" onClick={() => setCommand("Buat website saya lebih elegan")}>Buat lebih elegan</button>
            <button data-testid="ai-suggestion-green" onClick={() => setCommand("Gunakan warna hijau dan cream")}>Warna hijau & cream</button>
            <button data-testid="ai-suggestion-headline" onClick={() => setCommand("Buat headline lebih menarik")}>Headline lebih menarik</button>
            <button data-testid="ai-suggestion-modern" onClick={() => setCommand("Buat lebih modern dan minimalis")}>Modern & minimalis</button>
          </div>
          {!w.aiGeneratedContent?.heroTitle && (
            <div className="generate-callout">
              <Sparkles size={18} />
              <div><b>Website belum dibuat AI</b><span>Klik untuk menghasilkan konten pertama.</span></div>
              <Button data-testid="generate-again-button" onClick={generate} disabled={busy}>{busy ? "Membuat..." : "Generate"}</Button>
            </div>
          )}
          <div className="detail-links">
            <Link data-testid="manual-edit-link" to={`/dashboard/websites/${id}/edit`}>Edit informasi & produk <ArrowRight size={15} /></Link>
            <Link data-testid="subscription-link" to="/dashboard/subscription">Kelola paket <ArrowRight size={15} /></Link>
            <button data-testid="delete-website-button" className="danger-link" onClick={removeSite}><Trash2 size={14} />Hapus website</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManualEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [w, setW] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  useEffect(() => { api.get(`/websites/${id}`).then(r => { setW(r.data); setProducts(r.data.products || []); }); }, [id]);
  if (!w) return <Loading text="Menyiapkan editor..." />;
  const set = (k, v) => setW({ ...w, [k]: v });
  const save = async () => {
    setSaving(true); setErr("");
    try {
      const payload = { businessName: w.businessName, category: w.category, description: w.description, logoUrl: w.logoUrl, coverImageUrl: w.coverImageUrl, whatsapp: w.whatsapp, phone: w.phone, email: w.email, instagram: w.instagram, facebook: w.facebook, tiktok: w.tiktok, address: w.address, city: w.city, province: w.province, customDomain: w.customDomain || "" };
      await api.put(`/websites/${id}`, payload);
      await api.put(`/websites/${id}/theme`, { primary: w.themeConfig?.primary, accent: w.themeConfig?.accent, style: w.themeConfig?.style, heroTitle: w.aiGeneratedContent?.heroTitle, heroSubtitle: w.aiGeneratedContent?.heroSubtitle, about: w.aiGeneratedContent?.about });
      nav(`/dashboard/websites/${id}`);
    } catch (e) { setErr(errorText(e)); }
    finally { setSaving(false); }
  };

  const addNewProduct = async () => {
    try {
      const r = await api.post(`/websites/${id}/products`, { name: "Produk baru", price: 0, description: "" });
      setProducts([...products, r.data]);
    } catch (e) { setErr(errorText(e)); }
  };
  const updateProduct = async (p) => {
    try { const r = await api.put(`/products/${p.id}`, { name: p.name, price: Number(p.price) || 0, description: p.description, images: p.images || [] }); setProducts(products.map(x => x.id === p.id ? r.data : x)); }
    catch (e) { setErr(errorText(e)); }
  };
  const removeProduct = async (pid) => {
    if (!window.confirm("Hapus produk ini?")) return;
    try { await api.delete(`/products/${pid}`); setProducts(products.filter(p => p.id !== pid)); }
    catch (e) { setErr(errorText(e)); }
  };
  const uploadProdImg = async (p, e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if ((p.images || []).length >= 3) { setErr("Maksimal 3 gambar per produk"); return; }
    try { const r = await uploadFile(f); await updateProduct({ ...p, images: [...(p.images || []), r.url] }); } catch (ex) { setErr(errorText(ex)); }
  };
  const uploadLogoOrCover = async (kind, e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await uploadFile(f); set(kind, r.url); } catch (ex) { setErr(errorText(ex)); }
  };

  return (
    <div className="wizard-page">
      <div className="page-head compact">
        <div>
          <Link data-testid="edit-back" className="back-link" to={`/dashboard/websites/${id}`}>← Kembali</Link>
          <h1>Edit informasi</h1>
          <p>Ubah data usaha, produk, warna tema, dan section website.</p>
        </div>
        <div className="head-actions">
          <Button data-testid="edit-sections-button" variant="outline" onClick={() => nav(`/dashboard/websites/${id}/sections`)}><LayoutTemplate size={16} /> Kelola section</Button>
          <Button data-testid="edit-save-button" onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan perubahan"}</Button>
        </div>
      </div>
      <div className="wizard-card">
        <div className="eyebrow">DATA USAHA</div>
        <div className="form-grid">
          <label>Nama usaha<input data-testid="edit-business-name" value={w.businessName || ""} onChange={e => set("businessName", e.target.value)} /></label>
          <label>Jenis usaha<select data-testid="edit-business-category" value={w.category || "Lainnya"} onChange={e => set("category", e.target.value)}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="full">Deskripsi<textarea data-testid="edit-business-description" value={w.description || ""} onChange={e => set("description", e.target.value)} /></label>
          <label className="upload-label">Logo
            <div className="upload-box">{w.logoUrl ? <img src={w.logoUrl.startsWith("http") ? w.logoUrl : process.env.REACT_APP_BACKEND_URL + w.logoUrl} alt="logo" /> : <><Upload size={18} /><span>Upload</span></>}<input type="file" accept="image/*" onChange={(e) => uploadLogoOrCover("logoUrl", e)} data-testid="edit-logo-input" /></div>
          </label>
          <label className="upload-label">Cover
            <div className="upload-box">{w.coverImageUrl ? <img src={w.coverImageUrl.startsWith("http") ? w.coverImageUrl : process.env.REACT_APP_BACKEND_URL + w.coverImageUrl} alt="cover" /> : <><Upload size={18} /><span>Upload</span></>}<input type="file" accept="image/*" onChange={(e) => uploadLogoOrCover("coverImageUrl", e)} data-testid="edit-cover-input" /></div>
          </label>
          <label>WhatsApp<input data-testid="edit-whatsapp" value={w.whatsapp || ""} onChange={e => set("whatsapp", e.target.value)} /></label>
          <label>Instagram<input data-testid="edit-instagram" value={w.instagram || ""} onChange={e => set("instagram", e.target.value)} /></label>
          <label className="full">Alamat<input data-testid="edit-address" value={w.address || ""} onChange={e => set("address", e.target.value)} /></label>
          <label>Kota<input data-testid="edit-city" value={w.city || ""} onChange={e => set("city", e.target.value)} /></label>
          <label>Provinsi<input data-testid="edit-province" value={w.province || ""} onChange={e => set("province", e.target.value)} /></label>
          <label className="full">Domain custom (opsional · fitur Platinum)
            <input data-testid="edit-custom-domain" value={w.customDomain || ""} onChange={e => set("customDomain", e.target.value)} placeholder="Contoh: kopisenja.com — hubungi admin untuk aktivasi DNS" />
          </label>
        </div>
        <div className="eyebrow" style={{ marginTop: 32 }}>WARNA TEMA</div>
        <div className="form-grid">
          <label>Warna utama<input data-testid="edit-primary-color" type="color" value={w.themeConfig?.primary || "#16A34A"} onChange={e => set("themeConfig", { ...(w.themeConfig || {}), primary: e.target.value })} /></label>
          <label>Warna aksen<input data-testid="edit-accent-color" type="color" value={w.themeConfig?.accent || "#14532D"} onChange={e => set("themeConfig", { ...(w.themeConfig || {}), accent: e.target.value })} /></label>
          <label className="full">Judul hero<input data-testid="edit-hero-title" value={w.aiGeneratedContent?.heroTitle || ""} onChange={e => set("aiGeneratedContent", { ...(w.aiGeneratedContent || {}), heroTitle: e.target.value })} /></label>
          <label className="full">Sub-hero<input data-testid="edit-hero-subtitle" value={w.aiGeneratedContent?.heroSubtitle || ""} onChange={e => set("aiGeneratedContent", { ...(w.aiGeneratedContent || {}), heroSubtitle: e.target.value })} /></label>
          <label className="full">Tentang bisnis<textarea data-testid="edit-about" value={w.aiGeneratedContent?.about || ""} onChange={e => set("aiGeneratedContent", { ...(w.aiGeneratedContent || {}), about: e.target.value })} /></label>
        </div>
        <div className="eyebrow" style={{ marginTop: 32 }}>PRODUK</div>
        {products.map((p) => (
          <div className="product-row" key={p.id}>
            <div className="product-number"><MessageCircle size={16} /></div>
            <div className="product-fields">
              <input data-testid={`edit-product-name-${p.id}`} value={p.name || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} onBlur={() => updateProduct(p)} placeholder="Nama produk" />
              <input data-testid={`edit-product-price-${p.id}`} type="number" value={p.price || 0} onChange={e => setProducts(products.map(x => x.id === p.id ? { ...x, price: e.target.value } : x))} onBlur={() => updateProduct(p)} placeholder="Harga" />
              <input data-testid={`edit-product-description-${p.id}`} value={p.description || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? { ...x, description: e.target.value } : x))} onBlur={() => updateProduct(p)} placeholder="Deskripsi" />
              <div className="product-images">
                {(p.images || []).map((img, j) => (
                  <div key={j} className="product-image-thumb">
                    <img src={img.startsWith("http") ? img : process.env.REACT_APP_BACKEND_URL + img} alt="" />
                    <button onClick={() => updateProduct({ ...p, images: p.images.filter((_, k) => k !== j) })}><X size={12} /></button>
                  </div>
                ))}
                {(p.images || []).length < 3 && (
                  <label className="product-image-add">
                    <ImageIcon size={14} /><span>Foto</span>
                    <input type="file" accept="image/*" onChange={(e) => uploadProdImg(p, e)} data-testid={`edit-product-image-${p.id}`} />
                  </label>
                )}
              </div>
            </div>
            <button data-testid={`edit-remove-product-${p.id}`} className="icon-button" onClick={() => removeProduct(p.id)}><X size={17} /></button>
          </div>
        ))}
        <button data-testid="edit-add-product" className="add-product" onClick={addNewProduct}><Plus size={16} /> Tambah produk</button>
        <FormError msg={err} />
      </div>
    </div>
  );
}

export function Notifications() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/notifications").then(r => setList(r.data)); }, []);
  const markRead = async (n) => { await api.post(`/notifications/${n.id}/read`); setList(list.map(x => x.id === n.id ? { ...x, isRead: true } : x)); };
  if (!list) return <Loading text="Memuat notifikasi..." />;
  return (
    <div className="dashboard">
      <div className="page-head">
        <div><div className="eyebrow">NOTIFIKASI</div><h1>Semua kabar terbaru.</h1><p>Update tentang website, pembayaran, dan berlangganan.</p></div>
      </div>
      {list.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"><Sparkles /></div><h3>Belum ada notifikasi</h3><p>Kami akan mengabarkan hal penting di sini.</p></div>
      ) : (
        <div className="notif-list">
          {list.map(n => (
            <div data-testid={`notif-${n.id}`} key={n.id} className={`notif-item ${n.isRead ? "read" : ""}`} onClick={() => markRead(n)}>
              <span className="dot" />
              <div><b>{n.title}</b><p>{n.message}</p></div>
              <small>{formatDate(n.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
