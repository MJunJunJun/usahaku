import { useEffect, useState } from "react";
import { Check, CreditCard, Store, ClipboardList, Sparkles, Wallet, Trash2, Plus } from "lucide-react";
import { api, errorText, money, formatDate, formatDateTime } from "../lib/api";
import { Button, FormError, Loading } from "../lib/shared";

const AdminHead = ({ eyebrow, title, subtitle, extra }) => (
  <div className="page-head">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {extra}
  </div>
);

const AdminStat = ({ label, value, icon }) => (
  <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>
);

export function AdminMonetization() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pkgs, setPkgs] = useState([]);
  const [bonus, setBonus] = useState({ enabled: true, minAmount: 100000, bonus: 50000 });
  const [creditFor, setCreditFor] = useState(null);
  const [amount, setAmount] = useState(100000);
  const [note, setNote] = useState("");
  const [withBonus, setWithBonus] = useState(true);

  const load = () => api.get("/admin/monetization/summary").then((r) => {
    setD(r.data);
    setPkgs((r.data.packages || []).map((p) => ({ months: p.months, days: p.days, normalPrice: p.normalPrice, promoPrice: p.promoPrice })));
    const b = r.data.bonus || {};
    setBonus({ enabled: !!b.enabled, minAmount: b.minTopup || 100000, bonus: b.bonus || 50000 });
  }).catch((e) => setErr(errorText(e)));

  useEffect(() => { load(); }, []);

  const run = async (key, fn, ok) => {
    setBusy(key); setErr(""); setMsg("");
    try { await fn(); setMsg(ok); await load(); } catch (e) { setErr(errorText(e)); } finally { setBusy(""); }
  };
  const savePkgs = () => run("pkgs", () => api.post("/admin/monetization/packages", { packages: pkgs }), "Tabel harga tersimpan.");
  const saveBonus = () => run("bonus", () => api.post("/admin/monetization/bonus", bonus), "Bonus top up tersimpan.");
  const toggle = () => run("toggle", () => api.post("/admin/monetization/toggle", { enabled: !(d || {}).enabled }), "Status otomasi diubah.");
  const credit = () => run("credit", () => api.post("/admin/monetization/wallet", { userId: creditFor, amount: Number(amount), note, bonus: withBonus }), "Saldo diperbarui.");

  if (!d) return (<><AdminHead eyebrow="ADMIN" title="Paket & Kartu" /><Loading /></>);
  const s = d.stats || {};
  return (
    <>
      <AdminHead eyebrow="ADMIN" title="Paket & Kartu" subtitle="Monitor kartu langganan, saldo dompet, harga paket, dan bonus top up."
        extra={<Button data-testid="monetization-toggle-button" disabled={busy === "toggle"} onClick={toggle}>{d.enabled ? "Otomasi harian: AKTIF" : "Otomasi harian: MATI"}</Button>} />
      <FormError message={err} />
      {msg && <p className="form-success" data-testid="monetization-msg">{msg}</p>}
      <div className="stats-grid">
        <AdminStat label="Kartu aktif" value={s.aktif || 0} icon={<CreditCard size={18} />} />
        <AdminStat label="Website beku" value={s.beku || 0} icon={<Store size={18} />} />
        <AdminStat label="Kartu kosong" value={s.kosong || 0} icon={<ClipboardList size={18} />} />
        <AdminStat label="Masa gratis" value={s.masaGratis || 0} icon={<Sparkles size={18} />} />
        <AdminStat label="Kartu berbayar" value={s.berbayar || 0} icon={<Check size={18} />} />
        <AdminStat label="Pendapatan kartu" value={money(d.revenue)} icon={<Wallet size={18} />} />
      </div>

      <section className="admin-panel" data-testid="admin-cards-panel">
        <div className="section-row"><div><h2>Kartu langganan ({d.cards.length})</h2><p>Status tiap kartu, sisa hari, dan website yang memakainya.</p></div></div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Pemilik</th><th>Kartu</th><th>Status</th><th>Sisa</th><th>Aktif s/d</th><th>Website</th></tr></thead>
            <tbody>
              {d.cards.slice(0, 40).map((c) => (
                <tr key={c.id} data-testid={`admin-card-${c.id}`}>
                  <td>{c.userEmail || c.userName || "-"}</td>
                  <td>{c.cardName || "Kartu"}{c.isTrialCard ? " (masa gratis)" : ""}</td>
                  <td><span className={c.state === "ACTIVE" ? "badge badge-ok" : "badge"}>{c.stateLabel || c.state}</span></td>
                  <td>{c.daysRemaining} hari</td>
                  <td>{c.lastActiveDate ? formatDate(c.lastActiveDate) : "-"}</td>
                  <td>{c.siteSlug ? <a href={`/${c.siteSlug}`} target="_blank" rel="noreferrer">{c.siteName || c.siteSlug}</a> : <i>kosong</i>}</td>
                </tr>
              ))}
              {!d.cards.length && <tr><td colSpan="6">Belum ada kartu.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel" data-testid="admin-wallets-panel">
        <div className="section-row"><div><h2>Saldo dompet ({d.wallets.length})</h2><p>Top up transfer manual disetujui dengan menambah saldo di sini. Bonus top up pertama otomatis bila dicentang.</p></div></div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Pemilik</th><th>WhatsApp</th><th>Saldo</th><th>Masa gratis</th><th>Aksi</th></tr></thead>
            <tbody>
              {d.wallets.slice(0, 40).map((w) => (
                <tr key={w.userId} data-testid={`admin-wallet-${w.userId}`}>
                  <td>{w.email || w.name || w.userId}</td>
                  <td>{w.whatsapp || "-"}</td>
                  <td><b>{money(w.balance)}</b></td>
                  <td>{w.trialUsed ? "sudah dipakai" : "belum dipakai"}</td>
                  <td><Button className="btn-ghost" data-testid={`credit-open-${w.userId}`} onClick={() => { setCreditFor(creditFor === w.userId ? null : w.userId); setNote(""); setAmount(100000); }}>Tambah saldo</Button></td>
                </tr>
              ))}
              {!d.wallets.length && <tr><td colSpan="5">Belum ada saldo.</td></tr>}
            </tbody>
          </table>
        </div>
        {creditFor && (
          <div className="credit-row" data-testid="credit-row">
            <label>Nominal<input type="number" data-testid="credit-amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>Catatan<input data-testid="credit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Top up transfer BCA 100rb" /></label>
            <label className="check-line"><input type="checkbox" data-testid="credit-bonus" checked={withBonus} onChange={(e) => setWithBonus(e.target.checked)} /> Beri bonus top up pertama</label>
            <Button data-testid="credit-submit" disabled={busy === "credit"} onClick={credit}>Simpan saldo</Button>
            <Button className="btn-ghost" onClick={() => setCreditFor(null)}>Batal</Button>
          </div>
        )}
      </section>

      <section className="admin-panel" data-testid="admin-packages-panel">
        <div className="section-row"><div><h2>Tabel harga kartu</h2><p>Dipakai halaman harga publik & halaman Langganan. Harga normal tampil dicoret di landing.</p></div></div>
        {pkgs.map((p, i) => (
          <div className="pkg-edit-row" key={i}>
            <label>Durasi (bulan)<input type="number" data-testid={`pkg-months-${i}`} value={p.months} onChange={(e) => { const n = [...pkgs]; n[i] = { ...p, months: Number(e.target.value) }; setPkgs(n); }} /></label>
            <label>Hari<input type="number" data-testid={`pkg-days-${i}`} value={p.days} onChange={(e) => { const n = [...pkgs]; n[i] = { ...p, days: Number(e.target.value) }; setPkgs(n); }} /></label>
            <label>Harga normal<input type="number" data-testid={`pkg-normal-${i}`} value={p.normalPrice} onChange={(e) => { const n = [...pkgs]; n[i] = { ...p, normalPrice: Number(e.target.value) }; setPkgs(n); }} /></label>
            <label>Harga promo<input type="number" data-testid={`pkg-promo-${i}`} value={p.promoPrice} onChange={(e) => { const n = [...pkgs]; n[i] = { ...p, promoPrice: Number(e.target.value) }; setPkgs(n); }} /></label>
            <button className="icon-button danger" data-testid={`pkg-remove-${i}`} onClick={() => setPkgs(pkgs.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
          </div>
        ))}
        <div className="wizard-actions">
          <Button className="btn-ghost" data-testid="pkg-add" onClick={() => setPkgs([...pkgs, { months: 2, days: 60, normalPrice: 200000, promoPrice: 100000 }])}><Plus size={15} /> Tambah durasi</Button>
          <Button data-testid="pkg-save" disabled={busy === "pkgs"} onClick={savePkgs}>Simpan harga</Button>
        </div>
      </section>

      <section className="admin-panel" data-testid="admin-bonus-panel">
        <div className="section-row"><div><h2>Bonus top up pertama</h2><p>Hanya berlaku sekali per akun.</p></div></div>
        <div className="pkg-edit-row">
          <label>Minimal top up<input type="number" data-testid="bonus-min" value={bonus.minAmount} onChange={(e) => setBonus({ ...bonus, minAmount: Number(e.target.value) })} /></label>
          <label>Bonus<input type="number" data-testid="bonus-amount" value={bonus.bonus} onChange={(e) => setBonus({ ...bonus, bonus: Number(e.target.value) })} /></label>
          <label className="check-line"><input type="checkbox" data-testid="bonus-enabled" checked={bonus.enabled} onChange={(e) => setBonus({ ...bonus, enabled: e.target.checked })} /> Aktifkan</label>
          <Button data-testid="bonus-save" disabled={busy === "bonus"} onClick={saveBonus}>Simpan bonus</Button>
        </div>
      </section>

      <section className="admin-panel" data-testid="admin-tx-panel">
        <div className="section-row"><div><h2>Riwayat saldo terbaru</h2><p>{d.transactions.length} transaksi terakhir.</p></div></div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Waktu</th><th>User</th><th>Jenis</th><th>Nominal</th><th>Saldo</th><th>Catatan</th></tr></thead>
            <tbody>
              {d.transactions.slice(0, 25).map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.createdAt)}</td>
                  <td>{t.userId}</td><td>{t.type}</td><td>{money(t.amount)}</td><td>{money(t.balanceAfter)}</td><td>{t.note || "-"}</td>
                </tr>
              ))}
              {!d.transactions.length && <tr><td colSpan="6">Belum ada transaksi.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}