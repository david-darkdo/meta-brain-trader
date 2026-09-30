import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteSingleTrade, deleteAllUserTrades } from "@/lib/trade-delete-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Trash2, X, Award, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  insight: z.string().optional(),
  category: z.enum(["MISTAKE", "STRENGTH", "PATTERN"]).optional(),
});

export const Route = createFileRoute("/_authenticated/trade-analysis")({
  head: () => ({ meta: [{ title: "Trade Analysis & History — MetaBrain Trader" }] }),
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
          "trade_id,pair,direction,trade_status,executed,risk_pct,created_at,results(outcome,pnl_amount,rr_achieved),ai_analyses(stage,ai_output,verdict,entry_score,created_at)",
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

  const hasTrades = tradesQ.data && tradesQ.data.length > 0;

  return (
    <div className="space-y-6">
      <Link
        to="/validator"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Meta Validator
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-400" />
            Trade Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trading intelligence, AI validation verdicts, and historical performance records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insight && (
            <div className="flex items-center gap-2">
              <Badge variant={category === "STRENGTH" ? "default" : "destructive"}>
                {category ?? "Pattern"}
              </Badge>
              <span className="text-sm font-semibold">{insight}</span>
              <Button asChild size="sm" variant="ghost">
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
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Trade History?</AlertDialogTitle>
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

      <Card className="border-border/80 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {insight ? `Trades tagged "${insight}"` : "All Executed & Planned Trades"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tradesQ.data || tradesQ.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
              <p className="text-sm text-muted-foreground">No trades match this filter.</p>
              <Button asChild size="sm" className="mt-3 gold-gradient-btn">
                <Link to="/trade-creator">Create a new trade</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {tradesQ.data.map((t) => {
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
