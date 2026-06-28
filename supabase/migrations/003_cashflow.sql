-- 收支記錄（手動 + Excel 匯入）
create table public.cashflows (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  flow_date   date not null,
  name        text not null,
  category    text not null default '其他',
  amount      integer not null,
  direction   text not null default 'out' check (direction in ('in','out')),
  source      text default 'manual',
  created_at  timestamptz default now()
);

alter table public.cashflows enable row level security;

create policy "Users manage own cashflows"
  on public.cashflows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_cashflows_user_date on public.cashflows(user_id, flow_date desc);
