import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol, close } = await request.json()
  if (!symbol || close == null) return NextResponse.json({ error: 'symbol and close are required' }, { status: 400 })

  const trade_date = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('daily_prices')
    .upsert({ symbol: symbol.toUpperCase(), close: Number(close), trade_date, source: 'manual' }, { onConflict: 'symbol,trade_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
