"""
fetch_prices.py — 每日收盤後透過 Shioaji 抓收盤價，寫進 Supabase。

跑在你本機或公司機（不是 Vercel）。憑證與 API key 只存這台，永不上雲。

用法：
    python fetch_prices.py              # 自動抓 holdings 裡所有 letf/normal symbol
    python fetch_prices.py 00631L 0050  # 只抓指定 symbol

排程（擇一）：
    Windows 工作排程器：每個交易日 14:35 執行此腳本
    Linux cron:   35 14 * * 1-5  cd /path && /path/venv/bin/python fetch_prices.py
"""

import os
import sys
import logging
from datetime import date

import shioaji as sj
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("fetch_prices")

SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]   # service role 可繞過 RLS
API_KEY       = os.environ["SHIOAJI_API_KEY"]
SECRET_KEY    = os.environ["SHIOAJI_SECRET_KEY"]
CA_PATH       = os.environ.get("SHIOAJI_CA_PATH")         # .pfx 憑證路徑
CA_PASSWD     = os.environ.get("SHIOAJI_CA_PASSWD")
PERSON_ID     = os.environ.get("SHIOAJI_PERSON_ID")


def get_symbols(sb: Client) -> list[str]:
    """從 Supabase holdings 表取出所有需要抓價的 symbol（letf / normal）。"""
    result = sb.table("holdings").select("symbol").in_("kind", ["letf", "normal"]).execute()
    return list({r["symbol"] for r in result.data})


def login() -> sj.Shioaji:
    api = sj.Shioaji()
    api.login(api_key=API_KEY, secret_key=SECRET_KEY)
    if CA_PATH:
        api.activate_ca(ca_path=CA_PATH, ca_passwd=CA_PASSWD, person_id=PERSON_ID)
    return api


def fetch_close(api: sj.Shioaji, symbol: str) -> float | None:
    """用 snapshots 取當日最新成交/收盤價。"""
    contract = api.Contracts.Stocks.get(symbol)
    if not contract:
        log.warning("找不到合約：%s（確認股號是否正確）", symbol)
        return None
    snaps = api.snapshots([contract])
    return float(snaps[0].close) if snaps else None


def upsert_price(sb: Client, symbol: str, trade_date: str, close: float) -> None:
    sb.table("daily_prices").upsert(
        {"symbol": symbol, "trade_date": trade_date, "close": close, "source": "shioaji"},
        on_conflict="symbol,trade_date",
    ).execute()


def main() -> None:
    sb      = create_client(SUPABASE_URL, SUPABASE_KEY)
    symbols = sys.argv[1:] or get_symbols(sb)

    if not symbols:
        log.info("沒有要抓的 symbol，先在 web /strategy 頁面新增持股。")
        return

    log.info("準備抓 %d 檔收盤價：%s", len(symbols), ", ".join(symbols))
    api   = login()
    today = date.today().isoformat()
    ok    = 0

    for sym in symbols:
        try:
            close = fetch_close(api, sym)
            if close:
                upsert_price(sb, sym, today, close)
                log.info("✓ %s  %s  收盤 %.2f", sym, today, close)
                ok += 1
            else:
                log.warning("✗ %s 無收盤資料", sym)
        except Exception as e:
            log.error("✗ %s 失敗：%s", sym, e)

    log.info("完成，%d / %d 檔成功", ok, len(symbols))
    api.logout()


if __name__ == "__main__":
    main()
