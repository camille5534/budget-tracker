import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const yearMonth = searchParams.get('yearMonth') // 格式 2026-06

  let query = supabase
    .from('cashflows')
    .select('*')
    .eq('user_id', user.id)
    .order('flow_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (yearMonth) {
    query = query
      .gte('flow_date', `${yearMonth}-01`)
      .lte('flow_date', `${yearMonth}-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // 支援單筆或批次（Excel 匯入）
  const rows = Array.isArray(body) ? body : [body]
  const inserts = rows.map(r => ({
    user_id:   user.id,
    flow_date: r.flow_date,
    name:      r.name,
    category:  r.category ?? '其他',
    amount:    Number(r.amount),
    direction: r.direction ?? 'out',
    source:    r.source ?? 'manual',
  }))

  const { data, error } = await supabase.from('cashflows').insert(inserts).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase
    .from('cashflows')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
