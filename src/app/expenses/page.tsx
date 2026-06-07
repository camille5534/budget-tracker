'use client'

import { useEffect, useState } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, ChevronLeft, ChevronRight, RepeatIcon } from 'lucide-react'

interface Category { id: string; name: string; icon: string; color: string }
interface ManualExpense {
  id: string; name: string; amount: number; expense_date: string
  category_id: string | null; note: string | null
  categories: Category | null
}
interface RecurringExpense {
  id: string; name: string; monthly_amount: number
  start_month: string; end_month: string
  total_amount: number | null; total_periods: number | null; note: string | null
  categories: Category | null
}

export default function ExpensesPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [categories, setCategories] = useState<Category[]>([])
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)

  const [manualOpen, setManualOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)

  // 手動支出表單
  const [mName, setMName] = useState('')
  const [mAmount, setMAmount] = useState('')
  const [mDate, setMDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [mCat, setMCat] = useState('')
  const [mNote, setMNote] = useState('')

  // 定期支出表單
  const [rName, setRName] = useState('')
  const [rType, setRType] = useState<'fixed' | 'installment'>('fixed')
  const [rAmount, setRAmount] = useState('')
  const [rTotal, setRTotal] = useState('')
  const [rPeriods, setRPeriods] = useState('')
  const [rStart, setRStart] = useState(format(new Date(), 'yyyy-MM'))
  const [rEnd, setREnd] = useState('')
  const [rCat, setRCat] = useState('')
  const [rNote, setRNote] = useState('')

  const yearMonth = format(currentDate, 'yyyy-MM')
  const displayMonth = format(currentDate, 'yyyy年M月', { locale: zhTW })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/budget/categories').then(r => r.json()),
      fetch(`/api/budget/expenses?yearMonth=${yearMonth}`).then(r => r.json()),
      fetch('/api/budget/recurring').then(r => r.json()),
    ]).then(([cats, exps, recs]) => {
      setCategories(cats)
      setManualExpenses(exps)
      setRecurringExpenses(recs)
      setLoading(false)
    })
  }, [yearMonth])

  const activeRecurring = recurringExpenses.filter(r =>
    r.start_month <= yearMonth && r.end_month >= yearMonth
  )

  async function addManual() {
    const r = await fetch('/api/budget/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mName, amount: Number(mAmount), expense_date: mDate, category_id: mCat || null, note: mNote || null }),
    })
    const exp = await r.json()
    setManualExpenses(prev => [exp, ...prev])
    setMName(''); setMAmount(''); setMNote(''); setMCat('')
    setManualOpen(false)
  }

  async function deleteManual(id: string) {
    await fetch('/api/budget/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setManualExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function addRecurring() {
    const monthlyAmount = rType === 'installment'
      ? Math.round(Number(rTotal) / Number(rPeriods))
      : Number(rAmount)

    const r = await fetch('/api/budget/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: rName,
        monthly_amount: monthlyAmount,
        start_month: rStart,
        end_month: rEnd,
        category_id: rCat || null,
        total_amount: rType === 'installment' ? Number(rTotal) : null,
        total_periods: rType === 'installment' ? Number(rPeriods) : null,
        note: rNote || null,
      }),
    })
    const rec = await r.json()
    setRecurringExpenses(prev => [...prev, rec])
    setRName(''); setRAmount(''); setRTotal(''); setRPeriods('')
    setREnd(''); setRCat(''); setRNote('')
    setRecurringOpen(false)
  }

  async function deleteRecurring(id: string) {
    await fetch('/api/budget/recurring', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRecurringExpenses(prev => prev.filter(r => r.id !== id))
  }

  const manualTotal = manualExpenses.reduce((s, e) => s + e.amount, 0)
  const recurringTotal = activeRecurring.reduce((s, r) => s + r.monthly_amount, 0)

  const monthlyAmount = rType === 'installment' && rTotal && rPeriods
    ? Math.round(Number(rTotal) / Number(rPeriods))
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">支出管理</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium w-24 text-center">{displayMonth}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="w-full">
          <TabsTrigger value="manual" className="flex-1">
            一次性支出（${manualTotal.toLocaleString()}）
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex-1">
            定期支出（${recurringTotal.toLocaleString()}/月）
          </TabsTrigger>
        </TabsList>

        {/* 手動支出 */}
        <TabsContent value="manual">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">本月手動支出 {manualExpenses.length} 筆</CardTitle>
              <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                <DialogTrigger render={<Button size="sm" className="gap-1" />}>
                  <Plus size={14} /> 新增
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>新增一次性支出</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>名稱</Label>
                      <Input placeholder="例：現金午餐" value={mName} onChange={e => setMName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>金額（元）</Label>
                      <Input type="number" placeholder="0" value={mAmount} onChange={e => setMAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>日期</Label>
                      <Input type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>分類</Label>
                      <Select value={mCat} onValueChange={val => setMCat(val ?? '')}>
                        <SelectTrigger><SelectValue placeholder="選擇分類" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>備註（選填）</Label>
                      <Input placeholder="備註" value={mNote} onChange={e => setMNote(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={addManual} disabled={!mName || !mAmount}>儲存</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-center text-gray-400 py-6">載入中...</p> :
               manualExpenses.length === 0 ? <p className="text-center text-gray-400 py-6 text-sm">本月無手動支出</p> : (
                <div className="space-y-2">
                  {manualExpenses.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{exp.name}</p>
                        <p className="text-xs text-gray-400">
                          {exp.expense_date}
                          {exp.categories && ` · ${exp.categories.icon} ${exp.categories.name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">${exp.amount.toLocaleString()}</span>
                        <button onClick={() => deleteManual(exp.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 定期支出 */}
        <TabsContent value="recurring">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">定期／分期支出</CardTitle>
              <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
                <DialogTrigger render={<Button size="sm" className="gap-1" />}>
                  <Plus size={14} /> 新增
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>新增定期支出</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>名稱</Label>
                      <Input placeholder="例：將來銀行貸款" value={rName} onChange={e => setRName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>類型</Label>
                      <Select value={rType} onValueChange={v => setRType((v ?? 'fixed') as 'fixed' | 'installment')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">固定月繳（自己輸入每月金額）</SelectItem>
                          <SelectItem value="installment">分期付款（輸入總額＋期數）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {rType === 'fixed' ? (
                      <div className="space-y-1">
                        <Label>每月金額（元）</Label>
                        <Input type="number" placeholder="例：5700" value={rAmount} onChange={e => setRAmount(e.target.value)} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>總金額（元）</Label>
                          <Input type="number" placeholder="例：25000" value={rTotal} onChange={e => setRTotal(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>分幾期</Label>
                          <Input type="number" placeholder="例：6" value={rPeriods} onChange={e => setRPeriods(e.target.value)} />
                        </div>
                        {monthlyAmount && (
                          <p className="text-sm text-indigo-600 font-medium">→ 每月 ${monthlyAmount.toLocaleString()}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>開始月份</Label>
                        <Input type="month" value={rStart} onChange={e => setRStart(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>結束月份</Label>
                        <Input type="month" value={rEnd} onChange={e => setREnd(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>分類</Label>
                      <Select value={rCat} onValueChange={val => setRCat(val ?? '')}>
                        <SelectTrigger><SelectValue placeholder="選擇分類" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>備註（選填）</Label>
                      <Input placeholder="備註" value={rNote} onChange={e => setRNote(e.target.value)} />
                    </div>
                    <Button
                      className="w-full"
                      onClick={addRecurring}
                      disabled={!rName || !rStart || !rEnd || (rType === 'fixed' ? !rAmount : !rTotal || !rPeriods)}
                    >
                      儲存
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {recurringExpenses.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">尚無定期支出</p>
              ) : (
                <div className="space-y-2">
                  {recurringExpenses.map(rec => {
                    const isActive = rec.start_month <= yearMonth && rec.end_month >= yearMonth
                    return (
                      <div key={rec.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? '' : 'opacity-40'}`}>
                        <div className="flex items-center gap-2">
                          <RepeatIcon size={14} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{rec.name}</p>
                            <p className="text-xs text-gray-400">
                              {rec.start_month} ～ {rec.end_month}
                              {rec.total_periods && ` · 共${rec.total_periods}期`}
                              {rec.categories && ` · ${rec.categories.icon} ${rec.categories.name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-sm">${rec.monthly_amount.toLocaleString()}/月</p>
                            {isActive && <p className="text-xs text-indigo-500">本月計入</p>}
                          </div>
                          <button onClick={() => deleteRecurring(rec.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
