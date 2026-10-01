import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchCompanyFinancialSummary,
  fetchAllInvestors,
  fetchAdminRegisteredUsers,
  fetchAllCapitalEvents,
  fetchAllWithdrawals,
  fetchInvestmentCycles,
  fetchFinancialLedger,
  fetchPlatformConfig,
  runSystemReconciliation,
  fetchAuditLogs,
  activateInvestorCapital,
  createInvestmentCycle,
  activateInvestmentCycle,
  closeInvestmentCycle,
  approveWithdrawal,
  settleWithdrawal,
  rejectWithdrawal,
  type ReconciliationCheck,
} from "@/lib/metafund-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Lock,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Sliders,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/command-center")({
  head: () => ({ meta: [{ title: "Command Center — Administrative Control" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin", { p_user_id: data.user.id });
    if (roleError || !isAdmin) throw redirect({ to: "/profile" });
  },
  component: CommandCenterDashboard,
});

function CommandCenterDashboard() {
  const qc = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "investors" | "capital" | "cycles" | "withdrawals" | "ledger" | "payment_accounts" | "reconciliation" | "audit"
  >("overview");

  // State for Capital Activation Dialog
  const [isActivateCapitalOpen, setIsActivateCapitalOpen] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [activateAmount, setActivateAmount] = useState("");
  const [activateCurrency, setActivateCurrency] = useState("USD");
  const [activateFxRate, setActivateFxRate] = useState("1.0");
  const [activateNotes, setActivateNotes] = useState("");

  // State for Create Cycle Dialog
  const [isCreateCycleOpen, setIsCreateCycleOpen] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [cycleInvestorSplit, setCycleInvestorSplit] = useState("70");
  const [cycleCompanySplit, setCycleCompanySplit] = useState("30");
  const [cycleNotes, setCycleNotes] = useState("");

  // State for Reject Withdrawal Dialog
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlementRequestId, setSettlementRequestId] = useState("");
  const [settlementReference, setSettlementReference] = useState("");

  // State for Company Deposit Account
  const [paymentEditingId, setPaymentEditingId] = useState<string | null>(null);
  const [paymentMethodType, setPaymentMethodType] = useState<"BANK" | "CRYPTO">("BANK");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [paymentBankName, setPaymentBankName] = useState("");
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  const [paymentRoutingCode, setPaymentRoutingCode] = useState("");
  const [paymentSwiftCode, setPaymentSwiftCode] = useState("");
  const [paymentAsset, setPaymentAsset] = useState("BTC");
  const [paymentNetwork, setPaymentNetwork] = useState("BTC");
  const [paymentWalletAddress, setPaymentWalletAddress] = useState("");
  const [paymentMemoTag, setPaymentMemoTag] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [depositReviewId, setDepositReviewId] = useState<string | null>(null);
  const [depositReviewFxRate, setDepositReviewFxRate] = useState("1");
  const [depositReviewFxSource, setDepositReviewFxSource] = useState("MANUAL_ADMIN_VERIFICATION");
  const [depositReviewNotes, setDepositReviewNotes] = useState("");

  // 1. Company Financial Summary
  const companySummaryQ = useQuery({
    queryKey: ["admin", "company_summary"],
    queryFn: fetchCompanyFinancialSummary,
  });

  // 2. Investors List
  const investorsQ = useQuery({
    queryKey: ["admin", "investors"],
    queryFn: fetchAllInvestors,
  });

  // 3. Registered users
  const usersQ = useQuery({
    queryKey: ["admin", "registered_users"],
    queryFn: fetchAdminRegisteredUsers,
  });

  // 4. Capital Events
  const capitalEventsQ = useQuery({
    queryKey: ["admin", "capital_events"],
    queryFn: fetchAllCapitalEvents,
    refetchInterval: 15000,
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
    refetchInterval: 15000,
  });

  // 6. Financial Ledger
  const ledgerQ = useQuery({
    queryKey: ["admin", "ledger"],
    queryFn: () => fetchFinancialLedger(100),
  });

  // 7. Platform Config
  const configQ = useQuery({
    queryKey: ["admin", "config"],
    queryFn: fetchPlatformConfig,
  });

  // 8. Reconciliation Engine
  const reconciliationQ = useQuery({
    queryKey: ["admin", "reconciliation"],
    queryFn: runSystemReconciliation,
  });

  // Company Deposit Accounts
  const paymentAccountsQ = useQuery({
    queryKey: ["admin", "payment_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_payment_accounts").select("*").order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetPaymentForm = () => {
    setPaymentEditingId(null);
    setPaymentMethodType("BANK");
    setPaymentLabel("");
    setPaymentCurrency("USD");
    setPaymentBankName("");
    setPaymentAccountName("");
    setPaymentAccountNumber("");
    setPaymentRoutingCode("");
    setPaymentSwiftCode("");
    setPaymentAsset("BTC");
    setPaymentNetwork("BTC");
    setPaymentWalletAddress("");
    setPaymentMemoTag("");
    setPaymentInstructions("");
  };

  const editPaymentAccount = (a: any) => {
    setPaymentEditingId(a.id);
    setPaymentMethodType(a.method_type === "CRYPTO" ? "CRYPTO" : "BANK");
    setPaymentLabel(a.label || "");
    setPaymentCurrency(a.currency || "USD");
    setPaymentBankName(a.bank_name || "");
    setPaymentAccountName(a.account_name || "");
    setPaymentAccountNumber(a.account_number || "");
    setPaymentRoutingCode(a.routing_code || "");
    setPaymentSwiftCode(a.swift_code || "");
    setPaymentAsset(a.asset || a.currency || "BTC");
    setPaymentNetwork(a.network || "BTC");
    setPaymentWalletAddress(a.wallet_address || "");
    setPaymentMemoTag(a.memo_tag || "");
    setPaymentInstructions(a.instructions || "");
    setActiveTab("payment_accounts");
  };

  const savePaymentAccountMutation = useMutation({
    mutationFn: async () => {
      if (!paymentLabel.trim()) throw new Error("Account label is required.");
      if (paymentMethodType === "BANK" && (!paymentAccountName.trim() || !paymentAccountNumber.trim())) {
        throw new Error("Bank account name and account number are required.");
      }
      if (paymentMethodType === "CRYPTO" && (!paymentAsset.trim() || !paymentNetwork.trim() || !paymentWalletAddress.trim())) {
        throw new Error("Crypto asset, network and wallet address are required.");
      }

      const commonArgs = {
        p_label: paymentLabel,
        p_method_type: paymentMethodType,
        p_currency: paymentMethodType === "CRYPTO" ? paymentAsset.toUpperCase() : paymentCurrency.toUpperCase(),
        p_bank_name: paymentMethodType === "BANK" ? paymentBankName : "",
        p_account_name: paymentMethodType === "BANK" ? paymentAccountName : "",
        p_account_number: paymentMethodType === "BANK" ? paymentAccountNumber : "",
        p_routing_code: paymentMethodType === "BANK" ? paymentRoutingCode : "",
        p_swift_code: paymentMethodType === "BANK" ? paymentSwiftCode : "",
        p_asset: paymentMethodType === "CRYPTO" ? paymentAsset.toUpperCase() : "",
        p_network: paymentMethodType === "CRYPTO" ? paymentNetwork : "",
        p_wallet_address: paymentMethodType === "CRYPTO" ? paymentWalletAddress : "",
        p_memo_tag: paymentMethodType === "CRYPTO" ? paymentMemoTag : "",
        p_instructions: paymentInstructions,
        p_is_active: true,
        p_display_order: 0,
      };
      const result = paymentEditingId
        ? await supabase.rpc("admin_update_company_payment_account", { ...commonArgs, p_id: paymentEditingId })
        : await supabase.rpc("admin_create_company_payment_account", commonArgs);
      const { data, error } = result;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(paymentEditingId ? "Deposit account updated." : "Deposit account published.");
      resetPaymentForm();
      qc.invalidateQueries({ queryKey: ["admin", "payment_accounts"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save deposit account."),
  });

  const deactivatePaymentAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_deactivate_company_payment_account", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deposit account removed from investor deposit options.");
      if (paymentEditingId) resetPaymentForm();
      qc.invalidateQueries({ queryKey: ["admin", "payment_accounts"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to remove deposit account."),
  });


  const openDepositProof = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from("metafund-deposit-proofs").createSignedUrl(storagePath, 300);
    if (error) { toast.error(error.message || "Unable to open proof."); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const approveDepositMutation = useMutation({
    mutationFn: async () => {
      if (!depositReviewId) throw new Error("No deposit selected.");
      const rate = Number(depositReviewFxRate);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("Enter a valid USD conversion rate.");
      const { data, error } = await supabase.rpc("admin_approve_deposit_event", {
        p_event_id: depositReviewId,
        p_exchange_rate_to_usd: rate,
        p_fx_source: depositReviewFxSource,
        p_review_notes: depositReviewNotes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Deposit approved and capital activated.");
      setDepositReviewId(null); setDepositReviewFxRate("1"); setDepositReviewNotes("");
      qc.invalidateQueries({ queryKey: ["admin", "capital_events"] });
      qc.invalidateQueries({ queryKey: ["admin", "investors"] });
      qc.invalidateQueries({ queryKey: ["admin", "company_summary"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to approve deposit."),
  });

  const rejectDepositMutation = useMutation({
    mutationFn: async () => {
      if (!depositReviewId) throw new Error("No deposit selected.");
      if (!depositReviewNotes.trim()) throw new Error("Rejection reason is required.");
      const { data, error } = await supabase.rpc("admin_reject_deposit_event", {
        p_event_id: depositReviewId,
        p_review_notes: depositReviewNotes.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Deposit rejected. No capital was activated.");
      setDepositReviewId(null); setDepositReviewNotes("");
      qc.invalidateQueries({ queryKey: ["admin", "capital_events"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to reject deposit."),
  });

  // 9. Audit Logs
  const auditLogsQ = useQuery({
    queryKey: ["admin", "audit_logs"],
    queryFn: () => fetchAuditLogs(100),
  });

  // Mutations
  const activateCapitalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvestorId) throw new Error("Please select an investor.");
      const amt = Number(activateAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Amount must be greater than 0.");
      const fx = Number(activateFxRate);

      return activateInvestorCapital({
        investorId: selectedInvestorId,
        amount: amt,
        currency: activateCurrency,
        exchangeRate: isNaN(fx) ? 1.0 : fx,
        notes: activateNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Capital event activated and posted to ledger.");
      setIsActivateCapitalOpen(false);
      setActivateAmount("");
      setActivateNotes("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to activate capital event.");
    },
  });

  const createCycleMutation = useMutation({
    mutationFn: async () => {
      if (!cycleName || !cycleStartDate || !cycleEndDate) {
        throw new Error("Please fill in cycle name, start date, and end date.");
      }
      return createInvestmentCycle({
        name: cycleName,
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        investorSplit: Number(cycleInvestorSplit),
        companySplit: Number(cycleCompanySplit),
        notes: cycleNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Investment cycle created successfully.");
      setIsCreateCycleOpen(false);
      setCycleName("");
      setCycleNotes("");
      qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create cycle.");
    },
  });

  const activateCycleMutation = useMutation({
    mutationFn: (cycleId: string) => activateInvestmentCycle(cycleId),
    onSuccess: () => {
      toast.success("Cycle activated.");
      qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to activate cycle."),
  });

  const closeCycleMutation = useMutation({
    mutationFn: (cycleId: string) => closeInvestmentCycle(cycleId),
    onSuccess: () => {
      toast.success("Cycle closed and settled.");
      qc.invalidateQueries({ queryKey: ["admin", "cycles"] });
      qc.invalidateQueries({ queryKey: ["admin", "company_summary"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to close cycle."),
  });

  const approveWithdrawalMutation = useMutation({
    mutationFn: (requestId: string) => approveWithdrawal(requestId),
    onSuccess: () => {
      toast.success("Withdrawal approved.");
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to approve withdrawal."),
  });

  const settleWithdrawalMutation = useMutation({
    mutationFn: ({ requestId, reference }: { requestId: string; reference: string }) => {
      if (!reference.trim()) throw new Error("Settlement reference is required.");
      return settleWithdrawal(requestId, reference.trim());
    },
    onSuccess: () => {
      toast.success("Withdrawal marked as disbursed and settled.");
      setIsSettleOpen(false);
      setSettlementRequestId("");
      setSettlementReference("");
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin", "company_summary"] });
      qc.invalidateQueries({ queryKey: ["admin", "ledger"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to settle withdrawal."),
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!rejectReason) throw new Error("Please enter a rejection reason.");
      return rejectWithdrawal(selectedWithdrawalId, rejectReason);
    },
    onSuccess: () => {
      toast.success("Withdrawal request rejected.");
      setIsRejectOpen(false);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to reject withdrawal."),
  });

  const cs = companySummaryQ.data;
  const cfg = configQ.data;

  // Summary Metrics
  const totalEquity = Number(cs?.total_economic_equity ?? 0);
  const totalAvailable = Number(cs?.total_available_capital ?? 0);
  const totalCommitted = Number(cs?.total_active_committed_capital ?? 0);
  const totalNetPnl = Number(cs?.net_trading_pnl ?? 0);
  const activeInvestorsCount = Number(cs?.active_investors ?? 0);

  return (
    <div className="space-y-6">
      {/* 1. ADMIN PLATFORM HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              Command Center
            </h1>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] uppercase font-mono tracking-wider">
              ADMIN CONTROL
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Administrative Operations & Institutional Capital Governance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin"] })}
            className="border-border/80 bg-secondary/40 text-xs h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh All
          </Button>

          {/* ACTIVATE CAPITAL DIALOG */}
          <Dialog open={isActivateCapitalOpen} onOpenChange={setIsActivateCapitalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gold-gradient-btn text-xs h-8">
                <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Activate Capital
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Activate Investor Capital</DialogTitle>
                <DialogDescription>
                  Confirm and post an incoming deposit event into the immutable financial ledger.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="investor" className="text-xs text-muted-foreground">Investor Account</Label>
                  <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                    <SelectTrigger id="investor" className="bg-secondary/50 border-border">
                      <SelectValue placeholder="Select investor..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-56">
                      {investorsQ.data?.map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.account_number} ({inv.users?.email || inv.user_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs text-muted-foreground">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="any"
                      placeholder="e.g. 10000"
                      value={activateAmount}
                      onChange={(e) => setActivateAmount(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency" className="text-xs text-muted-foreground">Currency</Label>
                    <Select value={activateCurrency} onValueChange={setActivateCurrency}>
                      <SelectTrigger id="currency" className="bg-secondary/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fx" className="text-xs text-muted-foreground">FX Rate to USD</Label>
                    <Input
                      id="fx"
                      type="number"
                      step="any"
                      placeholder="1.0"
                      value={activateFxRate}
                      onChange={(e) => setActivateFxRate(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes / Ref</Label>
                    <Input
                      id="notes"
                      placeholder="Bank wire / ref code"
                      value={activateNotes}
                      onChange={(e) => setActivateNotes(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsActivateCapitalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gold-gradient-btn"
                  disabled={activateCapitalMutation.isPending || !selectedInvestorId || !activateAmount}
                  onClick={() => activateCapitalMutation.mutate()}
                >
                  {activateCapitalMutation.isPending ? "Posting..." : "Confirm & Post to Ledger"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* CREATE CYCLE DIALOG */}
          <Dialog open={isCreateCycleOpen} onOpenChange={setIsCreateCycleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-border/80 bg-secondary/40 text-xs h-8">
                <Plus className="h-3.5 w-3.5 mr-1" /> New Cycle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create Investment Cycle</DialogTitle>
                <DialogDescription>
                  Configure a new trading period with authoritative profit splits.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cname" className="text-xs text-muted-foreground">Cycle Name</Label>
                  <Input
                    id="cname"
                    placeholder="e.g. Q4 Growth Cycle 2026"
                    value={cycleName}
                    onChange={(e) => setCycleName(e.target.value)}
                    className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start" className="text-xs text-muted-foreground">Start Date</Label>
                    <Input
                      id="start"
                      type="date"
                      value={cycleStartDate}
                      onChange={(e) => setCycleStartDate(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end" className="text-xs text-muted-foreground">End Date</Label>
                    <Input
                      id="end"
                      type="date"
                      value={cycleEndDate}
                      onChange={(e) => setCycleEndDate(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="isplit" className="text-xs text-muted-foreground">Investor Split (%)</Label>
                    <Input
                      id="isplit"
                      type="number"
                      value={cycleInvestorSplit}
                      onChange={(e) => setCycleInvestorSplit(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="csplit" className="text-xs text-muted-foreground">Company Split (%)</Label>
                    <Input
                      id="csplit"
                      type="number"
                      value={cycleCompanySplit}
                      onChange={(e) => setCycleCompanySplit(e.target.value)}
                      className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateCycleOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gold-gradient-btn"
                  disabled={createCycleMutation.isPending}
                  onClick={() => createCycleMutation.mutate()}
                >
                  {createCycleMutation.isPending ? "Creating..." : "Create Cycle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2. RECONCILIATION SUMMARY ALERT */}
      {reconciliationQ.data && (
        <div
          className={`rounded-xl border p-4 flex items-center justify-between ${
            reconciliationQ.data.length === 0
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-400"
          }`}
        >
          <div className="flex items-center gap-3">
            {reconciliationQ.data.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                Financial Ledger Reconciliation Status:{" "}
                {reconciliationQ.data.length === 0 ? "100% BALANCED" : `${reconciliationQ.data.length} INVARIANTS FLAGGED`}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reconciliationQ.data.length === 0
                  ? "All double-entry invariants, snapshot participations, and ledger entries are mathematically verified."
                  : "Review discrepancy details in the Reconciliation tab immediately."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("reconciliation")}
            className="text-xs border-border/80 text-foreground"
          >
            Inspect Engine
          </Button>
        </div>
      )}

      {/* 3. HERO METRICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card/60 border-border/70">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Economic Pool
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
              ${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Available: ${totalAvailable.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/70">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Committed in Trades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
              ${totalCommitted.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {cs?.open_trades_count ?? 0} active trade executions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/70">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Realized P&L
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={`text-xl sm:text-2xl font-bold font-mono ${totalNetPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalNetPnl >= 0 ? "+" : ""}${totalNetPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {cs?.closed_trades_count ?? 0} closed trades
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/70">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company Profit Share
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-sm sm:text-base font-semibold text-foreground">Pending cycle settlement</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{activeInvestorsCount} active investor accounts · no company share is booked before settlement</p>
          </CardContent>
        </Card>
      </div>

      {/* 4. PRIMARY NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="border-b border-border/70 pb-2">
          <TabsList className="bg-secondary/40 border border-border/60 flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="overview" className="shrink-0 whitespace-nowrap text-xs data-[state=active]:text-amber-400">
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs data-[state=active]:text-amber-400">
              Users ({usersQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="investors" className="text-xs data-[state=active]:text-amber-400">
              Investors ({investorsQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="capital" className="text-xs data-[state=active]:text-amber-400">
              Capital Events ({capitalEventsQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="cycles" className="text-xs data-[state=active]:text-amber-400">
              Cycles ({cyclesQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="text-xs data-[state=active]:text-amber-400">
              Withdrawals ({withdrawalsQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs data-[state=active]:text-amber-400">
              Ledger
            </TabsTrigger>
            <TabsTrigger value="payment_accounts" className="text-xs data-[state=active]:text-amber-400">
              Deposit Accounts ({paymentAccountsQ.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs data-[state=active]:text-amber-400">
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs data-[state=active]:text-amber-400">
              Audit Trail
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card/60 border-border/70">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-400" /> Active Platform Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Config Version</span>
                  <span className="font-mono font-bold text-foreground">v{cfg?.version ?? "1"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Base Currency</span>
                  <span className="font-mono font-bold text-foreground">{cfg?.base_currency ?? "USD"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Investor Profit Share</span>
                  <span className="font-mono font-bold text-amber-400">{cfg?.investor_profit_share_pct ?? 70}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Company Profit Share</span>
                  <span className="font-mono font-bold text-foreground">{cfg?.company_profit_share_pct ?? 30}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Risk Basis Architecture</span>
                  <span className="font-mono text-emerald-400 font-bold">{cfg?.risk_basis ?? "FIXED_PERCENTAGE"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Loss Allocation Policy</span>
                  <span className="font-mono text-muted-foreground">100% Investor Pool / $0 Company Deducted</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border/70">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400" /> Operating Architecture & Invariants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>• <span className="text-foreground font-semibold">Immutable Financial Ledger:</span> No balance is ever directly updated. All balances are derived exclusively from ledger event aggregations.</p>
                <p>• <span className="text-foreground font-semibold">Execution-Time Snapshots:</span> When a trade is executed, investor capital snapshots are locked idempotently.</p>
                <p>• <span className="text-foreground font-semibold">70/30 Profit Allocation:</span> Realized gains are split 70% to investors and 30% to the company cut via atomic database triggers.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: USERS */}
        <TabsContent value="users" className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Registered Users</h3>
            <p className="text-xs text-muted-foreground mt-1">Every user who has created an account. MetaFund investor status is shown separately and does not require manual onboarding.</p>
          </div>
          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">User / Email</th><th className="p-3">Plan</th><th className="p-3">Joined</th><th className="p-3">MetaFund Account</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {usersQ.data?.map((u) => (
                  <tr key={u.user_id} className="hover:bg-secondary/20">
                    <td className="p-3 font-sans text-foreground">{u.email || u.user_id}</td>
                    <td className="p-3 font-mono text-muted-foreground">{u.subscription_tier || "—"}</td>
                    <td className="p-3 font-mono text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-mono text-muted-foreground">{u.investor_account_number || "Not opened yet"}</td>
                    <td className="p-3"><Badge variant={u.investor_status === "ACTIVE" ? "default" : "outline"} className="text-[10px]">{u.investor_status || "READY TO DEPOSIT"}</Badge></td>
                  </tr>
                ))}
                {!usersQ.isLoading && (usersQ.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">No registered users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 3: INVESTORS */}
        <TabsContent value="investors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Registered Investor Profiles</h3>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Account #</th>
                  <th className="p-3">User / Email</th>
                  <th className="p-3">Currency</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {investorsQ.data?.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-secondary/20">
                    <td className="p-3 font-bold text-foreground">{inv.account_number}</td>
                    <td className="p-3 font-sans text-muted-foreground">{inv.users?.email || inv.user_id}</td>
                    <td className="p-3 text-foreground">{inv.currency}</td>
                    <td className="p-3">
                      <Badge variant={inv.status === "ACTIVE" ? "default" : "outline"} className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-amber-400 hover:text-amber-300"
                        onClick={() => {
                          setSelectedInvestorId(inv.id);
                          setIsActivateCapitalOpen(true);
                        }}
                      >
                        + Add Capital
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 3: CAPITAL EVENTS */}
        <TabsContent value="capital" className="space-y-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-amber-400" /> Deposit Verification Queue</CardTitle>
              <CardDescription className="text-xs">Only deposits with submitted proof appear here. Approval is the only path that activates capital and posts the ledger event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(capitalEventsQ.data ?? []).filter((event: any) => event.status === "PENDING" && event.proof_storage_path).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No deposit proofs waiting for review.</div>
              ) : (
                (capitalEventsQ.data ?? []).filter((event: any) => event.status === "PENDING" && event.proof_storage_path).map((event: any) => (
                  <div key={event.id} className="rounded-xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-sm">{Number(event.amount ?? event.original_amount ?? 0).toLocaleString()} {event.currency}</span>
                          <Badge variant="outline" className="text-[10px]">PROOF SUBMITTED</Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">Submitted {event.proof_submitted_at ? new Date(event.proof_submitted_at).toLocaleString() : "—"} · Transaction ID: {event.transaction_reference || "Not provided"}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground font-mono break-all">Investor: {event.investor_id}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => openDepositProof(event.proof_storage_path)}>View Proof</Button>
                        <Button size="sm" className="h-8 gold-gradient-btn" onClick={() => { setDepositReviewId(event.id); setDepositReviewFxRate(event.currency === "USD" ? "1" : "1"); setDepositReviewNotes(""); }}>Review</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Capital Events & Deposits</h3>
            <Button size="sm" onClick={() => setIsActivateCapitalOpen(true)} className="gold-gradient-btn text-xs h-8">
              <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Activate Capital
            </Button>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Account</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payout Destination</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {capitalEventsQ.data?.map((ce: any) => (
                  <tr key={ce.id} className="hover:bg-secondary/20">
                    <td className="p-3 font-bold text-foreground">{ce.investor_accounts?.account_number || ce.investor_id}</td>
                    <td className="p-3 text-muted-foreground">{ce.event_type}</td>
                    <td className="p-3 font-bold text-foreground">
                      ${Number(ce.base_amount_usd || ce.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {ce.currency}
                    </td>
                    <td className="p-3">
                      <Badge variant={ce.status === "ACTIVATED" ? "default" : "outline"} className="text-[10px]">
                        {ce.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {new Date(ce.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 4: CYCLES */}
        <TabsContent value="cycles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Investment Cycles</h3>
            <Button size="sm" onClick={() => setIsCreateCycleOpen(true)} className="gold-gradient-btn text-xs h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Cycle
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cyclesQ.data?.map((c: any) => (
              <Card key={c.id} className="bg-card/60 border-border/70 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{c.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Cycle #{c.cycle_number} · {c.start_date} to {c.end_date}
                    </p>
                  </div>
                  <Badge variant={c.status === "ACTIVE" ? "default" : c.status === "SETTLED" ? "secondary" : "outline"}>
                    {c.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-border/60 py-2 font-mono">
                  <div>
                    <span className="text-muted-foreground">Investor Split:</span> {c.investor_profit_share_pct}%
                  </div>
                  <div>
                    <span className="text-muted-foreground">Company Split:</span> {c.company_profit_share_pct}%
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {c.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() => activateCycleMutation.mutate(c.id)}
                      disabled={activateCycleMutation.isPending}
                      className="gold-gradient-btn text-xs h-7"
                    >
                      Activate Cycle
                    </Button>
                  )}
                  {c.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => closeCycleMutation.mutate(c.id)}
                      disabled={closeCycleMutation.isPending}
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-7"
                    >
                      Close & Settle Cycle
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 5: WITHDRAWALS */}
        <TabsContent value="withdrawals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Withdrawal Requests Queue</h3>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Account</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Requested Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {withdrawalsQ.data?.map((w: any) => (
                  <tr key={w.id} className="hover:bg-secondary/20">
                    <td className="p-3 font-bold text-foreground">{w.investor_accounts?.account_number || w.investor_id}</td>
                    <td className="p-3 font-bold text-foreground">
                      ${Number(w.requested_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {w.currency || "USD"}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground font-sans max-w-xs">
                      {w.payout_details?.method === "BANK" ? (
                        <div>
                          <div className="font-semibold text-foreground">{w.payout_details.account_name || "Bank account"}</div>
                          <div>{w.payout_details.bank_name || "Bank"} · {w.payout_details.account_number || "No account"}</div>
                          <div>{w.payout_details.currency || w.currency || "USD"}</div>
                        </div>
                      ) : w.payout_details?.method === "CRYPTO" ? (
                        <div>
                          <div className="font-semibold text-foreground">{w.payout_details.asset || "Crypto"} · {w.payout_details.network || "Network"}</div>
                          <div className="font-mono break-all">{w.payout_details.wallet_address || "No wallet address"}</div>
                        </div>
                      ) : (
                        <span>Destination details not supplied</span>
                      )}
                    </td>
                    <td className="p-3">
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
                        className="text-[10px]"
                      >
                        {w.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {w.status === "REQUESTED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10"
                            onClick={() => approveWithdrawalMutation.mutate(w.id)}
                            disabled={approveWithdrawalMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            onClick={() => {
                              setSelectedWithdrawalId(w.id);
                              setIsRejectOpen(true);
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {w.status === "APPROVED" && (
                        <Button
                          size="sm"
                          className="gold-gradient-btn h-7 text-xs"
                          onClick={() => {
                            setSettlementRequestId(w.id);
                            setSettlementReference("");
                            setIsSettleOpen(true);
                          }}
                          disabled={settleWithdrawalMutation.isPending}
                        >
                          Disburse / Settle
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SETTLE WITHDRAWAL DIALOG */}
          <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Record Withdrawal Payout</DialogTitle>
                <DialogDescription>
                  Only use this after the payout has actually been sent to the investor's approved destination. Record the bank transfer ID, crypto transaction hash, or other provider reference.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settlement-ref" className="text-xs text-muted-foreground">Settlement / Payout Reference</Label>
                  <Input
                    id="settlement-ref"
                    placeholder="e.g. bank transfer ID or blockchain transaction hash"
                    value={settlementReference}
                    onChange={(e) => setSettlementReference(e.target.value)}
                    className="bg-secondary/50 border-border font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This changes the request from APPROVED to PROCESSED and posts the withdrawal to the financial ledger. It does not send money by itself.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettleOpen(false)}>Cancel</Button>
                <Button
                  className="gold-gradient-btn"
                  disabled={settleWithdrawalMutation.isPending || !settlementReference.trim()}
                  onClick={() => settleWithdrawalMutation.mutate({ requestId: settlementRequestId, reference: settlementReference })}
                >
                  {settleWithdrawalMutation.isPending ? "Recording..." : "Confirm Payout Sent"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* REJECT WITHDRAWAL DIALOG */}
          <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Reject Withdrawal Request</DialogTitle>
                <DialogDescription>
                  Enter an administrative reason for rejecting this withdrawal request.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rej-reason" className="text-xs text-muted-foreground">Rejection Reason</Label>
                  <Input
                    id="rej-reason"
                    placeholder="e.g. Account verification required / Invalid address"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="bg-secondary/50 border-border focus-visible:ring-amber-400"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={rejectWithdrawalMutation.isPending || !rejectReason}
                  onClick={() => rejectWithdrawalMutation.mutate()}
                >
                  {rejectWithdrawalMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 6: LEDGER */}
        <TabsContent value="ledger" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Immutable Financial Ledger Entries (Last 100)</h3>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Amount (USD)</th>
                  <th className="p-3">Running Balance</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {ledgerQ.data?.map((l: any) => {
                  const amt = Number(l.amount);
                  const isPositive = amt >= 0;

                  return (
                    <tr key={l.id} className="hover:bg-secondary/20">
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-foreground">{l.investor_accounts?.account_number || l.investor_id}</td>
                      <td className="p-3 text-muted-foreground">{l.event_type}</td>
                      <td className={`p-3 font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 font-bold text-amber-400">
                        ${Number(l.running_balance_after ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 font-sans text-muted-foreground text-[11px] truncate max-w-xs">
                        {l.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 7: RECONCILIATION */}
        <TabsContent value="reconciliation" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-foreground">Double-Entry Reconciliation Engine</h3>
              <p className="text-xs text-muted-foreground">Real-time evaluation of all 16 platform accounting invariants.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reconciliationQ.refetch()}
              className="text-xs border-border/80 h-8"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Re-evaluate Invariants
            </Button>
          </div>

          {!reconciliationQ.data || reconciliationQ.data.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-foreground">Zero Accounting Discrepancies</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                All capital allocations, trade snapshots, realized profit splits, and withdrawal ledger entries match system invariants.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reconciliationQ.data.map((r: ReconciliationCheck, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-rose-400 font-mono">
                      [{r.check_code}] {r.check_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Discrepancies: <span className="font-bold text-foreground">{r.discrepancy_count}</span> · Severity: {r.severity}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-xs font-mono">
                    ACTION REQUIRED
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: COMPANY DEPOSIT ACCOUNTS */}
        <TabsContent value="payment_accounts" className="space-y-4">
          <Card className="bg-card/60 border-border/70">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Company Deposit Accounts</CardTitle>
              <CardDescription className="text-xs">Create and manage every receiving channel investors may use. Bank accounts and crypto addresses are stored as payment destinations only; publishing one never creates investor capital.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-amber-400">Receiving channels:</span> add as many bank accounts, BTC addresses, USDT addresses, or other supported crypto networks as the company needs. Removing an account deactivates it for new deposits while preserving historical references.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Account Type</Label>
                  <select className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm" value={paymentMethodType} onChange={e=>setPaymentMethodType(e.target.value as "BANK"|"CRYPTO")}>
                    <option value="BANK">Bank / Normal Deposit Account</option>
                    <option value="CRYPTO">Crypto / Wallet Address</option>
                  </select>
                </div>
                <div><Label className="text-xs">Label</Label><Input value={paymentLabel} onChange={e=>setPaymentLabel(e.target.value)} placeholder={paymentMethodType === "CRYPTO" ? "e.g. USDT TRC20 Main Wallet" : "e.g. Company USD Bank Account"} /></div>

                {paymentMethodType === "BANK" ? (
                  <>
                    <div>
  <Label className="text-xs">Currency</Label>
  <select
    className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
    value={paymentCurrency}
    onChange={e=>setPaymentCurrency(e.target.value)}
  >
    <option value="USD">USD — US Dollar</option>
    <option value="NGN">NGN — Nigerian Naira (₦)</option>
    <option value="EUR">EUR — Euro</option>
    <option value="GBP">GBP — British Pound</option>
    <option value="CHF">CHF — Swiss Franc</option>
    <option value="CAD">CAD — Canadian Dollar</option>
    <option value="AUD">AUD — Australian Dollar</option>
    <option value="AED">AED — UAE Dirham</option>
  </select>
</div>
                    <div><Label className="text-xs">Bank Name</Label><Input value={paymentBankName} onChange={e=>setPaymentBankName(e.target.value)} /></div>
                    <div><Label className="text-xs">Account Name</Label><Input value={paymentAccountName} onChange={e=>setPaymentAccountName(e.target.value)} /></div>
                    <div><Label className="text-xs">Account Number</Label><Input value={paymentAccountNumber} onChange={e=>setPaymentAccountNumber(e.target.value)} /></div>
                    <div><Label className="text-xs">Routing / Sort Code</Label><Input value={paymentRoutingCode} onChange={e=>setPaymentRoutingCode(e.target.value)} /></div>
                    <div><Label className="text-xs">SWIFT</Label><Input value={paymentSwiftCode} onChange={e=>setPaymentSwiftCode(e.target.value)} /></div>
                  </>
                ) : (
                  <>
                    <div>
  <Label className="text-xs">Crypto Asset</Label>
  <select
    className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
    value={paymentAsset}
    onChange={e=>setPaymentAsset(e.target.value)}
  >
    <option value="BTC">BTC — Bitcoin</option>
    <option value="ETH">ETH — Ethereum</option>
    <option value="USDT">USDT — Tether</option>
    <option value="USDC">USDC — USD Coin</option>
    <option value="BNB">BNB — BNB</option>
    <option value="TRX">TRX — TRON</option>
  </select>
</div>
                    <div><Label className="text-xs">Network</Label><Input value={paymentNetwork} onChange={e=>setPaymentNetwork(e.target.value)} placeholder="BTC, TRC20, ERC20, BEP20..." /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Wallet Address</Label><Input value={paymentWalletAddress} onChange={e=>setPaymentWalletAddress(e.target.value)} placeholder="Paste the exact receiving wallet address" className="font-mono" /></div>
                    <div><Label className="text-xs">Memo / Tag (Optional)</Label><Input value={paymentMemoTag} onChange={e=>setPaymentMemoTag(e.target.value)} /></div>
                  </>
                )}

                <div className="sm:col-span-2"><Label className="text-xs">Investor Instructions</Label><Input value={paymentInstructions} onChange={e=>setPaymentInstructions(e.target.value)} placeholder="Reference format, network warning, transfer instructions, etc." /></div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="gold-gradient-btn" onClick={()=>savePaymentAccountMutation.mutate()} disabled={savePaymentAccountMutation.isPending}>
                  {savePaymentAccountMutation.isPending ? "Saving..." : paymentEditingId ? "Save Changes" : "Add Deposit Account"}
                </Button>
                {paymentEditingId && <Button variant="outline" onClick={resetPaymentForm}>Cancel Edit</Button>}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configured Receiving Channels</div>
                {(paymentAccountsQ.data ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No receiving accounts configured yet.</div>
                ) : (paymentAccountsQ.data ?? []).map((a:any)=>(
                  <div key={a.id} className="rounded-xl border border-border/70 p-3 bg-secondary/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">{a.label}</div>
                          <Badge variant={a.is_active ? "default" : "outline"}>{a.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
                          <Badge variant="outline" className="text-[10px]">{a.method_type === "CRYPTO" ? `${a.asset || a.currency} · ${a.network || "NETWORK"}` : a.currency}</Badge>
                        </div>
                        {a.method_type === "CRYPTO" ? (
                          <div className="mt-1 text-xs text-muted-foreground font-mono break-all">{a.wallet_address}</div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground">{a.bank_name || "Bank"} · {a.account_name || "Account"} · {a.account_number || "No account number"}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="h-8" onClick={()=>editPaymentAccount(a)}>Edit</Button>
                        {a.is_active && <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:text-destructive" onClick={()=>deactivatePaymentAccountMutation.mutate(a.id)} disabled={deactivatePaymentAccountMutation.isPending}>Remove</Button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 8: AUDIT TRAIL */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Immutable Audit Trail</h3>
          </div>

          <div className="rounded-xl border border-border/70 overflow-hidden bg-card/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Table</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Performed By</th>
                  <th className="p-3">Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {auditLogsQ.data?.map((a: any) => (
                  <tr key={a.id} className="hover:bg-secondary/20">
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-foreground">{a.table_name}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                        {a.action}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground font-sans truncate max-w-xs">{a.performed_by || "SYSTEM"}</td>
                    <td className="p-3 text-muted-foreground text-[11px] truncate max-w-xs">{a.record_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!depositReviewId} onOpenChange={(open) => { if (!open) setDepositReviewId(null); }}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Review Deposit Proof</DialogTitle>
            <DialogDescription>Approval activates capital and creates the authoritative ledger event. Rejection leaves the deposit unactivated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">USD Conversion Rate</Label><Input value={depositReviewFxRate} onChange={e=>setDepositReviewFxRate(e.target.value)} type="number" min="0.000001" step="any" /></div>
              <div><Label className="text-xs">FX Source / Basis</Label><Input value={depositReviewFxSource} onChange={e=>setDepositReviewFxSource(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Review Notes / Rejection Reason</Label><Input value={depositReviewNotes} onChange={e=>setDepositReviewNotes(e.target.value)} placeholder="Verification notes..." /></div>
            <p className="text-[11px] text-muted-foreground">For USD, the system requires a 1.0 conversion rate. For other assets, enter the verified USD rate used for this approval and identify its source.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDepositReviewId(null)}>Cancel</Button>
            <Button variant="outline" className="text-destructive border-destructive/30" disabled={rejectDepositMutation.isPending || approveDepositMutation.isPending} onClick={()=>rejectDepositMutation.mutate()}>{rejectDepositMutation.isPending ? "Rejecting..." : "Reject"}</Button>
            <Button className="gold-gradient-btn" disabled={approveDepositMutation.isPending || rejectDepositMutation.isPending} onClick={()=>approveDepositMutation.mutate()}>{approveDepositMutation.isPending ? "Approving..." : "Approve & Activate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}