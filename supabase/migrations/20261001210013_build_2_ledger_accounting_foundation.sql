-- MetaBrain Trader Item 2: Ledger + Accounting Foundation
-- Immutable double-entry accounting foundation. Existing financial events are journalized;
-- MetaFund trade allocation/cycle settlement semantics are intentionally not changed here.

create table if not exists public.chart_of_accounts (
 id uuid primary key default gen_random_uuid(),
 account_code text not null unique,
 account_key text not null unique,
 account_name text not null,
 account_type text not null check (account_type in ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE','CLEARING')),
 normal_balance text not null check (normal_balance in ('DEBIT','CREDIT')),
 investor_id uuid references public.investor_accounts(id),
 parent_account_id uuid references public.chart_of_accounts(id),
 is_control_account boolean not null default false,
 is_active boolean not null default true,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists chart_of_accounts_investor_id_idx on public.chart_of_accounts(investor_id);
create index if not exists chart_of_accounts_parent_id_idx on public.chart_of_accounts(parent_account_id);

create table if not exists public.journal_entries (
 id uuid primary key default gen_random_uuid(),
 entry_number bigint generated always as identity unique,
 effective_at timestamptz not null,
 posted_at timestamptz not null default now(),
 source_type text not null,
 source_id text not null,
 idempotency_key text not null unique,
 status text not null default 'POSTED' check(status in ('POSTED','REVERSED')),
 description text not null,
 reversal_of_entry_id uuid references public.journal_entries(id),
 investor_id uuid references public.investor_accounts(id),
 cycle_id uuid references public.investment_cycles(id),
 trade_id uuid references public.trades(trade_id),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check(reversal_of_entry_id is null or reversal_of_entry_id<>id)
);
create index if not exists journal_entries_source_idx on public.journal_entries(source_type,source_id);
create index if not exists journal_entries_investor_idx on public.journal_entries(investor_id);
create index if not exists journal_entries_cycle_idx on public.journal_entries(cycle_id);
create index if not exists journal_entries_trade_idx on public.journal_entries(trade_id);
create index if not exists journal_entries_effective_idx on public.journal_entries(effective_at);

create table if not exists public.journal_lines (
 id uuid primary key default gen_random_uuid(),
 journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
 account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
 line_number integer not null,
 description text,
 debit numeric(30,10) not null default 0,
 credit numeric(30,10) not null default 0,
 currency text not null default 'USD',
 original_amount numeric(30,10),
 original_currency text,
 exchange_rate_to_usd numeric(30,12),
 effective_at timestamptz not null,
 investor_id uuid references public.investor_accounts(id),
 cycle_id uuid references public.investment_cycles(id),
 trade_id uuid references public.trades(trade_id),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(journal_entry_id,line_number),
 check(debit>=0 and credit>=0),
 check((debit=0 and credit>0) or (credit=0 and debit>0)),
 check((original_amount is null and original_currency is null and exchange_rate_to_usd is null) or
       (original_amount is not null and original_amount<>0 and original_currency is not null and exchange_rate_to_usd is not null and exchange_rate_to_usd>0))
);
create index if not exists journal_lines_entry_idx on public.journal_lines(journal_entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines(account_id);
create index if not exists journal_lines_investor_idx on public.journal_lines(investor_id);
create index if not exists journal_lines_cycle_idx on public.journal_lines(cycle_id);
create index if not exists journal_lines_trade_idx on public.journal_lines(trade_id);

create or replace function public.set_chart_of_accounts_updated_at()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at:=now(); return new; end $$;
drop trigger if exists chart_of_accounts_updated_at on public.chart_of_accounts;
create trigger chart_of_accounts_updated_at before update on public.chart_of_accounts
for each row execute function public.set_chart_of_accounts_updated_at();

create or replace function public.prevent_accounting_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin raise exception 'Accounting records are immutable. Use a reversal/correction journal entry.'; end $$;
drop trigger if exists journal_entries_immutable on public.journal_entries;
create trigger journal_entries_immutable before update or delete on public.journal_entries
for each row execute function public.prevent_accounting_mutation();
drop trigger if exists journal_lines_immutable on public.journal_lines;
create trigger journal_lines_immutable before update or delete on public.journal_lines
for each row execute function public.prevent_accounting_mutation();

insert into public.chart_of_accounts(account_code,account_key,account_name,account_type,normal_balance,is_control_account)
values
('1000','COMPANY_CASH','MetaFund Settlement Cash','ASSET','DEBIT',true),
('1100','TRADING_ASSETS','Trading/Broker Assets','ASSET','DEBIT',true),
('2000','INVESTOR_CAPITAL_CONTROL','Investor Capital Control','LIABILITY','CREDIT',true),
('2010','INVESTOR_PNL_PAYABLE_CONTROL','Investor P&L Payable Control','LIABILITY','CREDIT',true),
('2020','INVESTOR_WITHDRAWAL_PAYABLE_CONTROL','Investor Withdrawal Payable Control','LIABILITY','CREDIT',true),
('3000','COMPANY_EQUITY','Company Equity','EQUITY','CREDIT',true),
('4000','COMPANY_PROFIT_SHARE','Company Profit Share','INCOME','CREDIT',true),
('5000','TRADING_PNL','Trading Gain/Loss','INCOME','CREDIT',true),
('5900','ACCOUNTING_ADJUSTMENTS','Accounting Adjustments','CLEARING','CREDIT',true)
on conflict(account_key) do nothing;

create or replace function public.ensure_investor_accounting_accounts(p_investor_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.investor_accounts where id=p_investor_id) then raise exception 'Investor account % does not exist.',p_investor_id; end if;
 insert into public.chart_of_accounts(account_code,account_key,account_name,account_type,normal_balance,investor_id,parent_account_id)
 select '2100-'||replace(p_investor_id::text,'-',''),'INVESTOR_CAPITAL:'||p_investor_id::text,'Investor Capital - '||p_investor_id::text,'LIABILITY','CREDIT',p_investor_id,(select id from public.chart_of_accounts where account_key='INVESTOR_CAPITAL_CONTROL')
 where not exists(select 1 from public.chart_of_accounts where account_key='INVESTOR_CAPITAL:'||p_investor_id::text);
 insert into public.chart_of_accounts(account_code,account_key,account_name,account_type,normal_balance,investor_id,parent_account_id)
 select '2110-'||replace(p_investor_id::text,'-',''),'INVESTOR_PNL_PAYABLE:'||p_investor_id::text,'Investor P&L Payable - '||p_investor_id::text,'LIABILITY','CREDIT',p_investor_id,(select id from public.chart_of_accounts where account_key='INVESTOR_PNL_PAYABLE_CONTROL')
 where not exists(select 1 from public.chart_of_accounts where account_key='INVESTOR_PNL_PAYABLE:'||p_investor_id::text);
 insert into public.chart_of_accounts(account_code,account_key,account_name,account_type,normal_balance,investor_id,parent_account_id)
 select '2120-'||replace(p_investor_id::text,'-',''),'INVESTOR_WITHDRAWAL_PAYABLE:'||p_investor_id::text,'Investor Withdrawal Payable - '||p_investor_id::text,'LIABILITY','CREDIT',p_investor_id,(select id from public.chart_of_accounts where account_key='INVESTOR_WITHDRAWAL_PAYABLE_CONTROL')
 where not exists(select 1 from public.chart_of_accounts where account_key='INVESTOR_WITHDRAWAL_PAYABLE:'||p_investor_id::text);
end $$;

do $$ declare r record; begin for r in select id from public.investor_accounts loop perform public.ensure_investor_accounting_accounts(r.id); end loop; end $$;

create or replace function public.post_journal_entry(
 p_source_type text,p_source_id text,p_idempotency_key text,p_effective_at timestamptz,p_description text,
 p_lines jsonb,p_investor_id uuid default null,p_cycle_id uuid default null,p_trade_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_existing uuid; v_debit numeric(30,10); v_credit numeric(30,10); x jsonb; n int:=0; aid uuid; d numeric; c numeric;
begin
 if current_user not in('postgres','service_role') and (select public.is_admin((select auth.uid()))) is not true then raise exception 'Unauthorized: accounting posting is internal/admin-only.'; end if;
 if nullif(btrim(p_source_type),'') is null or nullif(btrim(p_source_id),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'Accounting source identity and idempotency key are required.'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'A journal entry requires at least two lines.'; end if;
 select id into v_existing from public.journal_entries where idempotency_key=p_idempotency_key;
 if v_existing is not null then return v_existing; end if;
 select coalesce(sum((x->>'debit')::numeric),0),coalesce(sum((x->>'credit')::numeric),0) into v_debit,v_credit from jsonb_array_elements(p_lines) x;
 if v_debit<=0 or v_credit<=0 or abs(v_debit-v_credit)>0.00000001 then raise exception 'Unbalanced journal entry: debits=% credits=%.',v_debit,v_credit; end if;
 insert into public.journal_entries(source_type,source_id,idempotency_key,effective_at,description,investor_id,cycle_id,trade_id,metadata)
 values(p_source_type,p_source_id,p_idempotency_key,coalesce(p_effective_at,now()),p_description,p_investor_id,p_cycle_id,p_trade_id,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
 for x in select value from jsonb_array_elements(p_lines) loop
   n:=n+1; aid:=(x->>'account_id')::uuid; d:=coalesce((x->>'debit')::numeric,0); c:=coalesce((x->>'credit')::numeric,0);
   if not exists(select 1 from public.chart_of_accounts where id=aid and is_active) then raise exception 'Accounting account % does not exist or is inactive.',aid; end if;
   insert into public.journal_lines(journal_entry_id,account_id,line_number,description,debit,credit,currency,original_amount,original_currency,exchange_rate_to_usd,effective_at,investor_id,cycle_id,trade_id,metadata)
   values(v_id,aid,n,x->>'description',d,c,upper(coalesce(x->>'currency','USD')),(x->>'original_amount')::numeric,nullif(upper(x->>'original_currency'),''),(x->>'exchange_rate_to_usd')::numeric,coalesce(p_effective_at,now()),p_investor_id,p_cycle_id,p_trade_id,coalesce(x->'metadata','{}'::jsonb));
 end loop;
 return v_id;
exception when unique_violation then select id into v_existing from public.journal_entries where idempotency_key=p_idempotency_key; if v_existing is not null then return v_existing; end if; raise;
end $$;

create or replace function public.post_financial_ledger_event_to_accounting(p_ledger_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare e public.financial_ledger; cash uuid; cap uuid;
begin
 select * into e from public.financial_ledger where id=p_ledger_id;
 if not found then raise exception 'Financial ledger event % not found.',p_ledger_id; end if;
 if e.event_type not in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') then return null; end if;
 if e.investor_id is null then raise exception 'Investor is required for financial event %.',p_ledger_id; end if;
 perform public.ensure_investor_accounting_accounts(e.investor_id);
 select id into cash from public.chart_of_accounts where account_key='COMPANY_CASH';
 select id into cap from public.chart_of_accounts where account_key='INVESTOR_CAPITAL:'||e.investor_id::text;
 if e.amount>0 then
   return public.post_journal_entry('FINANCIAL_LEDGER',e.id::text,'ACCT:FINANCIAL_LEDGER:'||e.id::text,e.created_at,'Capital event accounting',
     jsonb_build_array(jsonb_build_object('account_id',cash,'debit',abs(e.amount),'credit',0,'currency','USD','original_amount',abs(coalesce(e.original_amount,e.amount)),'original_currency',coalesce(e.original_currency,'USD'),'exchange_rate_to_usd',coalesce(e.exchange_rate_to_usd,1)),
                       jsonb_build_object('account_id',cap,'debit',0,'credit',abs(e.amount),'currency','USD')),e.investor_id,e.cycle_id,e.trade_id,null);
 else
   return public.post_journal_entry('FINANCIAL_LEDGER',e.id::text,'ACCT:FINANCIAL_LEDGER:'||e.id::text,e.created_at,'Withdrawal/capital reduction accounting',
     jsonb_build_array(jsonb_build_object('account_id',cap,'debit',abs(e.amount),'credit',0,'currency','USD'),
                       jsonb_build_object('account_id',cash,'debit',0,'credit',abs(e.amount),'currency','USD')),e.investor_id,e.cycle_id,e.trade_id,null);
 end if;
end $$;

create or replace function public.financial_ledger_accounting_bridge()
returns trigger language plpgsql security definer set search_path=''
as $$ begin perform public.post_financial_ledger_event_to_accounting(new.id); return new; end $$;
drop trigger if exists financial_ledger_accounting_bridge on public.financial_ledger;
create trigger financial_ledger_accounting_bridge after insert on public.financial_ledger for each row execute function public.financial_ledger_accounting_bridge();

do $$ declare r record; begin
 for r in select fl.* from public.financial_ledger fl left join public.journal_entries je on je.idempotency_key='ACCT:FINANCIAL_LEDGER:'||fl.id::text where je.id is null and fl.event_type in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') order by fl.created_at,fl.id loop perform public.post_financial_ledger_event_to_accounting(r.id); end loop;
end $$;

create or replace view public.investor_accounting_position with(security_invoker=true) as
select ia.id investor_id,ia.user_id,
coalesce(sum(case when coa.account_key='INVESTOR_CAPITAL:'||ia.id::text then jl.credit-jl.debit else 0 end),0)::numeric investor_capital_balance,
coalesce(sum(case when coa.account_key='INVESTOR_PNL_PAYABLE:'||ia.id::text then jl.credit-jl.debit else 0 end),0)::numeric investor_pnl_payable,
coalesce(sum(case when coa.account_key='INVESTOR_WITHDRAWAL_PAYABLE:'||ia.id::text then jl.credit-jl.debit else 0 end),0)::numeric investor_withdrawal_payable
from public.investor_accounts ia left join public.journal_lines jl on jl.investor_id=ia.id left join public.chart_of_accounts coa on coa.id=jl.account_id group by ia.id,ia.user_id;

create or replace view public.accounting_trial_balance with(security_invoker=true) as
select coa.id account_id,coa.account_code,coa.account_key,coa.account_name,coa.account_type,coa.normal_balance,
coalesce(sum(jl.debit),0)::numeric total_debits,coalesce(sum(jl.credit),0)::numeric total_credits,
coalesce(sum(jl.debit-jl.credit),0)::numeric net_debit_balance,coalesce(sum(jl.credit-jl.debit),0)::numeric net_credit_balance
from public.chart_of_accounts coa left join public.journal_lines jl on jl.account_id=coa.id
group by coa.id,coa.account_code,coa.account_key,coa.account_name,coa.account_type,coa.normal_balance;

create or replace function public.reconcile_accounting_foundation()
returns table(check_name text,status text,detail text)
language plpgsql stable security definer set search_path=''
as $$
declare d numeric;c numeric;u bigint;j bigint;
begin
 if current_user not in('postgres','service_role') and (select public.is_admin((select auth.uid()))) is not true then raise exception 'Unauthorized: accounting reconciliation is admin-only.'; end if;
 select coalesce(sum(debit),0),coalesce(sum(credit),0) into d,c from public.journal_lines;
 return query select 'TRIAL_BALANCE',case when abs(d-c)<=0.00000001 then 'PASS' else 'FAIL' end,format('Debits=%s Credits=%s Difference=%s',d,c,d-c);
 select count(*) into j from(select je.id from public.journal_entries je join public.journal_lines jl on jl.journal_entry_id=je.id group by je.id having abs(sum(jl.debit)-sum(jl.credit))>0.00000001)x;
 return query select 'JOURNAL_BALANCE',case when j=0 then 'PASS' else 'FAIL' end,format('Unbalanced journal entries=%s',j);
 select count(*) into u from public.financial_ledger fl left join public.journal_entries je on je.idempotency_key='ACCT:FINANCIAL_LEDGER:'||fl.id::text where fl.event_type in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') and je.id is null;
 return query select 'CAPITAL_WITHDRAWAL_COVERAGE',case when u=0 then 'PASS' else 'FAIL' end,format('Unjournalized capital/withdrawal events=%s',u);
 return query select 'UNSUPPORTED_TRADE_EVENTS',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade/P&L events remain outside the foundation bridge until cycle-level settlement rules are implemented: %s',count(*)) from public.financial_ledger where event_type in('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS','CYCLE_SETTLEMENT_PROFIT');
 return query select 'PARTICIPATION_NOT_ACCOUNTED_AS_CASH',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade participation rows exist but are not posted as cash movements by Item 2: %s',count(*)) from public.trade_participations;
end $$;

alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
revoke all on table public.chart_of_accounts,public.journal_entries,public.journal_lines from anon,authenticated;
grant select on table public.chart_of_accounts,public.journal_entries,public.journal_lines to authenticated;
create policy chart_of_accounts_admin_read on public.chart_of_accounts for select to authenticated using((select public.is_admin((select auth.uid()))));
create policy journal_entries_admin_read on public.journal_entries for select to authenticated using((select public.is_admin((select auth.uid()))));
create policy journal_lines_admin_read on public.journal_lines for select to authenticated using((select public.is_admin((select auth.uid()))));

revoke execute on function public.post_journal_entry(text,text,text,timestamptz,text,jsonb,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.post_financial_ledger_event_to_accounting(uuid) from public,anon,authenticated;
revoke execute on function public.ensure_investor_accounting_accounts(uuid) from public,anon,authenticated;
revoke execute on function public.financial_ledger_accounting_bridge() from public,anon,authenticated;
revoke execute on function public.set_chart_of_accounts_updated_at() from public,anon,authenticated;
revoke execute on function public.prevent_accounting_mutation() from public,anon,authenticated;
revoke execute on function public.reconcile_accounting_foundation() from public,anon;
grant execute on function public.reconcile_accounting_foundation() to authenticated;
