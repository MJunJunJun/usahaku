"""Layanan monetisasi Situska — FASE 2 (paket, saldo/dompet, kartu langganan).

Dipisah dari server.py supaya terbaca & teruji terpisah. Dibuat sekali di
server.py:  monetization = Monetization(db, notify, log_activity, uid, now)

Aturan:
- Uang = INTEGER RUPIAH (tanpa desimal).
- Saldo kartu disimpan benar-benar di satu tempat: `cards.expiresAt`.
- Status kartu TIDAK disimpan, tapi dihitung saat dibaca (rules.card_state).
"""
from datetime import datetime, timezone
from fastapi import HTTPException

import monetization as rules
import wa_service
from billing import BillingMixin

# pesan gerbang kartu (dipakai alur bikin website)
NO_CARD_MSG = ("Kuota kartu kamu sudah terpakai semua. Beli kartu langganan dulu untuk membuat website baru, "
               "atau lepas kartu dari website lain supaya bisa dipakai di sini.")
TRIAL_USED_MSG = "Masa gratis 14 hari sudah pernah dipakai di akun ini. Beli kartu langganan untuk membuat website baru."
TRIAL_WA_MSG = ("Verifikasi nomor WhatsApp kamu dulu supaya bisa memakai masa gratis 14 hari "
                "(1 kali per akun & per nomor WA).")

PAY_TOPUP = "topup"
PAY_CARD = "card"


