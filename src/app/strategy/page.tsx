'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ExposureChart from '@/components/ExposureChart'
import HoldingsTable from '@/components/HoldingsTable'
import { computeStrategy, fmtNTD, type HoldingRow, type StrategyResult } from '@/lib/strategy'

type Snapshot = {
  id: string
  snap_date: string
  pool_total: number
  letf_pct: number
  exposure: number
  target_pct: number
}

export default function StrategyPage() {
  const router = useRouter()
  const [holdings,  setHoldings]  = useState<HoldingRow[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [target,    setTarget]    = useState(50)
  const [band,      setBand]      = useState(5)
  const [loading,   setLoading]   = useState(true)
  const [snapping,  setSnapping]  = useState(false)

  const loadHoldings = useCallback(async () => {
    const r = await fetch(`/api/holdings?target=${target}&band=${band}`)
    const d = await r.json()
    setHoldings(d.holdings ?? [])
  }, [target, band])

  const loadSnapshots = useCallback(async () => {
    const r = await fetch('/api/snapshot')
    const d = await r.json()
    setSnapshots(Array.isArray(d) ? d : [])
  }, [])

  const init = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    await Promise.all([loadHoldings(), loadSnapshots()])
    setLoading(false)
  }, [router, loadHoldings, loadSnapshots])

  useEffect(() => { init() }, [init])

  // 目標/容許帶改變時重新計算
  useEffect(() => {
    if (!loading) loadHoldings()
  }, [target, band, loading, loadHoldings])

  async function handleSnapshot() {
    setSnapping(true)
    await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_pct: target }),
    })
    await loadSnapshots()
    setSnapping(false)
  }

  async function handleDeleteSnapshot(id: string) {
    await fetch('/api/snapshot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadSnapshots()
  }

  async function handleAddHolding(h: Omit<HoldingRow, 'id' | 'close'>) {
    await fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(h),
    })
    loadHoldings()
  }

  async function handleDeleteHolding(id: string) {
    await fetch('/api/holdings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadHoldings()
  }

  async function handlePriceUpdate(symbol: string, close: number) {
    await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, close }),
    })
    loadHoldings()
  }

  // 用最新持股 + 目標即時重算（不等 API roundtrip）
  const cashAmounts: number[] = [] // balance_items is_cash 由後端計入，前端直接用 strategy from API
  // 這裡直接從持股重算，讓目標滑桿即時有反應
  const strategy: StrategyResult = (() => {
    // 從已抓到的 holdings 即時算
    const { data: cashRows } = { data: [] as { amount: number }[] }
    return computeStrategy(holdings, cashAmounts, target, band)
  })()

  const bannerCls =
    strategy.status === 'ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    strategy.status === 'sell' ? 'bg-amber-50  border-amber-200  text-amber-700'  :
                                  'bg-blue-50   border-blue-200   text-blue-700'
  const bannerText =
    strategy.status === 'ok'
      ? `✓ 平衡中　正二 ${strategy.letfPct.toFixed(1)}% / 現金 ${strategy.cashPct.toFixed(1)}%，在 ±${band}% 內，不需動作。`
    : strategy.status === 'sell'
      ? `⚠ 再平衡：正二佔 ${strategy.letfPct.toFixed(1)}%（超標 ${strategy.drift.toFixed(1)}pp）。賣出約 ${fmtNTD(Math.abs(strategy.adjust))} 即回到 ${target}/${100 - target}。`
      : `⚠ 再平衡：正二僅 ${strategy.letfPct.toFixed(1)}%（低於目標 ${Math.abs(strategy.drift).toFixed(1)}pp）。買進約 ${fmtNTD(Math.abs(strategy.adjust))} 即回到 ${target}/${100 - target}。`

  if (loading) return <p className="text-center text-gray-400 py-20">載入中...</p>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">策略監控</h1>

      {/* 策略卡 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">50/50 策略監控</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">目標</span>
              <Input
                type="number" value={target} min={0} max={100}
                className="w-16 h-7 text-sm px-2"
                onChange={e => setTarget(Number(e.target.value))}
              />
              <span className="text-gray-500">%　±</span>
              <Input
                type="number" value={band} min={1} max={30}
                className="w-14 h-7 text-sm px-2"
                onChange={e => setBand(Number(e.target.value))}
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 狀態橫幅 */}
          <div className={`rounded-md border px-4 py-2.5 text-sm ${bannerCls}`}>
            {bannerText}
          </div>

          {/* 配置橫條 */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-16 shrink-0">正二部位</span>
              <div className="flex-1 relative h-4 bg-gray-100 rounded-full overflow-visible">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(strategy.letfPct, 100)}%` }}
                />
                {/* 目標標線 */}
                <div
                  className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-gray-700 rounded"
                  style={{ left: `${target}%` }}
                />
              </div>
              <span className="text-sm font-semibold w-14 text-right tabular-nums">
                {strategy.letfPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-16 shrink-0">現金部位</span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(strategy.cashPct, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold w-14 text-right tabular-nums">
                {strategy.cashPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 數據列 */}
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">
              策略池　<span className="font-semibold text-gray-800">{fmtNTD(strategy.poolTotal)}</span>
            </span>
            <span className="text-gray-500">
              真實曝險
              <span className={`font-semibold ${strategy.exposure > 110 ? 'text-red-500' : 'text-gray-800'}`}>
                {strategy.exposure.toFixed(0)}%
              </span>
              <span className="text-xs text-gray-400 ml-1">（正二×2÷池）</span>
            </span>
          </div>

          <Button
            className="w-full"
            onClick={handleSnapshot}
            disabled={snapping || strategy.poolTotal === 0}
          >
            {snapping ? '記錄中...' : '＋ 記錄今日快照'}
          </Button>

          <p className="text-xs text-gray-400">
            目標標線（黑色垂直線）= 你設定的目標比例。每日快照累積後，下方走勢圖會顯示曝險歷史。
          </p>
        </CardContent>
      </Card>

      {/* 曝險走勢圖 */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">曝險走勢</CardTitle>
          {snapshots.length > 0 && (
            <span className="text-xs text-gray-400">{snapshots.length} 筆快照</span>
          )}
        </CardHeader>
        <CardContent>
          <ExposureChart snaps={snapshots} />
          {snapshots.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <details className="text-xs">
                <summary className="text-gray-400 cursor-pointer hover:text-gray-600">快照歷史（點擊展開）</summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {[...snapshots].reverse().map(s => (
                    <div key={s.id} className="flex items-center justify-between text-gray-500 hover:bg-gray-50 px-1 rounded group">
                      <span>{s.snap_date.slice(0, 10)}</span>
                      <span>池 {fmtNTD(s.pool_total)}</span>
                      <span>正二 {Number(s.letf_pct).toFixed(1)}%</span>
                      <span>曝險 {Number(s.exposure).toFixed(1)}%</span>
                      <button
                        onClick={() => handleDeleteSnapshot(s.id)}
                        className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 持股 P&L */}
      <HoldingsTable
        holdings={holdings}
        onAdd={handleAddHolding}
        onDelete={handleDeleteHolding}
        onPriceUpdate={handlePriceUpdate}
      />

      <p className="text-xs text-gray-400 text-center pb-2">
        策略池 = 正二市值 + 現金（含資產負債表中標記「計入策略現金」的項目）。
        80/20 時真實曝險達 160%，是實打實的 1.6 倍槓桿，請自行評估風險。
      </p>
    </div>
  )
}
