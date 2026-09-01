import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Search, Check, X, Users, CreditCard, Store, ClipboardList, Sparkles, Plus, Trash2 } from "lucide-react";
import { api, errorText, money, formatDate, formatDateTime } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";

const AdminHead = ({ eyebrow, title, subtitle, extra }) => (
  <div className="page-head">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {extra}
  </div>
);

const AdminStat = ({ label, value, icon }) => (
  <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>
);

export function AdminOverview() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/overview").then(r => setData(r.data)); }, []);
  if (!data) return <Loading text="Memuat overview..." />;
  return (
    <div className="dashboard">
      <AdminHead eyebrow="ADMIN OVERVIEW" title="Kontrol platform UsahaKu" subtitle="Ringkasan pengguna, website, dan pembayaran." />
      {data.pendingPayments > 0 && (
        <div className="trial-banner warning">
          <div className="trial-icon"><Sparkles size={19} /></div>
          <div><b>{data.pendingPayments} pembayaran menunggu verifikasi</b><span>Verifikasi bukti transfer untuk mengaktifkan berlangganan pengguna.</span></div>
          <Link data-testid="review-payments-link" to="/admin/payment-requests">Verifikasi sekarang <ArrowRight size={15} /></Link>
        </div>
      )}
      <div className="stat-grid">
        <AdminStat label="Total pengguna" value={data.totalUsers} icon={<Users size={16} />} />
        <AdminStat label="Pengguna aktif" value={data.activeUsers} icon="●" />
        <AdminStat label="Trial aktif" value={data.trialUsers} icon="◆" />
        <AdminStat label="Premium aktif" value={data.premiumUsers} icon={<CreditCard size={16} />} />
        <AdminStat label="Trial berakhir" value={data.trialExpired} icon="○" />
        <AdminStat label="Berlangganan berakhir" value={data.expiredUsers} icon="◌" />
        <AdminStat label="Total website" value={data.totalWebsites} icon={<Store size={16} />} />
        <AdminStat label="Website published" value={data.publishedWebsites} icon="↗" />
        <AdminStat label="Pembayaran pending" value={data.pendingPayments} icon={<ClipboardList size={16} />} />
        <AdminStat label="Pembayaran disetujui" value={data.approvedPayments} icon="✓" />
      </div>
    </div>
  );
}

