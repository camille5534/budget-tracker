import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const yearMonth = searchParams.get('yearMonth')

  let query = supabase
    .from('invoices')
    .select('*, categories(name, icon, color)')
    .eq('user_id', user.id)
    .order('invoice_date', { ascending: false })

  if (yearMonth) query = query.eq('year_month', yearMonth)

  const { data } = await query
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, category_id } = await request.json()

  const { data, error } = await supabase
    .from('invoices')
    .update({ category_id })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
