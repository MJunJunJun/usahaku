import { useEffect, useState } from "react";
import { Ticket, Sparkles, Check, X, Plus, Trash2 } from "lucide-react";
import { api, errorText, formatDate, money } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";

const discountLabel = (type, value) => {
  if (type === "percentage") return `Diskon ${value}%`;
  if (type === "fixed") return `Potongan Rp${money(value)}`;
  if (type === "days") return `Bonus ${value} hari`;
  return `${value}`;
};

export function UserCoupons() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState(null);

  const check = async () => {
    setBusy(true); setErr(""); setMsg(""); setApplied(null);
    try {
      const r = await api.post("/coupons/validate", { code: code.trim().toUpperCase() });
      setApplied(r.data);
      setMsg(`Kupon valid! Gunakan saat memilih paket di halaman berlangganan.`);
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">KUPON</div>
          <h1>Simpan kode & dapatkan hemat.</h1>
          <p>Cek kupon di sini. Terapkan saat memilih paket untuk mendapatkan diskon atau bonus hari.</p>
        </div>
      </div>

      <div className="wizard-card">
        <div className="eyebrow">CEK KODE KUPON</div>
        <h2>Punya kode kupon?</h2>
        <p className="form-intro">Cek terlebih dahulu apakah kode masih berlaku. Terapkan saat proses pembayaran.</p>
        <div className="coupon-check">
          <input
            data-testid="coupon-check-input"
            className="coupon-check-input"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Masukkan kode, contoh: HEMAT50"
          />
          <Button data-testid="coupon-check-button" onClick={check} disabled={busy || !code.trim()}>
            {busy ? "Mengecek..." : "Cek kupon"}
          </Button>
        </div>
        {msg && applied && (
          <div className="coupon-success-card" data-testid="coupon-valid-info">
            <Ticket size={22} />
            <div>
              <b>Kupon {applied.code} valid</b>
              <span>{discountLabel(applied.discountType, applied.discountValue)}{applied.description && ` · ${applied.description}`}</span>
            </div>
            <StatusBadge status="APPROVED" />
          </div>
        )}
        <FormError msg={err} />
        <div className="coupon-tip">
          <Sparkles size={16} />
          <div>
            <b>Cara pakai kupon</b>
            <span>1. Pilih paket di halaman berlangganan · 2. Klik "Lanjut ke pembayaran" · 3. Masukkan kode kupon pada step 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCoupons() {
  const [list, setList] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percentage", discountValue: 10, maxUses: "", expiresAt: "", isActive: true, description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/coupons").then(r => setList(r.data));
  useEffect(() => { load(); }, []);
  if (!list) return <Loading text="Memuat kupon..." />;

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const payload = { ...form, discountValue: Number(form.discountValue), maxUses: form.maxUses ? Number(form.maxUses) : null, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "" };
      await api.post("/admin/coupons", payload);
      setShowForm(false);
      setForm({ code: "", discountType: "percentage", discountValue: 10, maxUses: "", expiresAt: "", isActive: true, description: "" });
      await load();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const toggle = async (c) => {
    try {
      await api.put(`/admin/coupons/${c.code}`, { ...c, isActive: !c.isActive });
      await load();
    } catch (e) { alert(errorText(e)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Nonaktifkan kupon ${c.code}?`)) return;
    try { await api.delete(`/admin/coupons/${c.code}`); await load(); }
    catch (e) { alert(errorText(e)); }
  };

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">KUPON</div>
          <h1>Manajemen kupon</h1>
          <p>Buat kode diskon atau bonus hari untuk pengguna.</p>
        </div>
        <Button data-testid="admin-new-coupon-button" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Buat kupon baru
        </Button>
      </div>

      {showForm && (
        <div className="wizard-card">
          <div className="eyebrow">KUPON BARU</div>
          <div className="form-grid">
            <label>Kode kupon<input data-testid="coupon-form-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HEMAT50" /></label>
            <label>Tipe diskon
              <select data-testid="coupon-form-type" value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}>
                <option value="percentage">Diskon persentase (%)</option>
                <option value="fixed">Potongan tetap (Rp)</option>
                <option value="days">Bonus hari langganan</option>
              </select>
            </label>
            <label>Nilai<input data-testid="coupon-form-value" type="number" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} placeholder={form.discountType === "percentage" ? "10" : form.discountType === "fixed" ? "25000" : "7"} /></label>
            <label>Batas penggunaan (opsional)<input data-testid="coupon-form-maxuses" type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="Kosongkan untuk tanpa batas" /></label>
            <label>Berlaku sampai (opsional)<input data-testid="coupon-form-expires" type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></label>
            <label>Status
              <select data-testid="coupon-form-active" value={form.isActive ? "1" : "0"} onChange={e => setForm({ ...form, isActive: e.target.value === "1" })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </label>
            <label className="full">Deskripsi<input data-testid="coupon-form-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Promo pembukaan tahun baru" /></label>
          </div>
          <FormError msg={err} />
          <div className="wizard-actions">
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button data-testid="coupon-form-submit" onClick={create} disabled={busy || !form.code.trim() || !form.discountValue}>{busy ? "Menyimpan..." : "Buat kupon"}</Button>
          </div>
        </div>
      )}

      <div className="admin-table">
        <div className="admin-thead"><span>Kode</span><span>Tipe</span><span>Nilai</span><span>Terpakai</span><span>Berlaku</span><span>Status</span><span></span></div>
        {list.map(c => (
          <div data-testid={`coupon-row-${c.code}`} className="admin-tr" key={c.code}>
            <span><b>{c.code}</b><small>{c.description}</small></span>
            <span>{c.discountType}</span>
            <span>{discountLabel(c.discountType, c.discountValue)}</span>
            <span>{c.usedCount || 0}{c.maxUses ? ` / ${c.maxUses}` : ""}</span>
            <span>{c.expiresAt ? formatDate(c.expiresAt) : "Tanpa batas"}</span>
            <span><StatusBadge status={c.isActive ? "APPROVED" : "REJECTED"} /></span>
            <span className="coupon-actions">
              <button data-testid={`toggle-coupon-${c.code}`} className="icon-button" title={c.isActive ? "Nonaktifkan" : "Aktifkan"} onClick={() => toggle(c)}>{c.isActive ? <X size={15} /> : <Check size={15} />}</button>
              <button data-testid={`delete-coupon-${c.code}`} className="icon-button danger" onClick={() => remove(c)}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
        {list.length === 0 && <div className="empty-inline">Belum ada kupon. Buat kupon pertama untuk pengguna.</div>}
      </div>
    </div>
  );
}
