'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Wallet, Activity, ArrowRight } from 'lucide-react'
import { fmtNTD, marketValue, type HoldingRow, type StrategyResult } from '@/lib/strategy'

type BalanceItem = { id: string; kind: 'asset' | 'liability'; name: string; amount: number; is_cash: boolean }

export default function DashboardPage() {
  const router = useRouter()
  const [holdings, setHoldings]   = useState<HoldingRow[]>([])
  const [items,    setItems]       = useState<BalanceItem[]>([])
  const [strategy, setStrategy]   = useState<StrategyResult | null>(null)
  const [loading,  setLoading]    = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [hr, br] = await Promise.all([
      fetch('/api/holdings?target=50&band=5').then(r => r.json()),
      fetch('/api/balance-items').then(r => r.json()),
    ])
    setHoldings(hr.holdings ?? [])
    setStrategy(hr.strategy ?? null)
    setItems(br ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const stockValue  = holdings.reduce((s, h) => s + marketValue(h), 0)
  const assetItems  = items.filter(i => i.kind === 'asset')
  const liabItems   = items.filter(i => i.kind === 'liability')
  const assetTotal  = stockValue + assetItems.reduce((s, i) => s + i.amount, 0)
  const liabTotal   = liabItems.reduce((s, i) => s + i.amount, 0)
  const netWorth    = assetTotal - liabTotal

  const bannerCls =
    strategy?.status === 'ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    strategy?.status === 'sell' ? 'bg-amber-50  border-amber-200  text-amber-700'  :
                                  'bg-blue-50   border-blue-200   text-blue-700'
  const bannerText =
    strategy?.status === 'ok'
      ? `策略平衡中　正二 ${strategy.letfPct.toFixed(1)}% / 現金 ${strategy.cashPct.toFixed(1)}%，不需動作。`
    : strategy?.status === 'sell'
      ? `再平衡提示：正二佔 ${strategy?.letfPct.toFixed(1)}%，賣出約 ${fmtNTD(Math.abs(strategy?.adjust ?? 0))} 回到目標。`
      : strategy
      ? `再平衡提示：正二僅 ${strategy.letfPct.toFixed(1)}%，買進約 ${fmtNTD(Math.abs(strategy.adjust))} 回到目標。`
      : ''

  if (loading) return <p className="text-center text-gray-400 py-20">載入中...</p>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">總覽</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Wallet size={15} />
              <span className="text-xs font-medium">淨資產</span>
            </div>
            <p className={`text-xl font-bold ${netWorth >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
              {fmtNTD(netWorth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp size={15} />
              <span className="text-xs font-medium">總資產</span>
            </div>
            <p className="text-xl font-bold text-gray-800">{fmtNTD(assetTotal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <TrendingDown size={15} />
              <span className="text-xs font-medium">總負債</span>
            </div>
            <p className="text-xl font-bold text-gray-800">{fmtNTD(liabTotal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Activity size={15} />
              <span className="text-xs font-medium">真實曝險</span>
            </div>
            <p className={`text-xl font-bold ${(strategy?.exposure ?? 0) > 110 ? 'text-red-500' : 'text-gray-800'}`}>
              {strategy ? `${strategy.exposure.toFixed(0)}%` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy status */}
      {strategy && strategy.poolTotal > 0 && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-3 ${bannerCls}`}>
          <span>{bannerText}</span>
          <Link href="/strategy" className="flex items-center gap-1 font-medium shrink-0 hover:underline">
            詳細 <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Asset breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">資產明細</p>
              <Link href="/balance" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                管理 <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">股票市值</span>
              <span className="font-medium">{fmtNTD(stockValue)}</span>
            </div>
            {assetItems.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-gray-500">{i.name}</span>
                <span className="font-medium">{fmtNTD(i.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
              <span>資產合計</span>
              <span>{fmtNTD(assetTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">負債明細</p>
              <Link href="/balance" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                管理 <ArrowRight size={12} />
              </Link>
            </div>
            {liabItems.length === 0 ? (
              <p className="text-sm text-gray-400">尚無負債項目</p>
            ) : liabItems.map(i => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-gray-500">{i.name}</span>
                <span className="font-medium text-red-500">{fmtNTD(i.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
              <span>負債合計</span>
              <span className="text-red-500">{fmtNTD(liabTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
