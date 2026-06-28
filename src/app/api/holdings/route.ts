import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { computeStrategy, type HoldingRow } from '@/lib/strategy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetPct = Number(searchParams.get('target') ?? 50)
  const bandPct   = Number(searchParams.get('band')   ?? 5)

  const { data: rows } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at')

  const symbols = [...new Set((rows ?? []).map(r => r.symbol))]
  let priceMap = new Map<string, number>()

  if (symbols.length > 0) {
    const { data: prices } = await supabase
      .from('daily_prices')
      .select('symbol, close, trade_date')
      .in('symbol', symbols)
      .order('trade_date', { ascending: false })

    prices?.forEach(p => {
      if (!priceMap.has(p.symbol)) priceMap.set(p.symbol, Number(p.close))
    })
  }

  const holdings: HoldingRow[] = (rows ?? []).map(r => ({
    id:       r.id,
    symbol:   r.symbol,
    name:     r.name,
    kind:     r.kind,
    qty:      Number(r.qty),
    avg_cost: Number(r.avg_cost),
    close:    priceMap.get(r.symbol) ?? null,
  }))

  const { data: cashRows } = await supabase
    .from('balance_items')
    .select('amount')
    .eq('user_id', user.id)
    .eq('kind', 'asset')
    .eq('is_cash', true)

  const cashAmounts = (cashRows ?? []).map(r => Number(r.amount))
  const strategy = computeStrategy(holdings, cashAmounts, targetPct, bandPct)

  return NextResponse.json({ holdings, strategy })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol, name, kind, qty, avg_cost } = await request.json()
  const { data, error } = await supabase
    .from('holdings')
    .insert({ user_id: user.id, symbol: symbol.toUpperCase(), name, kind: kind ?? 'normal', qty, avg_cost })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
