import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchInvestorSummary,
  fetchInvestorTradeHistory,
  fetchInvestorWithdrawalRequests,
  requestInvestorWithdrawal,
  type InvestorSummary,
  type InvestorTradeHistoryRow,
} from "@/lib/metafund-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metafund")({
  head: () => ({ meta: [{ title: "MetaFund — Investor Dashboard" }] }),
  component: InvestorMetaFundDashboard,
});

function InvestorMetaFundDashboard() {
  const qc = useQueryClient();
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // 1. Fetch Investor Financial Summary
  const summaryQ = useQuery({
    queryKey: ["investor", "financial_summary"],
    queryFn: fetchInvestorSummary,
  });

  // 2. Fetch Investor Trade Participation History
  const tradeHistoryQ = useQuery({
    queryKey: ["investor", "trade_history"],
    queryFn: fetchInvestorTradeHistory,
  });

  // 3. Fetch Investor Withdrawal Requests
  const withdrawalsQ = useQuery({
    queryKey: ["investor", "withdrawals", summaryQ.data?.investor_id],
    queryFn: () =>
      summaryQ.data?.investor_id
        ? fetchInvestorWithdrawalRequests(summaryQ.data.investor_id)
        : Promise.resolve([]),
    enabled: !!summaryQ.data?.investor_id,
  });

  // 4. Withdrawal Request Mutation
  const requestWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!summaryQ.data?.investor_id) throw new Error("No active investor account found.");
      const amt = Number(withdrawalAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Please enter a valid positive withdrawal amount.");
      if (amt > (summaryQ.data.available_capital ?? 0)) {
        throw new Error(`Requested amount ($${amt}) exceeds available capital ($${summaryQ.data.available_capital ?? 0}).`);
      }

      return requestInvestorWithdrawal({
        accountId: summaryQ.data.investor_id,
        amount: amt,
        notes: withdrawalNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal request submitted successfully.");
      setIsWithdrawModalOpen(false);
      setWithdrawalAmount("");
      setWithdrawalNotes("");
      qc.invalidateQueries({ queryKey: ["investor"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit withdrawal request.");
    },
  });

  const s = summaryQ.data;

  // Loading State
  if (summaryQ.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center space-x-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Loading MetaFund investor position...</span>
      </div>
    );
  }

  // Error State
  if (summaryQ.isError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" /> Failed to load MetaFund position
          </CardTitle>
          <CardDescription>
            {(summaryQ.error as any)?.message || "An error occurred while connecting to the financial engine."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => summaryQ.refetch()}>
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty / No Account State
  if (!s || !s.investor_id) {
    return (
      <div className="mx-auto max-w-2xl text-center py-16 space-y-4">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold tracking-tight">No Active Investor Account</h2>
        <p className="text-muted-foreground text-sm">
          Your profile is not currently registered as an active MetaFund investor. Please contact the fund administrator for capital onboarding.
        </p>
      </div>
    );
  }

  const equity = Number(s.current_economic_equity ?? 0);
  const available = Number(s.available_capital ?? 0);
  const committed = Number(s.active_committed_capital ?? 0);
  const pnl = Number(s.realized_trading_pnl ?? 0);
  const deposited = Number(s.cumulative_deposited ?? 0);
  const withdrawn = Number(s.cumulative_withdrawn ?? 0);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">MetaFund</h1>
            <Badge variant={s.account_status === "ACTIVE" ? "default" : "secondary"}>
              {s.account_status ?? "ACTIVE"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Account: <span className="font-mono text-foreground">{s.account_number}</span> · Accounting Base: <span className="font-semibold text-foreground">USD</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["investor"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>

          <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={available <= 0}>
                <ArrowUpRight className="h-4 w-4 mr-1" /> Request Withdrawal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Request Capital Withdrawal</DialogTitle>
                <DialogDescription>
                  Available uncommitted balance: <span className="font-semibold text-foreground">${available.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">Withdrawal Amount ($ USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="any"
                    placeholder="e.g. 5000"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Notes / Payout Instructions (Optional)</Label>
                  <Input
                    id="notes"
                    placeholder="e.g. USDT TRC20 / Bank account"
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={requestWithdrawalMutation.isPending || !withdrawalAmount}
                  onClick={() => requestWithdrawalMutation.mutate()}
                >
                  {requestWithdrawalMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Economic Equity</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Total economic equity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Cash</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${available.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uncommitted & withdrawable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Committed Capital</CardTitle>
            <Lock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ${committed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Locked in {s.open_trades_count ?? 0} active open trade(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realized Trading P&L</CardTitle>
            <TrendingUp className={`h-4 w-4 ${pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{s.closed_trades_count ?? 0} closed trade allocations</p>
          </CardContent>
        </Card>
      </div>

      {/* TABS NAVIGATION */}
      <Tabs defaultValue="trades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trades">Trade Participations</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="capital">Capital Flow</TabsTrigger>
        </TabsList>

        {/* TRADES TAB */}
        <TabsContent value="trades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trade Participation History</CardTitle>
              <CardDescription>
                Authoritative per-trade execution participation, risk allocations, and net profit-share outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tradeHistoryQ.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading participations...</div>
              ) : tradeHistoryQ.data && tradeHistoryQ.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Pair</th>
                        <th className="py-2 px-3">Direction</th>
                        <th className="py-2 px-3">Participating Capital</th>
                        <th className="py-2 px-3">Risk Amt</th>
                        <th className="py-2 px-3">Trade Result</th>
                        <th className="py-2 px-3">Gross P&L</th>
                        <th className="py-2 px-3">Investor Net Share</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHistoryQ.data.map((t: InvestorTradeHistoryRow, idx: number) => {
                        const netPnl = Number(t.investor_net_pnl ?? 0);
                        const grossPnl = Number(t.investor_gross_pnl ?? 0);
                        return (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 text-muted-foreground">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-2 px-3 font-semibold">{t.pair ?? "—"}</td>
                            <td className="py-2 px-3">
                              <Badge variant={t.direction === "BUY" ? "default" : "secondary"}>
                                {t.direction ?? "—"}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 font-mono">
                              ${Number(t.participating_capital_snapshot ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 font-mono text-muted-foreground">
                              ${Number(t.risk_amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ({t.risk_pct ?? 2}%)
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              {t.result_pnl_percent !== null ? `${t.result_pnl_percent > 0 ? "+" : ""}${t.result_pnl_percent}%` : "OPEN"}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {t.investor_gross_pnl !== null ? `${grossPnl >= 0 ? "+" : ""}$${grossPnl.toFixed(2)}` : "—"}
                            </td>
                            <td className={`py-2 px-3 font-mono font-bold ${netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              {t.investor_net_pnl !== null ? `${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={t.status === "ALLOCATED" ? "outline" : "default"}>
                                {t.status ?? "COMMITTED"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground space-y-1">
                  <p className="text-base font-medium">No Trade Participations Yet</p>
                  <p className="text-xs">When the trade engine executes eligible trades, your participating capital will snapshot here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WITHDRAWALS TAB */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Withdrawal Requests</CardTitle>
              <CardDescription>
                Track the status of your requested capital withdrawals from submission to final settlement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawalsQ.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading withdrawal records...</div>
              ) : withdrawalsQ.data && withdrawalsQ.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2 px-3">Requested At</th>
                        <th className="py-2 px-3">Amount ($ USD)</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Processed Date</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawalsQ.data.map((w: any) => (
                        <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 text-muted-foreground">
                            {new Date(w.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">
                            ${Number(w.requested_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={
                                w.status === "PROCESSED"
                                  ? "default"
                                  : w.status === "APPROVED"
                                  ? "outline"
                                  : w.status === "REJECTED" || w.status === "CANCELLED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {w.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {w.processed_at ? new Date(w.processed_at).toLocaleDateString() : "Pending"}
                          </td>
                          <td className="py-2 px-3 text-xs text-muted-foreground max-w-xs truncate">
                            {w.notes || w.rejection_reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-base font-medium">No Withdrawal Requests</p>
                  <p className="text-xs">You have not submitted any withdrawal requests.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPITAL FLOW TAB */}
        <TabsContent value="capital" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Capital Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">Total Cumulative Deposited</span>
                  <span className="font-mono font-semibold">${deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">Total Cumulative Withdrawn</span>
                  <span className="font-mono font-semibold">${withdrawn.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">Net Cumulative Contributed</span>
                  <span className="font-mono font-semibold">${(deposited - withdrawn).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Current Total Economic Equity</span>
                  <span className="font-mono font-bold text-primary">${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Governing Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  • Performance fee is calculated strictly on positive net profits under governing cycle terms.
                </p>
                <p>
                  • Trading losses do not incur any company performance fee and are absorbed by the capital pool.
                </p>
                <p>
                  • Capital committed in open trades is protected from withdrawal until trade settlement.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
