import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RiskBasisType = Database["public"]["Enums"]["risk_basis_type"];
export type InvestmentCycleStatus = Database["public"]["Enums"]["investment_cycle_status"];
export type WithdrawalStatus = Database["public"]["Enums"]["withdrawal_status"];
export type InvestorAccountStatus = Database["public"]["Enums"]["investor_account_status"];

export interface InvestorSummary {
  account_number: string | null;
  account_status: InvestorAccountStatus | null;
  active_committed_capital: number | null;
  available_capital: number | null;
  closed_trades_count: number | null;
  cumulative_deposited: number | null;
  cumulative_withdrawn: number | null;
  currency: string | null;
  current_contributed_capital: number | null;
  current_economic_equity: number | null;
  investor_id: string | null;
  open_trades_count: number | null;
  realized_trading_pnl: number | null;
  settled_capital: number | null;
  user_id: string | null;
}

export interface CompanySummary {
  active_investors: number | null;
  closed_trades_count: number | null;
  net_trading_pnl: number | null;
  open_trades_count: number | null;
  pending_company_profit_share: number | null;
  total_active_committed_capital: number | null;
  total_active_risk_amount: number | null;
  total_available_capital: number | null;
  total_deposited: number | null;
  total_economic_equity: number | null;
  total_gross_loss: number | null;
  total_gross_profit: number | null;
  total_investors: number | null;
  total_withdrawn: number | null;
}

export interface InvestorTradeHistoryRow {
  account_number: string | null;
  closing_price: number | null;
  created_at: string | null;
  cycle_id: string | null;
  cycle_number: number | null;
  direction: string | null;
  entry_price: number | null;
  investor_gross_pnl: number | null;
  investor_id: string | null;
  investor_net_pnl: number | null;
  outcome: string | null;
  pair: string | null;
  participating_capital_snapshot: number | null;
  result_pnl_percent: number | null;
  risk_amount: number | null;
  risk_pct: number | null;
  status: string | null;
  trade_id: string | null;
  user_id: string | null;
}

export interface ReconciliationCheck {
  check_code: string;
  check_name: string;
  severity: string;
  discrepancy_count: number;
  details: any;
}

// ----------------------------------------------------------------------
// INVESTOR CLIENT QUERIES & MUTATIONS
// ----------------------------------------------------------------------

export async function fetchInvestorSummary(): Promise<InvestorSummary | null> {
  const { data, error } = await supabase
    .from("investor_financial_summary")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as InvestorSummary | null;
}

export async function fetchInvestorTradeHistory(): Promise<InvestorTradeHistoryRow[]> {
  const { data, error } = await supabase
    .from("investor_trade_history")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvestorTradeHistoryRow[];
}

export async function fetchInvestorWithdrawalRequests(accountId: string) {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("investor_id", accountId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function requestInvestorWithdrawal(params: {
  accountId: string;
  amount: number;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_account_id: params.accountId,
    p_amount: params.amount,
    p_notes: params.notes ?? null,
  });

  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------
// ADMIN / COMMAND CENTER QUERIES & MUTATIONS
// ----------------------------------------------------------------------

export async function fetchCompanyFinancialSummary(): Promise<CompanySummary | null> {
  const { data, error } = await supabase
    .from("company_financial_summary")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as CompanySummary | null;
}

export async function fetchAllInvestors() {
  const { data, error } = await supabase
    .from("investor_accounts")
    .select("*, users(email)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAllCapitalEvents() {
  const { data, error } = await supabase
    .from("capital_events")
    .select("*, investor_accounts(account_number, user_id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function activateInvestorCapital(params: {
  investorId: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  fxSource?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("activate_capital_event", {
    p_investor_id: params.investorId,
    p_amount: params.amount,
    p_currency: params.currency || "USD",
    p_exchange_rate: params.exchangeRate || 1.0,
    p_fx_source: params.fxSource || "MANUAL",
    p_notes: params.notes || null,
  });

  if (error) throw error;
  return data;
}

export async function fetchInvestmentCycles() {
  const { data, error } = await supabase
    .from("investment_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createInvestmentCycle(params: {
  name: string;
  startDate: string;
  endDate: string;
  investorSplit: number;
  companySplit: number;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("create_investment_cycle", {
    p_name: params.name,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_investor_split: params.investorSplit,
    p_company_split: params.companySplit,
    p_notes: params.notes || null,
  });

  if (error) throw error;
  return data;
}

export async function activateInvestmentCycle(cycleId: string) {
  const { data, error } = await supabase.rpc("activate_investment_cycle", {
    p_cycle_id: cycleId,
  });

  if (error) throw error;
  return data;
}

export async function closeInvestmentCycle(cycleId: string) {
  const { data, error } = await supabase.rpc("close_investment_cycle", {
    p_cycle_id: cycleId,
  });

  if (error) throw error;
  return data;
}

export async function fetchAllWithdrawals() {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*, investor_accounts(account_number, user_id)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function approveWithdrawal(requestId: string, adminNotes?: string) {
  const { data, error } = await supabase.rpc("approve_withdrawal", {
    p_request_id: requestId,
    p_admin_notes: adminNotes || null,
  });

  if (error) throw error;
  return data;
}

export async function settleWithdrawal(requestId: string, settlementRef?: string) {
  const { data, error } = await supabase.rpc("settle_withdrawal", {
    p_request_id: requestId,
    p_settlement_ref: settlementRef || "DIRECT_SETTLEMENT",
  });

  if (error) throw error;
  return data;
}

export async function rejectWithdrawal(requestId: string, reason: string) {
  const { data, error } = await supabase.rpc("reject_withdrawal", {
    p_request_id: requestId,
    p_reason: reason,
  });

  if (error) throw error;
  return data;
}

export async function fetchFinancialLedger(limit = 100) {
  const { data, error } = await supabase
    .from("financial_ledger")
    .select("*, investor_accounts(account_number)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchPlatformConfig() {
  const { data, error } = await supabase
    .from("platform_configuration")
    .select("*")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function runSystemReconciliation(): Promise<ReconciliationCheck[]> {
  const { data, error } = await supabase.rpc("reconcile_financial_system");
  if (error) throw error;
  return (data ?? []) as ReconciliationCheck[];
}

export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function triggerTradeParticipationSnapshot(tradeId: string) {
  const { data, error } = await supabase.rpc("snapshot_trade_participations", {
    p_trade_id: tradeId,
  });

  if (error) throw error;
  return data;
}

export async function triggerTradeResultAllocation(tradeId: string) {
  const { data, error } = await supabase.rpc("process_trade_result_allocation", {
    p_trade_id: tradeId,
  });

  if (error) throw error;
  return data;
}

export async function onboardInvestorAccount(params: {
  userId: string;
  accountNumber?: string;
  currency?: string;
  status?: InvestorAccountStatus;
}) {
  const accNum =
    params.accountNumber?.trim() ||
    `MF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("investor_accounts")
    .insert({
      user_id: params.userId,
      account_number: accNum,
      currency: params.currency || "USD",
      status: params.status || "ACTIVE",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchEligibleUsersForOnboarding() {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, subscription_tier")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
