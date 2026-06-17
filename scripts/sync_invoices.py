#!/usr/bin/env python3
"""
家庭收支表 - 財政部發票本機同步腳本
在本機（台灣 IP）執行，繞過 Vercel 海外 IP 問題

使用方式：
  python sync_invoices.py            # 同步本月
  python sync_invoices.py 2026 5    # 同步指定年月
"""

import sys
import uuid
import time
import json
import requests
from datetime import datetime
from pathlib import Path


# ── 設定：優先從環境變數讀取（GitHub Actions），否則直接改這裡 ──
import os

SUPABASE_URL          = os.getenv("SUPABASE_URL", "https://yacrqvbgjuixarajcvtg.supabase.co")
SUPABASE_ANON_KEY     = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhY3JxdmJnanVpeGFyYWpjdnRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTE0MDIsImV4cCI6MjA5NjI4NzQwMn0.OwVGt1DuWSi9WK9vIpogMVhCk_kWtbqdnIhMKHknq2o")
USER_EMAIL            = os.getenv("SUPABASE_USER_EMAIL", "camille5534@gmail.com")
USER_PASSWORD         = os.getenv("SUPABASE_USER_PASSWORD", "")   # ← 本機執行時填這裡
CARRIER_BARCODE       = os.getenv("CARRIER_BARCODE", "")          # ← 手機條碼
CARRIER_VERIFICATION  = os.getenv("CARRIER_VERIFICATION", "")     # ← 驗證碼
# ────────────────────────────────────────────────────────


def roc_year_month(year: int, month: int) -> str:
    return f"{year - 1911}{month:02d}"


def supabase_headers(token: str) -> dict:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def login() -> tuple[str, str]:
    """Supabase 登入，回傳 (access_token, user_id)"""
    res = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": USER_EMAIL, "password": USER_PASSWORD},
        timeout=10,
    )
    if res.status_code != 200:
        print(f"❌ Supabase 登入失敗：{res.text}")
        sys.exit(1)
    data = res.json()
    print(f"✅ Supabase 登入成功（{USER_EMAIL}）")
    return data["access_token"], data["user"]["id"]


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
        print("❌ 財政部 API 回傳 HTML")
        print("   可能原因：appID 無效。請告知開發者查詢正確 appID。")
        print(f"   回應前 200 字：{res.text[:200]}")
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


def upsert_invoices(token: str, user_id: str, details: list[dict], year_month: str):
    """將發票寫入 Supabase"""
    rows = [
        {
            "user_id": user_id,
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
        headers={**supabase_headers(token), "Prefer": "resolution=merge-duplicates"},
        json=rows,
        timeout=15,
    )

    if res.status_code in (200, 201):
        print(f"✅ 成功寫入 {len(rows)} 筆發票（{year_month}）")
    else:
        print(f"❌ Supabase 寫入失敗：{res.status_code} {res.text}")


def main():
    now = datetime.now()
    year  = int(sys.argv[1]) if len(sys.argv) > 1 else now.year
    month = int(sys.argv[2]) if len(sys.argv) > 2 else now.month

    if not USER_PASSWORD or not CARRIER_BARCODE or not CARRIER_VERIFICATION:
        print("❌ 請先在腳本頂端填入 USER_PASSWORD、CARRIER_BARCODE、CARRIER_VERIFICATION")
        sys.exit(1)

    token, user_id = login()
    inv_term = roc_year_month(year, month)
    year_month = f"{year}-{month:02d}"

    details = fetch_invoices(CARRIER_BARCODE, CARRIER_VERIFICATION, inv_term)

    if not details:
        print("本月無發票資料")
        return

    upsert_invoices(token, user_id, details, year_month)


if __name__ == "__main__":
    main()
