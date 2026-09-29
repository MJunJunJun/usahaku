import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Copy, UploadCloud, Trash2, MessageCircle, ArrowLeft } from "lucide-react";
import { api, errorText, formatDateTime, resolveMediaUrl } from "../lib/api";
import { Button, FormError, Loading } from "../lib/shared";
import { PaymentStatus, rupiah } from "../components/BillingUI";
import "./Subscription.css";

export function PaymentDetail() {
  const { pid } = useParams();
  const [p, setP] = useState(null);
  const [clock, setClock] = useState({ server: Date.now(), local: performance.now() });
  const [tick, setTick] = useState(performance.now());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const apply = useCallback(data => {
    setP(data); setClock({ server: new Date(data.serverNow).getTime(), local: performance.now() });
  }, []);
  const load = useCallback(async () => { apply((await api.get(`/payments/${pid}`)).data); }, [pid, apply]);
  useEffect(() => { load().catch(e => setError(errorText(e))); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setTick(performance.now()), 1000);
    const refresh = setInterval(() => load().catch(() => {}), 15000);
    const focus = () => load().catch(() => {});
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); clearInterval(refresh); window.removeEventListener("focus", focus); };
  }, [load]);
  const run = async (key, action) => {
    setBusy(key); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const upload = e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name) || !["image/jpeg", "image/png"].includes(file.type)) {
      setError("Bukti transfer hanya menerima JPG atau PNG. PDF dan format lainnya tidak didukung."); return;
    }
    if (file.size > 8 * 1024 * 1024) { setError("Ukuran bukti maksimal 8 MB."); return; }
    run("upload", async () => {
      const form = new FormData(); form.append("file", file);
      apply((await api.post(`/payments/${pid}/proof`, form)).data);
      setMessage("Bukti tersimpan. Tekan Kirim bukti pembayaran untuk meminta verifikasi.");
    });
  };
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(String(value)); setMessage("Berhasil disalin."); }
    catch { setError("Belum bisa menyalin otomatis. Silakan salin informasi yang ditampilkan."); }
  };
  if (!p) return <div className="billing"><FormError msg={error} />{!error && <Loading text="Memuat tagihan..." />}</div>;
  const editable = ["AWAITING_PAYMENT", "PROOF_DRAFT", "NEEDS_REVISION"].includes(p.status);
  const approved = p.status === "APPROVED";
  const waiting = p.status === "PENDING" || p.status === "PROCESSING";
  const unlockAt = p?.waAvailableAt ? new Date(p.waAvailableAt).getTime() : 0;
  const remaining = unlockAt ? Math.max(0, Math.ceil((unlockAt - (clock.server + tick - clock.local)) / 1000)) : 0;
  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const bonus = approved ? (p.bonusAmount || 0) : p.bonusEligible && p.topupBonus?.enabled && p.amount >= p.topupBonus.minTopup ? p.topupBonus.bonus : 0;
  const amount = approved ? p.approvedAmount ?? p.amount : p.amount;
  const title = approved ? "Pembayaran berhasil" : waiting ? "Menunggu konfirmasi admin" : p.status === "REJECTED" ? "Pembayaran ditolak" : p.status === "NEEDS_REVISION" ? "Perbaiki bukti pembayaran" : "Selesaikan pembayaran";
  return <div className="billing billing-invoice" data-testid="invoice-page">
    <Link className="billing-back" data-testid="invoice-back" to="/dashboard/subscription"><ArrowLeft size={16} /> Kembali ke Langganan</Link>
    <header className="billing-heading"><span className="billing-eyebrow">{p.invoiceNumber}</span><h1>{title}</h1><p>{approved ? "Pembayaran disetujui. Rincian transaksi tersimpan di Riwayat." : waiting ? "Bukti pembayaran berhasil dikirim. Saldo ditambahkan setelah verifikasi." : "Transfer sesuai tagihan, lalu unggah dan kirim bukti pembayaran."}</p></header>
    <div className="billing-steps" aria-label="Tahap pembayaran"><span className="done">1. Tagihan dibuat</span><span className={p.submittedAt || approved ? "done" : ""}>2. Kirim bukti</span><span className={approved ? "done" : ""}>3. Verifikasi admin</span></div>
    <FormError msg={error} />{message && <div className="billing-success" role="status">{message}</div>}
    {p.adminNotes && <div className="billing-notice"><b>Catatan admin</b><p>{p.adminNotes}</p></div>}
    <div className="billing-invoice-grid">
      <section className="billing-card">
        <div className="billing-section-head"><h2>Informasi tagihan</h2><PaymentStatus status={p.status} /></div>
        <div className="billing-summary">
          <div><span>Nomor tagihan</span><b>{p.invoiceNumber}</b></div>
          <div><span>Jenis transaksi</span><b>{p.kind === "topup" ? "Top up saldo" : p.itemLabel}</b></div>
          <div><span>Dibuat</span><b>{formatDateTime(p.createdAt)}</b></div>
          {p.submittedAt && <div><span>Bukti dikirim</span><b>{formatDateTime(p.submittedAt)}</b></div>}
          <div><span>Nominal tagihan</span><b>{rupiah(p.amount)}</b></div>
          {approved && <div><span>Transfer diterima</span><b>{rupiah(amount)}</b></div>}
          {p.kind === "topup" && <><div><span>Bonus pengguna pertama</span><b className={bonus > 0 ? "billing-positive" : ""}>{rupiah(bonus)}</b></div><div className="billing-total"><span>{approved ? "Total saldo ditambahkan" : "Estimasi saldo masuk"}</span><b>{rupiah(amount + bonus)}</b></div></>}
        </div>
        {!approved && p.kind === "topup" && <p className="billing-hint">Bonus mengikuti nominal yang diterima admin dan hanya berlaku untuk top up pertama yang berhasil.</p>}
        {editable && <div className="billing-bank"><h3>Transfer ke rekening berikut</h3><b>{p.bank?.bankName || "Bank belum tersedia"}</b><div className="billing-copy-row"><strong>{p.bank?.accountNumber || "Hubungi pengelola"}</strong><button aria-label="Salin nomor rekening" data-testid="copy-bank" disabled={!p.bank?.accountNumber} onClick={() => copy(p.bank.accountNumber)}><Copy size={16} /></button></div><p>a.n. {p.bank?.accountName || "—"}</p><hr /><small>Total transfer</small><div className="billing-copy-row"><strong>{rupiah(p.amount)}</strong><button aria-label="Salin nominal transfer" data-testid="copy-amount" onClick={() => copy(p.amount)}><Copy size={16} /></button></div></div>}
      </section>
      <section className="billing-card">
        <h2>{editable ? "Upload bukti transfer" : approved ? "Pembayaran terverifikasi" : "Bukti pembayaran"}</h2>
        {editable && <p>Unggah bukti transfer dalam format JPG atau PNG. Bisa menggunakan screenshot langsung dari HP. Maksimal 8 MB.</p>}
        {approved && <div className="billing-confirmed"><CheckCircle2 size={34} /><b>{p.kind === "topup" ? `${rupiah(amount + bonus)} telah ditambahkan ke saldo` : "Masa aktif berhasil ditambahkan"}</b></div>}
        {p.proofUrl && <a data-testid="view-proof" className="billing-proof-link" href={resolveMediaUrl(p.proofUrl)} target="_blank" rel="noreferrer"><img data-testid="proof-image" className="billing-proof" src={resolveMediaUrl(p.proofUrl)} alt="Bukti transfer yang diunggah" /><span>Lihat bukti transfer ukuran penuh ↗</span></a>}
        {editable && <><div className="billing-upload-actions"><label className={`billing-upload ${busy ? "disabled" : ""}`}><UploadCloud size={20} /><span>{busy === "upload" ? "Mengunggah..." : p.proofUrl ? "Ganti bukti" : "Pilih JPG / PNG"}</span><input data-testid="proof-input" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={upload} disabled={!!busy} /></label>{p.proofUrl && <Button variant="outline" data-testid="delete-proof" disabled={!!busy} onClick={() => run("delete", async () => apply((await api.delete(`/payments/${pid}/proof`)).data))}><Trash2 size={16} /> Hapus</Button>}</div>
          <p className="billing-hint">Bukti yang diunggah tersimpan otomatis. Kirim untuk mulai verifikasi admin.</p><Button className="billing-full" data-testid="submit-proof" disabled={!!busy || !p.proofUrl} onClick={() => run("submit", async () => apply((await api.post(`/payments/${pid}/submit`)).data))}>{busy === "submit" ? "Mengirim..." : "Kirim bukti pembayaran"}</Button></>}
        {waiting && <div className="billing-waiting"><Clock3 size={24} /><b>Admin sedang memeriksa pembayaranmu</b><p>Bukti dikunci selama verifikasi. Status akan diperbarui otomatis di halaman ini dan Riwayat.</p>
          <Button variant="outline" className="billing-full" data-testid="payment-whatsapp" disabled={!!busy || p.status !== "PENDING" || !p.waAvailableAt || remaining > 0}
            onClick={() => run("whatsapp", async () => { const r = await api.get(`/payments/${pid}/whatsapp`); window.location.assign(r.data.url); })}><MessageCircle size={17} /> Konfirmasi ke admin via WhatsApp</Button>
          <small data-testid="whatsapp-countdown">{remaining > 0 ? `Bisa dihubungi dalam ${countdown} jika pembayaran belum diverifikasi.` : "Hubungi admin jika pembayaranmu belum diverifikasi."}</small><small>Waktu tunggu ini bukan batas waktu penyelesaian verifikasi.</small>
        </div>}
        {!p.proofUrl && !editable && <p className="billing-empty">Belum ada bukti pembayaran.</p>}
      </section>
    </div>
  </div>;
}
