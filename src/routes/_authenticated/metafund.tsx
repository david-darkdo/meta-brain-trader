import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchInvestorSummary,
  fetchInvestorTradeHistory,
  fetchInvestorWithdrawalRequests,
  fetchInvestorCapitalEvents,
  fetchCompanyPaymentAccounts,
  createInvestorDepositIntent,
  submitInvestorDepositProof,
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
  ArrowDownLeft,
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
  Bell,
  Info,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metafund")({
  head: () => ({ meta: [{ title: "MetaFund — Investor Platform" }] }),
  component: InvestorMetaFundDashboard,
});

function InvestorMetaFundDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "trades" | "capital" | "withdrawals" | "notifications">("overview");

  // State for Deposit Modal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("USD");
  const [depositTransactionId, setDepositTransactionId] = useState("");
  const [depositProof, setDepositProof] = useState<File | null>(null);
  const [depositStep, setDepositStep] = useState<"details" | "proof">("details");
  const [depositIntentId, setDepositIntentId] = useState<string | null>(null);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);

  // State for Withdrawal Modal
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");

  // 1. Fetch Investor Financial Summary
  const summaryQ = useQuery({
    queryKey: ["investor", "financial_summary"],
    queryFn: fetchInvestorSummary,
    refetchInterval: 15000,
  });

  const investorId = summaryQ.data?.investor_id || null;
  const isAccountOnboarded = !!investorId;
  const paymentAccountsQ = useQuery({ queryKey: ["investor", "company_payment_accounts"], queryFn: fetchCompanyPaymentAccounts });
  const paymentAccounts = paymentAccountsQ.data ?? [];
  const paymentAccountsForCurrency = paymentAccounts.filter((a) => a.currency === depositCurrency);
  const selectedPaymentAccount = paymentAccounts.find((a) => a.id === selectedPaymentAccountId) ?? paymentAccountsForCurrency[0] ?? null;

  useEffect(() => {
    if (paymentAccounts.length === 0) return;
    const matching = paymentAccounts.filter((a) => a.currency === depositCurrency);
    if (matching.length === 0) {
      const first = paymentAccounts[0];
      setDepositCurrency(first.currency);
      setSelectedPaymentAccountId(first.id);
      return;
    }
    if (!matching.some((a) => a.id === selectedPaymentAccountId)) {
      setSelectedPaymentAccountId(matching[0].id);
    }
  }, [paymentAccounts, depositCurrency, selectedPaymentAccountId]);

  // 2. Fetch Investor Trade Participation History
  const tradeHistoryQ = useQuery({
    queryKey: ["investor", "trade_history"],
    queryFn: () => (investorId ? fetchInvestorTradeHistory() : Promise.resolve([])),
    enabled: isAccountOnboarded,
  });

  // 3. Fetch Investor Withdrawal Requests
  const withdrawalsQ = useQuery({
    queryKey: ["investor", "withdrawals", investorId],
    queryFn: () => (investorId ? fetchInvestorWithdrawalRequests(investorId) : Promise.resolve([])),
    enabled: isAccountOnboarded,
  });

  // 4. Fetch Investor Capital Events (Deposits)
  const capitalEventsQ = useQuery({
    queryKey: ["investor", "capital_events", investorId],
    queryFn: () => (investorId ? fetchInvestorCapitalEvents(investorId) : Promise.resolve([])),
    enabled: isAccountOnboarded,
    refetchInterval: 15000,
  });

  // 5. Deposit verification workflow
  const createDepositIntentMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(depositAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid positive deposit amount.");
      if (!selectedPaymentAccount) throw new Error("Select the company account you paid into.");
      return createInvestorDepositIntent({ accountId: investorId ?? null, amount: amt, currency: depositCurrency, paymentAccountId: selectedPaymentAccount.id });
    },
    onSuccess: (result) => { setDepositIntentId(result.event_id); setDepositStep("proof"); setDepositError(null); },
    onError: (err: any) => setDepositError(err?.message || "Unable to start deposit verification."),
  });

  const submitDepositProofMutation = useMutation({
    mutationFn: async () => {
      if (!depositIntentId || !depositProof) throw new Error("Deposit proof is incomplete.");
      if (depositProof.size > 10 * 1024 * 1024) throw new Error("Proof file must be 10 MB or smaller.");
      if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(depositProof.type)) throw new Error("Proof must be JPG, PNG, WEBP, or PDF.");
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("Authentication required.");
      const safeName = depositProof.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = uid + "/" + depositIntentId + "/" + crypto.randomUUID() + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from("metafund-deposit-proofs").upload(storagePath, depositProof, { contentType: depositProof.type, upsert: false });
      if (uploadError) throw uploadError;
      return submitInvestorDepositProof({ eventId: depositIntentId, transactionReference: depositTransactionId.trim() || undefined, proofStoragePath: storagePath, proofOriginalFilename: depositProof.name, proofContentType: depositProof.type, proofSizeBytes: depositProof.size });
    },
    onSuccess: () => {
      toast.success("Deposit proof submitted. Your deposit is now locked for company review.");
      setIsDepositModalOpen(false); setDepositAmount(""); setDepositTransactionId(""); setDepositProof(null); setDepositIntentId(null); setDepositStep("details"); setDepositError(null);
      qc.invalidateQueries({ queryKey: ["investor"] });
    },
    onError: (err: any) => setDepositError(err?.message || "Failed to submit deposit proof."),
  });

  // 6. Withdrawal Request Mutation
  const requestWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!investorId) throw new Error("No active investor account found.");
      const amt = Number(withdrawalAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Please enter a valid positive withdrawal amount.");
      const availableCap = Number(summaryQ.data?.available_capital ?? 0);
      if (amt > availableCap) {
        throw new Error(
          `Requested amount ($${amt}) exceeds available capital ($${availableCap.toFixed(2)}).`
        );
      }

      return requestInvestorWithdrawal({
        accountId: investorId,
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

  const copyPaymentDetail = async (value: string | null | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label + " copied");
    } catch {
      toast.error("Unable to copy " + label.toLowerCase());
    }
  };

  // Loading State
  if (summaryQ.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center space-x-2">
        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
        <span className="text-muted-foreground text-sm">Loading MetaFund investment platform...</span>
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

  // Financial Values (Safe fallback to 0.00 for State A and State B)
  const equity = Number(s?.current_economic_equity ?? 0);
  const available = Number(s?.available_capital ?? 0);
  const committed = Number(s?.active_committed_capital ?? 0);
  const pnl = Number(s?.realized_trading_pnl ?? 0);
  const deposited = Number(s?.cumulative_deposited ?? 0);
  const withdrawn = Number(s?.cumulative_withdrawn ?? 0);
  const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;
  const hasCapital = equity > 0 || deposited > 0;

  return (
    <div className="space-y-6">
      {/* 1. PLATFORM HEADER & USER ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              MetaFund
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-mono tracking-wider text-amber-400 border border-amber-500/30"
            >
              {!hasCapital ? "Ready to Deposit" : "Active Investor"}
            </Badge>
          </div>
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

          {/* DEPOSIT VERIFICATION WORKFLOW */}
          <Dialog open={isDepositModalOpen} onOpenChange={(open) => { setIsDepositModalOpen(open); if (!open) { setDepositStep("details"); setDepositIntentId(null); setDepositError(null); setDepositProof(null); } }}>
            <DialogTrigger asChild><Button size="sm" className="gold-gradient-btn text-xs h-8"><ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Deposit</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{depositStep === "details" ? "Fund Your MetaFund Account" : "Submit Deposit Proof"}</DialogTitle>
                <DialogDescription>{depositStep === "details" ? "Choose the company payment account, make the transfer, then submit your proof. Your deposit will remain pending until the company verifies it." : "Upload the payment evidence so the company can verify and process your deposit."}</DialogDescription>
              </DialogHeader>
              {depositStep === "details" ? (
                <div className="space-y-4 py-2">
                  {paymentAccounts.length === 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-center gap-2 text-amber-400 text-sm font-semibold"><AlertCircle className="h-4 w-4" /> Company payment account not configured</div><p className="mt-1 text-xs text-muted-foreground">No verified company deposit account is published. Deposits are blocked until one is configured.</p></div>
                  ) : (<>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Deposit Currency / Asset</Label>
                        <select
                          className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                          value={depositCurrency}
                          onChange={(e) => {
                            const nextCurrency = e.target.value;
                            setDepositCurrency(nextCurrency);
                            setSelectedPaymentAccountId(paymentAccounts.find((a) => a.currency === nextCurrency)?.id || "");
                          }}
                        >
                          {[...new Set(paymentAccounts.map((a) => a.currency))].map((currency) => (
                            <option key={currency} value={currency}>{currency}</option>
                          ))}
                        </select>
                      </div>
                      {paymentAccountsForCurrency.length > 1 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Receiving Account</Label>
                          <select
                            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                            value={selectedPaymentAccount?.id || ""}
                            onChange={(e) => setSelectedPaymentAccountId(e.target.value)}
                          >
                            {paymentAccountsForCurrency.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.label}{account.network ? " · " + account.network : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {selectedPaymentAccount && (
                      <div className="rounded-xl border border-amber-500/30 bg-secondary/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Verified Company Deposit Account</span>
                            <div className="text-sm font-semibold mt-1">{selectedPaymentAccount.label}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {selectedPaymentAccount.method_type === "CRYPTO"
                              ? (selectedPaymentAccount.asset || selectedPaymentAccount.currency) + " · " + (selectedPaymentAccount.network || "NETWORK")
                              : selectedPaymentAccount.currency}
                          </Badge>
                        </div>
                        {selectedPaymentAccount.method_type === "CRYPTO" ? (
                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">Wallet Address</div>
                              <div className="flex items-start gap-2 mt-1">
                                <div className="font-mono font-semibold break-all flex-1">{selectedPaymentAccount.wallet_address || "—"}</div>
                                {selectedPaymentAccount.wallet_address && (
                                  <Button type="button" size="sm" variant="outline" className="h-7 shrink-0" onClick={() => copyPaymentDetail(selectedPaymentAccount.wallet_address, "Wallet address")}>Copy</Button>
                                )}
                              </div>
                            </div>
                            {selectedPaymentAccount.memo_tag && (
                              <div>
                                <div className="text-muted-foreground">Memo / Tag</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="font-mono font-semibold">{selectedPaymentAccount.memo_tag}</div>
                                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => copyPaymentDetail(selectedPaymentAccount.memo_tag, "Memo / tag")}>Copy</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div><div className="text-muted-foreground">Bank</div><div className="font-semibold">{selectedPaymentAccount.bank_name || "—"}</div></div>
                            <div><div className="text-muted-foreground">Account Name</div><div className="font-semibold">{selectedPaymentAccount.account_name || "—"}</div></div>
                            <div>
                              <div className="text-muted-foreground">Account Number</div>
                              <div className="flex items-center gap-2">
                                <div className="font-mono font-semibold">{selectedPaymentAccount.account_number || "—"}</div>
                                {selectedPaymentAccount.account_number && (
                                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => copyPaymentDetail(selectedPaymentAccount.account_number, "Account number")}>Copy</Button>
                                )}
                              </div>
                            </div>
                            {selectedPaymentAccount.routing_code && <div><div className="text-muted-foreground">Routing / Sort Code</div><div className="font-mono font-semibold">{selectedPaymentAccount.routing_code}</div></div>}
                            {selectedPaymentAccount.swift_code && <div><div className="text-muted-foreground">SWIFT</div><div className="font-mono font-semibold">{selectedPaymentAccount.swift_code}</div></div>}
                          </div>
                        )}
                        {selectedPaymentAccount.instructions && <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground whitespace-pre-wrap">{selectedPaymentAccount.instructions}</div>}
                      </div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="deposit-amount" className="text-xs">Amount Deposited</Label><Input id="deposit-amount" type="number" min="0.01" step="any" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder="Enter amount transferred" /></div>
                    <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">Complete the transfer using the verified receiving account above. When the transfer is complete, continue to upload your proof of payment. Your capital remains pending until the company verifies the deposit.</div>
                    {depositError && <p className="text-xs text-destructive">{depositError}</p>}
                  </>)}
                </div>
              ) : (
                <div className="space-y-4 py-3"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="text-xs font-semibold text-emerald-400">Transfer recorded — proof required</div><p className="mt-1 text-xs text-muted-foreground">{"$"}{Number(depositAmount || 0).toLocaleString()} {depositCurrency} is not counted as capital yet. Submit the evidence to lock it for company verification.</p></div><div className="space-y-1.5"><Label htmlFor="deposit-proof-final" className="text-xs">Proof of Payment</Label><Input id="deposit-proof-final" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setDepositProof(e.target.files?.[0] || null)} />{depositProof && <p className="text-xs text-muted-foreground">{depositProof.name} · {(depositProof.size/1024/1024).toFixed(2)} MB</p>}</div><div className="space-y-1.5"><Label htmlFor="deposit-tx-final" className="text-xs">Transaction ID (Optional)</Label><Input id="deposit-tx-final" value={depositTransactionId} onChange={e=>setDepositTransactionId(e.target.value)} /></div>{depositError && <p className="text-xs text-destructive">{depositError}</p>}</div>
              )}
              <DialogFooter><Button variant="outline" onClick={()=>setIsDepositModalOpen(false)}>Cancel</Button>{paymentAccounts.length>0 && depositStep==="details" && <Button className="gold-gradient-btn" disabled={createDepositIntentMutation.isPending || !depositAmount || !selectedPaymentAccount} onClick={()=>createDepositIntentMutation.mutate()}>{createDepositIntentMutation.isPending ? "Creating..." : "I Have Made the Transfer — Continue"}</Button>}{depositStep==="proof" && <Button className="gold-gradient-btn" disabled={submitDepositProofMutation.isPending || !depositProof} onClick={()=>submitDepositProofMutation.mutate()}>{submitDepositProofMutation.isPending ? "Submitting..." : "Submit Proof for Verification"}</Button>}</DialogFooter>
            </DialogContent>
          </Dialog>

          {/* WITHDRAWAL DIALOG */}
          <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={!isAccountOnboarded || available <= 0}
                className="border-border/80 bg-secondary/40 text-xs h-8 text-foreground"
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Request Capital Withdrawal</DialogTitle>
                <DialogDescription>
                  Available uncommitted balance:{" "}
                  <span className="font-semibold text-amber-400 font-mono">
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
                    placeholder="e.g. USDT TRC20 / Bank account details"
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

      {/* 2. DEPOSIT ACCESS */}
      <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {!hasCapital ? "Ready to Deposit" : `MetaFund Account: Active · Account #${s?.account_number || "—"}`}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!hasCapital ? "Choose the company receiving account, make your transfer, then submit proof for company verification." : "Your capital is active. You can make additional deposits or manage your account."}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsDepositModalOpen(true)}
          className="gold-gradient-btn text-xs shrink-0"
        >
          <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Deposit Capital
        </Button>
      </div>

      {/* 3. PENDING DEPOSIT STATUS */}
      {(capitalEventsQ.data ?? []).some((event: any) => event.status === "PENDING") && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Deposit Processing</div>
            <p className="text-xs text-muted-foreground mt-0.5">Your deposit proof has been submitted and is waiting for company verification. Capital will appear after approval.</p>
          </div>
        </div>
      )}

      {/* 4. HERO TOTAL ECONOMIC EQUITY CARD */}
      <div className="relative overflow-hidden rounded-2xl gold-card-hero p-5 sm:p-7">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Economic Equity
            </span>
            {hasCapital ? (
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
            ) : (
              <span className="text-xs text-muted-foreground font-mono">
                No investment performance yet
              </span>
            )}
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
                ${deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Total P&L</div>
              <div
                className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                  pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Available</div>
              <div className="text-sm sm:text-base font-bold text-amber-400 font-mono mt-0.5">
                ${available.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRIMARY NAVIGATION CARDS (2x2 GRID) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* OVERVIEW */}
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            activeTab === "overview"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Overview
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${equity.toLocaleString("en-US", { minimumFractionDigits: 0 })} total equity
            </p>
          </div>
        </button>

        {/* MY PARTICIPATIONS */}
        <button
          type="button"
          onClick={() => setActiveTab("trades")}
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            activeTab === "trades"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
            <Layers className="h-4 w-4" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Participations
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {s?.open_trades_count ?? 0} active · ${committed.toLocaleString("en-US", { minimumFractionDigits: 0 })} committed
            </p>
          </div>
        </button>

        {/* CAPITAL FLOW */}
        <button
          type="button"
          onClick={() => setActiveTab("capital")}
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            activeTab === "capital"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Capital Flow
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${deposited.toLocaleString("en-US", { minimumFractionDigits: 0 })} deposited
            </p>
          </div>
        </button>

        {/* WITHDRAWALS */}
        <button
          type="button"
          onClick={() => setActiveTab("withdrawals")}
          className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            activeTab === "withdrawals"
              ? "border-amber-400/50 bg-card shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
              : "border-border/80 bg-card/60 hover:bg-card hover:border-border"
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
              Withdrawals
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ${available.toLocaleString("en-US", { minimumFractionDigits: 0 })} available
            </p>
          </div>
        </button>
      </div>

      {/* 5. DETAILED TABS SECTION */}
      <div className="space-y-4 pt-2">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full min-w-0 space-y-4">
          <div className="min-w-0 w-full border-b border-border/70 pb-2">
            <TabsList className="flex w-full max-w-full flex-nowrap overflow-x-auto justify-start bg-secondary/40 border border-border/60 scrollbar-none">
              <TabsTrigger value="overview" className="shrink-0 whitespace-nowrap text-xs data-[state=active]:text-amber-400">
                Overview
              </TabsTrigger>
              <TabsTrigger value="trades" className="text-xs data-[state=active]:text-amber-400">
                Participations
              </TabsTrigger>
              <TabsTrigger value="capital" className="text-xs data-[state=active]:text-amber-400">
                Capital Flow
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="text-xs data-[state=active]:text-amber-400">
                Withdrawals
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs data-[state=active]:text-amber-400">
                Updates
              </TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-400" /> Capital Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="text-muted-foreground">Total Economic Equity</span>
                    <span className="font-mono font-bold text-foreground">${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="text-muted-foreground">Active Committed Capital</span>
                    <span className="font-mono font-semibold text-amber-400">${committed.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Available Liquidity</span>
                    <span className="font-mono font-semibold text-emerald-400">${available.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" /> Investment Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>• <span className="text-foreground font-semibold">70% Investor / 30% Company</span> profit split on positive closed trades.</p>
                  <p>• <span className="text-foreground font-semibold">100% loss absorption</span> by capital pool with $0 company fee on loss trades.</p>
                  <p>• Idempotent execution-time snapshot allocation.</p>
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-400" /> Operations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{isAccountOnboarded ? "ACTIVE" : "PENDING ONBOARDING"}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Account: <span className="text-foreground font-mono">{s?.account_number || "—"}</span>
                  </p>
                  <div className="pt-1 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsDepositModalOpen(true)}
                      className="gold-gradient-btn text-xs h-7 w-full"
                    >
                      Deposit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PARTICIPATIONS TAB */}
          <TabsContent value="trades" className="space-y-3">
            {!tradeHistoryQ.data || tradeHistoryQ.data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
                <Layers className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No Trade Participations Recorded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When trades are validated and executed in Meta Validator, your participating capital snapshot will appear here.
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

          {/* CAPITAL FLOW TAB */}
          <TabsContent value="capital" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-foreground">Capital Flow & Deposits</h3>
                <p className="text-xs text-muted-foreground">Authoritative deposit request history and capital allocations.</p>
              </div>
              <Button size="sm" onClick={() => setIsDepositModalOpen(true)} className="gold-gradient-btn text-xs h-8">
                <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> New Deposit
              </Button>
            </div>

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
                  <CardTitle className="text-sm font-bold">Deposit Requests & Capital Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!capitalEventsQ.data || capitalEventsQ.data.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No deposit events recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {capitalEventsQ.data.map((ce: any) => (
                        <div key={ce.id} className="flex justify-between items-center text-xs p-2 rounded-lg border border-border/60 bg-secondary/30">
                          <div>
                            <div className="font-mono font-bold text-foreground">
                              ${Number(ce.base_amount_usd || ce.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {ce.currency}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(ce.created_at).toLocaleDateString()} · {ce.event_type}
                            </div>
                          </div>
                          <Badge
                            variant={ce.status === "ACTIVATED" ? "default" : ce.status === "PENDING" ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {ce.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* WITHDRAWALS TAB */}
          <TabsContent value="withdrawals" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-foreground">Withdrawal Requests</h3>
                <p className="text-xs text-muted-foreground">Governed review, approval, and settlement payouts.</p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={!isAccountOnboarded || available <= 0}
                className="gold-gradient-btn text-xs h-8"
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Request Withdrawal
              </Button>
            </div>

            {!withdrawalsQ.data || withdrawalsQ.data.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
                <Wallet className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No Withdrawal Requests</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have not submitted any withdrawal requests yet.
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

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="space-y-3">
            <div className="rounded-xl border border-border/80 bg-card/60 p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" /> Platform Announcements & Updates
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg border border-border/60 bg-secondary/30">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>MetaFund Operational Governance Active</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Platform Baseline</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Multi-currency deposit intent workflows, execution snapshot participations, and immutable ledger accounting are active.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/60 bg-secondary/30">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>Standard Profit Split: 70% / 30%</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Terms</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Participating investors receive 70% of net profits from winning trades. 100% loss absorption is covered with zero company performance deduction on loss trades.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}