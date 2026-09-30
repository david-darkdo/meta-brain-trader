import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchInvestorSummary,
  fetchInvestorTradeHistory,
  fetchInvestorWithdrawalRequests,
  requestInvestorWithdrawal,
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
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Calendar,
  Wallet,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metafund")({
  head: () => ({ meta: [{ title: "MetaFund — Investor Platform" }] }),
  component: InvestorMetaFundDashboard,
});

function InvestorMetaFundDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"trades" | "withdrawals" | "capital">("trades");
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
        throw new Error(
          `Requested amount ($${amt}) exceeds available capital ($${summaryQ.data.available_capital ?? 0}).`
        );
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
        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
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
            {(summaryQ.error as any)?.message ||
              "An error occurred while connecting to the financial engine."}
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
      <div className="mx-auto max-w-xl text-center py-16 px-4 space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.12)]">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            MetaFund
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Investor access not activated.
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Your MetaFund investor account has not yet been onboarded.
          </p>
          <p className="text-xs text-muted-foreground/80 max-w-md mx-auto leading-relaxed pt-1">
            If you are an authorized company administrator, complete investor onboarding from{" "}
            <span className="text-foreground font-medium">Company Command Center</span>.
          </p>
        </div>
      </div>
    );
  }

  const equity = Number(s.current_economic_equity ?? 0);
  const available = Number(s.available_capital ?? 0);
  const committed = Number(s.active_committed_capital ?? 0);
  const pnl = Number(s.realized_trading_pnl ?? 0);
  const deposited = Number(s.cumulative_deposited ?? 0);
  const withdrawn = Number(s.cumulative_withdrawn ?? 0);
  const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* 1. PLATFORM TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
            MetaFund
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your Capital. Our Discipline. Shared Growth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["investor"] })}
            className="border-border/80 bg-secondary/40 text-xs h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>

          <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={available <= 0} className="gold-gradient-btn text-xs h-8">
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Request Withdrawal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Request Capital Withdrawal</DialogTitle>
                <DialogDescription>
                  Available uncommitted balance:{" "}
                  <span className="font-semibold text-amber-400">
                    ${available.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs text-muted-foreground">Withdrawal Amount ($ USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="any"
                    placeholder="e.g. 1000"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs text-muted-foreground">Payout Instructions / Destination</Label>
                  <Input
                    id="notes"
                    placeholder="e.g. USDT TRC20 / Bank account"
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gold-gradient-btn"
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

      {/* 2. HERO TOTAL ECONOMIC EQUITY CARD */}
      <div className="relative overflow-hidden rounded-2xl gold-card-hero p-5 sm:p-7">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Economic Equity
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                pnl >= 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {pnl >= 0 ? "+" : ""}
              {pnlPct.toFixed(2)}%
            </span>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight font-mono">
              ${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">All-Time Performance Base (USD)</p>
          </div>

          {/* 3-METRIC STRIP */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-amber-500/20 text-left">
            <div>
              <div className="text-xs text-muted-foreground">Invested</div>
              <div className="text-sm sm:text-base font-bold text-foreground font-mono mt-0.5">
                ${deposited.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Total P&L</div>
              <div
                className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                  pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Available</div>
              <div className="text-sm sm:text-base font-bold text-amber-400 font-mono mt-0.5">
                ${available.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRIMARY 4 NAVIGATION CARDS (2x2 GRID) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* MY PARTICIPATIONS */}
        <button
          type="button"
          onClick={() => setActiveTab("trades")}
          className={`group flex flex-col justify-between rounded-xl border p-4 sm:p-5 text-left transition-all ${
            activeTab === "trades"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
            <Layers className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              My Participations
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {s.open_trades_count ?? 0} active · ${committed.toLocaleString("en-US", { minimumFractionDigits: 0 })} committed
            </p>
          </div>
        </button>

        {/* INVESTMENT CYCLES */}
        <button
          type="button"
          onClick={() => setActiveTab("capital")}
          className={`group flex flex-col justify-between rounded-xl border p-4 sm:p-5 text-left transition-all ${
            activeTab === "capital"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:scale-105 transition-transform">
            <Calendar className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Investment Cycles
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              70% / 30% standard profit split
            </p>
          </div>
        </button>

        {/* WITHDRAWALS */}
        <button
          type="button"
          onClick={() => setActiveTab("withdrawals")}
          className={`group flex flex-col justify-between rounded-xl border p-4 sm:p-5 text-left transition-all ${
            activeTab === "withdrawals"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:scale-105 transition-transform">
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Withdrawals
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${available.toLocaleString("en-US", { minimumFractionDigits: 0 })} withdrawable cash
            </p>
          </div>
        </button>

        {/* PERFORMANCE */}
        <button
          type="button"
          onClick={() => setActiveTab("capital")}
          className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 text-left transition-all hover:bg-card hover:border-border"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:scale-105 transition-transform">
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Performance
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {s.closed_trades_count ?? 0} settled trades
            </p>
          </div>
        </button>
      </div>

      {/* 4. RECENT ACTIVITY & DETAILED TABS */}
      <div className="space-y-4 pt-2">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <TabsList className="bg-secondary/40 border border-border/60">
              <TabsTrigger value="trades" className="text-xs data-[state=active]:text-amber-400">
                Participations
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="text-xs data-[state=active]:text-amber-400">
                Withdrawals
              </TabsTrigger>
              <TabsTrigger value="capital" className="text-xs data-[state=active]:text-amber-400">
                Capital Flow
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PARTICIPATIONS TAB */}
          <TabsContent value="trades" className="space-y-3">
            {!tradeHistoryQ.data || tradeHistoryQ.data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
                <p className="text-sm text-muted-foreground font-medium">No Trade Participations Recorded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When trades are executed in Meta Validator, your participating capital snapshot will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tradeHistoryQ.data.map((t: InvestorTradeHistoryRow, idx: number) => {
                  const netPnl = Number(t.investor_net_pnl ?? 0);
                  const isPositive = netPnl >= 0;
                  const isCommitted = t.status === "COMMITTED";

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-amber-400">
                          <Layers className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {t.pair ?? "TRADE"}{" "}
                            <span className="text-xs text-muted-foreground font-normal">· {t.direction}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Snapshot: ${Number(t.participating_capital_snapshot ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} · Risk: ${Number(t.risk_amount ?? 0).toFixed(2)} ({t.risk_pct}%)
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isCommitted ? (
                          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                            COMMITTED
                          </Badge>
                        ) : (
                          <div className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                            {isPositive ? "+" : ""}${netPnl.toFixed(2)}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {t.result_pnl_percent !== null ? `${t.result_pnl_percent > 0 ? "+" : ""}${t.result_pnl_percent}% trade` : "In execution"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* WITHDRAWALS TAB */}
          <TabsContent value="withdrawals" className="space-y-3">
            {!withdrawalsQ.data || withdrawalsQ.data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
                <p className="text-sm text-muted-foreground font-medium">No Withdrawal Requests</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have not submitted any withdrawal requests.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {withdrawalsQ.data.map((w: any) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-amber-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground font-mono">
                          ${Number(w.requested_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant={
                        w.status === "PROCESSED"
                          ? "default"
                          : w.status === "APPROVED"
                            ? "outline"
                            : w.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                      }
                      className="text-xs"
                    >
                      {w.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CAPITAL FLOW TAB */}
          <TabsContent value="capital" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">Capital Position Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="text-muted-foreground">Cumulative Deposited</span>
                    <span className="font-mono font-semibold">${deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="text-muted-foreground">Cumulative Withdrawn</span>
                    <span className="font-mono font-semibold">${withdrawn.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="text-muted-foreground">Net Contributed</span>
                    <span className="font-mono font-semibold">${(deposited - withdrawn).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Total Economic Equity</span>
                    <span className="font-mono font-bold text-amber-400">${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">Cycle & Allocation Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>• Standard 70% Investor / 30% Company profit split on positive closed trades.</p>
                  <p>• 100% loss absorption by capital pool with $0 company cut on negative results.</p>
                  <p>• Idempotent immutable ledger postings for all balance changes.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
