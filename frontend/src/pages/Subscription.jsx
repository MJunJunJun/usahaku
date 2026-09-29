import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet, Plus, CalendarDays, ArrowUpRight, Gift, History } from "lucide-react";
import { api, errorText, formatDate, formatDateTime } from "../lib/api";
import { Button, FormError, Loading } from "../lib/shared";
import { BillingModal, PaymentStatus, paymentPath, rupiah } from "../components/BillingUI";
import "./Subscription.css";

const savedSelection = () => {
  try { return JSON.parse(sessionStorage.getItem("billing-selection")) || null; } catch { return null; }
};

export function Subscription() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState(100000);
  const [selection, setSelection] = useState(savedSelection);
  const [durationOpen, setDurationOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    const [cards, wallet, dashboard, payments] = await Promise.all([
      api.get("/cards"), api.get("/wallet"), api.get("/dashboard"), api.get("/payments/mine"),
    ]);
    setData({ ...cards.data, wallet: wallet.data, websites: dashboard.data.websites || [], payments: payments.data });
  }, []);
  useEffect(() => { load().catch(e => setError(errorText(e))); }, [load]);
  useEffect(() => {
    const refresh = () => load().catch(() => {});
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); clearInterval(timer); };
  }, [load]);
  const saveSelection = (next) => {
    setSelection(next);
    if (next) sessionStorage.setItem("billing-selection", JSON.stringify(next));
    else sessionStorage.removeItem("billing-selection");
  };
  const run = async (key, action) => {
    setBusy(key); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  if (!data) return <div className="billing"><FormError msg={error} />{!error && <Loading text="Memuat langganan..." />}</div>;
  const { wallet, cards, packages: packages = [], websites, payments } = data;
  const monthly = packages.find(p => p.months === 1);
  const selectedPackage = packages.find(p => p.months === selection?.months) || packages[0];
  const selectedCard = cards.find(c => c.id === selection?.cardId);
  const siteName = c => websites.find(w => w.id === c.websiteId)?.businessName || c.name || "Website";
  const bonus = wallet.topupBonus;
  const eligible = !wallet.bonusClaimed && bonus?.enabled;
  const bonusAmount = eligible && Number(amount) >= bonus.minTopup ? bonus.bonus : 0;
  const invoiceIds = new Set(payments.map(p => p.id));
  const rows = [
    ...payments.map(p => ({ id: `invoice-${p.id}`, date: p.createdAt, type: p.kind === "topup" ? "topup" : "renewal",
      title: p.kind === "topup" ? "Top up saldo" : p.itemLabel, amount: p.approvedAmount ?? p.amount,
      status: p.status, payment: p, note: p.invoiceNumber })),
    ...wallet.transactions.filter(t => !(t.type === "TOPUP" && invoiceIds.has(t.refId))).map(t => ({
      id: t.id, date: t.createdAt, type: t.type === "TOPUP" || t.type === "BONUS" ? "topup" : t.type === "ADJUST" ? "adjust" : "renewal",
      title: t.type === "BONUS" ? "Bonus pengguna pertama" : t.note || "Penyesuaian saldo",
      amount: t.amount, status: "APPROVED", note: `Saldo setelah transaksi ${rupiah(t.balanceAfter)}`, tx: t,
      payment: payments.find(p => p.id === t.refId),
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).filter(r => filter === "all" || r.type === filter);
  const createInvoice = () => run("topup", async () => {
    const r = await api.post("/wallet/topup", { amount: Number(amount), method: "transfer" });
    nav(paymentPath(r.data.payment.id));
  });
  const buy = () => run("purchase", async () => {
    const payload = { months: selectedPackage.months, method: "wallet" };
    if (selection.cardId === "new") await api.post("/cards", payload);
    else await api.post(`/cards/${selection.cardId}/purchase`, payload);
    setDurationOpen(false); saveSelection(null); await load();
    setMessage("Masa aktif berhasil ditambahkan. Transaksi tersimpan di Riwayat.");
  });
  const openDuration = (cardId) => { setError(""); saveSelection({ cardId, months: 1 }); setDurationOpen(true); };
  const afterDate = selectedPackage && new Date(Math.max(Date.now(), new Date(selectedCard?.expiresAt || 0).getTime()) + selectedPackage.days * 86400000 - 86400000);

  return <div className="billing" data-testid="subscription-page">
    <header className="billing-heading"><span className="billing-eyebrow">PAKET & BILLING</span><h1>Langganan</h1><p>Saldo, masa aktif, dan semua transaksi di satu tempat.</p></header>
    {!topupOpen && !durationOpen && <FormError msg={error} />}
    {message && <div className="billing-success" role="status">{message}</div>}
    <section className="billing-card billing-balance" data-testid="balance-block">
      <div><h2><Wallet size={19} /> Saldo Aktif</h2><strong data-testid="wallet-balance">{rupiah(wallet.balance)}</strong><p>Digunakan untuk memperpanjang masa aktif website.</p></div>
      <Button data-testid="topup-open" onClick={() => { setError(""); setTopupOpen(true); }}><Plus size={16} /> Top up</Button>
    </section>
    <section className="billing-card" data-testid="active-block">
      <div className="billing-section-head"><div><h2><CalendarDays size={19} /> Masa Aktif Website</h2><p>Kelola perpanjangan setiap website kamu.</p></div><span className="billing-count">{cards.filter(c => c.websiteId).length} website</span></div>
      <div className="billing-sites">{cards.filter(c => c.websiteId).map(c => <article className="billing-site" key={c.id} data-testid={`card-${c.id}`}>
        <div className="billing-section-head"><h3>{siteName(c)}</h3><span className={`billing-status ${c.expired ? "billing-status-rejected" : "billing-status-approved"}`}>{c.isTrialCard ? "Masa gratis" : c.stateLabel}</span></div>
        <p><CalendarDays size={14} /> Sisa <b>{c.daysRemaining} hari</b> · Aktif s/d {formatDate(c.lastActiveDate)}</p>
        <div className="billing-site-footer"><Button data-testid={`add-active-${c.id}`} variant="outline" onClick={() => openDuration(c.id)}><Plus size={16} /> Tambah masa aktif</Button>
          <div className="billing-renew"><button type="button" role="switch" aria-checked={!!c.autoRenew} aria-label={`Perpanjangan otomatis ${siteName(c)}`} data-testid={`renew-${c.id}`} disabled={!!busy}
            className={`billing-switch ${c.autoRenew ? "on" : ""}`} onClick={() => run(c.id, async () => { await api.patch(`/cards/${c.id}/autorenew`, { enabled: !c.autoRenew }); await load(); })}><span /></button>
            <div><b>Perpanjangan otomatis bulanan</b><small>{monthly ? <>{rupiah(monthly.price)} / {monthly.days} hari {monthly.normalPrice > monthly.price && <del>{rupiah(monthly.normalPrice)}</del>}</> : "Paket bulanan belum tersedia"}</small><small>{c.autoRenew ? "Dipotong dari saldo saat masa aktif berakhir. Bisa dimatikan kapan saja." : "Nonaktif. Perpanjang secara manual sebelum masa aktif habis."}</small></div>
          </div>
        </div>
      </article>)}</div>
      {!cards.some(c => c.websiteId) && <p className="billing-empty">Belum ada website. Buat website pertama untuk memakai masa gratis {data.trial?.days || 14} hari.</p>}
      {cards.filter(c => !c.websiteId && c.daysRemaining > 0).map(c => <div className="billing-loose" key={c.id}><span><b>{c.name}</b> · {c.daysRemaining} hari tersedia</span><Link data-testid={`use-card-${c.id}`} to="/dashboard/websites/create">Buat website <ArrowUpRight size={14} /></Link></div>)}
      <div className="billing-bottom-link"><button data-testid="buy-new-card" onClick={() => openDuration("new")}>+ Beli masa aktif untuk website baru</button></div>
      {selection && !durationOpen && <div className="billing-resume"><span>Pilihan masa aktifmu tersimpan.</span><Button variant="outline" data-testid="resume-purchase" onClick={() => setDurationOpen(true)}>Lanjutkan perpanjangan</Button></div>}
    </section>
    <section className="billing-card" data-testid="billing-history">
      <div className="billing-section-head"><h2><History size={19} /> Riwayat</h2><select aria-label="Filter riwayat" data-testid="history-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Semua transaksi</option><option value="topup">Top up & bonus</option><option value="renewal">Perpanjangan</option><option value="adjust">Penyesuaian saldo</option></select></div>
      {!rows.length && <p className="billing-empty">Belum ada transaksi. Tagihan dan aktivitas saldo akan muncul di sini.</p>}
      <div className="billing-history">{rows.map(r => <div className="billing-history-row" key={r.id} data-testid={`history-${r.id}`}>
        <div className="billing-history-info"><b>{r.title}</b><small>{formatDateTime(r.date)} · {r.note}</small></div>
        <b className={r.amount > 0 && (r.tx || (r.type === "topup" && r.status === "APPROVED")) ? "billing-positive" : ""}>{r.amount > 0 && (r.tx || (r.type === "topup" && r.status === "APPROVED")) ? "+" : ""}{rupiah(r.amount)}</b><PaymentStatus status={r.status} />
        {r.payment ? <Link data-testid={`history-detail-${r.id}`} to={paymentPath(r.payment.id)}>{r.status === "AWAITING_PAYMENT" ? "Upload bukti transfer" : r.status === "PROOF_DRAFT" ? "Lanjutkan pengiriman" : r.status === "NEEDS_REVISION" ? "Upload ulang bukti" : "Lihat detail"} →</Link> : <span />}
      </div>)}</div>
    </section>
    <BillingModal open={topupOpen} onOpenChange={setTopupOpen} busy={!!busy} testId="topup-modal" title="Top up saldo" description="Pilih nominal. Saldo masuk setelah pembayaran diverifikasi admin.">
      <div className="billing-amounts">{[50000, 100000, 200000, 500000].filter(a => a >= wallet.minTopup).map(a => <button data-testid={`topup-amount-${a}`} key={a} aria-pressed={Number(amount) === a} className={Number(amount) === a ? "selected" : ""} onClick={() => setAmount(a)}>{rupiah(a)}</button>)}</div>
      <label className="billing-field">Nominal top up<input data-testid="topup-amount-input" type="number" inputMode="numeric" min={wallet.minTopup} step="1" value={amount} onChange={e => setAmount(e.target.value)} /><small>Minimal {rupiah(wallet.minTopup)}.</small></label>
      {eligible && <div className="billing-bonus"><Gift size={19} /><span>Top up pertama minimal {rupiah(bonus.minTopup)}, dapat bonus saldo {rupiah(bonus.bonus)}.</span></div>}
      <div className="billing-summary"><div><span>Total transfer</span><b>{rupiah(amount)}</b></div>{bonusAmount > 0 && <div><span>Bonus pengguna pertama</span><b className="billing-positive">+{rupiah(bonusAmount)}</b></div>}<div className="billing-total"><span>Saldo yang akan masuk</span><b>{rupiah(Number(amount) + bonusAmount)}</b></div></div>
      <FormError msg={error} /><Button data-testid="create-invoice" disabled={!!busy || !Number.isSafeInteger(Number(amount)) || Number(amount) < wallet.minTopup} onClick={createInvoice}>{busy === "topup" ? "Membuat tagihan..." : `Buat tagihan ${rupiah(amount)}`}</Button>
    </BillingModal>
    <BillingModal open={durationOpen} onOpenChange={setDurationOpen} busy={!!busy} testId="duration-modal" title="Tambah masa aktif" description={selectedCard ? siteName(selectedCard) : "Masa aktif untuk website baru. Hari mulai dihitung setelah pembelian."}>
      <div className="billing-durations">{packages.map(p => <button data-testid={`duration-${p.months}`} key={p.months} aria-pressed={selectedPackage?.months === p.months} className={selectedPackage?.months === p.months ? "selected" : ""} onClick={() => saveSelection({ ...selection, months: p.months })}><b>{p.monthLabel}</b><span>{rupiah(p.price)}</span></button>)}</div>
      {selectedPackage && <><div className="billing-package"><strong>{rupiah(selectedPackage.price)}</strong>{selectedPackage.normalPrice > selectedPackage.price && <del>{rupiah(selectedPackage.normalPrice)}</del>}<p>{selectedPackage.savingLabel} · {selectedPackage.days} hari</p></div>
        <div className="billing-summary"><div><span>Saldo tersedia</span><b>{rupiah(wallet.balance)}</b></div><div><span>Masa aktif bertambah</span><b>{selectedPackage.days} hari</b></div><div><span>Aktif hingga</span><b>{formatDate(afterDate)}</b></div></div>
        <FormError msg={error} />{wallet.balance >= selectedPackage.price ? <Button data-testid="purchase-duration" disabled={!!busy} onClick={buy}>{busy === "purchase" ? "Memproses..." : `Bayar ${rupiah(selectedPackage.price)} dari saldo`}</Button> : <><p className="billing-hint">Saldo kurang {rupiah(selectedPackage.price - wallet.balance)}. Pilihan ini tersimpan sampai kamu melanjutkan.</p><Button data-testid="purchase-topup" onClick={() => { setDurationOpen(false); setAmount(Math.max(wallet.minTopup, selectedPackage.price - wallet.balance)); setTopupOpen(true); }}>Top up saldo</Button></>}
      </>}
    </BillingModal>
  </div>;
}
