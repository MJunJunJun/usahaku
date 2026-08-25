import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Upload, MessageCircle } from "lucide-react";
import { api, errorText, uploadFile, money, formatDate } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";

export function Subscription() {
  const nav = useNavigate();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [additional, setAdditional] = useState(0);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/plans"), api.get("/settings/public"), api.get("/auth/me"), api.get("/payments/mine")])
      .then(([p, s, u, ps]) => { setPlans(p.data); setSettings(s.data); setUser(u.data); setPayments(ps.data); });
  }, []);

  if (!plans.length || !settings || !user) return <Loading text="Memuat paket..." />;

  const sel = plans.find(p => p.slug === selected);
  const canAddExtra = sel?.allowsAdditional === true;
  const total = sel ? sel.monthlyPrice + (canAddExtra ? additional : 0) * (settings.additionalWebsitePrice || 25000) : 0;
  const pending = payments.find(p => p.status === "PENDING");

  const planLabel = (slug) => ({ trial: "Trial Gratis", basic: "Basic", premium: "Premium", platinum: "Platinum" })[slug] || "Trial";

  return (
    <div className="subscription-page">
      <div className="page-head compact">
        <div>
          <div className="eyebrow">PAKET USAHAKU</div>
          <h1>Pilih ruang untuk tumbuh.</h1>
          <p>Semua paket dimulai dengan website yang profesional.</p>
        </div>
      </div>

      <div className="current-plan-card">
        <div>
          <small>STATUS SAAT INI</small>
          <b>{planLabel(user.planSlug)}</b>
          <span>
            Kuota {user.websiteQuota || 1} website
            {(user.subscriptionStatus === "TRIAL_ACTIVE" && user.trialEndDate) && ` · Trial berakhir ${formatDate(user.trialEndDate)}`}
            {(user.subscriptionStatus === "ACTIVE" && user.subscriptionExpiryDate) && ` · Berakhir ${formatDate(user.subscriptionExpiryDate)}`}
            {user.subscriptionStatus === "TRIAL_EXPIRED" && ` · Trial berakhir ${formatDate(user.trialEndDate)}`}
            {user.subscriptionStatus === "EXPIRED" && ` · Berakhir ${formatDate(user.subscriptionExpiryDate)}`}
          </span>
        </div>
        <StatusBadge status={user.subscriptionStatus} />
      </div>

      {pending && (
        <div className="pending-payment-card">
          <Sparkles size={20} />
          <div>
            <b>Pembayaran sedang diverifikasi.</b>
            <span>Paket {pending.planName} · Rp{money(pending.amount)} · dikirim {formatDate(pending.createdAt)}</span>
          </div>
          <Link data-testid="view-pending-payment" to={`/dashboard/subscription/payment/${pending.id}`}>Detail →</Link>
        </div>
      )}

      <div className="subscription-grid">
        {plans.map(p => (
          <div data-testid={`subscription-plan-${p.slug}`} className={`subscription-card ${selected === p.slug ? "selected" : ""}`} key={p.slug}>
            <span className="plan-kicker">{p.slug === "premium" ? "PALING DIPILIH" : p.slug === "platinum" ? "PALING FLEKSIBEL" : "PAKET"}</span>
            <h2>{p.name}</h2>
            <div className="subscription-price">Rp{money(p.monthlyPrice)}<small>/bulan</small></div>
            <p>{p.allowsAdditional ? `${p.websiteLimit} website (bisa ditambah)` : `Hingga ${p.websiteLimit} website bisnis`}</p>
            <ul>{(p.features || []).map((f, i) => <li key={i}><Check size={15} />{f}</li>)}</ul>
            <Button data-testid={`choose-plan-${p.slug}-button`} variant={selected === p.slug ? "primary" : "outline"} onClick={() => { setSelected(p.slug); setAdditional(0); }}>
              {selected === p.slug ? "Dipilih" : "Pilih paket"}
            </Button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="payment-summary">
          <div className="summary-head">
            <div><div className="eyebrow">RINGKASAN PEMBAYARAN</div><h2>Konfirmasi paket kamu</h2></div>
          </div>
          {canAddExtra && (
            <div className="additional-selector">
              <div>
                <b>Tambah website ekstra</b>
                <span>+Rp{money(settings.additionalWebsitePrice || 25000)} / bulan per website tambahan</span>
              </div>
              <div className="counter">
                <button data-testid="additional-minus" onClick={() => setAdditional(Math.max(0, additional - 1))}>−</button>
                <input data-testid="additional-count" readOnly value={additional} />
                <button data-testid="additional-plus" onClick={() => setAdditional(Math.min(10, additional + 1))}>+</button>
              </div>
            </div>
          )}
          <div className="summary-rows">
            <div><span>{sel.name}</span><b>Rp{money(sel.monthlyPrice)}</b></div>
            {canAddExtra && additional > 0 && (
              <div><span>{additional} website tambahan</span><b>Rp{money(additional * (settings.additionalWebsitePrice || 25000))}</b></div>
            )}
            <div className="summary-total"><span>Total per bulan</span><b data-testid="summary-total">Rp{money(total)}</b></div>
          </div>
          <Button data-testid="continue-payment-button" onClick={() => nav(`/dashboard/subscription/pay?plan=${selected}&extra=${additional}`)}>
            Lanjut ke pembayaran <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {payments.length > 0 && (
        <section className="dashboard-section" style={{ marginTop: 32 }}>
          <div className="section-row"><div><h2>Riwayat pembayaran</h2><p>Semua pengajuan pembayaran kamu.</p></div></div>
          <div className="payment-history">
            {payments.map(p => (
              <div data-testid={`payment-history-${p.id}`} key={p.id} className="payment-row">
                <div><b>{p.planName}</b><small>{formatDate(p.createdAt)}</small></div>
                <span>Rp{money(p.amount)}</span>
                <StatusBadge status={p.status} />
                <Link className="text-link" to={`/dashboard/subscription/payment/${p.id}`}>Detail →</Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function PaymentFlow() {
  const nav = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const planSlug = params.get("plan");
  const extra = Number(params.get("extra") || 0);
  const [plan, setPlan] = useState(null);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const [proofPreview, setProofPreview] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponErr, setCouponErr] = useState("");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/plans"), api.get("/settings/public"), api.get("/auth/me")])
      .then(([p, s, u]) => {
        setPlan(p.data.find(x => x.slug === planSlug));
        setSettings(s.data); setUser(u.data);
      });
  }, [planSlug]);

  if (!plan || !settings || !user) return <Loading text="Memuat pembayaran..." />;
  const baseAmount = plan.monthlyPrice + extra * (settings.additionalWebsitePrice || 25000);
  const applyCouponDiscount = (amt) => {
    if (!coupon) return { finalAmount: amt, bonusDays: 0 };
    if (coupon.discountType === "percentage") return { finalAmount: Math.max(0, amt * (1 - coupon.discountValue / 100)), bonusDays: 0 };
    if (coupon.discountType === "fixed") return { finalAmount: Math.max(0, amt - coupon.discountValue), bonusDays: 0 };
    if (coupon.discountType === "days") return { finalAmount: amt, bonusDays: coupon.discountValue };
    return { finalAmount: amt, bonusDays: 0 };
  };
  const { finalAmount, bonusDays } = applyCouponDiscount(baseAmount);

  const uploadProof = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setErr("");
    try {
      const r = await uploadFile(f);
      setProofUrl(r.url);
      setProofPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : "");
    } catch (ex) { setErr(errorText(ex)); }
    finally { setBusy(false); }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponErr("");
    try {
      const r = await api.post("/coupons/validate", { code: couponCode });
      setCoupon(r.data);
    } catch (e) { setCoupon(null); setCouponErr(errorText(e)); }
  };

  const submit = async () => {
    if (!proofUrl) { setErr("Silakan upload bukti transfer terlebih dahulu."); return; }
    setBusy(true); setErr("");
    try {
      const r = await api.post("/payments", { planSlug: plan.slug, additionalWebsiteCount: extra, transferDate, proofUrl, notes, couponCode: coupon ? coupon.code : "" });
      setPayment(r.data);
      setStep(3);
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const wa = () => {
    const msg = `Halo Admin UsahaKu, saya sudah melakukan pembayaran paket ${plan.name} sebesar Rp${money(finalAmount)}. Email akun saya: ${user.email}. Saya akan mengirimkan bukti transfer.`;
    const num = (settings.adminWhatsapp || "").replace(/\D/g, "");
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="wizard-page">
      <div className="page-head compact">
        <div>
          <Link data-testid="payment-back" className="back-link" to="/dashboard/subscription">← Kembali</Link>
          <h1>Selesaikan pembayaran</h1>
          <p>Transfer bank manual · Verifikasi 1-24 jam</p>
        </div>
      </div>
      <div className="wizard-steps">
        <span className={step >= 1 ? "active" : ""}><b>1</b> Transfer</span><i />
        <span className={step >= 2 ? "active" : ""}><b>2</b> Bukti</span><i />
        <span className={step >= 3 ? "active" : ""}><b>3</b> Selesai</span>
      </div>

      {step === 1 && (
        <div className="wizard-card">
          <div className="eyebrow">INSTRUKSI TRANSFER</div>
          <h2>Transfer ke rekening di bawah</h2>
          <div className="bank-info">
            <div><small>BANK</small><b>{settings.bankName}</b></div>
            <div><small>ATAS NAMA</small><b>{settings.accountName}</b></div>
            <div><small>NOMOR REKENING</small><b data-testid="bank-account-number">{settings.accountNumber}</b></div>
            <div><small>TOTAL TRANSFER</small><b data-testid="payment-amount">Rp{money(finalAmount)}{bonusDays > 0 && <small style={{ color: "#166534", display: "block", fontSize: 11 }}>+ {bonusDays} hari bonus</small>}</b></div>
          </div>
          <div className="coupon-inline">
            <label>
              <small>KUPON DISKON (OPSIONAL)</small>
              <div className="coupon-input-row">
                <input data-testid="coupon-code-input" value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); }} placeholder="Contoh: HEMAT50" />
                <button data-testid="coupon-apply-button" onClick={validateCoupon} className="btn btn-outline" type="button">Terapkan</button>
              </div>
            </label>
            {coupon && (
              <div className="coupon-success" data-testid="coupon-applied">
                ✓ Kupon <b>{coupon.code}</b> diterapkan · {coupon.discountType === "percentage" ? `Diskon ${coupon.discountValue}%` : coupon.discountType === "fixed" ? `Potongan Rp${money(coupon.discountValue)}` : `Bonus ${coupon.discountValue} hari`}
              </div>
            )}
            {couponErr && <div className="form-error" data-testid="coupon-error">{couponErr}</div>}
          </div>
          <div className="bank-instructions">
            <b>Instruksi transfer</b>
            <p>{settings.paymentInstructions}</p>
          </div>
          <div className="wizard-actions">
            <Button data-testid="already-transferred-button" onClick={() => setStep(2)}>Saya sudah transfer <ArrowRight size={16} /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-card">
          <div className="eyebrow">BUKTI TRANSFER</div>
          <h2>Unggah bukti pembayaran</h2>
          <p className="form-intro">Foto/screenshot atau PDF bukti transfer.</p>
          <div className="form-grid">
            <label>Tanggal transfer<input data-testid="transfer-date-input" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} /></label>
            <label className="full upload-label">Bukti transfer
              <div className="upload-box upload-box-large">
                {proofPreview ? <img src={proofPreview} alt="bukti" /> : proofUrl ? <span>File terupload ✓</span> : <><Upload size={20} /><span>Upload gambar / PDF (max 8MB)</span></>}
                <input type="file" accept="image/*,application/pdf" onChange={uploadProof} data-testid="proof-input" />
              </div>
            </label>
            <label className="full">Catatan (opsional)<textarea data-testid="payment-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tambahkan catatan untuk admin (opsional)" /></label>
          </div>
          <FormError msg={err} />
          <div className="wizard-actions">
            <Button data-testid="payment-back-button" variant="outline" onClick={() => setStep(1)}>Kembali</Button>
            <Button data-testid="submit-payment-button" onClick={submit} disabled={busy || !proofUrl}>{busy ? "Mengirim..." : "Kirim untuk verifikasi"}</Button>
          </div>
        </div>
      )}

      {step === 3 && payment && (
        <div className="wizard-card">
          <div className="success-panel">
            <div className="success-icon"><Check size={30} /></div>
            <div className="eyebrow">PEMBAYARAN DIKIRIM</div>
            <h2>Terima kasih, {user.name.split(" ")[0]}.</h2>
            <p>Pembayaran <b>{plan.name}</b> senilai <b>Rp{money(finalAmount)}</b> sedang menunggu verifikasi admin.{bonusDays > 0 && ` Kamu akan mendapat bonus ${bonusDays} hari saat pembayaran disetujui.`} Kami akan memberi kabar melalui notifikasi.</p>
            <div className="wizard-actions">
              <a data-testid="whatsapp-admin-button" className="btn btn-primary" href={wa()} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Kirim bukti ke Admin via WhatsApp</a>
              <Link data-testid="back-to-subscription" className="btn btn-outline" to="/dashboard/subscription">Kembali ke paket</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentDetail() {
  const { pid } = useParams();
  const [p, setP] = useState(null);
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    Promise.all([api.get(`/payments/${pid}`), api.get("/settings/public")]).then(([r, s]) => { setP(r.data); setSettings(s.data); });
  }, [pid]);
  if (!p || !settings) return <Loading text="Memuat pembayaran..." />;
  const proofUrl = p.proofUrl ? (p.proofUrl.startsWith("http") ? p.proofUrl : process.env.REACT_APP_BACKEND_URL + p.proofUrl) : "";
  return (
    <div className="dashboard">
      <div className="page-head compact">
        <div>
          <Link className="back-link" to="/dashboard/subscription">← Kembali</Link>
          <h1>Detail pembayaran</h1>
          <p>{p.planName} · Rp{money(p.amount)}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <div className="payment-detail-grid">
        <div className="wizard-card">
          <div className="eyebrow">INFORMASI</div>
          <div className="info-rows">
            <div><small>PAKET</small><b>{p.planName}</b></div>
            <div><small>JUMLAH</small><b>Rp{money(p.amount)}</b></div>
            <div><small>WEBSITE TAMBAHAN</small><b>{p.additionalWebsiteCount || 0}</b></div>
            <div><small>TANGGAL TRANSFER</small><b>{p.transferDate || "-"}</b></div>
            <div><small>TANGGAL SUBMIT</small><b>{formatDate(p.createdAt)}</b></div>
            {p.adminNotes && <div><small>CATATAN ADMIN</small><b style={{ color: "#dc2626" }}>{p.adminNotes}</b></div>}
            {p.notes && <div><small>CATATAN KAMU</small><b>{p.notes}</b></div>}
          </div>
        </div>
        <div className="wizard-card">
          <div className="eyebrow">BUKTI TRANSFER</div>
          {p.proofUrl && ((p.proofContentType === "application/pdf" || p.proofUrl.toLowerCase().endsWith(".pdf")) ?
            <a data-testid="view-proof" href={proofUrl} target="_blank" rel="noreferrer" className="btn btn-outline">Buka bukti PDF</a>
            : <img data-testid="proof-image" src={proofUrl} alt="bukti" style={{ maxWidth: "100%", borderRadius: 12 }} />
          )}
        </div>
      </div>
    </div>
  );
}
