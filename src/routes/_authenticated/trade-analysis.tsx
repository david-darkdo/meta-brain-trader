import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteSingleTrade, deleteAllUserTrades } from "@/lib/trade-delete-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Trash2,
  X,
  Award,
  ChevronRight,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Brain,
  Info,
} from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  insight: z.string().optional(),
  category: z.enum(["MISTAKE", "STRENGTH", "PATTERN"]).optional(),
});

export const Route = createFileRoute("/_authenticated/trade-analysis")({
  head: () => ({ meta: [{ title: "Trade Analysis & Intelligence — MetaBrain Trader" }] }),
  validateSearch: searchSchema,
  component: TradeAnalysis,
});

type TradeAnalysisRow = {
  trade_id: string;
  pair: string;
  direction: string;
  trade_status: string;
  executed: boolean;
  risk_pct: number | null;
  created_at: string;
  results?: Array<{
    outcome: string;
    pnl_amount: number | null;
    pnl_percent: number | null;
    rr_achieved: number | null;
  }>;
  ai_analyses?: Array<{
    stage: string;
    ai_output: Record<string, unknown> & { stage?: string };
    verdict: string | null;
    entry_score: number | null;
    created_at: string;
  }>;
};

function TradeAnalysis() {
  const { insight, category } = useSearch({ from: "/_authenticated/trade-analysis" });
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 1. Fetch dashboard metrics (closed trades, win rate, discipline score, etc.)
  const metricsQ = useQuery({
    queryKey: ["dashboard_metrics"],
    queryFn: async () => {
      const { data } = await supabase.from("dashboard_metrics").select("*").maybeSingle();
      return data;
    },
  });

  // 2. Fetch learning insights (categorized: STRENGTH, MISTAKE, PATTERN)
  const insightsQ = useQuery({
    queryKey: ["learning_insights", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_insights")
        .select("id,category,content,occurrences,updated_at,referenced_trade_ids")
        .order("occurrences", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Fetch trade records
  const tradesQ = useQuery({
    queryKey: ["trade-analysis", "trades", insight ?? "", category ?? ""],
    queryFn: async (): Promise<TradeAnalysisRow[]> => {
      let allowedIds: string[] | null = null;
      if (insight) {
        const q = supabase
          .from("learning_insights")
          .select("referenced_trade_ids,content,category")
          .eq("content", insight);
        if (category) q.eq("category", category);
        const { data } = await q;
        allowedIds = Array.from(
          new Set((data ?? []).flatMap((r) => r.referenced_trade_ids ?? [])),
        );
        if (allowedIds.length === 0) return [];
      }

      let query = supabase
        .from("trades")
        .select(
          "trade_id,pair,direction,trade_status,executed,risk_pct,created_at,results(outcome,pnl_amount,pnl_percent,rr_achieved),ai_analyses(stage,ai_output,verdict,entry_score,created_at)",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (allowedIds) query = query.in("trade_id", allowedIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TradeAnalysisRow[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["trade-analysis"] });
    qc.invalidateQueries({ queryKey: ["trades"] });
    qc.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    qc.invalidateQueries({ queryKey: ["learning_insights"] });
  };

  const deleteSingleMut = useMutation({
    mutationFn: async (tradeId: string) => {
      setDeletingId(tradeId);
      await deleteSingleTrade(tradeId);
    },
    onSuccess: () => {
      toast.success("Trade deleted");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete trade");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const deleteAllMut = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not authenticated");
      await deleteAllUserTrades(userId);
    },
    onSuccess: () => {
      toast.success("All trade history cleared");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to clear trade history");
    },
  });

  const allTrades = tradesQ.data ?? [];
  const hasTrades = allTrades.length > 0;
  const metrics = metricsQ.data;
  const closedTradesCount = metrics?.closed_trades ?? allTrades.filter((t) => (t.results && t.results.length > 0) || t.trade_status === "JOURNALED").length;

  // Group insights by category
  const allInsights = insightsQ.data ?? [];
  const strengths = allInsights.filter((i) => i.category === "STRENGTH");
  const mistakes = allInsights.filter((i) => i.category === "MISTAKE");
  const patterns = allInsights.filter((i) => i.category === "PATTERN");

  // Insufficient completed trades check
  const hasSufficientData = closedTradesCount > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. TOP HEADER & BACK NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/validator"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Meta Validator
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-amber-400" />
            Trade Analysis & Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Trading intelligence, AI edge validation verdicts, and historical performance records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {insight && (
            <div className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-lg text-xs">
              <Badge variant={category === "STRENGTH" ? "default" : "destructive"}>
                {category ?? "Filter"}
              </Badge>
              <span className="font-semibold text-foreground max-w-[160px] truncate">{insight}</span>
              <Button asChild size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                <Link to="/trade-analysis">
                  <X className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}

          {hasTrades && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-9"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Clear All Trade History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all trades, chart screenshots, post-trade
                    reflections, and AI analyses from your account. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteAllMut.mutate()}
                  >
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* 2. TRADING INTELLIGENCE SECTION (AT THE TOP) */}
      <Card className="border border-amber-500/30 bg-card/80 backdrop-blur-md shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base font-bold text-foreground">
                Trading Intelligence
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono border-amber-500/30 text-amber-400">
              {closedTradesCount} Closed {closedTradesCount === 1 ? "Trade" : "Trades"}
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Multi-timeframe behavioral synthesis, recurring patterns, and rule compliance.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5">
          {!hasSufficientData ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-secondary/20 p-8 text-center space-y-2">
              <Info className="h-8 w-8 text-amber-400/70 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Not enough completed trades to generate reliable trading patterns.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Execute and journal your setups in Meta Validator. Once you record completed trade outcomes, the AI engine will synthesize your habits, discipline, and edge.
              </p>
              <Button asChild size="sm" className="mt-2 gold-gradient-btn text-xs">
                <Link to="/trade-creator">Plan & Execute Trade</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. WHAT YOU DO WELL */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    What You Do Well
                  </span>
                </div>
                {strengths.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-foreground/90">
                    {strengths.slice(0, 3).map((s) => (
                      <li key={s.id} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{s.content}</span>
                        {s.occurrences > 1 && (
                          <span className="text-[10px] text-muted-foreground font-mono">({s.occurrences}×)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Positive edge validation and execution discipline logged across winning trades.
                  </p>
                )}
                {metrics?.win_rate != null && (
                  <div className="pt-1 text-[11px] font-mono text-emerald-400/90 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Win Rate: {metrics.win_rate}% {metrics.avg_rr ? `· Avg R:R: ${metrics.avg_rr}` : ""}
                  </div>
                )}
              </div>

              {/* 2. WHAT YOU NEED TO IMPROVE */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    What You Need to Improve
                  </span>
                </div>
                {mistakes.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-foreground/90">
                    {mistakes.slice(0, 3).map((m) => (
                      <li key={m.id} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{m.content}</span>
                        {m.occurrences > 1 && (
                          <span className="text-[10px] text-muted-foreground font-mono">({m.occurrences}×)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No recurring execution flaws identified yet. Maintain strict risk parameters.
                  </p>
                )}
                {metrics?.override_score != null && (
                  <div className="pt-1 text-[11px] font-mono text-rose-400/90 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    AI Override Rate: {metrics.override_score}%
                  </div>
                )}
              </div>

              {/* 3. RECENT PATTERNS */}
              <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2.5">
                <div className="flex items-center gap-2 text-sky-400">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Recent Patterns
                  </span>
                </div>
                {patterns.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-foreground/90">
                    {patterns.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex items-start gap-1.5">
                        <span className="text-sky-400 font-bold">•</span>
                        <span>{p.content}</span>
                        {p.occurrences > 1 && (
                          <span className="text-[10px] text-muted-foreground font-mono">({p.occurrences}×)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Analyzing multi-session setups and directional tendencies across completed pairs.
                  </p>
                )}
                <div className="pt-1 text-[11px] font-mono text-sky-400/90 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  Recent executions: {allTrades.slice(0, 3).map((t) => `${t.pair} (${t.direction})`).join(", ") || "None"}
                </div>
              </div>

              {/* 4. DISCIPLINE & COMPLIANCE */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Discipline & Rule Compliance
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-card/80 p-2 rounded-lg border border-border/60">
                    <div className="text-xs text-muted-foreground">Discipline</div>
                    <div className="text-base font-bold font-mono text-amber-400">
                      {metrics?.discipline_score ?? "—"}
                    </div>
                  </div>
                  <div className="bg-card/80 p-2 rounded-lg border border-border/60">
                    <div className="text-xs text-muted-foreground">Agreement</div>
                    <div className="text-base font-bold font-mono text-foreground">
                      {metrics?.agreement_score ? `${metrics.agreement_score}%` : "—"}
                    </div>
                  </div>
                  <div className="bg-card/80 p-2 rounded-lg border border-border/60">
                    <div className="text-xs text-muted-foreground">Override</div>
                    <div className="text-base font-bold font-mono text-foreground">
                      {metrics?.override_score ? `${metrics.override_score}%` : "—"}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight pt-1">
                  Adherence to pre-trade validation rules, risk limits, and post-trade reflections.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. TRADE HISTORY LIST */}
      <Card className="border-border/80 bg-card/60">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base text-foreground font-bold">
            {insight ? `Trades tagged "${insight}"` : "All Executed & Planned Trades"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Complete historical record of trade setups, verdicts, risk metrics, and post-trade lessons.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {!allTrades || allTrades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
              <p className="text-sm text-muted-foreground">No trades match this filter.</p>
              <Button asChild size="sm" className="mt-3 gold-gradient-btn text-xs">
                <Link to="/trade-creator">Create a new trade</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {allTrades.map((t) => {
                const res = t.results?.[0] || null;
                const analyses = t.ai_analyses || [];
                const verdictStage = analyses.find(
                  (a) => (a.ai_output?.stage || a.stage) === "VERDICT",
                );
                const coachStage = analyses.find(
                  (a) => (a.ai_output?.stage || a.stage) === "COACH_REPORT",
                );
                const reviewStage = analyses.find(
                  (a) => (a.ai_output?.stage || a.stage) === "REVIEW",
                );

                const vOut = (verdictStage?.ai_output ?? {}) as Record<string, unknown>;
                const cOut = (coachStage?.ai_output ?? {}) as Record<string, unknown>;
                const rOut = (reviewStage?.ai_output ?? {}) as Record<string, unknown>;

                const verdict = (verdictStage?.verdict || vOut.verdict as string) || null;
                const entryScore = verdictStage?.entry_score ?? (typeof vOut.entry_score === "number" ? vOut.entry_score : null);
                const headline =
                  (vOut.executive_headline as string) ||
                  (cOut.executive_headline as string) ||
                  (rOut.executive_headline as string) ||
                  null;
                const summary =
                  (vOut.decision_summary as string) ||
                  (cOut.decision_summary as string) ||
                  (vOut.primary_reason as string) ||
                  null;
                const coreLesson =
                  (cOut.core_lesson as string) || (cOut.top_lesson as string) || null;

                const outcome = res?.outcome || null;
                const rr = res?.rr_achieved != null ? res.rr_achieved : null;
                const isWin = outcome === "WIN";
                const isLoss = outcome === "LOSS";

                return (
                  <li key={t.trade_id} className="group py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        to="/trade-detail/$id"
                        params={{ id: t.trade_id }}
                        className="flex flex-1 flex-col gap-2 rounded-xl p-3 transition-colors hover:bg-card border border-transparent hover:border-border/60"
                      >
                        {/* ROW 1: PAIR, DIRECTION, OUTCOME, VERDICT */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${
                                t.direction === "LONG" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="text-base font-bold tracking-tight text-foreground">
                              {t.pair}
                            </span>
                            <Badge
                              variant={t.direction === "LONG" ? "default" : "destructive"}
                              className="text-[10px]"
                            >
                              {t.direction}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {outcome && (
                              <Badge
                                variant={isWin ? "default" : isLoss ? "destructive" : "secondary"}
                                className={`font-bold ${
                                  isWin
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : isLoss
                                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                      : ""
                                }`}
                              >
                                {outcome}
                                {rr != null && ` · ${rr > 0 ? `+${rr}` : rr}R`}
                              </Badge>
                            )}
                            {verdict && (
                              <Badge
                                variant={
                                  verdict === "APPROVED"
                                    ? "default"
                                    : verdict === "DISQUALIFIED"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="font-bold"
                              >
                                {verdict}
                                {entryScore != null && ` · ${entryScore}`}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {t.executed ? "Executed" : "Skipped"}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>

                        {/* ROW 2: AI EXECUTIVE HEADLINE / SUMMARY */}
                        {(headline || summary) && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
                            {headline && (
                              <div className="font-mono font-bold uppercase tracking-wider text-amber-400">
                                {headline}
                              </div>
                            )}
                            {summary && (
                              <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                                {summary}
                              </p>
                            )}
                          </div>
                        )}

                        {/* ROW 3: CORE LESSON (If post-analyzed) */}
                        {coreLesson && (
                          <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                            <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="font-medium truncate">Lesson: {coreLesson}</span>
                          </div>
                        )}
                      </Link>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mt-2 h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            disabled={deletingId === t.trade_id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">Delete Trade ({t.pair})?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this trade, its screenshots, reflections,
                              and AI analysis records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteSingleMut.mutate(t.trade_id)}
                            >
                              Delete Trade
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
