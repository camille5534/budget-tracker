-- 自訂支出分類
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text not null default '💰',
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Users can manage own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 收支設定（薪資 + 載具條碼）
create table public.budget_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  monthly_income integer not null default 0,
  carrier_barcode text,
  carrier_verification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_settings enable row level security;

create policy "Users can manage own budget settings"
  on public.budget_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 財政部發票（自動同步）
create table public.invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_number text not null,
  seller_name text not null,
  amount integer not null,
  invoice_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  year_month text not null,
  created_at timestamptz not null default now(),
  unique(user_id, invoice_number)
);

alter table public.invoices enable row level security;

create policy "Users can manage own invoices"
  on public.invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 手動一次性支出
create table public.manual_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount integer not null,
  expense_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.manual_expenses enable row level security;

create policy "Users can manage own manual expenses"
  on public.manual_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 定期/分期支出
create table public.recurring_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  monthly_amount integer not null,
  start_month text not null,
  end_month text not null,
  category_id uuid references public.categories(id) on delete set null,
  total_amount integer,
  total_periods integer,
  note text,
  created_at timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;

create policy "Users can manage own recurring expenses"
  on public.recurring_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
