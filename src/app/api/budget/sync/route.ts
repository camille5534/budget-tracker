import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { format, subMonths } from 'date-fns'

function toROCYearMonth(date: Date): string {
  const rocYear = date.getFullYear() - 1911
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${rocYear}${month}`
}

async function fetchInvoicesFromGov(
  barcode: string,
  verification: string,
  yearMonth: string
): Promise<{ invoiceNumber: string; sellerName: string; amount: number; invoiceDate: string }[]> {
  const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 20)
  const params = new URLSearchParams({
    action: 'qryCarrierInv',
    version: '0.5',
    cardType: '3J0002',
    cardNo: barcode,
    expTimeStamp: '2147483647',
    timeStamp: String(Math.floor(Date.now() / 1000)),
    uuid,
    appID: 'EINV202112131736OOOOO',
    cardEncrypt: verification,
    invTerm: yearMonth,
  })

  const url = 'https://einvoice.nat.gov.tw/PB2CAPIVAN/invapp/InvApp'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  })

  const rawText = await res.text()

  if (!res.ok) {
    throw new Error(`財政部 API HTTP ${res.status}：${rawText.substring(0, 200)}`)
  }

  if (rawText.trimStart().startsWith('<')) {
    throw new Error(`財政部 API 回傳 HTML（可能 IP 被封鎖或 appID 無效）：${rawText.substring(0, 300)}`)
  }

  let data: { code: string; msg?: string; details?: unknown[] }
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(`財政部 API 回傳非 JSON：${rawText.substring(0, 300)}`)
  }

  if (data.code !== '200') {
    throw new Error(`財政部 API 錯誤 code=${data.code}：${data.msg ?? rawText}`)
  }

  const details = data.details ?? []
  return (details as {
    invNum: string
    sellerName: string
    amount: string
    invDate: string
  }[]).map(inv => ({
    invoiceNumber: inv.invNum,
    sellerName: inv.sellerName ?? '未知商家',
    amount: Number(inv.amount),
    invoiceDate: inv.invDate,
  }))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('budget_settings')
    .select('carrier_barcode, carrier_verification')
    .eq('user_id', user.id)
    .single()

  if (!settings?.carrier_barcode || !settings?.carrier_verification) {
    return NextResponse.json({ error: '請先在設定頁填入手機條碼與驗證碼' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const targetDate = body.yearMonth
    ? new Date(body.yearMonth + '-01')
    : new Date()

  const yearMonth = toROCYearMonth(targetDate)
  const calendarYearMonth = format(targetDate, 'yyyy-MM')

  try {
    const invoices = await fetchInvoicesFromGov(
      settings.carrier_barcode,
      settings.carrier_verification,
      yearMonth
    )

    if (invoices.length === 0) {
      return NextResponse.json({ synced: 0, message: '本期無發票資料' })
    }

    const rows = invoices.map(inv => ({
      user_id: user.id,
      invoice_number: inv.invoiceNumber,
      seller_name: inv.sellerName,
      amount: inv.amount,
      invoice_date: inv.invoiceDate,
      year_month: calendarYearMonth,
    }))

    const { error } = await supabase
      .from('invoices')
      .upsert(rows, { onConflict: 'user_id,invoice_number' })

    if (error) throw new Error(error.message)

    return NextResponse.json({ synced: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