class Monetization(BillingMixin):
    def __init__(self, db, notify=None, log_activity=None, uid=None, now_fn=None):
        self.db = db
        self._notify = notify
        self._log = log_activity
        self._uid = uid
        self._now = now_fn or (lambda: datetime.now(timezone.utc).isoformat())

    # ------------------------------------------------------------------ util
    def uid(self):
        return self._uid()

    def now(self):
        return self._now()

    async def config(self):
        """Konfigurasi monetisasi dari settings {id:"platform"} (bukan hardcode)."""
        st = await self.db.settings.find_one({"id": "platform"}, {"_id": 0}) or {}
        trial = st.get("trialConfig") or {
            "days": int(st.get("trialDays", rules.DEFAULT_TRIAL["days"])),
            "maxProducts": int(st.get("trialMaxProducts", rules.DEFAULT_TRIAL["maxProducts"])),
            "oncePerAccount": True,
        }
        return {
            "packages": st.get("packages") or rules.DEFAULT_PACKAGES,
            "trial": trial,
            "topup": st.get("topupBonus") or rules.DEFAULT_TOPUP_BONUS,
            "minTopup": int(st.get("minTopupAmount", 50000)),
            "enabled": bool(st.get("monetizationEnabled")),
            "unlimitedRoles": st.get("unlimitedRoles") or rules.DEFAULT_UNLIMITED_ROLES,
            "bank": {
                "bankName": st.get("bankName"),
                "accountName": st.get("accountName"),
                "accountNumber": st.get("accountNumber"),
            },
            "adminWhatsapp": st.get("adminWhatsapp"),
        }

    def package_view(self, pkg):
        return {
            **pkg,
            "price": int(pkg["promoPrice"]),
            "normalPrice": int(pkg["normalPrice"]),
            "perMonth": rules.per_month(pkg),
            "savingPercent": rules.saving_percent(pkg),
            "savingLabel": rules.saving_label(pkg),
            "monthLabel": rules.month_label(pkg['months']),
        }

    async def packages_public(self):
        cfg = await self.config()
        return {
            "packages": [self.package_view(p) for p in cfg["packages"]],
            "trial": cfg["trial"],
            "topupBonus": cfg["topup"],
            "minTopup": cfg["minTopup"],
            "minPurchaseDays": rules.MIN_PURCHASE_DAYS,
            "bank": cfg["bank"],
            "adminWhatsapp": cfg["adminWhatsapp"],
            "enabled": cfg["enabled"],
        }

    async def package_for(self, months, cfg=None):
        cfg = cfg or await self.config()
        for p in cfg["packages"]:
            if int(p["months"]) == int(months):
                pkg = p
                break
        else:
            raise HTTPException(400, "Paket durasi itu tidak tersedia.")
        if int(pkg["days"]) < rules.MIN_PURCHASE_DAYS:
            raise HTTPException(400, f"Pembelian minimal {rules.MIN_PURCHASE_DAYS} hari.")
        return pkg

    # ----------------------------------------------------------------- saldo
    async def ensure_wallet(self, user_id):
        await self.db.users.update_one(
            {"id": user_id, "walletBalance": {"$exists": False}},
            {"$set": {"walletBalance": 0}},
        )

    async def balance(self, user_id):
        await self.ensure_wallet(user_id)
        u = await self.db.users.find_one({"id": user_id}, {"_id": 0, "walletBalance": 1})
        return int((u or {}).get("walletBalance") or 0)

    async def _write_tx(self, user_id, type_, amount, balance_after, note, ref_id, bonus=0):
        doc = {
            "id": self.uid(), "userId": user_id, "type": type_, "amount": int(amount),
            "bonus": int(bonus), "balanceAfter": int(balance_after), "note": note,
            "refId": ref_id, "createdAt": self.now(),
        }
        await self.db.wallet_transactions.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def admin_credit(self, user_id, amount, note="", apply_bonus=False):
        """Explicit corrections are ADJUST entries, never a top-up or welcome bonus."""
        if not amount or not note.strip():
            raise HTTPException(400, "Nominal dan alasan penyesuaian wajib diisi.")
        if not await self.db.users.find_one({"id": user_id}):
            raise HTTPException(404, "Pengguna tidak ditemukan.")
        if amount < 0:
            balance = await self.debit(user_id, -amount, "ADJUST", note.strip())
        else:
            balance = await self.credit(user_id, amount, "ADJUST", note.strip())
        return {"balance": balance, "bonus": 0}

    async def credit(self, user_id, amount, type_="TOPUP", note="", ref_id=None, bonus=0):
        await self.ensure_wallet(user_id)
        amount = int(amount)
        if amount <= 0:
            raise HTTPException(400, "Nominal tidak valid.")
        await self.db.users.update_one({"id": user_id}, {"$inc": {"walletBalance": amount}})
        bal = await self.balance(user_id)
        await self._write_tx(user_id, type_, amount, bal, note, ref_id, bonus=bonus)
        return bal

    async def debit(self, user_id, amount, type_="PURCHASE", note="", ref_id=None):
        await self.ensure_wallet(user_id)
        amount = int(amount)
        res = await self.db.users.update_one(
            {"id": user_id, "walletBalance": {"$gte": amount}},
            {"$inc": {"walletBalance": -amount}},
        )
        if not res.modified_count:
            raise HTTPException(400, "Saldo tidak cukup. Silakan top up dulu.")
        bal = await self.balance(user_id)
        await self._write_tx(user_id, type_, -amount, bal, note, ref_id)
        return bal

    async def history(self, user_id, limit=50):
        cur = self.db.wallet_transactions.find({"userId": user_id}, {"_id": 0}).sort("createdAt", -1).limit(limit)
        return [d async for d in cur]

    async def wallet_view(self, user):
        cfg = await self.config()
        return {
            "balance": await self.balance(user["id"]),
            "bonusClaimed": await self.first_topup_used(user),
            "topupBonus": cfg["topup"],
            "minTopup": cfg["minTopup"],
            "bank": cfg["bank"],
            "adminWhatsapp": cfg["adminWhatsapp"],
            "transactions": await self.history(user["id"]),
        }

    # ------------------------------------------------- alarm pemasukan uang
    async def request_payment(self, user, amount, kind, months=None, card_id=None, label=None, bonus=0):
        doc = {
            "id": self.uid(), "userId": user["id"], "kind": kind, "planSlug": None,
            "userName": user.get("name", ""), "userEmail": user.get("email", ""),
            "bank": (await self.config())["bank"],
            "itemLabel": label, "amount": int(amount), "bonusAmount": int(bonus),
            "months": months, "cardId": card_id, "status": "AWAITING_PAYMENT", "method": "transfer",
            "proofUrl": None, "createdAt": self.now(), "reviewedAt": None, "reviewedBy": None,
            "adminNotes": "", "proofContentType": None,
        }
        await self.db.payments.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def request_topup(self, user, amount, method="transfer"):
        cfg = await self.config()
        amount = int(amount)
        if amount < cfg["minTopup"]:
            raise HTTPException(400, f"Minimal top up Rp{cfg['minTopup']:,}".replace(",", "."))
        if method != "transfer":
            raise HTTPException(400, "Top up saldo saat ini hanya lewat transfer bank.")
        bonus = rules.topup_bonus_for(amount, cfg["topup"], await self.first_topup_used(user))
        pay = await self.request_payment(
            user, amount, PAY_TOPUP,
            label=f"Top Up Saldo Rp{amount:,}".replace(",", ".") + (f" (+bonus Rp{bonus:,})".replace(",", ".") if bonus else ""),
            bonus=bonus,
        )
        return {"payment": pay, "bonus": bonus, "balance": await self.balance(user["id"])}

    # ------------------------------------------------------------------ kartu
    def card_view(self, card, now_iso=None):
        state = rules.card_state(card, now_iso)
        return {
            **card,
            "websiteUrl": card.get("websiteUrl"),
            "daysRemaining": state["daysRemaining"],
            "state": state["state"],
            "stateLabel": rules.state_label(state["state"]),
            "lastActiveDate": rules.format_date(rules.last_active_date(card.get("expiresAt"))) if card.get("expiresAt") else None,
            "expired": (not state["isActive"] and bool(card.get("expiresAt"))),
            "websiteFrozen": state["freezeWebsite"],
            "deleteAtZero": state["autoDelete"],
            "priceLabel": rules.rupiah(int(card.get("planPrice") or 0)) if card.get("planPrice") else None,
        }

    async def cards(self, user_id):
        cur = self.db.cards.find({"userId": user_id}, {"_id": 0}).sort("createdAt", 1)
        return [d async for d in cur]

    async def cards_view(self, user):
        cards = await self.cards(user["id"])
        cfg = await self.config()
        return {
            "cards": [self.card_view(c) for c in cards],
            "balance": await self.balance(user["id"]),
            "packages": [self.package_view(p) for p in cfg["packages"]],
            "trial": cfg["trial"],
        }

    async def card_or_404(self, user_id, card_id):
        c = await self.db.cards.find_one({"id": card_id, "userId": user_id}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Kartu tidak ditemukan.")
        return c

    async def card_detail(self, user, card_id):
        c = await self.card_or_404(user["id"], card_id)
        pays = []
        async for p in self.db.payments.find({"cardId": card_id}, {"_id": 0}).sort("createdAt", -1).limit(20):
            pays.append(p)
        txs = []
        async for t in self.db.wallet_transactions.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).limit(10):
            txs.append(t)
        return {"card": self.card_view(c), "payments": pays, "transactions": txs}

    async def _next_card_name(self, user_id):
        n = await self.db.cards.count_documents({"userId": user_id})
        return f"Kartu #{n + 1}"

    async def create_trial_card(self, user, site_id, days=None):
        """Kartu GRATIS 14 hari — 1x per akun (dipanggil saat website pertama dibuat)."""
        if user.get("trialUsed") or user.get("trialCardId"):
            return None
        cfg = await self.config()
        days = int(days or cfg["trial"]["days"])
        card = {
            "id": self.uid(), "userId": user["id"], "name": await self._next_card_name(user["id"]),
            "websiteId": site_id, "isTrialCard": True, "status": rules.STATE_TRIAL,
            "expiresAt": rules.iso(rules.add_days(self.now(), days)), "daysTotal": days,
            "planMonths": 0, "planPrice": 0, "autoRenew": True, "renewalMonths": 1,
            "createdAt": self.now(), "updatedAt": self.now(),
        }
        await self.db.cards.insert_one(card)
        await self.db.users.update_one({"id": user["id"]}, {"$set": {
            "trialUsed": True, "trialCardId": card["id"], "trialStartedAt": self.now()}})
        if site_id:
            await self.db.websites.update_one({"id": site_id}, {"$set": {"cardId": card["id"]}})
        phone = wa_service.normalize_number(user.get("whatsapp") or "")
        if phone:
            await self.db.trial_phones.update_one({"phone": phone}, {"$set": {
                "phone": phone, "userId": user["id"], "cardId": card["id"], "usedAt": self.now()}}, upsert=True)
        card.pop("_id", None)
        return card

    async def _new_card(self, user, pkg, months, expires_at, status, method, price):
        card = {
            "id": self.uid(), "userId": user["id"], "name": await self._next_card_name(user["id"]),
            "websiteId": None, "isTrialCard": False, "status": status,
            "expiresAt": expires_at, "daysTotal": int(pkg["days"]) if expires_at else 0,
            "planMonths": int(months), "planPrice": int(price), "autoRenew": False, "renewalMonths": 1,
            "method": method, "createdAt": self.now(), "updatedAt": self.now(),
        }
        await self.db.cards.insert_one(card)
        card.pop("_id", None)
        return card

    async def create_card(self, user, months, method="wallet"):
        cfg = await self.config()
        pkg = await self.package_for(months, cfg)
        price = int(pkg["promoPrice"])
        label = f"{self.card_name_hint(user)} — paket {rules.month_label(pkg['months'])}"
        if method == "wallet":
            await self.debit(user["id"], price, note=f"Beli {label}", ref_id=None)
            card = await self._new_card(user, pkg, months, rules.iso(rules.add_days(self.now(), pkg["days"])),
                                        rules.STATE_ACTIVE, "wallet", price)
            await self._notify_user(user["id"], "Kartu langganan aktif 🎉",
                                    f"{card['name']} aktif {rules.month_label(pkg['months'])} (sampai {rules.format_date(card['expiresAt'])}) — sisa saldo Rp{await self.balance(user['id']):,}".replace(",", "."))
            return {"card": self.card_view(card), "payment": None, "balance": await self.balance(user["id"])}
        if method != "transfer":
            raise HTTPException(400, "Metode pembayaran tidak dikenal.")
        card = await self._new_card(user, pkg, months, None, "PENDING_PAYMENT", "transfer", price)
        pay = await self.request_payment(user, price, PAY_CARD, months=months, card_id=card["id"], label=label)
        return {"card": self.card_view(card), "payment": pay, "balance": await self.balance(user["id"])}

    def card_name_hint(self, user):
        return "Kartu langganan baru"

    async def purchase(self, user, card_id, months, method="wallet", automatic=False):
        card = await self.card_or_404(user["id"], card_id)
        cfg = await self.config()
        pkg = await self.package_for(months, cfg)
        price = int(pkg["promoPrice"])
        label = f"{card['name']} — perpanjang {rules.month_label(pkg['months'])}"
        if method == "wallet":
            await self.debit(user["id"], price, "AUTORENEW" if automatic else "PURCHASE", note=f"{'Perpanjangan otomatis' if automatic else 'Perpanjang'} {card['name']} {rules.month_label(pkg['months'])}", ref_id=card_id)
            upd = rules.apply_purchase(card, pkg, self.now())
            upd["status"] = rules.STATE_ACTIVE
            upd["planPrice"] = price
            upd["method"] = "wallet"
            upd["remindedExpiryOffsets"] = []
            upd["renewRemindedAt"] = None
            await self.db.cards.update_one({"id": card_id}, {"$set": upd})
            fresh = await self.card_or_404(user["id"], card_id)
            await self._notify_user(user["id"], "Langganan ditambah ⏳",
                                    f"{card['name']} +{pkg['days']} hari — aktif sampai {rules.format_date(fresh['expiresAt'])}.")
            return {"card": self.card_view(fresh), "payment": None, "balance": await self.balance(user["id"])}
        if method != "transfer":
            raise HTTPException(400, "Metode pembayaran tidak dikenal.")
        pay = await self.request_payment(user, price, PAY_CARD, months=months, card_id=card_id, label=label)
        return {"card": self.card_view(card), "payment": pay, "balance": await self.balance(user["id"])}

    async def set_autorenew(self, user, card_id, enabled):
        card = await self.card_or_404(user["id"], card_id)
        if enabled and not card.get("websiteId"):
            raise HTTPException(400, "Auto-renew hanya untuk kartu yang sudah dipakai website.")
        await self.db.cards.update_one({"id": card_id}, {"$set": {
            "autoRenew": bool(enabled), "autoRenewPreference": bool(enabled),
            "renewalMonths": 1, "updatedAt": self.now()}})
        return {"card": self.card_view(await self.card_or_404(user["id"], card_id))}

    def gate_message(self, trial):
        """Pesan yang ditampilkan kalau website tidak bisa dibuat."""
        r = (trial or {}).get("reason")
        if r in ("nomor_sudah_trial", "akun_sudah_trial"):
            return TRIAL_USED_MSG
        if r == "wa_belum_verifikasi":
            return TRIAL_WA_MSG
        return NO_CARD_MSG

    async def quota_info(self, user):
        """Info kuota model kartu (halaman bikin website + dashboard)."""
        cfg = await self.config()
        if rules.is_unlimited(user, cfg):
            # akun bebas limit (website demo/showcase): tanpa batas produk & tanpa gate kartu
            used = await self.db.websites.count_documents({"userId": user["id"]})
            return {"used": used, "quota": None, "emptyCards": 0, "activeCards": 0, "totalCards": 0,
                    "cardToUse": None, "trialEligible": False, "trialReason": "unlimited",
                    "trialDays": int(cfg["trial"]["days"]), "productLimit": None,
                    "canCreate": True, "message": "", "unlimited": True}
        trial_days = int(cfg["trial"]["days"])
        max_products = int(cfg["trial"]["maxProducts"])
        cards = await self.db.cards.find({"userId": user["id"]}, {"_id": 0}).to_list(length=100)
        empty = [c for c in cards if not c.get("websiteId") and rules.card_state(c, self.now())["isActive"]]
        attached = [c for c in cards if c.get("websiteId")]
        trial = await self.trial_eligibility(user)
        nxt = empty[0] if empty else None
        used = await self.db.websites.count_documents({"userId": user["id"]})
        can = bool(nxt) or trial["eligible"]
        extra = 0 if empty else (1 if trial["eligible"] else 0)
        return {
            "used": used, "quota": used + len(empty) + extra,
            "emptyCards": len(empty), "activeCards": len(attached), "totalCards": len(cards),
            "cardToUse": self.card_view(nxt) if nxt else None,
            "trialEligible": trial["eligible"], "trialReason": trial["reason"], "trialDays": trial_days,
            "productLimit": (max_products if nxt is None else None),
            "canCreate": can, "message": "" if can else self.gate_message(trial),
        }

    async def site_public_state(self, site_id):
        """Status publik website (model kartu): beku atau tidak + badge kredit tampil atau tidak."""
        card = await self.db.cards.find_one({"websiteId": site_id}, {"_id": 0})
        if not card:
            return {"hasCard": False, "frozen": False, "showCredit": True, "isTrial": False, "daysRemaining": None}
        owner = await self.db.users.find_one({"id": card.get("userId")}, {"_id": 0, "role": 1, "unlimited": 1})
        if rules.is_unlimited(owner, await self.config()):
            # website demo/showcase (akun sistem): tidak pernah beku, tanpa badge Situska
            return {"hasCard": True, "frozen": False, "showCredit": False, "isTrial": False,
                    "daysRemaining": None, "expiresAt": card.get("expiresAt"), "lastActiveDate": None}
        cv = self.card_view(card)
        days = int(cv.get("daysRemaining") or 0)
        is_trial = bool(card.get("isTrialCard"))
        return {
            "hasCard": True,
            "frozen": days <= 0,
            "daysRemaining": days,
            "isTrial": is_trial,
            "expiresAt": card.get("expiresAt"),
            "lastActiveDate": cv.get("lastActiveDate"),
            "showCredit": is_trial,
        }

    async def trial_eligibility(self, user):
        """Hak masa gratis: 1x per akun DAN 1x per nomor WA terverifikasi."""
        if (user.get("role") or "").upper() == "ADMIN":
            return {"eligible": False, "reason": "admin"}
        if user.get("trialUsed") or user.get("trialCardId"):
            return {"eligible": False, "reason": "akun_sudah_trial"}
        phone = wa_service.normalize_number(user.get("whatsapp") or "")
        if not phone:
            return {"eligible": False, "reason": "wa_belum_verifikasi"}
        rec = await self.db.wa_verifications.find_one({"phone": phone, "verified": True}, {"_id": 0, "phone": 1})
        if not rec and not user.get("waVerified"):
            # verified saat daftar (flag di dokumen user) tetap dianggap sah
            return {"eligible": False, "reason": "wa_belum_verifikasi"}
        if await self.db.trial_phones.find_one({"phone": phone}, {"_id": 0, "phone": 1}):
            return {"eligible": False, "reason": "nomor_sudah_trial"}
        return {"eligible": True, "reason": "", "phone": phone}

    async def card_for_new_site(self, user, site_id):
        """Website baru otomatis dipasangkan kartu: kartu kosong dulu, kalau tidak ada pakai masa gratis."""
        card = await self.available_empty_card(user["id"])
        if card:
            await self.db.cards.update_one({"id": card["id"]}, {"$set": {
                "websiteId": site_id, "emptySince": None, "remindedEmptyOffsets": [], "updatedAt": self.now(), "autoRenew": card.get("autoRenewPreference", True), "renewalMonths": 1}})
            if site_id:
                await self.db.websites.update_one({"id": site_id}, {"$set": {"cardId": card["id"]}})
            fresh = await self.db.cards.find_one({"id": card["id"]}, {"_id": 0})
            return {"mode": "kartu", "isTrial": False, "card": self.card_view(fresh or card)}
        trial = await self.trial_eligibility(user)
        if trial["eligible"]:
            made = await self.create_trial_card(user, site_id)
            if made:
                fresh = await self.db.cards.find_one({"id": made["id"]}, {"_id": 0})
                return {"mode": "trial", "isTrial": True, "card": self.card_view(fresh or made)}
        return {"mode": "tidak_ada", "isTrial": False, "card": None, "message": self.gate_message(trial)}

    async def product_limit_for_site(self, user_id, site_id):
        """Masa gratis: maks N produk per website. Kartu berbayar / akun bebas limit: tanpa batas (None)."""
        cfg = await self.config()
        owner = await self.db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "unlimited": 1})
        if rules.is_unlimited(owner, cfg):
            return None
        card = await self.db.cards.find_one({"userId": user_id, "websiteId": site_id}, {"_id": 0, "isTrialCard": 1})
        if not card or not card.get("isTrialCard"):
            return None
        cfg = await self.config()
        return int(cfg["trial"]["maxProducts"])

    async def available_empty_card(self, user_id):
        """Kartu kosong (belum dipakai website) yang masih aktif."""
        cards = await self.db.cards.find({"userId": user_id, "websiteId": None}, {"_id": 0}).to_list(length=50)
        for c in cards:
            if rules.card_state(c, self.now())["isActive"]:
                return c
        return None

    async def attach(self, user, card_id, site_id):
        card = await self.card_or_404(user["id"], card_id)
        site = await self.db.websites.find_one({"id": site_id, "userId": user["id"]}, {"_id": 0, "id": 1, "businessName": 1, "cardId": 1})
        if not site:
            raise HTTPException(404, "Website tidak ditemukan.")
        if site.get("cardId") and site["cardId"] != card_id:
            raise HTTPException(400, "Website itu sudah memakai kartu lain.")
        other = await self.db.cards.find_one({"userId": user["id"], "websiteId": site_id, "id": {"$ne": card_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(400, "Website itu sudah terpasang di kartu lain.")
        await self.db.cards.update_one({"id": card_id}, {"$set": {"websiteId": site_id, "autoRenew": card.get("autoRenewPreference", True), "renewalMonths": 1, "updatedAt": self.now(),
                                                                  "emptySince": None, "remindedEmptyOffsets": []}})
        await self.db.websites.update_one({"id": site_id}, {"$set": {"cardId": card_id}})
        fresh = await self.card_or_404(user["id"], card_id)
        return {"card": self.card_view(fresh)}

    async def detach(self, user, card_id):
        card = await self.card_or_404(user["id"], card_id)
        site_id = card.get("websiteId")
        await self.db.cards.update_one({"id": card_id}, {"$set": {"websiteId": None, "autoRenew": False, "updatedAt": self.now(),
                                                                  "emptySince": self.now(), "remindedEmptyOffsets": []}})
        if site_id:
            await self.db.websites.update_one({"id": site_id}, {"$set": {"cardId": None}})
        fresh = await self.card_or_404(user["id"], card_id)
        return {"card": self.card_view(fresh)}

    # ------------------------------------------------- approve pembayaran
    async def _notify_user(self, user_id, title, message):
        if self._notify:
            await self._notify(user_id, title, message)