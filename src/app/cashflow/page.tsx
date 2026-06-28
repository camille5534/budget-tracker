'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import ExpenseImport from '@/components/ExpenseImport'

type Cashflow = {
  id: string
  flow_date: string
  name: string
  category: string
  amount: number
  direction: 'in' | 'out'
  source: string
}

const CATEGORIES = ['薪資', '投資', '獎金', '餐飲', '交通', '購物', '娛樂', '醫療', '貓咪', '房租', '水電', '保險', '其他']

const EMPTY_FORM = { name: '', category: '其他', amount: '', direction: 'out' as const, flow_date: '' }

export default function CashflowPage() {
  const router  = useRouter()
  const [date,   setDate]    = useState(new Date())
  const [rows,   setRows]    = useState<Cashflow[]>([])
  const [income, setIncome]  = useState(0)
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editIncome, setEditIncome]   = useState(false)
  const [incomeInput, setIncomeInput] = useState('')
  const [editId, setEditId]  = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  const yearMonth = format(date, 'yyyy-MM')
  const displayMonth = format(date, 'yyyy年M月', { locale: zhTW })

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [cf, inc] = await Promise.all([
      fetch(`/api/cashflows?yearMonth=${yearMonth}`).then(r => r.json()),
      fetch('/api/income').then(r => r.json()),
    ])
    setRows(cf ?? [])
    setIncome(inc.monthly_income ?? 0)
    setLoading(false)
  }, [yearMonth, router])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.name || !form.amount) return
    const flow_date = form.flow_date || `${yearMonth}-01`
    await fetch('/api/cashflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, flow_date, amount: Number(form.amount) }),
    })
    setForm(EMPTY_FORM)
    setAdding(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch('/api/cashflows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function handleSaveIncome() {
    await fetch('/api/income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_income: Number(incomeInput) }),
    })
    setIncome(Number(incomeInput))
    setEditIncome(false)
  }

  async function handleImport(importedRows: { flow_date: string; name: string; category: string; amount: number; direction: 'in' | 'out' }[]) {
    await fetch('/api/cashflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importedRows.map(r => ({ ...r, source: 'excel' }))),
    })
    load()
  }

  async function handleEditSave() {
    if (!editId || !editForm.name || !editForm.amount) return
    // 用 delete + insert 實現 update（簡化，避免加 PATCH route）
    await fetch('/api/cashflows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId }),
    })
    await fetch('/api/cashflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, amount: Number(editForm.amount) }),
    })
    setEditId(null)
    load()
  }

  const outTotal = rows.filter(r => r.direction === 'out').reduce((s, r) => s + r.amount, 0)
  const inExtra  = rows.filter(r => r.direction === 'in').reduce((s, r) => s + r.amount, 0)
  const totalIn  = income + inExtra
  const balance  = totalIn - outTotal

  // 依分類彙整支出
  const categoryMap = new Map<string, number>()
  rows.filter(r => r.direction === 'out').forEach(r => {
    categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + r.amount)
  })
  const categoryBreakdown = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])

  if (loading) return <p className="text-center text-gray-400 py-20">載入中...</p>

  return (
    <div className="space-y-5">
      {/* 標題 + 月份導覽 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">每月收支</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(d => subMonths(d, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium w-24 text-center">{displayMonth}</span>
          <Button variant="outline" size="icon" onClick={() => setDate(d => addMonths(d, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">月收入</span>
            </div>
            {editIncome ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  value={incomeInput}
                  onChange={e => setIncomeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveIncome()}
                  className="h-7 text-sm px-2"
                  autoFocus
                />
                <button onClick={handleSaveIncome} className="text-emerald-600"><Check size={14} /></button>
                <button onClick={() => setEditIncome(false)} className="text-gray-400"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <p className="text-xl font-bold text-gray-800">NT${income.toLocaleString()}</p>
                <button
                  onClick={() => { setIncomeInput(String(income)); setEditIncome(true) }}
                  className="text-gray-300 hover:text-indigo-400 opacity-0 group-hover:opacity-100"
                ><Pencil size={12} /></button>
              </div>
            )}
            {inExtra > 0 && <p className="text-xs text-gray-400 mt-0.5">+NT${inExtra.toLocaleString()} 其他收入</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-red-500 mb-1">
              <TrendingDown size={14} />
              <span className="text-xs font-medium">本月支出</span>
            </div>
            <p className="text-xl font-bold text-gray-800">NT${outTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rows.filter(r => r.direction === 'out').length} 筆</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
              <Wallet size={14} />
              <span className="text-xs font-medium">結餘</span>
            </div>
            <p className={`text-xl font-bold ${balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
              NT${balance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 分類彙整 */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">支出分類</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {categoryBreakdown.map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 shrink-0">{cat}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${(amt / outTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium tabular-nums w-28 text-right">
                    NT${amt.toLocaleString()} <span className="text-gray-400 text-xs">({Math.round(amt/outTotal*100)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 明細列表 */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">明細</CardTitle>
          <div className="flex items-center gap-2">
            <ExpenseImport onImport={handleImport} />
            <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
              <Plus size={14} className="mr-1" />新增
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {adding && (
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border space-y-2">
              <p className="text-sm font-medium text-gray-700">新增一筆</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Input
                  type="date"
                  value={form.flow_date || `${yearMonth}-01`}
                  onChange={e => setForm(f => ({ ...f, flow_date: e.target.value }))}
                />
                <Input
                  placeholder="項目名稱"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: (v ?? 'out') as 'in' | 'out' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="out">支出</SelectItem>
                    <SelectItem value="in">收入</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? '其他' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="金額"
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd}>確認新增</Button>
                <Button size="sm" variant="outline" onClick={() => setAdding(false)}>取消</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-400 text-xs">
                  <th className="pb-2 text-left font-medium">日期</th>
                  <th className="pb-2 text-left font-medium">項目</th>
                  <th className="pb-2 text-left font-medium">分類</th>
                  <th className="pb-2 text-right font-medium">金額</th>
                  <th className="pb-2 text-left font-medium">類型</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">本月尚無記錄，點擊「新增」或「匯入 Excel」開始。</td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 group">
                    {editId === r.id ? (
                      <>
                        <td className="py-2" colSpan={4}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Input type="date" value={editForm.flow_date} onChange={e => setEditForm(f => ({ ...f, flow_date: e.target.value }))} className="h-7 text-xs w-32" />
                            <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs flex-1 min-w-24" placeholder="項目" />
                            <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v ?? '其他' }))}>
                              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="h-7 text-xs w-24" placeholder="金額" />
                          </div>
                        </td>
                        <td className="py-2" colSpan={2}>
                          <div className="flex gap-1">
                            <button onClick={handleEditSave} className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                            <button onClick={() => setEditId(null)} className="text-red-400 hover:text-red-500"><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 text-gray-500 tabular-nums">{r.flow_date.slice(0, 10)}</td>
                        <td className="py-2.5 text-gray-800">{r.name}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{r.category}</td>
                        <td className={`py-2.5 text-right font-medium tabular-nums ${r.direction === 'in' ? 'text-emerald-600' : 'text-gray-800'}`}>
                          {r.direction === 'in' ? '+' : '-'}NT${r.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.direction === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.direction === 'in' ? '收入' : '支出'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => { setEditId(r.id); setEditForm({ name: r.name, category: r.category, amount: String(r.amount), direction: r.direction, flow_date: r.flow_date.slice(0,10) }) }} className="text-gray-300 hover:text-indigo-400"><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
