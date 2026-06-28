'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Check, X } from 'lucide-react'
import { type HoldingRow, fmtNTD } from '@/lib/strategy'

const KIND_LABEL: Record<string, string> = {
  letf:   '正二',
  normal: '一般',
  cash:   '現金等值',
}
const KIND_COLOR: Record<string, string> = {
  letf:   'bg-amber-100 text-amber-700',
  normal: 'bg-gray-100 text-gray-600',
  cash:   'bg-emerald-100 text-emerald-700',
}

type Props = {
  holdings: HoldingRow[]
  onAdd:    (h: Omit<HoldingRow, 'id' | 'close'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onPriceUpdate: (symbol: string, close: number) => Promise<void>
}

export default function HoldingsTable({ holdings, onAdd, onDelete, onPriceUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ symbol: '', name: '', kind: 'normal', qty: '', avg_cost: '' })
  const [editPrice, setEditPrice] = useState<{ symbol: string; value: string } | null>(null)

  const mv     = (h: HoldingRow) => h.qty * (h.close ?? h.avg_cost)
  const pnl    = (h: HoldingRow) => mv(h) - h.qty * h.avg_cost
  const pnlPct = (h: HoldingRow) => h.avg_cost ? (pnl(h) / (h.qty * h.avg_cost)) * 100 : 0

  async function submitAdd() {
    if (!form.symbol || !form.name || !form.qty || !form.avg_cost) return
    await onAdd({
      symbol:   form.symbol.toUpperCase(),
      name:     form.name,
      kind:     form.kind as HoldingRow['kind'],
      qty:      Number(form.qty),
      avg_cost: Number(form.avg_cost),
    })
    setForm({ symbol: '', name: '', kind: 'normal', qty: '', avg_cost: '' })
    setAdding(false)
  }

  async function submitPrice() {
    if (!editPrice?.value) return
    await onPriceUpdate(editPrice.symbol, Number(editPrice.value))
    setEditPrice(null)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">持股管理 &amp; P&amp;L</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus size={14} className="mr-1" />新增持股
        </Button>
      </CardHeader>
      <CardContent>
        {adding && (
          <div className="mb-4 p-3 rounded-lg bg-gray-50 border space-y-3">
            <p className="text-sm font-medium text-gray-700">新增持股</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Input
                placeholder="股號（如 00631L）"
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
              />
              <Input
                placeholder="名稱（如 台50正2）"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v ?? 'normal' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="letf">正二（槓桿 ETF）</SelectItem>
                  <SelectItem value="normal">一般股票</SelectItem>
                  <SelectItem value="cash">現金等值</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="股數"
                type="number"
                value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
              />
              <Input
                placeholder="平均成本價"
                type="number"
                value={form.avg_cost}
                onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitAdd}>確認新增</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>取消</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-400 text-xs">
                <th className="pb-2 text-left font-medium">股號</th>
                <th className="pb-2 text-left font-medium">名稱</th>
                <th className="pb-2 text-left font-medium">類型</th>
                <th className="pb-2 text-right font-medium">股數</th>
                <th className="pb-2 text-right font-medium">成本</th>
                <th className="pb-2 text-right font-medium">現價</th>
                <th className="pb-2 text-right font-medium">市值</th>
                <th className="pb-2 text-right font-medium">損益</th>
                <th className="pb-2 text-right font-medium">報酬率</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holdings.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 font-mono font-semibold text-gray-800">{h.symbol}</td>
                  <td className="py-2.5 text-gray-700">{h.name}</td>
                  <td className="py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${KIND_COLOR[h.kind]}`}>
                      {KIND_LABEL[h.kind]}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{h.qty.toLocaleString()}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">{h.avg_cost.toLocaleString()}</td>
                  <td className="py-2.5 text-right">
                    {editPrice?.symbol === h.symbol ? (
                      <span className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          value={editPrice.value}
                          onChange={e => setEditPrice({ symbol: h.symbol, value: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && submitPrice()}
                          className="w-20 h-6 text-xs px-1.5"
                          autoFocus
                        />
                        <button onClick={submitPrice} className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                        <button onClick={() => setEditPrice(null)} className="text-red-400 hover:text-red-500"><X size={13} /></button>
                      </span>
                    ) : (
                      <button
                        className="tabular-nums hover:underline hover:text-indigo-600"
                        onClick={() => setEditPrice({ symbol: h.symbol, value: String(h.close ?? '') })}
                        title="點擊更新現價"
                      >
                        {h.close != null ? h.close.toLocaleString() : (
                          <span className="text-gray-300 text-xs">輸入現價</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{fmtNTD(mv(h))}</td>
                  <td className={`py-2.5 text-right font-medium tabular-nums ${pnl(h) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pnl(h) >= 0 ? '+' : ''}{fmtNTD(pnl(h))}
                  </td>
                  <td className={`py-2.5 text-right text-xs tabular-nums ${pnlPct(h) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pnlPct(h) >= 0 ? '+' : ''}{pnlPct(h).toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => onDelete(h.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400 text-sm">
                    尚無持股，點擊上方「新增持股」開始。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">現價欄位點擊可手動更新，未來 price_fetcher 每日自動寫入後即可省略此步驟。</p>
      </CardContent>
    </Card>
  )
}
