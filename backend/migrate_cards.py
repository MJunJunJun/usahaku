"""Migrasi kartu untuk website lama (model langganan per-website).

Website yang belum punya kartu tetap hidup (aturan lama) — skrip ini memasukkannya
ke model kartu dengan kartu internal gratis agar tidak mendadak beku.

Pemakaian (di dalam container backend):
  python migrate_cards.py                       # dry-run: tampilkan rencana
  python migrate_cards.py --apply               # pasang kartu 12 bulan (internal, harga 0)
  python migrate_cards.py --apply --months 6    # durasi lain
  python migrate_cards.py --apply --only-published
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/app")
import server as S  # noqa: E402


async def main(args):
    db = S.db
    used = {c.get("websiteId") for c in await db.cards.find({}, {"_id": 0, "websiteId": 1}).to_list(5000)
            if c.get("websiteId")}
    sites = await db.websites.find({}, {"_id": 0}).to_list(5000)
    plan = [s for s in sites if s["id"] not in used]
    if args.only_published:
        plan = [s for s in plan if s.get("status") == "PUBLISHED"]
    print(f"Website tanpa kartu: {len(plan)}")
    for s in plan:
        u = await db.users.find_one({"id": s.get("userId")}, {"_id": 0, "email": 1}) or {}
        print(f"  - {s.get('slug') or '(tanpa alamat)'} | {s.get('businessName')} | {s.get('status')} | {u.get('email') or s.get('userId')}")
    if not args.apply:
        print("\nDRY-RUN (belum ada perubahan). Tambahkan --apply untuk memasang kartu.")
        return
    months = int(args.months)
    pkg = await S.monetization.package_for(months)
    days = int(pkg.get("days") or months * 30)
    expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    ok = 0
    for s in plan:
        u = await db.users.find_one({"id": s.get("userId")}, {"_id": 0})
        if not u:
            print("  LEWAT (pemilik tidak ada):", s.get("slug"))
            continue
        card = await S.monetization._new_card(u, pkg, months, expires, "ACTIVE", "internal", 0)
        await db.cards.update_one({"id": card["id"]},
                                  {"$set": {"websiteId": s["id"], "isTrialCard": True, "autoRenew": False,
                                            "method": "internal", "note": "Migrasi kartu website lama"}})
        ok += 1
        print(f"  OK: {s.get('slug')} -> kartu {card.get('cardName') or card['id']} s/d {expires[:10]}")
    print(f"\nSELESAI: {ok} kartu dipasang.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="jalankan (default: dry-run)")
    ap.add_argument("--months", type=int, default=12, help="durasi kartu (bulan), default 12")
    ap.add_argument("--only-published", action="store_true", help="hanya website PUBLISHED")
    asyncio.run(main(ap.parse_args()))