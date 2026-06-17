#!/usr/bin/env python3
"""
家庭收支表 - 財政部發票同步腳本（GitHub Actions 版）
使用 Supabase Service Role Key，不需要帳號密碼

使用方式：
  python sync_invoices.py            # 同步本月
  python sync_invoices.py 2026 5    # 同步指定年月
"""

import os
import sys
import uuid
import time
import requests
from datetime import datetime


# ── 設定：優先從環境變數讀取（GitHub Actions Secrets）──
SUPABASE_URL          = os.getenv("SUPABASE_URL", "https://yacrqvbgjuixarajcvtg.supabase.co")
SUPABASE_SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY", "")
USER_ID               = os.getenv("SUPABASE_USER_ID", "0abb13f1-8be9-4452-a14c-f0da89a4b729")
CARRIER_BARCODE       = os.getenv("CARRIER_BARCODE", "")
CARRIER_VERIFICATION  = os.getenv("CARRIER_VERIFICATION", "")
# ────────────────────────────────────────────────────────


def roc_year_month(year: int, month: int) -> str:
    return f"{year - 1911}{month:02d}"


def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_carrier_settings() -> tuple[str, str]:
    """從 Supabase 讀取手機條碼與驗證碼（若環境變數未設定）"""
    if CARRIER_BARCODE and CARRIER_VERIFICATION:
        return CARRIER_BARCODE, CARRIER_VERIFICATION

    print("🔄 從 Supabase 讀取載具設定...")
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/budget_settings?user_id=eq.{USER_ID}&select=carrier_barcode,carrier_verification",
        headers=supabase_headers(),
        timeout=10,
    )
    if res.status_code != 200 or not res.json():
        print(f"❌ 無法讀取載具設定：{res.text}")
        sys.exit(1)
    row = res.json()[0]
    barcode = row.get("carrier_barcode", "")
    verification = row.get("carrier_verification", "")
    if not barcode or not verification:
        print("❌ Supabase 中尚未設定手機條碼或驗證碼，請先在網站設定頁填入")
        sys.exit(1)
    print(f"✅ 載具設定讀取成功（{barcode}）")
    return barcode, verification


def fetch_invoices(barcode: str, verification: str, inv_term: str) -> list[dict]:
    """呼叫財政部 API"""
    params = {
        "action": "qryCarrierInv",
        "version": "0.5",
        "cardType": "3J0002",
        "cardNo": barcode,
        "expTimeStamp": "2147483647",
        "timeStamp": str(int(time.time())),
        "uuid": str(uuid.uuid4()).replace("-", "")[:20],
        "appID": "EINV202112131736OOOOO",
        "cardEncrypt": verification,
        "invTerm": inv_term,
    }

    print(f"🔄 呼叫財政部 API（期別 {inv_term}）...")
    res = requests.post(
        "https://einvoice.nat.gov.tw/PB2CAPIVAN/invapp/InvApp",
        data=params,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )

    if res.text.strip().startswith("<"):
        print("❌ 財政部 API 回傳 HTML（IP 被封鎖或 appID 無效）")
        print(f"   回應前 300 字：{res.text[:300]}")
        sys.exit(1)

    try:
        data = res.json()
    except Exception:
        print(f"❌ 無法解析回應：{res.text[:300]}")
        sys.exit(1)

    code = data.get("code")
    if code != "200":
        print(f"❌ API 錯誤 code={code}：{data.get('msg')}")
        sys.exit(1)

    details = data.get("details") or []
    print(f"✅ 財政部回傳 {len(details)} 筆發票")
    return details


def upsert_invoices(details: list[dict], year_month: str):
    """將發票寫入 Supabase"""
    rows = [
        {
            "user_id": USER_ID,
            "invoice_number": inv.get("invNum", ""),
            "seller_name": inv.get("sellerName") or "未知商家",
            "amount": int(inv.get("amount", 0)),
            "invoice_date": inv.get("invDate", ""),
            "year_month": year_month,
        }
        for inv in details
    ]

    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/invoices?on_conflict=user_id,invoice_number",
        headers={**supabase_headers(), "Prefer": "resolution=merge-duplicates"},
        json=rows,
        timeout=15,
    )

    if res.status_code in (200, 201):
        print(f"✅ 成功寫入 {len(rows)} 筆發票（{year_month}）")
    else:
        print(f"❌ Supabase 寫入失敗：{res.status_code} {res.text}")
        sys.exit(1)


def main():
    if not SUPABASE_SERVICE_KEY:
        print("❌ 請設定環境變數 SUPABASE_SERVICE_KEY")
        sys.exit(1)

    now = datetime.now()
    year  = int(sys.argv[1]) if len(sys.argv) > 1 else now.year
    month = int(sys.argv[2]) if len(sys.argv) > 2 else now.month

    barcode, verification = fetch_carrier_settings()

    inv_term = roc_year_month(year, month)
    year_month = f"{year}-{month:02d}"

    details = fetch_invoices(barcode, verification, inv_term)

    if not details:
        print("本期無發票資料")
        return

    upsert_invoices(details, year_month)


if __name__ == "__main__":
    main()
