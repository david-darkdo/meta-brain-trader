import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Trophy,
  Target,
  Brain,
  Award,
} from "lucide-react";

type AnalysisItem = {
  analysis_id: string;
  stage: string;
  ai_output: Record<string, unknown> & { stage?: string };
  verdict: string | null;
  entry_score: number | null;
  created_at: string;
};

type ResultData = {
  id?: string;
  outcome?: string | null;
  pnl_amount?: number | null;
  pnl_percent?: number | null;
  rr_achieved?: number | null;
  closing_price?: number | null;
  result_notes?: string | null;
};

type PostTradeCockpitProps = {
  trade: {
    trade_id: string;
    pair: string;
    direction: string;
    trade_status: string;
    risk_pct?: number | null;
    entry_price?: number | null;
    stop_loss?: number | null;
    take_profit?: number | null;
  };
  result: ResultData | null;
  analyses: AnalysisItem[];
};

export function PostTradeCockpit({ trade, result, analyses }: PostTradeCockpitProps) {
  const coachReport = analyses.find((a) => (a.ai_output?.stage || a.stage) === "COACH_REPORT");
  const reviewStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "REVIEW");
  const mistakeStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "MISTAKE");
  const perfStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "PERFORMANCE");

  if (!coachReport && !reviewStage && !result) {
    return null;
  }

  const cOut = (coachReport?.ai_output ?? {}) as Record<string, unknown>;
  const rOut = (reviewStage?.ai_output ?? {}) as Record<string, unknown>;
  const mOut = (mistakeStage?.ai_output ?? {}) as Record<string, unknown>;
  const pOut = (perfStage?.ai_output ?? {}) as Record<string, unknown>;

  const outcome = result?.outcome || "UNRECORDED";
  const pnl = result?.pnl_amount != null ? result.pnl_amount : null;
  const rr = result?.rr_achieved != null ? result.rr_achieved : null;

  const isWin = outcome.toUpperCase() === "WIN";
  const isLoss = outcome.toUpperCase() === "LOSS";

  const headline =
    (cOut.executive_headline as string) ||
    (rOut.executive_headline as string) ||
    `POST-TRADE AUDIT · ${outcome}`;

  const summary =
    (cOut.decision_summary as string) ||
    (rOut.decision_summary as string) ||
    (rOut.execution_summary as string) ||
    result?.result_notes ||
    "Post-trade analysis completed.";

  const action =
    (cOut.action_directive as string) ||
    (rOut.action_directive as string) ||
    (cOut.next_focus as string) ||
    null;

  const coreLesson = (cOut.core_lesson as string) || (cOut.top_lesson as string) || null;
  const executionQuality = (rOut.execution_quality as string) || null;
  const adherenceScore = typeof rOut.adherence_score === "number" ? rOut.adherence_score : null;
  const primaryMistake = (mOut.primary_mistake_tag as string) || null;

  return (
    <Card className="overflow-hidden border-2 border-primary/30 shadow-md">
      {/* TIER 1: EXECUTIVE AUDIT HEADER */}
      <CardHeader
        className={
          isWin
            ? "bg-success/10 pb-3"
            : isLoss
              ? "bg-destructive/10 pb-3"
              : "bg-primary/10 pb-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={
                isWin
                  ? "flex h-3 w-3 rounded-full bg-success animate-pulse"
                  : isLoss
                    ? "flex h-3 w-3 rounded-full bg-destructive"
                    : "flex h-3 w-3 rounded-full bg-amber-500"
              }
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                AI Post-Trade Audit Cockpit
              </div>
              <CardTitle className="text-xl font-black tracking-tight text-foreground">
                {headline}
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className="px-3 py-1 text-sm font-bold tracking-wide"
              variant={isWin ? "default" : isLoss ? "destructive" : "secondary"}
            >
              {outcome}
            </Badge>
            {rr != null && (
              <Badge variant="outline" className="px-3 py-1 text-sm font-bold tabular-nums">
                {rr > 0 ? `+${rr}R` : `${rr}R`}
              </Badge>
            )}
            {pnl != null && (
              <Badge variant="secondary" className="px-3 py-1 text-sm font-bold tabular-nums">
                {pnl >= 0 ? `+$${pnl}` : `-$${Math.abs(pnl)}`}
              </Badge>
            )}
          </div>
        </div>

        {summary && (
          <p className="mt-2 text-sm font-medium leading-relaxed text-foreground/90">
            {summary}
          </p>
        )}

        {action && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/30 bg-card px-3 py-2 text-xs font-bold text-primary shadow-sm">
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span>ACTION DIRECTIVE: {action}</span>
          </div>
        )}
      </CardHeader>

      {/* TIER 2: AUDIT METRICS & CORE LESSON */}
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Plan Adherence */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Plan Adherence
            </div>
            <div className="mt-1 font-bold text-foreground">
              {adherenceScore != null ? `${adherenceScore}%` : "—"}
            </div>
          </div>

          {/* Execution Quality */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Execution Quality
            </div>
            <div className="mt-1 font-bold text-foreground">
              {executionQuality ? (
                <Badge
                  variant={
                    executionQuality === "flawless"
                      ? "default"
                      : executionQuality === "minor_deviation"
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-[10px]"
                >
                  {executionQuality.replace("_", " ").toUpperCase()}
                </Badge>
              ) : (
                "Evaluated"
              )}
            </div>
          </div>

          {/* Primary Mistake */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Mistake Tag
            </div>
            <div className="mt-1 text-xs font-bold text-foreground">
              {primaryMistake ? (
                primaryMistake.toLowerCase() === "none" ? (
                  <span className="text-success">Clean (None)</span>
                ) : (
                  <span className="text-destructive">{primaryMistake}</span>
                )
              ) : (
                "None Detected"
              )}
            </div>
          </div>

          {/* Actual Risk Recorded */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Actual Risk
            </div>
            <div className="mt-1 font-bold text-foreground">
              {trade.risk_pct != null ? `${trade.risk_pct}%` : "1%"}
            </div>
          </div>
        </div>

        {/* Permanent Extracted Core Lesson */}
        {coreLesson && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Permanent Core Lesson
              </div>
              <p className="mt-0.5 text-xs font-medium text-foreground">{coreLesson}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
