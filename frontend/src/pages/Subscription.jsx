import { useEffect, useRef, useState } from "react";
import { Wallet, RefreshCw, Plus, Calendar, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorText, money, formatDate } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";
import "./Subscription.css";

const TOPUP_QUICK = [100000, 200000, 500000, 1000000];
const FILTERS = [
  ["all", "Semua transaksi"],
  ["in", "Top up"],
  ["out", "Penggunaan"],
];

export function Subscription() {
  const [view, setView] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [sites, setSites] = useState([]);
  const [topupAmount, setTopupAmount] = useState(100000);
  const [customOpen, setCustomOpen] = useState(false);
  const [pickFor, setPickFor] = useState(null);
  const [pickedMonths, setPickedMonths] = useState(null);
  const [histFilter, setHistFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const topupRef = useRef(null);
  const amountRef = useRef(null);
  const autoPicked = useRef(false);

  const load = async () => {
    const [c, w, d] = await Promise.all([api.get("/cards"), api.get("/wallet"), api.get("/dashboard")]);
    setView(c.data);
    setWallet(w.data);
    setSites(d.data.websites || []);
    const tied = (c.data.cards || []).filter((x) => x.websiteId);
    if (!autoPicked.current && tied.length === 1) {
      autoPicked.current = true;
      setPickFor(tied[0].id);
      const firstPkg = (c.data.packages || [])[0];
      if (firstPkg) setPickedMonths(firstPkg.months);
    }
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
  const bonusNote = bonus
    ? (wallet.bonusClaimed
      ? `Bonus top up pertama sudah pernah diklaim. Minimal top up ${money(bonus.minTopup)}.`
      : `Top up pertama minimal ${money(bonus.minTopup)} dapat bonus ${money(bonus.bonus)} — 1 kali per akun.`)
    : `Top up pertama minimal ${money(100000)} dapat bonus ${money(50000)} — 1 kali per akun.`;
  const pickedSite = pickFor ? (byId[(attached.find((c) => c.id === pickFor) || {}).websiteId] || {}) : {};
  const curPkg = pkgs.find((p) => p.months === pickedMonths) || pkgs[0] || null;
  const txs = (wallet.transactions || []).filter((t) => (
    histFilter === "all" ? true : histFilter === "in" ? Number(t.amount) > 0 : Number(t.amount) < 0
  ));
  const focusTopup = () => {
    setCustomOpen(true);
    setTimeout(() => {
      if (topupRef.current) topupRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if (amountRef.current) amountRef.current.focus();
    }, 60);
  };

  return (
    <div className="page-wrap subx" data-testid="subscription-head">
      <div className="subx-head">
        <h1>Langganan</h1>
        <p className="subx-sub">Kelola saldo, top up, dan tambah masa aktif website kamu.</p>
      </div>
      {msg && <div className="alert-ok" data-testid="subscription-ok">{msg}</div>}
      {err && <FormError>{err}</FormError>}

      <section className="subx-card" data-testid="balance-block">
        <div className="subx-card-head">
          <h2><Wallet size={18} /> Saldo Aktif</h2>
          <button type="button" className="subx-topup-btn" onClick={focusTopup} data-testid="topup-open">
            <Plus size={15} /> Top up
          </button>
        </div>
        <div className="subx-balance" data-testid="wallet-balance">
          <b>{money(wallet.balance)}</b>
          <span>Saldo aktif</span>
        </div>
        <ul className="subx-notes">
          <li>Saldo minimal top up {money(view.minTopup || 10000)}.</li>
          <li data-testid="topup-bonus-note">{bonusNote}</li>
          <li>Saldo dipakai untuk menambah masa aktif website.</li>
        </ul>
        <div className="subx-chip-row" ref={topupRef}>
          {TOPUP_QUICK.map((a) => (
            <button key={a} type="button" data-testid={`topup-quick-${a}`}
              className={Number(topupAmount) === a && !customOpen ? "subx-chip active" : "subx-chip"}
              onClick={() => { setCustomOpen(false); setTopupAmount(a); }}>
              {money(a)}
            </button>
          ))}
          <button type="button" data-testid="topup-quick-other"
            className={customOpen ? "subx-chip active" : "subx-chip"} onClick={() => setCustomOpen(true)}>
            Nominal lain
          </button>
        </div>
        {customOpen && (
          <div className="subx-fields">
            <input className="input" type="number" min="10000" ref={amountRef} data-testid="topup-amount-input"
              value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
          </div>
        )}
        <div className="subx-cta">
          <Button data-testid="topup-button" disabled={busy === "topup"} onClick={topup}>
            {busy === "topup" ? "Mengirim..." : `Top up ${money(Number(topupAmount) || 0)}`}
          </Button>
          {wallet.adminWhatsapp && (
            <a className="subx-wa" href={`https://wa.me/${wallet.adminWhatsapp}`} target="_blank" rel="noreferrer" data-testid="topup-wa-admin">
              <MessageCircle size={14} /> WhatsApp admin
            </a>
          )}
        </div>
        {wallet.bank && (
          <div className="subx-bank" data-testid="bank-info">
            <b>Transfer via {wallet.bank.bankName} {wallet.bank.accountNumber}</b>
            <span>a.n. {wallet.bank.accountName}</span>
            <small>Setelah transfer, kirim bukti ke admin melalui WhatsApp admin.</small>
          </div>
        )}
      </section>

      <section className="subx-card" data-testid="active-block">
        <div className="subx-card-head">
          <h2><Calendar size={18} /> Masa Aktif Website</h2>
          <span className="subx-count">{attached.length} website</span>
        </div>
        <p className="subx-card-sub">Daftar website aktif dan masa aktifnya.</p>
        {!attached.length && (
          <p className="subx-empty-text">Belum ada website. Bikin website pertamamu untuk memakai masa gratis {trial && trial.days ? trial.days : 14} hari.</p>
        )}
        <div className="subx-sites">
          {attached.map((c) => {
            const site = byId[c.websiteId] || {};
            const open = pickFor === c.id;
            return (
              <div key={c.id} className={open ? "subx-site active" : "subx-site"} data-testid={`card-${c.id}`}>
                <div className="subx-site-head">
                  <b>{site.businessName || site.slug || "website"}</b>
                  <span className="subx-flags">
                    <StatusBadge>{c.stateLabel}</StatusBadge>
                    {c.isTrialCard && <span className="subx-tag">MASA GRATIS</span>}
                  </span>
                </div>
                <div className="subx-site-meta">
                  <span><Calendar size={14} /> Sisa <b>{c.daysRemaining} hari</b>{c.lastActiveDate ? ` — aktif s/d ${formatDate(c.lastActiveDate)}` : ""}</span>
                </div>
                <div className="subx-site-actions">
                  <Button data-testid={`add-active-${c.id}`} onClick={() => {
                    setPickFor(open ? null : c.id);
                    if (pkgs.length) setPickedMonths(pkgs[0].months);
                  }}>
                    <Plus size={14} /> Tambahkan masa aktif
                  </Button>
                  <button type="button" className="subx-switch" data-testid={`renew-${c.id}`} disabled={!!busy}
                    onClick={() => toggleRenew(c.id, !c.autoRenew)}>
                    <span className={c.autoRenew ? "subx-switch-track on" : "subx-switch-track"} />
                    <span className="subx-switch-label"><RefreshCw size={13} /> Auto renewal: {c.autoRenew ? "AKTIF" : "MATI"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {!!loose.length && (
          <p className="subx-hint" data-testid="loose-cards">Ada {loose.length} masa aktif belum terpasang ke website — otomatis dipakai saat kamu bikin website baru.</p>
        )}
      </section>

      {!!pkgs.length && (
        <section className="subx-card" data-testid={`picker-${pickFor || "none"}`}>
          <div className="subx-card-head">
            <h2><Calendar size={18} /> Pilih Durasi Masa Aktif</h2>
          </div>
          <p className="subx-card-sub">
            {pickFor
              ? <>Tambah masa aktif untuk website <b>{pickedSite.businessName || pickedSite.slug || "ini"}</b>.</>
              : "Pilih website di atas dulu untuk menambah masa aktifnya."}
          </p>
          <div className="subx-tabs">
            {pkgs.map((p) => (
              <button key={p.months} type="button" data-testid={`pkg-tab-${p.months}`}
                disabled={!pickFor}
                className={curPkg && curPkg.months === p.months ? "subx-tab active" : "subx-tab"}
                onClick={() => setPickedMonths(p.months)}>
                {p.monthLabel}
              </button>
            ))}
          </div>
          {curPkg && (
            <div className="subx-pkg" data-testid="pkg-detail">
              <div className="subx-pkg-price">
                <b>{money(curPkg.price)}</b>
                <span>/{curPkg.months === 1 ? "bln" : curPkg.monthLabel}</span>
              </div>
              <div className="subx-pkg-badges">
                {!!curPkg.savingLabel && <span className="subx-tag">{curPkg.savingLabel}</span>}
                {!!curPkg.perMonth && <span className="subx-setara">Setara {money(curPkg.perMonth)}/bulan</span>}
                {!!curPkg.normalPrice && Number(curPkg.normalPrice) > Number(curPkg.price) && (
                  <span className="subx-normal">Harga normal {money(curPkg.normalPrice)}</span>
                )}
              </div>
              <Button data-testid={pickFor ? `extend-${pickFor}-${curPkg.months}` : "extend-none"}
                disabled={!pickFor || busy === `ext-${pickFor}-${curPkg.months}`}
                onClick={() => pickFor && extendCard(pickFor, curPkg.months)}>
                {busy === `ext-${pickFor}-${curPkg.months}` ? "Memproses..." : `Pesan ${money(curPkg.price)}`}
              </Button>
              {wallet.balance <= 0 && (
                <p className="subx-hint">Saldo kamu masih 0 — top up dulu di bagian Saldo Aktif di atas.</p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="subx-card" data-testid="transactions-block">
        <div className="subx-card-head">
          <h2>Riwayat Saldo</h2>
          <select className="subx-filter" value={histFilter} data-testid="hist-filter"
            onChange={(e) => setHistFilter(e.target.value)}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="subx-hist">
          {txs.map((t, i) => (
            <div key={i} className="subx-hist-row">
              <span>{t.note || t.type}</span>
              <b className={Number(t.amount) < 0 ? "out" : "in"}>
                {Number(t.amount) < 0 ? "-" : "+"}{money(Math.abs(Number(t.amount)))} • {formatDate(t.createdAt)}
              </b>
            </div>
          ))}
        </div>
        {!txs.length && (
          <p className="subx-empty-text">
            Belum ada transaksi saldo. Transaksi saldo akan muncul di sini setelah kamu top up atau menggunakan saldo.
          </p>
        )}
      </section>

      <p className="subx-note" data-testid="cards-help">
        Website otomatis beku jika masa aktifnya habis. Tambahkan masa aktif sebelum tanggal berakhir supaya website tetap online.{" "}
        <Link to="/dashboard">Kembali ke dashboard</Link>
      </p>
    </div>
  );
}