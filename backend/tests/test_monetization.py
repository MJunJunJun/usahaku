"""Tes aturan monetisasi Situska (tanpa DB, tanpa dependensi).

Jalankan:  python3 backend/tests/test_monetization.py
(pytest juga bisa mengoleksi file ini: pytest backend/tests/test_monetization.py)
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import monetization as m  # noqa: E402

NOW = datetime(2026, 10, 5, 8, 30, tzinfo=timezone.utc)
PKG = m.DEFAULT_PACKAGES


def iso(dt):
    return dt.isoformat()


def card(days_left=None, expires=None, website="site-1", trial=False, autorenew=False, months=1, name="Kopi Senja"):
    exp = expires if expires is not None else (NOW + timedelta(days=days_left) if days_left is not None else None)
    return {
        "id": "card-1", "userId": "user-1", "name": name,
        "websiteId": website, "expiresAt": iso(exp) if exp else None,
        "isTrialCard": trial, "autoRenew": autorenew, "planMonths": months,
    }


# ------------------------------------------------------------------ harga
def test_package_table_matches_decision():
    table = [(p["months"], p["days"], p["normalPrice"], p["promoPrice"]) for p in PKG]
    assert table == [(1, 30, 100000, 50000), (3, 90, 300000, 135000),
                     (6, 180, 600000, 250000), (12, 360, 1200000, 450000)], table
    assert [m.saving_percent(p) for p in PKG] == [50.0, 55.0, 58.3, 62.5]
    assert [m.per_month(p) for p in PKG] == [50000, 45000, 41667, 37500]


def test_saving_label_framing():
    assert m.saving_label(PKG[1]) == "Hemat 55% · setara Rp45.000/bulan"
    assert m.saving_label(PKG[3]) == "Hemat 62,5% · setara Rp37.500/bulan"
    assert m.saving_label({"months": 1, "normalPrice": 0, "promoPrice": 0}) == ""


def test_min_purchase_30_days():
    assert m.package_is_purchasable(PKG[0]) is True
    assert m.package_is_purchasable({"months": 1, "days": 7, "promoPrice": 20000}) is False


# ------------------------------------------------------------------ waktu
def test_days_remaining_rounding():
    assert m.days_remaining(iso(NOW + timedelta(days=14)), NOW) == 14
    assert m.days_remaining(iso(NOW + timedelta(days=29, hours=12)), NOW) == 30   # dibulatkan ke atas
    assert m.days_remaining(iso(NOW + timedelta(hours=2)), NOW) == 1             # hari terakhir tetap "1 hari"
    assert m.days_remaining(iso(NOW - timedelta(hours=1)), NOW) == 0
    assert m.days_remaining(None, NOW) == 0


# ------------------------------------------------------------------ kartu
def test_card_states():
    aktif = m.card_state(card(days_left=23), NOW)
    assert (aktif["state"], aktif["daysRemaining"], aktif["autoDelete"], aktif["freezeWebsite"]) == ("ACTIVE", 23, False, False)

    trial = m.card_state(card(days_left=9, trial=True), NOW)
    assert trial["state"] == "TRIAL"

    kosong = m.card_state(card(days_left=74, website=None), NOW)
    assert (kosong["state"], kosong["hasWebsite"]) == ("EMPTY", False)

    beku = m.card_state(card(expires=NOW - timedelta(days=2)), NOW)
    assert (beku["state"], beku["freezeWebsite"], beku["autoDelete"]) == ("FROZEN", True, False)

    hapus = m.card_state(card(expires=NOW - timedelta(days=1), website=None), NOW)
    assert (hapus["state"], hapus["autoDelete"]) == ("EMPTY", True)


# ------------------------------------------------------------------ pembelian (nabung)
def test_purchase_stacks_not_resets():
    c = card(days_left=6)
    exp_before = m.parse_dt(c["expiresAt"])
    new_exp = m.purchase_extension(c, m.package_by_months(PKG, 1), NOW)
    assert new_exp == m.add_days(exp_before, 30)                          # 6 + 30 hari (nabung)
    assert new_exp.date() == (exp_before + timedelta(days=30)).date()     # batas 00:00
    assert m.days_remaining(new_exp, NOW) == 36


def test_apply_purchase_upgrades_trial():
    trial = card(days_left=6, trial=True)
    up = m.apply_purchase(trial, m.package_by_months(PKG, 1), NOW)
    assert up["isTrialCard"] is False and up["planMonths"] == 1 and up["daysTotal"] == 30
    assert m.card_state({**trial, **up}, NOW)["state"] == "ACTIVE"
    up2 = m.apply_purchase(card(days_left=6, trial=True, website=None), m.package_by_months(PKG, 1), NOW)
    assert up2["autoRenew"] is False                                       # kartu kosong: auto-renew OFF


def test_purchase_after_expiry_starts_now():
    expired = card(expires=NOW - timedelta(days=30))
    new_exp = m.purchase_extension(expired, m.package_by_months(PKG, 12), NOW)
    assert m.days_remaining(new_exp, NOW) == 360


def test_trial_can_be_extended_and_upgraded():
    trial = card(days_left=6, trial=True)
    new_exp = m.trial_extension(trial, m.DEFAULT_TRIAL["days"], NOW)
    assert m.days_remaining(new_exp, NOW) == 20                            # 6 + 14
    upgraded = m.card_state({**trial, "isTrialCard": False, "expiresAt": iso(new_exp)}, NOW)
    assert upgraded["state"] == "ACTIVE"


# ------------------------------------------------------------------ saldo
def test_topup_bonus_once_per_account():
    cfg = m.DEFAULT_TOPUP_BONUS
    assert m.topup_bonus_for(100000, cfg, False) == 50000
    assert m.topup_bonus_for(250000, cfg, False) == 50000
    assert m.topup_bonus_for(50000, cfg, False) == 0                      # di bawah minimum
    assert m.topup_bonus_for(100000, cfg, True) == 0                      # sudah pernah klaim
    assert m.topup_bonus_for(100000, {**cfg, "enabled": False}, False) == 0


def test_auto_renew_decisions():
    cukup = m.auto_renew_decision(card(days_left=2, autorenew=True, months=1), 75000, PKG, NOW)
    assert cukup["renew"] is True and cukup["price"] == 50000 and cukup["days"] == 30
    assert m.days_remaining(cukup["newExpiresAt"], NOW) == 32              # 2 + 30

    kurang = m.auto_renew_decision(card(days_left=2, autorenew=True), 20000, PKG, NOW)
    assert kurang["renew"] is False and kurang["reason"] == "insufficient_balance" and kurang["short"] == 30000

    assert m.auto_renew_decision(card(days_left=2, autorenew=False), 999999, PKG, NOW)["reason"] == "auto_renew_off"
    assert m.auto_renew_decision(card(days_left=2, autorenew=True, website=None), 999999, PKG, NOW)["reason"] == "card_empty"
    assert m.auto_renew_decision(card(days_left=10, autorenew=True), 999999, PKG, NOW)["reason"] == "not_due"

    tahunan = m.auto_renew_decision(card(days_left=1, autorenew=True, months=12), 500000, PKG, NOW)
    assert tahunan["renew"] is True and tahunan["price"] == 450000 and tahunan["days"] == 360


# ------------------------------------------------------------------ notifikasi
def test_empty_card_reminder_schedule():
    harus = {1, 3, 7, 14, 21, 28, 35, 42}
    tidak = {0, 2, 4, 5, 6, 8, 13, 20}
    assert {d for d in range(0, 43) if m.should_remind_empty_card(d)} == harus
    assert all(m.should_remind_empty_card(d) is False for d in tidak)


def test_empty_card_message_matches_spec():
    # NOW = 5 Okt 2026 08:30 -> +47 hari => expiresAt 21 Nov 00:00 => aktif terakhir 20 Nov
    c = {"name": "Kopi Senja", "expiresAt": iso(m.add_days(NOW, 47))}
    msg = m.empty_card_message(c, NOW)
    assert msg == ('Kartu "Kopi Senja" kosong tidak ada website yang sudah dibuat, '
                   'masa aktif 47 hari (sampai 20 November 2026), silakan buat website '
                   'agar kartu "Kopi Senja" bisa digunakan lebih bermanfaat.'), msg


def test_expiring_soon():
    assert m.is_expiring_soon(7) and m.is_expiring_soon(3) and m.is_expiring_soon(1)
    assert not m.is_expiring_soon(0) and not m.is_expiring_soon(5)


# ------------------------------------------------------------------ skenario nyata (validasi angka yang disepakati)
def test_scenario_from_prd():
    """Angka skenario yang disepakati — basis 30/90/180/360 hari, batas eksklusif 00:00."""
    # 5 Okt: langganan 1 bulan -> batas 4 Nov, aktif "sampai 3 Nov 2026"
    exp1 = m.purchase_extension({"expiresAt": None}, m.package_by_months(PKG, 1),
                                datetime(2026, 10, 5, tzinfo=timezone.utc))
    assert exp1 == datetime(2026, 11, 4, tzinfo=timezone.utc), exp1
    assert m.last_active_date(exp1).isoformat() == "2026-11-03"
    # 20 Okt: hapus Kopi Senja -> kartu kosong sisa 15 hari (20 Okt s/d 3 Nov)
    assert m.days_remaining(exp1, datetime(2026, 10, 20, tzinfo=timezone.utc)) == 15

    # 10 Okt: langganan 3 bulan -> batas 8 Jan 2027, aktif "sampai 7 Jan 2027"
    exp2 = m.purchase_extension({"expiresAt": None}, m.package_by_months(PKG, 3),
                                datetime(2026, 10, 10, tzinfo=timezone.utc))
    assert exp2 == datetime(2027, 1, 8, tzinfo=timezone.utc), exp2
    assert m.last_active_date(exp2).isoformat() == "2027-01-07"
    # 25 Okt: hapus Kopi Kenangan -> kartu kosong sisa 75 hari (25 Okt s/d 7 Jan)
    assert m.days_remaining(exp2, datetime(2026, 10, 25, tzinfo=timezone.utc)) == 75

    # NABUNG: kartu sisa 15 hari (batas 4 Nov) + beli 30 hari -> batas 4 Des (aktif s/d 3 Des)
    exp3 = m.purchase_extension({"expiresAt": iso(exp1)}, m.package_by_months(PKG, 1),
                                datetime(2026, 10, 20, tzinfo=timezone.utc))
    assert m.last_active_date(exp3).isoformat() == "2026-12-03", m.last_active_date(exp3)


def run_all():
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except AssertionError as exc:
            failed.append(name)
            print(f"  FAIL  {name} :: {exc}")
    print(f"\n{len(tests) - len(failed)}/{len(tests)} tes lulus")
    return 1 if failed else 0


if __name__ == "__main__":
    print("=== TES LOGIKA MONETISASI SITUSKA ===\n")
    sys.exit(run_all())