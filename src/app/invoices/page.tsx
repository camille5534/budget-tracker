'use client'

import { useEffect, useState } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

interface Category { id: string; name: string; icon: string; color: string }
interface Invoice {
  id: string
  invoice_number: string
  seller_name: string
  amount: number
  invoice_date: string
  category_id: string | null
  categories: Category | null
}

export default function InvoicesPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const yearMonth = format(currentDate, 'yyyy-MM')
  const displayMonth = format(currentDate, 'yyyy年M月', { locale: zhTW })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/budget/invoices?yearMonth=${yearMonth}`).then(r => r.json()),
      fetch('/api/budget/categories').then(r => r.json()),
    ]).then(([invs, cats]) => {
      setInvoices(invs)
      setCategories(cats)
      setLoading(false)
    })
  }, [yearMonth])

  async function syncInvoices() {
    setSyncing(true)
    setSyncMsg('')
    const r = await fetch('/api/budget/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth }),
    })
    const data = await r.json()
    if (data.error) {
      setSyncMsg(`錯誤：${data.error}`)
    } else {
      setSyncMsg(`同步完成，共 ${data.synced} 筆發票`)
      const updated = await fetch(`/api/budget/invoices?yearMonth=${yearMonth}`).then(r => r.json())
      setInvoices(updated)
    }
    setSyncing(false)
  }

  async function updateCategory(invoiceId: string, categoryId: string) {
    await fetch('/api/budget/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoiceId, category_id: categoryId === 'none' ? null : categoryId }),
    })
    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId
        ? { ...inv, category_id: categoryId === 'none' ? null : categoryId, categories: categories.find(c => c.id === categoryId) ?? null }
        : inv
    ))
  }

  const total = invoices.reduce((sum, inv) => sum + inv.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">發票明細</h1>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            共 {invoices.length} 筆，合計 ${total.toLocaleString()}
          </CardTitle>
          <div className="flex items-center gap-2">
            {syncMsg && <span className="text-xs text-gray-500">{syncMsg}</span>}
            <Button onClick={syncInvoices} disabled={syncing} size="sm" className="gap-1">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? '同步中...' : '同步發票'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-400 py-8">載入中...</p>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">本月尚無發票資料</p>
              <p className="text-gray-400 text-xs">點擊「同步發票」從財政部載入</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{inv.seller_name}</p>
                    <p className="text-xs text-gray-400">{inv.invoice_date} · {inv.invoice_number}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <Select
                      value={inv.category_id ?? 'none'}
                      onValueChange={val => updateCategory(inv.id, val ?? 'none')}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue placeholder="未分類" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未分類</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="font-semibold text-sm w-20 text-right">
                      ${inv.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
