"""Job harian monetisasi (Fase 3): beku/aktifkan website, reminder H-7/H-3/H-1,
auto-renew dari saldo, reminder kartu kosong (H+1/H+3/+7), hapus kartu kosong.

Aman: HANYA menyentuh website yang punya kartu (`websiteId` terisi) — situs
lama tanpa kartu tidak diapa-apakan. Pemisah "|" pada teks = baris baru.
"""
import monetization as rules

DEFAULTS = {
    "expiring7": "Halo {nama} 👋|Masa aktif *{nama_usaha}* berakhir {tanggal} (sekitar 7 hari lagi). Perpanjang: {link}",
    "expiring3": "Halo {nama} ⏳|Masa aktif *{nama_usaha}* tinggal {hari} hari (sampai {tanggal}). Perpanjang: {link}",
    "expiring1": "Halo {nama} ⚠️|Besok ({tanggal}) masa aktif *{nama_usaha}* berakhir.|Perpanjang: {link}",
    "expired": "Halo {nama} 🙏|Masa aktif *{nama_usaha}* sudah berakhir ({tanggal}). Website dibekukan sementara, data tetap aman.|Perpanjang: {link}",
    "empty": 'Kartu "{nama_kartu}" kosong tidak ada website yang sudah dibuat, masa aktif {hari} hari (sampai {tanggal}), silakan buat website agar kartu ini bisa digunakan lebih bermanfaat.',
    "renew_ok": "Auto-renew berhasil ✅|Kartu *{nama}* diperpanjang {bulan} ({hari} hari).|Saldo terpotong Rp{harga}, sisa Rp{saldo}.",
    "renew_fail": "Auto-renew gagal ⚠️|Saldo Rp{saldo} kurang dari Rp{harga}.|Top up agar *{nama_usaha}* tidak dibekukan.",
    "deleted": "Kartu *{nama}* dihapus karena kosong & masa aktifnya sudah habis ({tanggal}).",
    "no_site": "Halo {nama} 👋|Website gratis Situska (masa gratis {hari} hari) belum kamu pakai.|Yuk bikin website usaha kamu sekarang — cukup isi nama usaha, tanpa perlu bayar.|Bikin sekarang: {link}",
}

# pengingat akun yang sudah daftar tapi belum bikin website
NO_SITE_OFFSETS = (1, 3, 7)
NO_SITE_WINDOW = 8

MATCH = [("expiring1", ("besok", "h-1")), ("expiring3", ("3 hari",)),
         ("expiring7", ("7 hari",)), ("expired", ("kedaluwarsa",)),
         ("renew_fail", ("saldo kurang",)), ("renew_ok", ("perpanjangan otomatis",)),
         ("deleted", ("kartu dihapus",)), ("no_site", ("belum bikin website", "website gratis"))]

# template dari DB dipetakan lewat id supaya teksnya bisa diedit admin
BY_ID = {"tpl-21": "empty", "tpl-22": "renew_ok", "tpl-23": "renew_fail", "tpl-24": "deleted", "tpl-25": "no_site"}


