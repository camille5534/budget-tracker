import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const yearMonth = searchParams.get('yearMonth')

  let query = supabase
    .from('manual_expenses')
    .select('*, categories(name, icon, color)')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })

  if (yearMonth) {
    const start = `${yearMonth}-01`
    const end = `${yearMonth}-31`
    query = query.gte('expense_date', start).lte('expense_date', end)
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, amount, expense_date, category_id, note } = await request.json()

  const { data, error } = await supabase
    .from('manual_expenses')
    .insert({ user_id: user.id, name, amount, expense_date, category_id: category_id || null, note })
    .select('*, categories(name, icon, color)')
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
    .from('manual_expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
