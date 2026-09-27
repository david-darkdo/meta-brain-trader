import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCompanyFinancialSummary,
  fetchAllInvestors,
  fetchAllCapitalEvents,
  activateInvestorCapital,
  fetchInvestmentCycles,
  createInvestmentCycle,
  activateInvestmentCycle,
  closeInvestmentCycle,
  fetchAllWithdrawals,
  approveWithdrawal,
  settleWithdrawal,
  rejectWithdrawal,
  fetchFinancialLedger,
  fetchPlatformConfig,
  runSystemReconciliation,
  fetchAuditLogs,
  type CompanySummary,
  type ReconciliationCheck,
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
  ShieldAlert,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Activity,
  Sliders,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/command-center")({
  beforeLoad: async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw redirect({ to: "/auth" });
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "ADMIN");
      if (!isAdmin) {
        throw redirect({ to: "/validator" });
      }
    } catch (err: any) {
      if (err?.to || err?.isRedirect) throw err;
      throw redirect({ to: "/validator" });
    }
  },
  head: () => ({ meta: [{ title: "Command Center — MetaFund Operations" }] }),
  component: CompanyCommandCenter,
});

function CompanyCommandCenter() {
  const qc = useQueryClient();

  // State for Modals
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("USD");
  const [depositFxRate, setDepositFxRate] = useState("1.0");

  const [isCycleOpen, setIsCycleOpen] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [cycleInvestorSplit, setCycleInvestorSplit] = useState("70");
  const [cycleCompanySplit, setCycleCompanySplit] = useState("30");

  // 1. Company Financial Summary
  const summaryQ = useQuery({
    queryKey: ["admin", "company_summary"],
    queryFn: fetchCompanyFinancialSummary,
  });

  // 2. Investors List
  const investorsQ = useQuery({
    queryKey: ["admin", "investors"],
    queryFn: fetchAllInvestors,
  });

  // 3. Capital Events
  const capitalEventsQ = useQuery({
    queryKey: ["admin", "capital_events"],
    queryFn: fetchAllCapitalEvents,
  });

  // 4. Investment Cycles
  const cyclesQ = useQuery({
    queryKey: ["admin", "cycles"],
    queryFn: fetchInvestmentCycles,
  });

  // 5. Withdrawals
  const withdrawalsQ = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: fetchAllWithdrawals,
  });

  // 6. Financial Ledger
  const ledgerQ = useQuery({
    queryKey: ["admin", "ledger"],
    queryFn: () => fetchFinancialLedger(100),
  });

  // 7. Platform Config
  const configQ = useQuery({
    queryKey: ["admin", "platform_config"],
    queryFn: fetchPlatformConfig,
  });

  // 8. Reconciliation Engine
  const reconQ = useQuery({
    queryKey: ["admin", "reconciliation"],
    queryFn: runSystemReconciliation,
  });

  // 9. Audit Logs
  const auditLogsQ = useQuery({
    queryKey: ["admin", "audit_logs"],
    queryFn: () => fetchAuditLogs(50),
  });

  // MUTATIONS
  const activateCapitalMut = useMutation({
    mutationFn: async () => {
      if (!selectedInvestorId) throw new Error("Select an investor account.");
      const amt = Number(depositAmount);
      const fx = Number(depositFxRate);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid deposit amount.");
      if (isNaN(fx) || fx <= 0) throw new Error("Enter a valid exchange rate.");

      return activateInvestorCapital({
        investorId: selectedInvestorId,
        amount: amt,
        currency: depositCurrency,
        exchangeRate: fx,
        fxSource: depositCurrency === "USD" ? "BASE_CURRENCY" : "ADMIN_OPERATOR",
      });
    },
    onSuccess: () => {
      toast.success("Capital activated and posted to immutable ledger successfully.");
      setIsDepositOpen(false);
      setDepositAmount("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to activate capital."),
  });

  const createCycleMut = useMutation({
    mutationFn: async () => {
      if (!cycleName || !cycleStartDate || !cycleEndDate) throw new Error("Fill in all cycle fields.");
      const invSplit = Number(cycleInvestorSplit);
      const compSplit = Number(cycleCompanySplit);
      if (invSplit + compSplit !== 100) throw new Error("Profit splits must sum to exactly 100%.");

      return createInvestmentCycle({
        name: cycleName,
        startDate: new Date(cycleStartDate).toISOString(),
        endDate: new Date(cycleEndDate).toISOString(),
        investorSplit: invSplit,
        companySplit: compSplit,
      });
    },
    onSuccess: () => {
      toast.success("Investment cycle created.");
      setIsCycleOpen(false);
      setCycleName("");
      qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create cycle."),
  });

  const s = summaryQ.data;

  // Authorization / Loading Guard
  if (summaryQ.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center space-x-2">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Loading Company Command Center...</span>
      </div>
    );
  }

  if (summaryQ.isError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Access Denied or Initialization Error
          </CardTitle>
          <CardDescription>
            Only authorized administrators can access the Company Command Center.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalEquity = Number(s?.total_economic_equity ?? 0);
  const totalAvailable = Number(s?.total_available_capital ?? 0);
  const totalCommitted = Number(s?.total_active_committed_capital ?? 0);
  const companyProfitShare = Number(s?.pending_company_profit_share ?? 0);
  const totalDeposited = Number(s?.total_deposited ?? 0);
  const totalWithdrawn = Number(s?.total_withdrawn ?? 0);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="space-y-4">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Profile & Settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Company Command Center</h1>
              <Badge variant="outline" className="border-primary text-primary">ADMIN OPERATIONAL ENGINE</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Financial controls, multi-currency activation, risk basis governance, and ledger auditing.
            </p>
          </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh System
          </Button>

          <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle className="h-4 w-4 mr-1" /> Activate Capital
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Activate Investor Capital</DialogTitle>
                <DialogDescription>
                  Atomically records capital event and posts immutable entry to financial ledger.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1">
                  <Label>Investor Account</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedInvestorId}
                    onChange={(e) => setSelectedInvestorId(e.target.value)}
                  >
                    <option value="">Select Investor Account...</option>
                    {investorsQ.data?.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.account_number} ({inv.users?.email || inv.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nominal Amount</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="10000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Currency</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={depositCurrency}
                      onChange={(e) => {
                        const cur = e.target.value;
                        setDepositCurrency(cur);
                        if (cur === "USD") setDepositFxRate("1.0");
                        else if (cur === "EUR") setDepositFxRate("1.08");
                        else if (cur === "GBP") setDepositFxRate("1.31");
                      }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="NGN">NGN (₦)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Exchange Rate to USD</Label>
                  <Input
                    type="number"
                    step="any"
                    value={depositFxRate}
                    onChange={(e) => setDepositFxRate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculated Base USD: ${(Number(depositAmount || 0) * Number(depositFxRate || 1)).toFixed(2)} USD
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Cancel</Button>
                <Button disabled={activateCapitalMut.isPending} onClick={() => activateCapitalMut.mutate()}>
                  {activateCapitalMut.isPending ? "Activating..." : "Confirm & Activate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

      {/* METRIC OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Economic Equity</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {s?.total_investors ?? 0} investor accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Capital</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${totalAvailable.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uncommitted liquidity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Committed in Trades</CardTitle>
            <Lock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ${totalCommitted.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{s?.open_trades_count ?? 0} active open trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Company Share</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              ${companyProfitShare.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Realized company profit fee</p>
          </CardContent>
        </Card>
      </div>

      {/* TABS SECTIONS */}
      <Tabs defaultValue="investors" className="space-y-4">
        <TabsList className="grid grid-cols-3 sm:grid-cols-7 w-full">
          <TabsTrigger value="investors">Investors</TabsTrigger>
          <TabsTrigger value="capital">Capital</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* INVESTORS TAB */}
        <TabsContent value="investors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investor Accounts</CardTitle>
              <CardDescription>Governed investor profiles and current active status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Account Number</th>
                      <th className="py-2 px-3">User Email</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Base Currency</th>
                      <th className="py-2 px-3">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investorsQ.data?.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono font-semibold">{inv.account_number}</td>
                        <td className="py-2 px-3">{inv.users?.email || inv.user_id}</td>
                        <td className="py-2 px-3">
                          <Badge variant={inv.status === "ACTIVE" ? "default" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{inv.currency ?? "USD"}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPITAL EVENTS TAB */}
        <TabsContent value="capital" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Multi-Currency Capital Events</CardTitle>
              <CardDescription>Authoritative deposit and activation records with FX audit traceability.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3">Event Type</th>
                      <th className="py-2 px-3">Nominal Amount</th>
                      <th className="py-2 px-3">FX Rate</th>
                      <th className="py-2 px-3">Base USD</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capitalEventsQ.data?.map((ce: any) => (
                      <tr key={ce.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground">{new Date(ce.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono">{ce.investor_accounts?.account_number || "—"}</td>
                        <td className="py-2 px-3">{ce.event_type}</td>
                        <td className="py-2 px-3 font-mono font-semibold">
                          {Number(ce.original_amount || ce.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {ce.original_currency || ce.currency}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                          {Number(ce.exchange_rate_to_usd || 1).toFixed(6)}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">
                          ${Number(ce.base_amount_usd || ce.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={ce.status === "ACTIVATED" ? "default" : "secondary"}>
                            {ce.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CYCLES TAB */}
        <TabsContent value="cycles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Investment Cycles</CardTitle>
                <CardDescription>Governing terms and historical split snapshots.</CardDescription>
              </div>
              <Dialog open={isCycleOpen} onOpenChange={setIsCycleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" /> New Cycle</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Investment Cycle</DialogTitle>
                    <DialogDescription>Define governing profit-share terms for the cycle.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-1">
                      <Label>Cycle Name</Label>
                      <Input placeholder="Q4 2026 Strategy Cycle" value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Start Date</Label>
                        <Input type="date" value={cycleStartDate} onChange={(e) => setCycleStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>End Date</Label>
                        <Input type="date" value={cycleEndDate} onChange={(e) => setCycleEndDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Investor Share (%)</Label>
                        <Input type="number" value={cycleInvestorSplit} onChange={(e) => setCycleInvestorSplit(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Company Share (%)</Label>
                        <Input type="number" value={cycleCompanySplit} onChange={(e) => setCycleCompanySplit(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCycleOpen(false)}>Cancel</Button>
                    <Button disabled={createCycleMut.isPending} onClick={() => createCycleMut.mutate()}>
                      {createCycleMut.isPending ? "Creating..." : "Create Cycle"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Cycle Name</th>
                      <th className="py-2 px-3">Start Date</th>
                      <th className="py-2 px-3">End Date</th>
                      <th className="py-2 px-3">Investor Split</th>
                      <th className="py-2 px-3">Company Split</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cyclesQ.data?.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-semibold">{c.cycle_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{new Date(c.start_date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-muted-foreground">{new Date(c.end_date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{c.profit_split_investor_pct}%</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-500">{c.profit_split_company_pct}%</td>
                        <td className="py-2 px-3">
                          <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          {c.status === "UPCOMING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await activateInvestmentCycle(c.id);
                                toast.success(`Cycle ${c.cycle_name} activated.`);
                                qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
                              }}
                            >
                              Activate
                            </Button>
                          )}
                          {c.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await closeInvestmentCycle(c.id);
                                toast.success(`Cycle ${c.cycle_name} closed.`);
                                qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
                              }}
                            >
                              Close
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WITHDRAWALS TAB */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Withdrawal Request Management</CardTitle>
              <CardDescription>Controlled review, approval, and settlement workflows.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Requested At</th>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3">Amount ($ USD)</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalsQ.data?.map((w: any) => (
                      <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono">{w.investor_accounts?.account_number || "—"}</td>
                        <td className="py-2 px-3 font-mono font-bold">${Number(w.requested_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
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
                        <td className="py-2 px-3 flex gap-2">
                          {w.status === "REQUESTED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await approveWithdrawal(w.id);
                                    toast.success("Withdrawal approved.");
                                    qc.invalidateQueries({ queryKey: ["admin"] });
                                  } catch (e: any) {
                                    toast.error(e?.message || "Failed to approve.");
                                  }
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  try {
                                    await rejectWithdrawal(w.id, "Admin rejection");
                                    toast.success("Withdrawal rejected.");
                                    qc.invalidateQueries({ queryKey: ["admin"] });
                                  } catch (e: any) {
                                    toast.error(e?.message || "Failed to reject.");
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {w.status === "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await settleWithdrawal(w.id, "BANK_TRANSFER_COMPLETED");
                                  toast.success("Withdrawal settled and ledger payout posted.");
                                  qc.invalidateQueries({ queryKey: ["admin"] });
                                } catch (e: any) {
                                  toast.error(e?.message || "Failed to settle.");
                                }
                              }}
                            >
                              Settle Payout
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCIAL LEDGER TAB */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Immutable Financial Ledger</CardTitle>
              <CardDescription>Append-only audit trail protected by database engine mutation triggers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3">Event Type</th>
                      <th className="py-2 px-3">Base Amount ($ USD)</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Idempotency Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerQ.data?.map((l: any) => (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground text-xs">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono">{l.investor_accounts?.account_number || "—"}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline">{l.event_type}</Badge>
                        </td>
                        <td className={`py-2 px-3 font-mono font-bold ${Number(l.amount) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {Number(l.amount) >= 0 ? "+" : ""}${Number(l.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-xs max-w-sm truncate">{l.description}</td>
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground truncate max-w-xs">{l.idempotency_key}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECONCILIATION TAB */}
        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">16-Point Financial Invariant Reconciliation</CardTitle>
                <CardDescription>Mathematical and structural invariant validator running on live engine.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => reconQ.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Run Invariants
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Check Code</th>
                      <th className="py-2 px-3">Invariant Name</th>
                      <th className="py-2 px-3">Severity</th>
                      <th className="py-2 px-3">Discrepancies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconQ.data?.map((rc: ReconciliationCheck, idx: number) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-mono font-semibold">{rc.check_code}</td>
                        <td className="py-2 px-3">{rc.check_name}</td>
                        <td className="py-2 px-3">
                          <Badge variant={rc.severity === "OK" ? "default" : "destructive"}>
                            {rc.severity}
                          </Badge>
                        </td>
                        <td className={`py-2 px-3 font-mono font-bold ${rc.discrepancy_count === 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {rc.discrepancy_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operational Audit Trail</CardTitle>
              <CardDescription>Immutable activity trail of all administrative and financial actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Table</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Performed By</th>
                      <th className="py-2 px-3">Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogsQ.data?.map((al: any) => (
                      <tr key={al.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-muted-foreground text-xs">{new Date(al.created_at).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-xs">{al.table_name}</td>
                        <td className="py-2 px-3"><Badge variant="outline">{al.action}</Badge></td>
                        <td className="py-2 px-3 font-mono text-xs">{al.performed_by || "SYSTEM"}</td>
                        <td className="py-2 px-3 font-mono text-xs max-w-md truncate text-muted-foreground">
                          {JSON.stringify(al.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
