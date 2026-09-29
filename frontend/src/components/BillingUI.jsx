import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { money } from "../lib/api";

export const rupiah = (value) => `${Number(value) < 0 ? "−" : ""}Rp${money(Math.abs(Number(value) || 0))}`;
export const paymentPath = (id) => `/dashboard/subscription/payment/${id}`;
export const paymentLabels = {
  AWAITING_PAYMENT: "Menunggu pembayaran", PROOF_DRAFT: "Bukti belum dikirim",
  PENDING: "Menunggu verifikasi", PROCESSING: "Sedang diproses",
  NEEDS_REVISION: "Perlu perbaikan bukti", APPROVED: "Berhasil",
  REJECTED: "Ditolak", CANCELLED: "Dibatalkan",
};
export function PaymentStatus({ status }) {
  return <span className={`billing-status billing-status-${status?.toLowerCase()}`}>{paymentLabels[status] || status}</span>;
}
export function BillingModal({ open, onOpenChange, title, description, children, testId, busy }) {
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="billing-overlay" />
      <Dialog.Content className="billing-modal billing" data-testid={testId}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
        <Dialog.Close className="billing-close" aria-label="Tutup popup" data-testid={`${testId}-close`} disabled={busy}><X size={20} /></Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
