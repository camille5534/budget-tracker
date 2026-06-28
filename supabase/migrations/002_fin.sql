-- 財務 Dashboard：持股、資產負債、收盤價、策略快照

-- 持股
create table public.holdings (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  symbol      text not null,
  name        text not null,
  kind        text not null default 'normal'
              check (kind in ('letf','normal','cash')),
  qty         numeric(14,2) not null,
  avg_cost    numeric(10,2) not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.holdings enable row level security;
create policy "Users manage own holdings"
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 資產 / 負債項目
create table public.balance_items (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  kind        text not null check (kind in ('asset','liability')),
  name        text not null,
  amount      bigint not null,
  is_cash     boolean default false,
  updated_at  timestamptz default now()
);
alter table public.balance_items enable row level security;
create policy "Users manage own balance_items"
  on public.balance_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 每日收盤（price_fetcher 寫入，或手動輸入）
create table public.daily_prices (
  symbol      text not null,
  trade_date  date not null,
  close       numeric(10,2) not null,
  source      text default 'manual',
  fetched_at  timestamptz default now(),
  primary key (symbol, trade_date)
);
alter table public.daily_prices enable row level security;
create policy "Authenticated users can read prices"
  on public.daily_prices for select
  using (auth.role() = 'authenticated');
create policy "Authenticated users can upsert prices"
  on public.daily_prices for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated users can update prices"
  on public.daily_prices for update
  using (auth.role() = 'authenticated');

-- 策略快照（曝險走勢時間序列）
create table public.strategy_snapshots (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  snap_date   date not null,
  pool_total  bigint not null,
  letf_pct    numeric(5,2) not null,
  exposure    numeric(6,2) not null,
  target_pct  numeric(5,2) not null,
  created_at  timestamptz default now(),
  unique (user_id, snap_date)
);
alter table public.strategy_snapshots enable row level security;
create policy "Users manage own snapshots"
  on public.strategy_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 各股最新收盤 view
create or replace view public.latest_prices as
select distinct on (symbol) symbol, trade_date, close
from public.daily_prices
order by symbol, trade_date desc;
