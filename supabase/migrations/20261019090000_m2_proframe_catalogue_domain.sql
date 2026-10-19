-- M2: Proframe catalogue and operations domain. Existing investor ledger is intentionally untouched.
create table if not exists public.proframe_products (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 summary text not null default '', description text not null default '',
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
 display_order integer not null default 0, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.proframe_product_versions (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.proframe_products(id) on delete restrict,
 version_number integer not null, price numeric(20,6) not null check(price>0),
 currency text not null default 'USD' check(length(currency)=3), provider_name text not null,
 account_type text not null default 'INSTANT_FUNDING' check(account_type='INSTANT_FUNDING'),
 provider_account_size numeric(20,6) not null check(provider_account_size>0),
 max_drawdown_pct numeric(8,4) not null check(max_drawdown_pct>0 and max_drawdown_pct<=100),
 daily_drawdown_pct numeric(8,4) not null check(daily_drawdown_pct>0 and daily_drawdown_pct<=100),
 default_risk_pct numeric(8,4) not null default 0.5 check(default_risk_pct>0 and default_risk_pct<=100),
 payout_target_pct numeric(8,4) not null default 3 check(payout_target_pct>0 and payout_target_pct<=100),
 profit_split_investor_pct numeric(8,4) not null default 70 check(profit_split_investor_pct>=0 and profit_split_investor_pct<=100),
 provider_rules jsonb not null default '{}'::jsonb, payout_conditions jsonb not null default '{}'::jsonb,
 terms_text text not null default '', is_published boolean not null default false,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(product_id,version_number)
);
alter table public.proframe_products add column if not exists current_version_id uuid references public.proframe_product_versions(id) on delete set null;
create table if not exists public.proframe_provider_accounts (
 id uuid primary key default gen_random_uuid(), provider_name text not null, account_reference text not null unique,
 account_size numeric(20,6) not null check(account_size>0), currency text not null default 'USD' check(length(currency)=3),
 account_type text not null default 'INSTANT_FUNDING' check(account_type='INSTANT_FUNDING'),
 procurement_cost numeric(20,6) not null default 0 check(procurement_cost>=0),
 procurement_currency text not null default 'USD' check(length(procurement_currency)=3),
 purchased_at timestamptz, status text not null default 'AVAILABLE'
 check(status in ('ORDERED','AVAILABLE','ASSIGNED','ACTIVE','BREACHED','PAYOUT_PENDING','CLOSED','TERMINATED')),
 provider_terms_snapshot jsonb not null default '{}'::jsonb, operator_mt_reference text, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.proframe_accounts (
 id uuid primary key default gen_random_uuid(), investor_account_id uuid not null references public.investor_accounts(id) on delete restrict,
 product_id uuid not null references public.proframe_products(id) on delete restrict,
 product_version_id uuid not null references public.proframe_product_versions(id) on delete restrict,
 provider_account_id uuid references public.proframe_provider_accounts(id) on delete restrict,
 account_number text not null unique, status text not null default 'PENDING_ACTIVATION'
 check(status in ('PENDING_ACTIVATION','ACTIVE','PAYOUT_PENDING','BREACHED','CLOSED','CANCELLED')),
 activation_price numeric(20,6) not null check(activation_price>0), activation_currency text not null check(length(activation_currency)=3),
 provider_account_size numeric(20,6) not null check(provider_account_size>0),
 risk_pct_snapshot numeric(8,4) not null default 0.5 check(risk_pct_snapshot>0 and risk_pct_snapshot<=100),
 max_drawdown_pct_snapshot numeric(8,4) not null, daily_drawdown_pct_snapshot numeric(8,4) not null,
 payout_target_pct_snapshot numeric(8,4) not null default 3, investor_profit_split_pct_snapshot numeric(8,4) not null default 70,
 purchased_at timestamptz, activated_at timestamptz, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.proframe_purchase_orders (
 id uuid primary key default gen_random_uuid(), investor_account_id uuid not null references public.investor_accounts(id) on delete restrict,
 product_id uuid not null references public.proframe_products(id) on delete restrict,
 product_version_id uuid not null references public.proframe_product_versions(id) on delete restrict,
 proframe_account_id uuid references public.proframe_accounts(id) on delete restrict,
 amount numeric(20,6) not null check(amount>0), currency text not null check(length(currency)=3),
 status text not null default 'CREATED' check(status in ('CREATED','PAYMENT_PENDING','PAID','FULFILMENT_PENDING','FULFILLED','CANCELLED','REFUNDED')),
 idempotency_key text not null unique, payment_ledger_event_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_proframe_versions_published on public.proframe_product_versions(product_id,is_published);
create index if not exists idx_proframe_accounts_owner on public.proframe_accounts(investor_account_id,created_at desc);
create index if not exists idx_proframe_accounts_provider on public.proframe_accounts(provider_account_id);
create index if not exists idx_proframe_orders_owner on public.proframe_purchase_orders(investor_account_id,created_at desc);
alter table public.proframe_products enable row level security;
alter table public.proframe_product_versions enable row level security;
alter table public.proframe_provider_accounts enable row level security;
alter table public.proframe_accounts enable row level security;
alter table public.proframe_purchase_orders enable row level security;
create policy proframe_products_public_read on public.proframe_products for select to anon,authenticated using(status='ACTIVE' or public.is_admin(auth.uid()));
create policy proframe_products_admin_write on public.proframe_products for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy proframe_versions_public_read on public.proframe_product_versions for select to anon,authenticated using(public.is_admin(auth.uid()) or (is_published=true and exists(select 1 from public.proframe_products p where p.id=product_id and p.status='ACTIVE')));
create policy proframe_versions_admin_write on public.proframe_product_versions for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy proframe_provider_accounts_admin_only on public.proframe_provider_accounts for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy proframe_accounts_owner_read on public.proframe_accounts for select to authenticated using(public.is_admin(auth.uid()) or exists(select 1 from public.investor_accounts ia where ia.id=investor_account_id and ia.user_id=auth.uid()));
create policy proframe_accounts_admin_write on public.proframe_accounts for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy proframe_orders_owner_read on public.proframe_purchase_orders for select to authenticated using(public.is_admin(auth.uid()) or exists(select 1 from public.investor_accounts ia where ia.id=investor_account_id and ia.user_id=auth.uid()));
create policy proframe_orders_admin_write on public.proframe_purchase_orders for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
grant select on public.proframe_products,public.proframe_product_versions to anon,authenticated;
grant select on public.proframe_accounts,public.proframe_purchase_orders to authenticated;
grant all on public.proframe_products,public.proframe_product_versions,public.proframe_provider_accounts,public.proframe_accounts,public.proframe_purchase_orders to authenticated;
