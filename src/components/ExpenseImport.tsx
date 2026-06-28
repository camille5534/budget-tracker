'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Check, X } from 'lucide-react'
import * as XLSX from 'xlsx'

type ParsedRow = {
  flow_date: string
  name: string
  category: string
  amount: number
  direction: 'in' | 'out'
}

type Props = {
  onImport: (rows: ParsedRow[]) => Promise<void>
}

// 嘗試把各種欄位名對應到標準欄位
const FIELD_MAP: Record<string, keyof ParsedRow> = {
  '日期': 'flow_date', 'date': 'flow_date',
  '項目': 'name', '名稱': 'name', 'name': 'name', 'item': 'name', '說明': 'name',
  '分類': 'category', 'category': 'category', '類別': 'category',
  '金額': 'amount', 'amount': 'amount',
  '方向': 'direction', 'direction': 'direction', '收支': 'direction',
}

function parseDate(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  // Excel 序列日期數字
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  // 支援 YYYY/MM/DD、YYYY-MM-DD、MM/DD/YYYY
  const iso = s.replace(/\//g, '-')
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return new Date().toISOString().slice(0, 10)
}

function parseDirection(raw: unknown): 'in' | 'out' {
  const s = String(raw ?? '').toLowerCase()
  return s === 'in' || s === '收入' || s === '入' ? 'in' : 'out'
}

export default function ExpenseImport({ onImport }: Props) {
  const [preview, setPreview]   = useState<ParsedRow[] | null>(null)
  const [error,   setError]     = useState('')
  const [loading, setLoading]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPreview(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data  = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const raw   = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        if (!raw.length) { setError('檔案沒有資料列'); return }

        // 偵測欄位對應
        const keys    = Object.keys(raw[0])
        const mapping = new Map<string, keyof ParsedRow>()
        keys.forEach(k => {
          const mapped = FIELD_MAP[k.trim()] ?? FIELD_MAP[k.trim().toLowerCase()]
          if (mapped) mapping.set(k, mapped)
        })

        // 如果沒有對應到，按順序假設：日期、項目、分類、金額
        const fallback: (keyof ParsedRow)[] = ['flow_date','name','category','amount']
        if (mapping.size === 0) {
          keys.slice(0, 4).forEach((k, i) => { if (fallback[i]) mapping.set(k, fallback[i]) })
        }

        const rows: ParsedRow[] = raw.map(r => ({
          flow_date: parseDate(r[keys.find(k => mapping.get(k) === 'flow_date') ?? ''] ?? ''),
          name:      String(r[keys.find(k => mapping.get(k) === 'name') ?? ''] ?? '未命名').trim() || '未命名',
          category:  String(r[keys.find(k => mapping.get(k) === 'category') ?? ''] ?? '其他').trim() || '其他',
          amount:    Math.abs(Number(r[keys.find(k => mapping.get(k) === 'amount') ?? ''] ?? 0)),
          direction: parseDirection(r[keys.find(k => mapping.get(k) === 'direction') ?? ''] ?? 'out'),
        })).filter(r => r.amount > 0)

        if (!rows.length) { setError('沒有有效金額的資料列（金額需 > 0）'); return }
        setPreview(rows)
      } catch (err) {
        setError('解析失敗：' + String(err))
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!preview) return
    setLoading(true)
    await onImport(preview)
    setPreview(null)
    setLoading(false)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload size={14} className="mr-1.5" />匯入 Excel / CSV
      </Button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {preview && (
        <div className="mt-3 border rounded-lg overflow-hidden text-sm">
          <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b">
            <span className="font-medium text-gray-700">預覽（共 {preview.length} 筆）</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmImport} disabled={loading}>
                <Check size={13} className="mr-1" />{loading ? '匯入中...' : '確認匯入'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)}>
                <X size={13} className="mr-1" />取消
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-400">
                  <th className="px-3 py-1.5 text-left font-medium">日期</th>
                  <th className="px-3 py-1.5 text-left font-medium">項目</th>
                  <th className="px-3 py-1.5 text-left font-medium">分類</th>
                  <th className="px-3 py-1.5 text-right font-medium">金額</th>
                  <th className="px-3 py-1.5 text-left font-medium">收/支</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.slice(0, 8).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-600">{r.flow_date}</td>
                    <td className="px-3 py-1.5 text-gray-800">{r.name}</td>
                    <td className="px-3 py-1.5 text-gray-500">{r.category}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      NT${r.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        r.direction === 'in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {r.direction === 'in' ? '收入' : '支出'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 8 && (
            <p className="px-3 py-2 text-xs text-gray-400 border-t">
              另有 {preview.length - 8} 筆，確認後全部匯入。
            </p>
          )}
          <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-400">
            欄位自動偵測：日期 / 項目 / 分類 / 金額。沒有「方向」欄時全視為支出。
          </div>
        </div>
      )}
    </div>
  )
}