export function AdminUsers() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const deleteUser = async (uid) => {
    if (!confirm("Yakin hapus user ini?")) return;
    setBusyId(uid); setErr("");
    try {
      await api.delete('/admin/users/' + uid);
      setList(list.filter(x => x.id !== uid));
    } catch (e) { setErr(errorText(e)); }
    finally { setBusyId(null); }
  };
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  useEffect(() => { api.get("/admin/users").then(r => setList(r.data)); }, []);
  if (!list) return <Loading text="Memuat pengguna..." />;

  const filtered = list.filter(u => {
    if (filter === "TRIAL" && u.subscriptionStatus !== "TRIAL_ACTIVE") return false;
    if (filter === "ACTIVE" && u.subscriptionStatus !== "ACTIVE") return false;
    if (filter === "EXPIRED" && !["TRIAL_EXPIRED", "EXPIRED"].includes(u.subscriptionStatus)) return false;
    if (filter === "SUSPENDED" && u.accountStatus !== "SUSPENDED") return false;
    if (q && !((u.name || "").toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  return (
    <div className="dashboard">
      <AdminHead eyebrow="PENGGUNA" title="Manajemen pengguna" subtitle={`${list.length} pengguna terdaftar`} />
      <div className="admin-toolbar">
        <div className="search-box"><Search size={16} /><input data-testid="user-search" placeholder="Cari nama atau email" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select data-testid="user-filter" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="ALL">Semua</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Berlangganan aktif</option>
          <option value="EXPIRED">Berakhir</option>
          <option value="SUSPENDED">Ditangguhkan</option>
        </select>
      </div>
      <div className="admin-table">
        <div className="admin-thead"><span>Nama</span><span>Email</span><span>Paket</span><span>Website</span><span>Status</span><span>Berakhir</span><span></span></div>
        {filtered.map(u => (
          <div data-testid={`user-row-${u.id}`} className="admin-tr" key={u.id}>
            <span><b>{u.name}</b><small>{formatDate(u.createdAt)}</small></span>
            <span>{u.email}</span>
            <span>{u.planSlug || "trial"}</span>
            <span>{u.websiteCount} / {u.websiteQuota || 1}</span>
            <span>
              <div>
                <StatusBadge status={u.subscriptionStatus} />
                <button className="btn btn-danger" data-testid={'delete-user-' + u.id} onClick={() => deleteUser(u.id)} disabled={busyId === u.id}>
                  {busyId === u.id ? 'Menghapus...' : 'Hapus user'}
                </button>
              </div>
            </span>
            <span>{formatDate(u.subscriptionStatus === "TRIAL_ACTIVE" ? u.trialEndDate : u.subscriptionExpiryDate)}</span>
            <Link data-testid={`user-detail-${u.id}`} className="text-link" to={`/admin/users/${u.id}`}>Detail →</Link>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-inline">Tidak ada pengguna yang cocok.</div>}
      </div>
    </div>
  );
}

export function AdminUserDetail() {
  const { id } = useParams();
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [action, setAction] = useState({ action: "extend", extraDays: 30, planSlug: "premium-1", additionalWebsites: 0, reason: "" });
  const load = () => api.get(`/admin/users/${id}`).then(r => setU(r.data));
  useEffect(() => { load(); }, [id]);
  if (!u) return <Loading text="Memuat detail..." />;

  const run = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await api.post(`/admin/users/${id}/action`, action);
      if (r.data.resetLink) setMsg(`Reset link: ${window.location.origin}${r.data.resetLink}`);
      else setMsg("Aksi berhasil.");
      await load();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="dashboard">
      <div className="page-head compact">
        <div><Link className="back-link" to="/admin/users">← Kembali</Link><h1>{u.name}</h1><p>{u.email}</p></div>
        <StatusBadge status={u.subscriptionStatus} />
      </div>
      <div className="admin-detail-grid">
        <div className="wizard-card">
          <div className="eyebrow">INFO AKUN</div>
          <div className="info-rows">
            <div><small>NOMOR TELEPON</small><b>{u.whatsapp || u.phone || "-"}</b></div>
            <div><small>PAKET</small><b>{u.planSlug || "trial"}</b></div>
            <div><small>KUOTA WEBSITE</small><b>{u.websiteQuota || 1}</b></div>
            <div><small>WEBSITE TAMBAHAN</small><b>{u.additionalWebsiteQuota || 0}</b></div>
            <div><small>STATUS AKUN</small><b>{u.accountStatus}</b></div>
            <div><small>STATUS BERLANGGANAN</small><b>{u.subscriptionStatus}</b></div>
            <div><small>TRIAL BERAKHIR</small><b>{formatDate(u.trialEndDate)}</b></div>
            <div><small>SUB BERAKHIR</small><b>{formatDate(u.subscriptionExpiryDate)}</b></div>
            <div><small>DAFTAR</small><b>{formatDate(u.createdAt)}</b></div>
          </div>
        </div>
        <div className="wizard-card">
          <div className="eyebrow">AKSI ADMIN</div>
          <div className="form-grid">
            <label>Aksi
              <select data-testid="admin-action-select" value={action.action} onChange={e => setAction({ ...action, action: e.target.value })}>
                <option value="suspend">Suspend akun</option>
                <option value="activate">Aktifkan akun</option>
                <option value="extend">Perpanjang berlangganan</option>
                <option value="change_plan">Ubah paket</option>
                <option value="add_quota">Tambah kuota website</option>
                <option value="cancel">Batalkan berlangganan</option>
                <option value="reset_password">Reset password</option>
              </select>
            </label>
            {action.action === "extend" && <label>Tambah hari<input data-testid="admin-extend-days" type="number" value={action.extraDays} onChange={e => setAction({ ...action, extraDays: e.target.value })} /></label>}
            {action.action === "change_plan" && (
              <>
                <label>Paket baru
                  <select data-testid="admin-change-plan" value={action.planSlug} onChange={e => setAction({ ...action, planSlug: e.target.value })}>
                    <option value="premium-1">Premium 1</option>
                    <option value="premium-3">Premium 3</option>
                  </select>
                </label>
                <label>Website tambahan<input data-testid="admin-additional-websites" type="number" value={action.additionalWebsites} onChange={e => setAction({ ...action, additionalWebsites: e.target.value })} /></label>
              </>
            )}
            {action.action === "add_quota" && <label>Jumlah tambahan<input data-testid="admin-add-quota" type="number" value={action.additionalWebsites} onChange={e => setAction({ ...action, additionalWebsites: e.target.value })} /></label>}
            {(action.action === "suspend" || action.action === "cancel") && (
              <label className="full">Alasan<input data-testid="admin-reason" value={action.reason} onChange={e => setAction({ ...action, reason: e.target.value })} placeholder="Berikan alasan singkat" /></label>
            )}
          </div>
          <FormError msg={err} />
          {msg && <div className="form-info" data-testid="admin-action-message">{msg}</div>}
          <Button data-testid="admin-execute-button" onClick={run} disabled={busy}>{busy ? "Memproses..." : "Jalankan aksi"}</Button>
        </div>
      </div>
      <section className="dashboard-section">
        <div className="section-row"><div><h2>Website ({u.websites?.length || 0})</h2></div></div>
        <div className="admin-table">
          <div className="admin-thead"><span>Nama</span><span>Kategori</span><span>Status</span><span>Slug</span></div>
          {(u.websites || []).map(w => (
            <div className="admin-tr" key={w.id}>
              <span><b>{w.businessName}</b></span><span>{w.category}</span><span><StatusBadge status={w.status} /></span><span>{w.slug || "-"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-section">
        <div className="section-row"><div><h2>Riwayat pembayaran ({u.payments?.length || 0})</h2></div></div>
        <div className="admin-table">
          <div className="admin-thead"><span>Paket</span><span>Jumlah</span><span>Tanggal</span><span>Status</span><span></span></div>
          {(u.payments || []).map(p => (
            <div className="admin-tr" key={p.id}>
              <span>{p.planName}</span><span>Rp{money(p.amount)}</span><span>{formatDate(p.createdAt)}</span><span><StatusBadge status={p.status} /></span>
              <Link className="text-link" to={`/admin/payment-requests/${p.id}`}>Detail →</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminPayments() {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("PENDING");
  useEffect(() => { api.get("/admin/payments").then(r => setList(r.data)); }, []);
  if (!list) return <Loading text="Memuat pembayaran..." />;
  const filtered = list.filter(p => filter === "ALL" || p.status === filter);
  return (
    <div className="dashboard">
      <AdminHead eyebrow="PEMBAYARAN" title="Verifikasi pembayaran" subtitle={`${list.filter(p => p.status === "PENDING").length} menunggu review`} />
      <div className="admin-toolbar">
        <select data-testid="payment-filter" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="PENDING">Menunggu</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
          <option value="ALL">Semua</option>
        </select>
      </div>
      <div className="admin-table">
        <div className="admin-thead"><span>Pengguna</span><span>Paket</span><span>Jumlah</span><span>Transfer</span><span>Submit</span><span>Status</span><span></span></div>
        {filtered.map(p => (
          <div data-testid={`payment-row-${p.id}`} className="admin-tr" key={p.id}>
            <span><b>{p.userName}</b><small>{p.userEmail}</small></span>
            <span>{p.planName}</span>
            <span>Rp{money(p.amount)}</span>
            <span>{p.transferDate || "-"}</span>
            <span>{formatDate(p.createdAt)}</span>
            <span><StatusBadge status={p.status} /></span>
            <Link data-testid={`payment-detail-${p.id}`} className="text-link" to={`/admin/payment-requests/${p.id}`}>Review →</Link>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-inline">Tidak ada pembayaran pada filter ini.</div>}
      </div>
    </div>
  );
}

export function AdminPaymentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const load = () => api.get(`/admin/payments/${id}`).then(r => setP(r.data));
  useEffect(() => { load(); }, [id]);
  if (!p) return <Loading text="Memuat detail pembayaran..." />;
  const proofUrl = p.proofUrl ? (p.proofUrl.startsWith("http") ? p.proofUrl : process.env.REACT_APP_BACKEND_URL + p.proofUrl) : "";
  const approve = async () => {
    if (!window.confirm(`Setujui pembayaran ${p.planName} sebesar Rp${money(p.amount)}?`)) return;
    setBusy(true); setErr("");
    try { await api.post(`/admin/payments/${id}/approve`); nav("/admin/payment-requests"); }
    catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (!reason.trim()) { setErr("Alasan penolakan wajib diisi."); return; }
    setBusy(true); setErr("");
    try { await api.post(`/admin/payments/${id}/reject`, { reason }); nav("/admin/payment-requests"); }
    catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="dashboard">
      <div className="page-head compact">
        <div><Link className="back-link" to="/admin/payment-requests">← Kembali</Link><h1>Review pembayaran</h1><p>{p.user?.name} · {p.user?.email}</p></div>
        <StatusBadge status={p.status} />
      </div>
      <div className="payment-detail-grid">
        <div className="wizard-card">
          <div className="eyebrow">INFORMASI PEMBAYARAN</div>
          <div className="info-rows">
            <div><small>PAKET</small><b>{p.planName}</b></div>
            <div><small>JUMLAH</small><b>Rp{money(p.amount)}</b></div>
            <div><small>WEBSITE TAMBAHAN</small><b>{p.additionalWebsiteCount || 0}</b></div>
            <div><small>TANGGAL TRANSFER</small><b>{p.transferDate || "-"}</b></div>
            <div><small>SUBMIT</small><b>{formatDateTime(p.createdAt)}</b></div>
            {p.notes && <div><small>CATATAN USER</small><b>{p.notes}</b></div>}
            {p.adminNotes && <div><small>CATATAN ADMIN</small><b>{p.adminNotes}</b></div>}
          </div>
          {p.status === "PENDING" && (
            <>
              <label className="reject-reason-label" style={{ marginTop: 20 }}>Alasan (untuk penolakan)</label>
              <textarea data-testid="reject-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: Jumlah transfer tidak sesuai" className="reject-reason-textarea" />
              <FormError msg={err} />
              <div className="admin-review-actions">
                <Button data-testid="approve-payment-button" onClick={approve} disabled={busy}><Check size={16} /> Setujui</Button>
                <Button data-testid="reject-payment-button" variant="outline" onClick={reject} disabled={busy}><X size={16} /> Tolak</Button>
              </div>
            </>
          )}
        </div>
        <div className="wizard-card">
          <div className="eyebrow">BUKTI TRANSFER</div>
          {p.proofUrl && ((p.proofContentType === "application/pdf" || p.proofUrl.toLowerCase().endsWith(".pdf"))
            ? <a data-testid="admin-view-proof" href={proofUrl} target="_blank" rel="noreferrer" className="btn btn-outline">Buka bukti PDF</a>
            : <img data-testid="admin-proof-image" src={proofUrl} alt="bukti" style={{ maxWidth: "100%", borderRadius: 12 }} onError={(e) => { e.target.style.display = "none"; e.target.insertAdjacentHTML("afterend", `<a href='${proofUrl}' target='_blank' class='btn btn-outline'>Buka bukti</a>`); }} />
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminPlans() {
  const [plans, setPlans] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", monthlyPrice: "", websiteLimit: "", featuresText: "", allowsAdditional: false });
  useEffect(() => { api.get("/admin/plans").then(r => setPlans(r.data)); }, []);
  if (!plans) return <Loading text="Memuat paket..." />;
  const update = (i, k, v) => setPlans(plans.map((p, j) => i === j ? { ...p, [k]: v } : p));
  const save = async (p) => {
    setSaving(true); setErr(""); setMsg("");
    try {
      await api.put(`/admin/plans/${p.slug}`, { name: p.name, monthlyPrice: Number(p.monthlyPrice), websiteLimit: Number(p.websiteLimit), features: p.features, isActive: p.isActive });
      setMsg(`Paket ${p.name} tersimpan.`);
    } catch (e) { setErr(errorText(e)); }
    finally { setSaving(false); }
  };
  const create = async () => {
    setSaving(true); setErr(""); setMsg("");
    try {
      await api.post("/admin/plans", {
        name: form.name,
        monthlyPrice: Number(form.monthlyPrice) || 0,
        websiteLimit: Number(form.websiteLimit) || 1,
        features: form.featuresText.split("\n").map(s => s.trim()).filter(Boolean),
        allowsAdditional: form.allowsAdditional,
        isActive: true
      });
      setMsg(`Paket ${form.name} berhasil dibuat.`);
      setForm({ name: "", monthlyPrice: "", websiteLimit: "", featuresText: "", allowsAdditional: false });
      setShowForm(false);
      const r = await api.get("/admin/plans");
      setPlans(r.data);
    } catch (e) { setErr(errorText(e)); }
    finally { setSaving(false); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Hapus permanen paket ${p.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setErr(""); setMsg("");
    try {
      await api.delete(`/admin/plans/${p.slug}`);
      setPlans(plans.filter(x => x.slug !== p.slug));
      setMsg(`Paket ${p.name} dihapus.`);
    } catch (e) { setErr(errorText(e)); }
  };
  return (
    <div className="dashboard">
      <AdminHead eyebrow="PAKET" title="Manajemen paket" subtitle="Atur harga, kuota, dan fitur. Buat paket baru atau hapus yang tidak dipakai."
        extra={<Button data-testid="admin-new-plan-button" onClick={() => { setShowForm(!showForm); setErr(""); }}><Plus size={16} /> Paket baru</Button>} />
      {msg && <div className="form-info">{msg}</div>}
      {showForm && (
        <div className="wizard-card" data-testid="admin-plan-form">
          <div className="eyebrow">PAKET BARU</div>
          <div className="form-grid">
            <label>Nama paket<input data-testid="plan-form-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Business" /></label>
            <label>Harga/bulan<input data-testid="plan-form-price" type="number" value={form.monthlyPrice} onChange={e => setForm({ ...form, monthlyPrice: e.target.value })} placeholder="Contoh: 150000" /></label>
            <label>Kuota website<input data-testid="plan-form-limit" type="number" value={form.websiteLimit} onChange={e => setForm({ ...form, websiteLimit: e.target.value })} placeholder="Contoh: 5" /></label>
            <label>Bisa tambah website berbayar?
              <select data-testid="plan-form-additional" value={form.allowsAdditional ? "1" : "0"} onChange={e => setForm({ ...form, allowsAdditional: e.target.value === "1" })}>
                <option value="0">Tidak</option>
                <option value="1">Ya</option>
              </select>
            </label>
            <label className="full">Fitur (satu per baris)<textarea data-testid="plan-form-features" value={form.featuresText} onChange={e => setForm({ ...form, featuresText: e.target.value })} placeholder={"5 website\nAI generation & editing\nDukungan prioritas"} /></label>
          </div>
          <FormError msg={err} />
          <div className="wizard-actions">
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button data-testid="plan-form-submit" onClick={create} disabled={saving || !form.name.trim()}>{saving ? "Menyimpan..." : "Buat paket"}</Button>
          </div>
        </div>
      )}
      {!showForm && err && <FormError msg={err} />}
      <div className="admin-plans-grid">
        {plans.map((p, i) => (
          <div className="wizard-card" key={p.slug}>
            <div className="plan-card-head">
              <div className="eyebrow">{p.slug.toUpperCase()}</div>
              <span className={`badge ${p.isActive ? "badge-success" : "badge-danger"}`}>{p.isActive ? "Aktif" : "Nonaktif"}</span>
            </div>
            <div className="plan-card-price">Rp{money(p.monthlyPrice)}<small>/bulan</small></div>
            <div className="form-grid">
              <label>Nama<input data-testid={`plan-name-${p.slug}`} value={p.name} onChange={e => update(i, "name", e.target.value)} /></label>
              <label>Harga/bulan<input data-testid={`plan-price-${p.slug}`} type="number" value={p.monthlyPrice} onChange={e => update(i, "monthlyPrice", e.target.value)} /></label>
              <label>Kuota website<input data-testid={`plan-limit-${p.slug}`} type="number" value={p.websiteLimit} onChange={e => update(i, "websiteLimit", e.target.value)} /></label>
              <label>Status
                <select data-testid={`plan-active-${p.slug}`} value={p.isActive ? "1" : "0"} onChange={e => update(i, "isActive", e.target.value === "1")}>
                  <option value="1">Aktif</option><option value="0">Nonaktif</option>
                </select>
              </label>
              <label className="full">Fitur (pisahkan dengan enter)<textarea data-testid={`plan-features-${p.slug}`} value={(p.features || []).join("\n")} onChange={e => update(i, "features", e.target.value.split("\n").filter(Boolean))} /></label>
            </div>
            <div className="wizard-actions">
              <Button variant="outline" data-testid={`plan-delete-${p.slug}`} onClick={() => remove(p)} title={p.isDefault || p.slug === "trial" ? "Paket bawaan tidak bisa dihapus" : "Hapus paket"} disabled={p.isDefault || p.slug === "trial"}>
                <Trash2 size={15} /> Hapus
              </Button>
              <Button data-testid={`plan-save-${p.slug}`} onClick={() => save(p)} disabled={saving}>{saving ? "Menyimpan..." : "Simpan perubahan"}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminActivity() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { api.get("/admin/activity-logs").then(r => setLogs(r.data)); }, []);
  if (!logs) return <Loading text="Memuat aktivitas..." />;
  return (
    <div className="dashboard">
      <AdminHead eyebrow="AKTIVITAS ADMIN" title="Log semua aksi admin" subtitle={`${logs.length} entri`} />
      <div className="admin-table">
        <div className="admin-thead"><span>Waktu</span><span>Admin</span><span>Aksi</span><span>Target</span><span>Catatan</span></div>
        {logs.map(l => (
          <div data-testid={`log-${l.id}`} className="admin-tr" key={l.id}>
            <span>{formatDateTime(l.createdAt)}</span>
            <span>{l.adminName || "-"}</span>
            <span><b>{l.action}</b></span>
            <span>{l.targetName || l.targetResourceId || "-"}</span>
            <span title={l.notes}>{(l.notes || "").slice(0, 60)}</span>
          </div>
        ))}
        {logs.length === 0 && <div className="empty-inline">Belum ada aktivitas.</div>}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/admin/settings").then(r => setS(r.data)); }, []);
  if (!s) return <Loading text="Memuat pengaturan..." />;
  const set = (k, v) => setS({ ...s, [k]: v });
  const save = async () => {
    setSaving(true); setMsg(""); setErr("");
    try {
      const payload = { applicationName: s.applicationName, supportEmail: s.supportEmail, adminWhatsapp: s.adminWhatsapp, bankName: s.bankName, accountName: s.accountName, accountNumber: s.accountNumber, paymentInstructions: s.paymentInstructions, additionalWebsitePrice: Number(s.additionalWebsitePrice) };
      await api.put("/admin/settings", payload);
      setMsg("Pengaturan berhasil disimpan.");
    } catch (e) { setErr(errorText(e)); }
    finally { setSaving(false); }
  };
  return (
    <div className="dashboard">
      <AdminHead eyebrow="PENGATURAN" title="Konfigurasi platform" subtitle="Info platform, pembayaran, dan kontak admin." />
      <div className="wizard-card">
        <div className="eyebrow">PLATFORM</div>
        <div className="form-grid">
          <label>Nama aplikasi<input data-testid="settings-app-name" value={s.applicationName || ""} onChange={e => set("applicationName", e.target.value)} /></label>
          <label>Email support<input data-testid="settings-support-email" value={s.supportEmail || ""} onChange={e => set("supportEmail", e.target.value)} /></label>
          <label>WhatsApp admin<input data-testid="settings-admin-whatsapp" value={s.adminWhatsapp || ""} onChange={e => set("adminWhatsapp", e.target.value)} placeholder="628123456789" /></label>
        </div>
        <div className="eyebrow" style={{ marginTop: 32 }}>PEMBAYARAN</div>
        <div className="form-grid">
          <label>Bank<input data-testid="settings-bank-name" value={s.bankName || ""} onChange={e => set("bankName", e.target.value)} /></label>
          <label>Atas nama<input data-testid="settings-account-name" value={s.accountName || ""} onChange={e => set("accountName", e.target.value)} /></label>
          <label>Nomor rekening<input data-testid="settings-account-number" value={s.accountNumber || ""} onChange={e => set("accountNumber", e.target.value)} /></label>
          <label>Harga website tambahan/bulan<input data-testid="settings-additional-price" type="number" value={s.additionalWebsitePrice || 25000} onChange={e => set("additionalWebsitePrice", e.target.value)} /></label>
          <label className="full">Instruksi pembayaran<textarea data-testid="settings-payment-instructions" value={s.paymentInstructions || ""} onChange={e => set("paymentInstructions", e.target.value)} /></label>
        </div>
        {msg && <div className="form-info">{msg}</div>}
        <FormError msg={err} />
        <Button data-testid="settings-save-button" onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan pengaturan"}</Button>
      </div>
    </div>
  );
}

export function AdminWebsites() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/admin/websites").then(r => setList(r.data)); }, []);
  if (!list) return <Loading text="Memuat website..." />;
  return (
    <div className="dashboard">
      <AdminHead eyebrow="WEBSITE" title="Semua website UMKM" subtitle={`${list.length} website terdaftar`} />
      <div className="admin-table">
        <div className="admin-thead"><span>Bisnis</span><span>Pemilik</span><span>Kategori</span><span>Produk</span><span>Status</span><span>Slug</span></div>
        {list.map(w => (
          <div data-testid={`admin-website-${w.id}`} className="admin-tr" key={w.id}>
            <span><b>{w.businessName}</b></span>
            <span><b>{w.ownerName}</b><small>{w.ownerEmail}</small></span>
            <span>{w.category}</span>
            <span>{w.productCount || 0}</span>
            <span><StatusBadge status={w.status} /></span>
            <span>{w.slug ? <a target="_blank" rel="noreferrer" href={`/site/${w.slug}`}>/site/{w.slug}</a> : "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
