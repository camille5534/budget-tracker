'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Trash2, Plus, Save } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string
  color: string
}

const DEFAULT_CATEGORIES = [
  { name: '餐飲', icon: '🍜', color: '#ef4444' },
  { name: '食品雜貨', icon: '🛒', color: '#f97316' },
  { name: '交通', icon: '🚗', color: '#3b82f6' },
  { name: '娛樂', icon: '🎮', color: '#8b5cf6' },
  { name: '醫療', icon: '🏥', color: '#10b981' },
  { name: '貸款', icon: '🏦', color: '#6366f1' },
  { name: '稅費', icon: '📋', color: '#f59e0b' },
  { name: '其他', icon: '💰', color: '#6b7280' },
]

export default function SettingsPage() {
  const [income, setIncome] = useState('')
  const [barcode, setBarcode] = useState('')
  const [verification, setVerification] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('💰')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [loadingCats, setLoadingCats] = useState(true)

  useEffect(() => {
    fetch('/api/budget/settings')
      .then(r => r.json())
      .then(d => {
        if (d.monthly_income) setIncome(String(d.monthly_income))
        if (d.carrier_barcode) setBarcode(d.carrier_barcode)
      })

    fetch('/api/budget/categories')
      .then(r => r.json())
      .then(d => {
        setCategories(d)
        setLoadingCats(false)
      })
  }, [])

  async function saveSettings() {
    setSavingSettings(true)
    await fetch('/api/budget/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthly_income: Number(income),
        carrier_barcode: barcode,
        carrier_verification: verification || undefined,
      }),
    })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  async function initDefaultCategories() {
    for (const cat of DEFAULT_CATEGORIES) {
      await fetch('/api/budget/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      })
    }
    const r = await fetch('/api/budget/categories')
    setCategories(await r.json())
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const r = await fetch('/api/budget/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName, icon: newCatIcon, color: newCatColor }),
    })
    const cat = await r.json()
    setCategories(prev => [...prev, cat])
    setNewCatName('')
    setNewCatIcon('💰')
    setNewCatColor('#6366f1')
  }

  async function deleteCategory(id: string) {
    await fetch('/api/budget/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">設定</h1>

      {/* 收支設定 */}
      <Card>
        <CardHeader>
          <CardTitle>收支設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>月薪（元）</Label>
            <Input
              type="number"
              placeholder="例：50000"
              value={income}
              onChange={e => setIncome(e.target.value)}
            />
          </div>
          <Separator />
          <p className="text-sm font-medium text-gray-700">電子發票載具</p>
          <div className="space-y-2">
            <Label>手機條碼</Label>
            <Input
              placeholder="/XXXXXXX"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>驗證碼（輸入後存入 Supabase，不會顯示）</Label>
            <Input
              type="password"
              placeholder="4位驗證碼"
              value={verification}
              onChange={e => setVerification(e.target.value)}
            />
          </div>
          <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
            <Save size={16} />
            {settingsSaved ? '已儲存！' : savingSettings ? '儲存中...' : '儲存設定'}
          </Button>
        </CardContent>
      </Card>

      {/* 分類管理 */}
      <Card>
        <CardHeader>
          <CardTitle>支出分類管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 && !loadingCats && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">還沒有任何分類</p>
              <Button variant="outline" onClick={initDefaultCategories}>
                一鍵建立預設分類
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <Separator />
          <p className="text-sm font-medium text-gray-700">新增分類</p>
          <div className="flex gap-2">
            <Input
              placeholder="emoji（如 🎵）"
              value={newCatIcon}
              onChange={e => setNewCatIcon(e.target.value)}
              className="w-24"
            />
            <Input
              placeholder="分類名稱"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
            />
            <input
              type="color"
              value={newCatColor}
              onChange={e => setNewCatColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border"
              title="選擇顏色"
            />
            <Button onClick={addCategory} disabled={!newCatName.trim()} className="gap-1">
              <Plus size={16} /> 新增
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
