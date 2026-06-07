'use client'

import { useEffect, useState } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface Category { id: string; name: string; icon: string; color: string }
interface Invoice { amount: number; category_id: string | null; categories: Category | null }
interface ManualExpense { amount: number; category_id: string | null; categories: Category | null }
interface RecurringExpense { monthly_amount: number; start_month: string; end_month: string; categories: Category | null }

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [income, setIncome] = useState(0)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)

  const yearMonth = format(currentDate, 'yyyy-MM')
  const displayMonth = format(currentDate, 'yyyy年M月', { locale: zhTW })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/budget/settings').then(r => r.json()),
      fetch(`/api/budget/invoices?yearMonth=${yearMonth}`).then(r => r.json()),
      fetch(`/api/budget/expenses?yearMonth=${yearMonth}`).then(r => r.json()),
      fetch('/api/budget/recurring').then(r => r.json()),
    ]).then(([settings, invs, exps, recs]) => {
      setIncome(settings.monthly_income ?? 0)
      setInvoices(invs)
      setManualExpenses(exps)
      setRecurringExpenses(recs)
      setLoading(false)
    })
  }, [yearMonth])

  const activeRecurring = recurringExpenses.filter(r =>
    r.start_month <= yearMonth && r.end_month >= yearMonth
  )

  const invoiceTotal = invoices.reduce((s, i) => s + i.amount, 0)
  const manualTotal = manualExpenses.reduce((s, e) => s + e.amount, 0)
  const recurringTotal = activeRecurring.reduce((s, r) => s + r.monthly_amount, 0)
  const totalExpense = invoiceTotal + manualTotal + recurringTotal
  const balance = income - totalExpense

  const categoryMap = new Map<string, { name: string; color: string; amount: number }>()

  const addToCategory = (catId: string | null, cat: Category | null, amount: number) => {
    const key = catId ?? 'uncategorized'
    const label = cat ? `${cat.icon} ${cat.name}` : '未分類'
    const color = cat?.color ?? '#9ca3af'
    const existing = categoryMap.get(key)
    if (existing) existing.amount += amount
    else categoryMap.set(key, { name: label, color, amount })
  }

  invoices.forEach(i => addToCategory(i.category_id, i.categories, i.amount))
  manualExpenses.forEach(e => addToCategory(e.category_id, e.categories, e.amount))
  activeRecurring.forEach(r => addToCategory(null, r.categories, r.monthly_amount))

  const chartData = Array.from(categoryMap.values())
    .filter(d => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">月度總覽</h1>
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

      {loading ? (
        <p className="text-center text-gray-400 py-12">載入中...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <TrendingUp size={16} />
                  <span className="text-xs font-medium">月收入</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">${income.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <TrendingDown size={16} />
                  <span className="text-xs font-medium">本月支出</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">${totalExpense.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <Wallet size={16} />
                  <span className="text-xs font-medium">結餘</span>
                </div>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                  ${balance.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">支出分類</CardTitle></CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">本月尚無支出資料</p>
                ) : (
                  <div className="space-y-2">
                    {chartData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${Math.round((d.amount / totalExpense) * 100)}%`, backgroundColor: d.color }}
                            />
                          </div>
                          <span className="text-sm font-medium w-20 text-right">${d.amount.toLocaleString()}</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{Math.round((d.amount / totalExpense) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">支出圓餅圖</CardTitle></CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">本月尚無支出資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={chartData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">支出來源</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">電子發票（{invoices.length} 筆）</span>
                  <span className="font-medium">${invoiceTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">手動支出（{manualExpenses.length} 筆）</span>
                  <span className="font-medium">${manualTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">定期支出（{activeRecurring.length} 項）</span>
                  <span className="font-medium">${recurringTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
