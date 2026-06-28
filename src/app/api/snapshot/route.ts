import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { computeStrategy, type HoldingRow } from '@/lib/strategy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('strategy_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('snap_date')

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_pct } = await request.json()
  const targetPct = Number(target_pct ?? 50)

  const { data: rows } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', user.id)

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
    id: r.id, symbol: r.symbol, name: r.name, kind: r.kind,
    qty: Number(r.qty), avg_cost: Number(r.avg_cost),
    close: priceMap.get(r.symbol) ?? null,
  }))

  const { data: cashRows } = await supabase
    .from('balance_items')
    .select('amount')
    .eq('user_id', user.id)
    .eq('kind', 'asset')
    .eq('is_cash', true)

  const cashAmounts = (cashRows ?? []).map(r => Number(r.amount))
  const s = computeStrategy(holdings, cashAmounts, targetPct)

  const snap_date = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('strategy_snapshots')
    .upsert({
      user_id: user.id,
      snap_date,
      pool_total: Math.round(s.poolTotal),
      letf_pct:  parseFloat(s.letfPct.toFixed(2)),
      exposure:  parseFloat(s.exposure.toFixed(2)),
      target_pct: targetPct,
    }, { onConflict: 'user_id,snap_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, snap_date })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase
    .from('strategy_snapshots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
