"""Payment lifecycle and retry-safe wallet settlement (also works on standalone MongoDB)."""
from datetime import timedelta
import hashlib
from urllib.parse import quote

from fastapi import HTTPException
from pymongo import ReturnDocument

import monetization as rules

EDITABLE = ("AWAITING_PAYMENT", "PROOF_DRAFT", "NEEDS_REVISION")


def payment_status(payment):
    # Old invoices were created as PENDING before a proof had been supplied.
    status = payment.get("status", "AWAITING_PAYMENT")
    if status == "PENDING" and payment.get("kind") in ("topup", "card") and not payment.get("proofUrl"):
        return "AWAITING_PAYMENT"
    return status


class BillingMixin:
    async def renew_card(self, user, card):
        """One debit per expiry cycle, recoverable after a worker interruption."""
        cfg = await self.config()
        if rules.is_unlimited(user, cfg):
            return None
        cycle = hashlib.sha256(str(card.get("expiresAt")).encode()).hexdigest()[:16]
        operation = f"renew-{card['id']}-{cycle}"
        key = f"walletReceipts.{operation}"
        await self.ensure_wallet(user["id"])
        for _ in range(12):
            owner = await self.db.users.find_one({"id": user["id"]})
            receipt = owner.get("walletReceipts", {}).get(operation)
            if receipt:
                break
            decision = rules.auto_renew_decision(card, owner.get("walletBalance", 0), cfg["packages"], self.now())
            if not decision.get("renew"):
                return None
            before = int(owner.get("walletBalance") or 0)
            receipt = {"amount": -decision["price"], "balanceAfter": before - decision["price"],
                       "createdAt": self.now(), "days": decision["days"], "price": decision["price"]}
            changed = await self.db.users.update_one(
                {"id": owner["id"], "walletBalance": before, key: {"$exists": False}},
                {"$inc": {"walletBalance": -decision["price"]}, "$set": {key: receipt}})
            if changed.modified_count:
                break
        else:
            raise HTTPException(409, "Saldo sedang diperbarui.")
        # Simpan riwayat debit sebelum masa aktif diubah. Upsert berdasarkan
        # operation membuat retry setelah worker terputus tetap idempoten.
        await self.db.wallet_transactions.update_one({"_id": operation}, {"$setOnInsert": {
            "id": operation, "userId": user["id"], "type": "AUTORENEW", "amount": receipt["amount"],
            "balanceAfter": receipt["balanceAfter"], "createdAt": receipt["createdAt"],
            "note": f"Perpanjangan otomatis {card.get('name', 'Website')} 1 bulan", "refId": card["id"]}}, upsert=True)
        # Optimistic expiry comparison prevents two workers overwriting extensions.
        for _ in range(12):
            fresh = await self.db.cards.find_one({"id": card["id"]})
            if operation in fresh.get("appliedRenewals", []):
                break
            pkg = {"months": 1, "days": receipt["days"]}
            updates = rules.apply_purchase(fresh, pkg, receipt["createdAt"])
            updates.update(planPrice=receipt["price"], remindedExpiryOffsets=[], renewRemindedAt=None)
            changed = await self.db.cards.update_one(
                {"id": card["id"], "expiresAt": fresh.get("expiresAt"), "appliedRenewals": {"$ne": operation}},
                {"$set": updates, "$addToSet": {"appliedRenewals": operation}})
            if changed.modified_count:
                break
        else:
            raise HTTPException(409, "Masa aktif sedang diperbarui.")
        return {"card": self.card_view(await self.db.cards.find_one({"id": card["id"]}, {"_id": 0}))}

    async def first_topup_used(self, user):
        if user.get("firstTopupCompleted") or user.get("topupBonusClaimed"):
            return True
        # Existing customers must not receive a second welcome bonus after rollout.
        return bool(await self.db.wallet_transactions.find_one({"userId": user["id"], "type": "TOPUP"})
                    or await self.db.payments.find_one({"userId": user["id"], "kind": "topup", "status": "APPROVED"}))

    async def payment_for(self, pid, user):
        p = await self.db.payments.find_one({"id": pid}, {"_id": 0})
        if not p or (p["userId"] != user["id"] and user.get("role") != "ADMIN"):
            raise HTTPException(404, "Tagihan tidak ditemukan.")
        return p

    async def payment_view(self, p):
        cfg = await self.config()
        owner = await self.db.users.find_one({"id": p["userId"]}, {"_id": 0}) or {"id": p["userId"]}
        status = payment_status(p)
        submitted = rules.parse_dt(p.get("submittedAt"))
        if not submitted and status == "PENDING" and p.get("proofUrl"):
            submitted = rules.parse_dt(p.get("createdAt"))
        unlock = submitted + timedelta(minutes=5) if submitted else None
        proof = await self.db.files.find_one({"id": (p.get("proofUrl") or "").rsplit("/", 1)[-1]}, {"_id": 0})
        used = await self.first_topup_used(owner)
        return {**p, "status": status,
                "invoiceNumber": p.get("invoiceNumber") or f"INV-{p['id'][:8].upper()}",
                "userName": owner.get("name") or p.get("userName") or "Pengguna",
                "userEmail": owner.get("email") or p.get("userEmail") or "",
                "itemLabel": p.get("itemLabel") or p.get("planName") or "Pembayaran",
                "bank": p.get("bank") or cfg["bank"], "serverNow": self.now(),
                "proofContentType": (proof or {}).get("contentType"),
                "waAvailableAt": rules.iso(unlock) if unlock else None,
                "bonusEligible": p.get("kind") == "topup" and not used,
                "topupBonus": cfg["topup"]}

    async def check_proof(self, p, proof_url):
        if not proof_url or not proof_url.startswith("/api/uploads/"):
            raise HTTPException(400, "Bukti transfer JPG atau PNG wajib diunggah.")
        rec = await self.db.files.find_one({"id": proof_url.removeprefix("/api/uploads/"), "userId": p["userId"]})
        if not rec or rec.get("contentType") not in ("image/jpeg", "image/png"):
            raise HTTPException(400, "Bukti transfer hanya menerima JPG atau PNG, bukan PDF atau format lain.")
        return rec

    async def save_proof(self, pid, user, proof_url):
        p = await self.payment_for(pid, user)
        if payment_status(p) not in EDITABLE:
            raise HTTPException(409, "Bukti sedang diperiksa atau pembayaran telah selesai.")
        if proof_url:
            await self.check_proof(p, proof_url)
        updates = {"proofUrl": proof_url, "status": "PROOF_DRAFT" if proof_url else "AWAITING_PAYMENT",
                   "updatedAt": self.now(), "submittedAt": None}
        result = await self.db.payments.update_one(
            {"id": pid, "status": p["status"], "proofUrl": p.get("proofUrl")}, {"$set": updates})
        if not result.matched_count:
            raise HTTPException(409, "Tagihan telah berubah. Muat ulang halaman.")
        return await self.payment_view({**p, **updates})

    async def submit_proof(self, pid, user):
        p = await self.payment_for(pid, user)
        if payment_status(p) not in EDITABLE:
            raise HTTPException(409, "Bukti sudah dikirim atau pembayaran telah selesai.")
        await self.check_proof(p, p.get("proofUrl"))
        submitted = self.now()
        result = await self.db.payments.update_one(
            {"id": pid, "status": p["status"], "proofUrl": p.get("proofUrl")},
            {"$set": {"status": "PENDING", "submittedAt": submitted, "updatedAt": submitted},
             "$push": {"proofHistory": {"url": p["proofUrl"], "submittedAt": submitted}}})
        if not result.matched_count:
            raise HTTPException(409, "Tagihan telah berubah. Muat ulang halaman.")
        return await self.payment_view({**p, "status": "PENDING", "submittedAt": submitted})

    async def whatsapp_link(self, pid, user):
        p = await self.payment_view(await self.payment_for(pid, user))
        unlock = rules.parse_dt(p.get("waAvailableAt"))
        if p["status"] != "PENDING" or not unlock or rules.parse_dt(self.now()) < unlock:
            raise HTTPException(409, "WhatsApp tersedia 5 menit setelah bukti dikirim, selama menunggu verifikasi.")
        number = "".join(c for c in str((await self.config()).get("adminWhatsapp") or "") if c.isdigit())
        if not number:
            raise HTTPException(400, "Nomor WhatsApp admin belum tersedia.")
        msg = f"Halo Admin Situska, mohon cek pembayaran {p['invoiceNumber']} sebesar {rules.rupiah(p['amount'])}. Bukti sudah saya kirim melalui Situska. Akun: {p['userEmail']}."
        return {"url": f"https://wa.me/{number}?text={quote(msg)}"}

    async def review_payment(self, pid, admin, status, reason):
        p = await self.payment_for(pid, admin)
        if not reason.strip():
            raise HTTPException(400, "Alasan wajib diisi.")
        if status not in ("NEEDS_REVISION", "REJECTED") or payment_status(p) != "PENDING":
            raise HTTPException(409, "Hanya pembayaran menunggu verifikasi yang dapat direview.")
        result = await self.db.payments.update_one({"id": pid, "status": "PENDING"}, {"$set": {
            "status": status, "adminNotes": reason.strip(), "reviewedBy": admin["id"], "reviewedAt": self.now()}})
        if not result.modified_count:
            raise HTTPException(409, "Pembayaran sedang atau sudah diproses.")
        if self._log:
            await self._log(admin["id"], "review_payment", p["userId"], pid, reason)
        await self._notify_user(p["userId"], "Perbaiki bukti pembayaran" if status == "NEEDS_REVISION" else "Pembayaran ditolak", reason)
        return {"ok": True}

    async def settle_topup(self, p):
        """Receipt and balance change are one atomic user-document update.

        A retry rebuilds the ledger from the receipt without crediting twice.
        CAS also serializes different invoices competing for the first-topup bonus.
        """
        key = f"walletReceipts.{p['id']}"
        amount = int(p["approvedAmount"])
        cfg = await self.config()
        await self.ensure_wallet(p["userId"])
        for _ in range(12):
            user = await self.db.users.find_one({"id": p["userId"]})
            if not user:
                raise HTTPException(404, "Pengguna tidak ditemukan.")
            receipt = user.get("walletReceipts", {}).get(p["id"])
            if receipt:
                break
            used = await self.first_topup_used(user)
            bonus = rules.topup_bonus_for(amount, cfg["topup"], used)
            before = int(user.get("walletBalance") or 0)
            receipt = {"amount": amount, "bonus": bonus, "balanceBefore": before,
                       "balanceAfter": before + amount + bonus, "createdAt": self.now()}
            result = await self.db.users.update_one(
                {"id": user["id"], "walletBalance": before, key: {"$exists": False},
                 "firstTopupCompleted": user.get("firstTopupCompleted", {"$exists": False})},
                {"$inc": {"walletBalance": amount + bonus}, "$set": {
                    key: receipt, "firstTopupCompleted": True,
                    "topupBonusClaimed": bool(user.get("topupBonusClaimed") or bonus)}})
            if result.modified_count:
                break
        else:
            raise HTTPException(409, "Saldo sedang diperbarui. Coba proses pembayaran kembali.")
        for type_, value, balance, note in (
            ("TOPUP", receipt["amount"], receipt["balanceBefore"] + receipt["amount"], "Top up saldo"),
            ("BONUS", receipt["bonus"], receipt["balanceAfter"], "Bonus pengguna pertama"),
        ):
            if not value:
                continue
            tx_id = f"payment-{p['id']}-{type_}"
            await self.db.wallet_transactions.update_one({"_id": tx_id}, {"$setOnInsert": {
                "id": tx_id, "userId": p["userId"], "type": type_, "amount": value,
                "balanceAfter": balance, "note": note, "refId": p["id"],
                "createdAt": receipt["createdAt"]}}, upsert=True)
        return {"balance": await self.balance(p["userId"]), "bonus": receipt["bonus"], "approvedAmount": receipt["amount"]}

    async def apply_payment(self, p, admin, approved_amount=None, note=""):
        if p.get("status") == "APPROVED":
            return {"ok": True, "alreadyProcessed": True}
        amount = p["amount"] if approved_amount is None else approved_amount
        if amount <= 0:
            raise HTTPException(400, "Nominal diterima harus lebih dari 0.")
        if p.get("kind") != "topup" and amount != p["amount"]:
            raise HTTPException(400, "Penyesuaian nominal hanya untuk top up saldo.")
        if amount != p["amount"] and not note.strip():
            raise HTTPException(400, "Catatan wajib diisi jika nominal transfer berbeda.")
        if p.get("status") != "PROCESSING":
            if payment_status(p) != "PENDING":
                raise HTTPException(409, "Bukti pembayaran belum dikirim atau tagihan telah diproses.")
            await self.check_proof(p, p.get("proofUrl"))
            claimed = await self.db.payments.find_one_and_update(
                {"id": p["id"], "status": "PENDING", "proofUrl": p.get("proofUrl")},
                {"$set": {"status": "PROCESSING", "approvedAmount": amount,
                          "adminNotes": note.strip(), "reviewedBy": admin["id"]}},
                return_document=ReturnDocument.AFTER)
            if not claimed:
                raise HTTPException(409, "Pembayaran sedang atau sudah diproses. Muat ulang halaman.")
            p = claimed
        # PROCESSING can be resumed after an interrupted request using saved approval values.
        result = {"kind": p.get("kind")}
        if p.get("kind") == "topup":
            result.update(await self.settle_topup(p))
        else:
            pkg = await self.package_for(p.get("months") or 1)
            card = await self.db.cards.find_one({"id": p.get("cardId"), "userId": p["userId"]})
            if not card:
                raise HTTPException(409, "Kartu tagihan tidak ditemukan. Hubungi pengelola.")
            updates = rules.apply_purchase(card, pkg, self.now())
            updates.update({"planPrice": int(pkg["promoPrice"]), "method": "transfer"})
            await self.db.cards.update_one({"id": card["id"], "appliedPayments": {"$ne": p["id"]}},
                                           {"$set": updates, "$addToSet": {"appliedPayments": p["id"]}})
            result["days"] = pkg["days"]
        done = await self.db.payments.update_one({"id": p["id"], "status": "PROCESSING"}, {"$set": {
            "status": "APPROVED", "reviewedAt": self.now(), "bonusAmount": result.get("bonus", 0)}})
        if done.modified_count:
            if self._log:
                await self._log(admin["id"], "approve_payment", p["userId"], p["id"],
                                f"Diterima {p['approvedAmount']}; bonus {result.get('bonus', 0)}; {p.get('adminNotes', '')}")
            await self._notify_user(p["userId"], "Pembayaran berhasil", "Pembayaran telah disetujui. Lihat rincian di Riwayat.")
        return {"ok": True, **result}
