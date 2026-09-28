import { useEffect, useState } from "react";
import { Wallet, RefreshCw, Plus, Calendar, Gift, Check, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorText, money, formatDate } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";

const TOPUP_QUICK = [100000, 200000, 500000, 1000000];

export function Subscription() {
  const [view, setView] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [sites, setSites] = useState([]);
  const [topupAmount, setTopupAmount] = useState(100000);
  const [pickFor, setPickFor] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
const load = async () => {
    const [c, w, d] = await Promise.all([api.get("/cards"), api.get("/wallet"), api.get("/dashboard")]);
    setView(c.data);
    setWallet(w.data);
    setSites(d.data.websites || []);
  };

  useEffect(() => { load().catch((e) => setErr(errorText(e))); }, []);

  const run = async (key, fn) => {
    setBusy(key); setErr(""); setMsg("");
    try {
      const r = await fn();
      await load();
      setMsg((r && r.data && r.data.message) || "Berhasil");
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    } finally { setBusy(""); }
  };
const extendCard = (id, m) => run(`ext-${id}-${m}`, () => api.post(`/cards/${id}/purchase`, { months: m, method: "wallet" }));
  const toggleRenew = (id, on) => run(`ren-${id}`, () => api.patch(`/cards/${id}/autorenew`, { enabled: on }));
  const topup = () => run("topup", () => api.post("/wallet/topup", { amount: Number(topupAmount), method: "transfer" }));

  if (!view || !wallet) return <Loading text="Memuat saldo & masa aktif..." />;

  const pkgs = view.packages || [];
  const trial = view.trial || {};
  const bonus = wallet.topupBonus || null;
  const byId = {};
  (sites || []).forEach((s) => { byId[s.id] = s; });
  const cards = view.cards || [];
  const attached = cards.filter((c) => c.websiteId);
  const loose = cards.filter((c) => !c.websiteId);
return (
    <div className="page-wrap">
      <div className="dash-head" data-testid="subscription-head">
        <div>
          <div className="eyebrow">LANGGANAN</div>
          <h1>Saldo &amp; Masa Aktif</h1>
          <p className="page-sub">Saldo dipakai untuk menambah masa aktif website. Tiap website punya masa aktifnya sendiri.</p>
        </div>
      </div>
      {msg && <div className="alert-ok" data-testid="subscription-ok">{msg}</div>}
      {err && <FormError>{err}</FormError>}

      <section className="wizard-card" data-testid="balance-block">
        <div className="block-head">
          <h2><Wallet size={17} /> Informasi saldo</h2>
        </div>
        <div className="balance-total" data-testid="wallet-balance">
          <span>Total saldo</span>
          <b>{money(wallet.balance)}</b>
        </div>
        <p className="form-hint">
          Saldo dipakai untuk menambah masa aktif website: 1 bulan, 3 bulan, 6 bulan, atau 1 tahun.
        </p>
<h3 className="sub-head">Top up saldo</h3>
        <p className="form-hint" data-testid="topup-bonus-note">
          {bonus
            ? (wallet.bonusClaimed
              ? "Bonus top up pertama sudah pernah diklaim."
              : `Top up pertama minimal ${money(bonus.minTopup)} dapat bonus ${money(bonus.bonus)} — 1 kali per akun.`)
            : `Top up pertama minimal ${money(100000)} dapat bonus ${money(50000)} — 1 kali per akun.`}
        </p>
        <div className="attach-row">
          {TOPUP_QUICK.map((a) => (
            <button key={a} type="button" data-testid={`topup-quick-${a}`}
              className={Number(topupAmount) === a ? "pkg-card active" : "pkg-card"}
              onClick={() => setTopupAmount(a)}>
              <b className="pkg-price">{money(a)}</b>
            </button>
          ))}
        </div>
<div className="attach-row">
          <input className="input" type="number" min="10000" data-testid="topup-amount-input"
            value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
          <Button data-testid="topup-button" disabled={busy === "topup"} onClick={topup}>
            {busy === "topup" ? "Mengirim..." : `Top up ${money(Number(topupAmount) || 0)}`}
          </Button>
        </div>
        {wallet.bank && (
          <p className="form-hint" data-testid="bank-info">
            Transfer ke <b>{wallet.bank.bankName} {wallet.bank.accountNumber}</b> a.n. {wallet.bank.accountName}, lalu kirim bukti ke admin.
            {" "}<a href={`https://wa.me/${wallet.adminWhatsapp}`} target="_blank" rel="noreferrer" data-testid="topup-wa-admin"><MessageCircle size={13} /> WhatsApp admin</a>
          </p>
        )}
      </section>
<div className="section-gap" />

      <section className="wizard-card" data-testid="active-block">
        <div className="block-head">
          <h2><Calendar size={17} /> Masa aktif</h2>
          <span className="block-sub">{attached.length} website</span>
        </div>
        {!attached.length && (
          <p className="empty-text">Belum ada website. Bikin website pertamamu untuk memakai masa gratis {trial && trial.days ? trial.days : 14} hari.</p>
        )}
        <div className="cards-list">
          {attached.map((c) => {
            const site = byId[c.websiteId] || {};
            const open = pickFor === c.id;
            return (
              <div key={c.id} className="card-item" data-testid={`card-${c.id}`}>
                <div className="card-item-main">
                  <b>Masa aktif {site.businessName || site.slug || "website"}</b>
                  <StatusBadge>{c.stateLabel}</StatusBadge>
                  {c.isTrialCard && <span className="custom-chip">MASA GRATIS</span>}
                </div>
<div className="card-item-meta">
                  <span><Calendar size={14} /> Sisa <b>{c.daysRemaining} hari</b>{c.lastActiveDate ? ` — aktif s/d ${formatDate(c.lastActiveDate)}` : ""}</span>
                </div>
                <div className="card-item-actions">
                  <Button data-testid={`add-active-${c.id}`} onClick={() => setPickFor(open ? null : c.id)}>
                    <Plus size={14} /> Tambahkan masa aktif
                  </Button>
                  <Button className="btn-ghost" data-testid={`renew-${c.id}`} disabled={!!busy} onClick={() => toggleRenew(c.id, !c.autoRenew)}>
                    <RefreshCw size={14} /> Auto renewal: {c.autoRenew ? "AKTIF" : "MATI"}
                  </Button>
                </div>
{open && (
                  <div className="pkg-picker" data-testid={`picker-${c.id}`}>
                    <p className="form-hint">Pilih durasi masa aktif yang mau ditambahkan ke website ini:</p>
                    <div className="pkg-grid">
                      {pkgs.map((p) => (
                        <button key={p.months} type="button" data-testid={`extend-${c.id}-${p.months}`}
                          className="pkg-card" disabled={busy === `ext-${c.id}-${p.months}`}
                          onClick={() => extendCard(c.id, p.months)}>
                          <span className="pkg-month">{p.monthLabel}</span>
<b className="pkg-price">{money(p.price)}</b>
                          <span className="pkg-per">{money(p.perMonth)}/bln</span>
                          <span className="pkg-save">{p.savingLabel}</span>
                        </button>
                      ))}
                    </div>
                    {wallet.balance <= 0 && (
                      <p className="form-hint">Saldo kamu masih 0 — top up dulu di bagian Informasi saldo di atas.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!!loose.length && (
          <p className="form-hint" data-testid="loose-cards">Ada {loose.length} masa aktif belum terpasang ke website — otomatis dipakai saat kamu bikin website baru.</p>
        )}
      </section>
<section className="wizard-card" data-testid="transactions-block">
        <div className="block-head"><h2>Riwayat saldo</h2><span className="block-sub">{(wallet.transactions || []).length} transaksi</span></div>
        {(wallet.transactions || []).map((t, i) => (
          <div key={i} className="card-item-meta">
            <span>{t.note || t.type}</span>
            <b>{Number(t.amount) < 0 ? "-" : "+"}{money(Math.abs(Number(t.amount)))} • {formatDate(t.createdAt)}</b>
          </div>
        ))}
        {!(wallet.transactions || []).length && <p className="empty-text">Belum ada transaksi saldo.</p>}
      </section>
<p className="form-hint" data-testid="cards-help">
        Website otomatis beku kalau masa aktifnya habis — tambah masa aktif sebelum tanggal berakhir supaya website tetap online.{" "}
        <Link to="/dashboard">Kembali ke dashboard</Link>
      </p>
    </div>
  );
}