class MonetizationJobs:
    def __init__(self, db, svc, notify=None, wa=None, log=None, now_fn=None):
        self.db = db
        self.svc = svc
        self._notify = notify
        self._wa = wa
        self._log = log
        self._now = now_fn

    def now(self):
        return self._now() if self._now else rules.iso(rules.utcnow())

    async def _templates(self):
        st = await self.db.settings.find_one({"id": "platform"}, {"_id": 0}) or {}
        out = dict(DEFAULTS)
        for t in (st.get("waMessageTemplates") or []):
            if t.get("body") and BY_ID.get(t.get("id")):
                out[BY_ID[t["id"]]] = t["body"]
        for t in (st.get("waMessageTemplates") or []):
            title = (t.get("title") or "").lower()
            if "kosong" in title and "dihapus" not in title:
                out["empty"] = t.get("body") or out["empty"]
            for purpose, keys in MATCH:
                if any(k in title for k in keys):
                    out[purpose] = t.get("body") or out[purpose]
                    break
        return out

    def _render(self, tpls, purpose, ctx):
        text = tpls.get(purpose) or DEFAULTS.get(purpose, "")
        for k, v in (ctx or {}).items():
            text = text.replace("{" + k + "}", "" if v is None else str(v))
        return text.replace("|", chr(10))

    async def _send(self, user, purpose, ctx, tpls, ref_id, dry=False, title="Kartu langganan"):
        """Kirim WA + notifikasi in-app. Saat dry-run tidak ada yang dikirim."""
        text = self._render(tpls, purpose, ctx)
        if dry:
            return {"purpose": purpose, "ref": ref_id, "skipped": "dry_run"}
        phone = (user or {}).get("whatsapp") or (user or {}).get("phone") or ""
        sent = False
        if phone and self._wa:
            try:
                await self._wa(phone, text, event="card_" + purpose, ref_id=ref_id)
                sent = True
            except Exception:
                sent = False
        if self._notify and (user or {}).get("id"):
            try:
                await self._notify(user["id"], title, text.replace("*", ""))
            except Exception:
                pass
        return {"purpose": purpose, "ref": ref_id, "whatsapp": sent, "phoneSet": bool(phone)}

    async def _user(self, uid):
        return await self.db.users.find_one({"id": uid}, {"_id": 0}) or {}

    def _context(self, card, user, site=None, extra=None):
        ctx = {
            "nama": (user or {}).get("name", ""),
            "nama_kartu": card.get("name", ""),
            "nama_usaha": (site or {}).get("businessName") or card.get("name", ""),
            "link": "https://situska.com/dashboard",
            "tanggal": rules.format_date(card.get("expiresAt")),
            "hari": rules.days_remaining(card.get("expiresAt"), self.now()),
            "bulan": rules.month_label(card.get("planMonths") or 1),
            "harga": rules.rupiah(card.get("planPrice") or 0),
            "saldo": rules.rupiah((user or {}).get("walletBalance") or 0),
            "paket": rules.month_label(card.get("planMonths") or 1),
        }
        ctx.update(extra or {})
        return ctx

    async def _sync_websites(self, cards, tpls, dry, actions):
        """Bekukan website yang kartunya habis (frozenAt), aktifkan lagi bila kartu aktif.
        Field `frozenAt` dipakai terpisah dari `status` supaya tampilan publik tidak rusak."""
        for card in cards:
            sid = card.get("websiteId")
            if not sid:
                continue
            site = await self.db.websites.find_one({"id": sid}, {"_id": 0})
            if not site:
                continue
            st = rules.card_state(card, self.now())
            frozen = bool(site.get("frozenAt"))
            if st["freezeWebsite"] and not frozen:
                if not dry:
                    await self.db.websites.update_one({"id": sid}, {"$set": {"frozenAt": self.now(), "frozenByCard": card["id"]}})
                actions.append({"act": "freeze_site", "card": card["id"], "site": sid})
                user = await self._user(card["userId"])
                await self._send(user, "expired", self._context(card, user, site), tpls, card["id"], dry)
            elif st["isActive"] and frozen:
                if not dry:
                    await self.db.websites.update_one({"id": sid}, {"$unset": {"frozenAt": "", "frozenByCard": ""}})
                actions.append({"act": "unfreeze_site", "card": card["id"], "site": sid})

    async def _remind_expiry(self, cards, tpls, dry, actions):
        """Reminder H-7/H-3/H-1 sekali per offset (dilewati bila auto-renew ON & saldo cukup)."""
        for card in cards:
            st = rules.card_state(card, self.now())
            d = st["daysRemaining"]
            if not st["isActive"] or d not in (7, 3, 1):
                continue
            done = list(card.get("remindedExpiryOffsets") or [])
            if d in done:
                continue
            user = await self._user(card["userId"])
            if d in (7, 3) and card.get("autoRenew") and rules.can_afford(user.get("walletBalance") or 0, card.get("planPrice") or 0):
                continue
            purpose = {7: "expiring7", 3: "expiring3", 1: "expiring1"}[d]
            if not dry:
                await self.db.cards.update_one({"id": card["id"]}, {"$addToSet": {"remindedExpiryOffsets": d}})
            actions.append({"act": "remind_" + purpose, "card": card["id"], "days": d})
            await self._send(user, purpose, self._context(card, user), tpls, card["id"], dry)

    async def _remind_empty(self, cards, tpls, dry, actions):
        """Kartu kosong (tanpa website): H+1, H+3, H+7, lalu kelipatan +7."""
        for card in cards:
            if card.get("websiteId"):
                continue
            st = rules.card_state(card, self.now())
            if not st["isActive"]:
                continue  # masa aktif habis -> ditangani penghapusan kartu kosong
            base = rules.parse_dt(card.get("emptySince") or card.get("updatedAt") or card.get("createdAt"))
            if not base:
                continue
            days = int((rules.parse_dt(self.now()) - base).total_seconds() // 86400)
            if not rules.should_remind_empty_card(days):
                continue
            if days in list(card.get("remindedEmptyOffsets") or []):
                continue
            user = await self._user(card["userId"])
            if not dry:
                await self.db.cards.update_one({"id": card["id"]}, {"$addToSet": {"remindedEmptyOffsets": days}})
            actions.append({"act": "remind_empty", "card": card["id"], "days": days})
            await self._send(user, "empty", self._context(card, user), tpls, card["id"], dry)

    async def _auto_renew(self, cards, cfg, tpls, dry, actions):
        """Auto-renew: kartu berisi website, autoRenew ON, masuk jendela H-3..H."""
        pkgs = cfg.get("packages") or []
        for card in cards:
            user = await self._user(card["userId"])
            dec = rules.auto_renew_decision(card, user.get("walletBalance") or 0, pkgs, self.now())
            if dec.get("reason") == "insufficient_balance":
                if card.get("renewRemindedAt"):
                    continue
                if not dry:
                    await self.db.cards.update_one({"id": card["id"]}, {"$set": {"renewRemindedAt": self.now()}})
                actions.append({"act": "renew_insufficient", "card": card["id"], "short": dec.get("short")})
                await self._send(user, "renew_fail", self._context(card, user, extra={
                    "harga": rules.rupiah(dec.get("price")), "saldo": rules.rupiah(user.get("walletBalance") or 0)}),
                    tpls, card["id"], dry)
                continue
            if not dec.get("renew"):
                continue
            if dry:
                actions.append({"act": "renew_dry_run", "card": card["id"], "months": dec.get("months")})
                continue
            result = await self.svc.purchase(user, card["id"], dec.get("months") or 1, "wallet")
            actions.append({"act": "renew_ok", "card": card["id"], "months": dec.get("months"),
                            "price": dec.get("price")})
            u2 = await self._user(card["userId"])
            fresh = await self.db.cards.find_one({"id": card["id"]}, {"_id": 0}) or card
            await self._send(u2, "renew_ok", self._context(fresh, u2, extra={
                "harga": rules.rupiah(dec.get("price")), "saldo": rules.rupiah(u2.get("walletBalance") or 0)}),
                tpls, card["id"], dry)

    async def _delete_empty(self, cards, tpls, dry, actions):
        """Kartu kosong & masa aktif habis (sesuai aturan) → hapus kartu."""
        for card in cards:
            if card.get("websiteId"):
                continue
            st = rules.card_state(card, self.now())
            if not st.get("autoDelete"):
                continue
            user = await self._user(card["userId"])
            if not dry:
                await self.db.cards.delete_one({"id": card["id"]})
            actions.append({"act": "delete_empty_card", "card": card["id"]})
            await self._send(user, "deleted", self._context(card, user), tpls, card["id"], dry)

    async def _remind_no_website(self, users, tpls, cfg, dry, actions):
        """Ingatkan akun yang sudah daftar tapi belum bikin website (H+1, H+3, H+7)."""
        now = rules.parse_dt(self.now())
        trial_days = int((cfg.get("trial") or {}).get("days") or 14)
        link = (cfg.get("siteUrl") or "https://situska.com").rstrip("/") + "/dashboard"
        for u in users:
            created = rules.parse_dt(u.get("createdAt"))
            if not created:
                continue
            age = (now - created).days
            if age < NO_SITE_OFFSETS[0] or age > NO_SITE_WINDOW:
                continue
            if u.get("trialUsed"):
                continue
            if await self.db.websites.count_documents({"userId": u["id"]}):
                continue
            done = set(u.get("remindedNoSiteOffsets") or [])
            due = [o for o in NO_SITE_OFFSETS if age >= o and o not in done]
            if not due:
                continue
            actions.append({"act": "remind_no_site", "userId": u["id"], "offset": max(due)})
            if dry:
                continue
            ctx = {"nama": (u.get("name") or "Sobat Situska").split(" ")[0], "hari": trial_days, "link": link}
            await self._send(u, "no_site", ctx, tpls, u["id"], title="Website gratis menanti")
            await self.db.users.update_one({"id": u["id"]}, {"$set": {"remindedNoSiteOffsets": sorted(done | set(due))}})

    async def run(self, dry_run=False):
        """Jalankan semua job harian. Return laporan ringkas (dry_run = tidak mengubah apa pun)."""
        started = self.now()
        cfg = await self.svc.config()
        tpls = await self._templates()
        actions = []
        cards = await self.db.cards.find({}, {"_id": 0}).to_list(length=10000)
        await self._sync_websites(cards, tpls, dry_run, actions)
        await self._remind_expiry(cards, tpls, dry_run, actions)
        await self._remind_empty(cards, tpls, dry_run, actions)
        await self._auto_renew(cards, cfg, tpls, dry_run, actions)
        await self._delete_empty(cards, tpls, dry_run, actions)
        users = await self.db.users.find({"role": {"$ne": "ADMIN"}}, {"_id": 0}).to_list(length=2000)
        await self._remind_no_website(users, tpls, cfg, dry_run, actions)
        summary = {}
        for a in actions:
            summary[a["act"]] = summary.get(a["act"], 0) + 1
        report = {"id": self.svc.uid(), "ranAt": started, "finishedAt": self.now(),
                  "dryRun": bool(dry_run), "cardsChecked": len(cards),
                  "enabled": bool(cfg.get("enabled")), "summary": summary, "actions": actions[:200]}
        if not dry_run:
            try:
                await self.db.monetization_jobs.insert_one(dict(report))
            except Exception:
                pass
        return report

    async def history(self, limit=10):
        cur = self.db.monetization_jobs.find({}, {"_id": 0}).sort("ranAt", -1).limit(int(limit))
        return await cur.to_list(length=int(limit))