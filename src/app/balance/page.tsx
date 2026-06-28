'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { fmtNTD, marketValue, type HoldingRow } from '@/lib/strategy'

type BalanceItem = {
  id: string
  kind: 'asset' | 'liability'
  name: string
  amount: number
  is_cash: boolean
}

const EMPTY_FORM: { kind: 'asset' | 'liability'; name: string; amount: string; is_cash: boolean } = {
  kind: 'asset', name: '', amount: '', is_cash: false,
}

export default function BalancePage() {
  const router = useRouter()
  const [holdings, setHoldings] = useState<HoldingRow[]>([])
  const [items,    setItems]    = useState<BalanceItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [addKind,  setAddKind]  = useState<'asset' | 'liability' | null>(null)
  const [form,     setForm]     = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [hr, br] = await Promise.all([
      fetch('/api/holdings').then(r => r.json()),
      fetch('/api/balance-items').then(r => r.json()),
    ])
    setHoldings(hr.holdings ?? [])
    setItems(br ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.name || !form.amount) return
    await fetch('/api/balance-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: addKind, name: form.name, amount: Number(form.amount), is_cash: form.is_cash }),
    })
    setForm(EMPTY_FORM)
    setAddKind(null)
    load()
  }

  async function handleDelete(id: string) {
    await fetch('/api/balance-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const stockValue = holdings.reduce((s, h) => s + marketValue(h), 0)
  const assets     = items.filter(i => i.kind === 'asset')
  const liabs      = items.filter(i => i.kind === 'liability')
  const assetTotal = stockValue + assets.reduce((s, i) => s + i.amount, 0)
  const liabTotal  = liabs.reduce((s, i) => s + i.amount, 0)
  const netWorth   = assetTotal - liabTotal

  if (loading) return <p className="text-center text-gray-400 py-20">載入中...</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">資產負債表</h1>
        <div className={`text-right`}>
          <p className="text-xs text-gray-400">淨資產</p>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
            {fmtNTD(netWorth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 資產 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-emerald-700">資產</CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => { setAddKind('asset'); setForm({ ...EMPTY_FORM, kind: 'asset' }) }}
              >
                <Plus size={13} className="mr-1" />新增
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {/* 股票市值（唯讀，從持股計算） */}
            <div className="flex justify-between items-center py-1.5 border-b border-dashed">
              <div>
                <p className="text-sm font-medium text-gray-700">股票市值</p>
                <p className="text-xs text-gray-400">{holdings.length} 檔持股（含最新收盤）</p>
              </div>
              <span className="font-semibold text-sm">{fmtNTD(stockValue)}</span>
            </div>

            {assets.map(i => (
              <div key={i.id} className="flex justify-between items-center py-1.5 group">
                <div>
                  <p className="text-sm text-gray-700">{i.name}</p>
                  {i.is_cash && <span className="text-xs text-emerald-600 bg-emerald-50 px-1 rounded">計入策略現金</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{fmtNTD(i.amount)}</span>
                  <button
                    onClick={() => handleDelete(i.id)}
                    className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {assets.length === 0 && (
              <p className="text-sm text-gray-400 py-2">尚無其他資產項目</p>
            )}

            {addKind === 'asset' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-2">
                <Input
                  placeholder="項目名稱（如 現金/活存）"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <Input
                  placeholder="金額（元）"
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
                <Select
                  value={form.is_cash ? 'yes' : 'no'}
                  onValueChange={v => setForm(f => ({ ...f, is_cash: v === 'yes' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="是否計入策略現金？" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">計入策略現金池（活存、貨幣基金等）</SelectItem>
                    <SelectItem value="no">不計入（房產、設備等）</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd}>確認新增</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddKind(null)}>取消</Button>
                </div>
              </div>
            )}

            <div className="flex justify-between font-semibold text-sm border-t pt-3 mt-2">
              <span>資產合計</span>
              <span className="text-emerald-700">{fmtNTD(assetTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 負債 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-red-600">負債</CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => { setAddKind('liability'); setForm({ ...EMPTY_FORM, kind: 'liability' }) }}
              >
                <Plus size={13} className="mr-1" />新增
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {liabs.map(i => (
              <div key={i.id} className="flex justify-between items-center py-1.5 group">
                <p className="text-sm text-gray-700">{i.name}</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-red-500">{fmtNTD(i.amount)}</span>
                  <button
                    onClick={() => handleDelete(i.id)}
                    className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {liabs.length === 0 && (
              <p className="text-sm text-gray-400 py-2">尚無負債項目</p>
            )}

            {addKind === 'liability' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-2">
                <Input
                  placeholder="項目名稱（如 房貸、信用卡）"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <Input
                  placeholder="金額（元）"
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd}>確認新增</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddKind(null)}>取消</Button>
                </div>
              </div>
            )}

            <div className="flex justify-between font-semibold text-sm border-t pt-3 mt-2">
              <span>負債合計</span>
              <span className="text-red-600">{fmtNTD(liabTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-gray-400 text-center">
        股票市值以持股頁面輸入的現價計算；未輸入現價時以成本估算。
      </p>
    </div>
  )
}
