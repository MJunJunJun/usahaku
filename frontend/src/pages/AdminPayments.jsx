import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";
import { api, errorText, formatDateTime, resolveMediaUrl } from "../lib/api";
import { Button, FormError, Loading } from "../lib/shared";
import { PaymentStatus, paymentLabels, rupiah } from "../components/BillingUI";
import "./Subscription.css";

export function AdminPayments() {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("PENDING");
  const [error, setError] = useState("");
  const load = useCallback(() => api.get("/admin/payments").then(r => setList(r.data)).catch(e => setError(errorText(e))), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  return <div className="billing" data-testid="admin-payments-page">
    <header className="billing-heading"><span className="billing-eyebrow">PEMBAYARAN</span><h1>Verifikasi pembayaran</h1><p>{list ? `${list.filter(p => p.status === "PENDING").length} pembayaran menunggu verifikasi` : "Memuat tagihan dan bukti pembayaran..."}</p></header>
    <FormError msg={error} />{!list && !error && <Loading />}
    {list && <section className="billing-card"><div className="billing-section-head"><h2>Daftar tagihan</h2><select aria-label="Filter pembayaran" data-testid="payment-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Semua status</option>{Object.entries(paymentLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
      <div className="billing-table-scroll"><table className="billing-admin-table"><thead><tr><th>Tagihan / pengguna</th><th>Transaksi</th><th>Nominal</th><th>Dikirim</th><th>Status</th><th /></tr></thead><tbody>
        {list.filter(p => filter === "ALL" || p.status === filter).map(p => <tr data-testid={`payment-row-${p.id}`} key={p.id}>
          <td><b>{p.invoiceNumber}</b><small>{p.userName}</small><small>{p.userEmail}</small></td><td>{p.kind === "topup" ? "Top up saldo" : p.itemLabel}</td><td>{rupiah(p.approvedAmount ?? p.amount)}{p.approvedAmount != null && p.approvedAmount !== p.amount && <small>Tagihan {rupiah(p.amount)}</small>}</td><td>{p.submittedAt ? formatDateTime(p.submittedAt) : "Bukti belum dikirim"}</td><td><PaymentStatus status={p.status} /></td><td><Link data-testid={`payment-detail-${p.id}`} to={`/admin/payment-requests/${p.id}`}>Detail →</Link></td>
        </tr>)}
      </tbody></table></div>{!list.some(p => filter === "ALL" || p.status === filter) && <p className="billing-empty">Tidak ada pembayaran pada status ini.</p>}
    </section>}
  </div>;
}

export function AdminPaymentDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const data = (await api.get(`/admin/payments/${id}`)).data;
    setP(data); setAmount(data.approvedAmount ?? data.amount); setNote(data.adminNotes || "");
  }, [id]);
  useEffect(() => { load().catch(e => setError(errorText(e))); }, [load]);
  const review = async (action) => {
    setError(""); setMessage("");
    if ((action !== "approve" || Number(amount) !== p.amount) && !note.trim()) { setError("Isi catatan untuk penyesuaian nominal, perbaikan bukti, atau penolakan."); return; }
    setBusy(action);
    try {
      await api.post(`/admin/payments/${id}/${action}`, action === "approve" ? { approvedAmount: Number(amount), note } : { reason: note });
      await load(); setMessage(action === "approve" ? "Pembayaran disetujui. Saldo dan riwayat telah diperbarui." : action === "revision" ? "Permintaan perbaikan bukti telah dikirim." : "Pembayaran ditolak.");
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  if (!p) return <div className="billing"><FormError msg={error} />{!error && <Loading text="Memuat pembayaran..." />}</div>;
  const editable = p.status === "PENDING";
  const bonus = p.status === "APPROVED" ? p.bonusAmount || 0 : p.status === "PROCESSING" ? 0 : p.bonusEligible && p.topupBonus?.enabled && Number(amount) >= p.topupBonus.minTopup ? p.topupBonus.bonus : 0;
  return <div className="billing" data-testid="admin-payment-detail">
    <Link className="billing-back" data-testid="admin-payment-back" to="/admin/payment-requests"><ArrowLeft size={16} /> Kembali ke pembayaran</Link>
    <header className="billing-heading"><span className="billing-eyebrow">{p.invoiceNumber}</span><h1>Review pembayaran</h1><p>{p.userName} · {p.userEmail}</p></header>
    <FormError msg={error} />{message && <div className="billing-success" role="status">{message}</div>}
    <div className="billing-invoice-grid"><section className="billing-card"><div className="billing-section-head"><h2>Informasi pembayaran</h2><PaymentStatus status={p.status} /></div>
      <div className="billing-summary"><div><span>Jenis</span><b>{p.kind === "topup" ? "Top up saldo" : p.itemLabel}</b></div><div><span>Nominal tagihan</span><b>{rupiah(p.amount)}</b></div><div><span>Dibuat</span><b>{formatDateTime(p.createdAt)}</b></div><div><span>Bukti dikirim</span><b>{p.submittedAt ? formatDateTime(p.submittedAt) : "Belum dikirim"}</b></div></div>
      {p.kind === "topup" && <><label className="billing-field">Nominal transfer diterima<input data-testid="approved-amount" type="number" inputMode="numeric" min="1" step="1" value={amount} disabled={!editable || !!busy} onChange={e => setAmount(e.target.value)} /><small>Sesuaikan dengan uang yang benar-benar diterima di rekening.</small></label>
        <div className="billing-summary"><div><span>Top up saldo</span><b>{rupiah(amount)}</b></div><div><span>Bonus pengguna pertama</span><b className="billing-positive">{rupiah(bonus)}</b></div><div className="billing-total"><span>Total saldo {p.status === "APPROVED" ? "ditambahkan" : "yang ditambahkan"}</span><b>{rupiah(Number(amount) + bonus)}</b></div></div><p className="billing-hint">Top up dan bonus dicatat sebagai dua transaksi terpisah. Bonus hanya untuk top up pertama yang berhasil dan memenuhi nominal minimum.</p></>}
      {(editable || p.adminNotes) && <label className="billing-field">Catatan admin<textarea data-testid="review-note" rows="3" value={note} disabled={!editable || !!busy} onChange={e => setNote(e.target.value)} placeholder="Wajib jika nominal berbeda, meminta perbaikan, atau menolak pembayaran." /></label>}
      {editable && <><Button className="billing-full" data-testid="approve-payment-button" disabled={!!busy || !p.proofUrl || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0} onClick={() => review("approve")}><Check size={16} />{busy === "approve" ? "Memproses..." : p.kind === "topup" ? `Setujui & tambah saldo ${rupiah(Number(amount) + bonus)}` : "Setujui pembayaran"}</Button><div className="billing-admin-actions"><Button data-testid="revise-payment-button" variant="outline" disabled={!!busy} onClick={() => review("revision")}>Minta perbaikan bukti</Button><Button data-testid="reject-payment-button" variant="outline" disabled={!!busy} onClick={() => review("reject")}>Tolak pembayaran</Button></div></>}
      {p.status === "PROCESSING" && <><p className="billing-hint">Persetujuan sedang diproses. Jika proses sebelumnya terputus, lanjutkan dengan nominal persetujuan yang sudah tersimpan.</p><Button data-testid="resume-approval" disabled={!!busy} onClick={() => review("approve")}>Lanjutkan pemrosesan</Button></>}
      {["AWAITING_PAYMENT", "PROOF_DRAFT", "NEEDS_REVISION"].includes(p.status) && <p className="billing-hint">Menunggu pengguna mengirim bukti. Saldo belum dapat ditambahkan.</p>}
    </section><section className="billing-card"><h2>Bukti transfer</h2>{p.proofUrl ? <a data-testid="admin-view-proof" className="billing-proof-link" href={resolveMediaUrl(p.proofUrl)} target="_blank" rel="noreferrer"><img className="billing-review-proof" data-testid="admin-proof-image" src={resolveMediaUrl(p.proofUrl)} alt="Bukti transfer pengguna" /><span>Buka gambar ukuran penuh ↗</span></a> : <p className="billing-empty">Pengguna belum mengunggah bukti transfer.</p>}
      {(p.proofHistory || []).length > 1 && <div><h3>Pengiriman sebelumnya</h3>{p.proofHistory.slice(0, -1).map((proof, i) => <p key={`${proof.url}-${i}`}><a data-testid={`previous-proof-${i}`} href={resolveMediaUrl(proof.url)} target="_blank" rel="noreferrer">Bukti {i + 1} · {formatDateTime(proof.submittedAt)}</a></p>)}</div>}
    </section></div>
  </div>;
}
