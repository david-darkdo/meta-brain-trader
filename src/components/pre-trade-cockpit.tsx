import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Target,
  Clock,
  Sparkles,
} from "lucide-react";

type AnalysisItem = {
  analysis_id: string;
  stage: string;
  ai_output: Record<string, unknown> & { stage?: string };
  verdict: string | null;
  entry_score: number | null;
  created_at: string;
};

type PreTradeCockpitProps = {
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
  analyses: AnalysisItem[];
};

export function PreTradeCockpit({ trade, analyses }: PreTradeCockpitProps) {
  // Find key stages from pre-trade analyses
  const verdictStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "VERDICT");
  const strategyStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "STRATEGY");
  const blindStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "BLIND");
  const validationStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "VALIDATION");
  const learningStage = analyses.find((a) => (a.ai_output?.stage || a.stage) === "LEARNING");

  if (!verdictStage && analyses.length === 0) {
    return null;
  }

  const vOut = (verdictStage?.ai_output ?? {}) as Record<string, unknown>;
  const sOut = (strategyStage?.ai_output ?? {}) as Record<string, unknown>;
  const bOut = (blindStage?.ai_output ?? {}) as Record<string, unknown>;
  const valOut = (validationStage?.ai_output ?? {}) as Record<string, unknown>;
  const lOut = (learningStage?.ai_output ?? {}) as Record<string, unknown>;

  const verdict = (verdictStage?.verdict || vOut.verdict || "NEUTRAL") as string;
  const entryScore = verdictStage?.entry_score ?? (typeof vOut.entry_score === "number" ? vOut.entry_score : null);
  const headline = (vOut.executive_headline as string) || (verdict ? `${verdict} SETUP` : "PRE-TRADE ANALYSIS");
  const summary = (vOut.decision_summary as string) || (vOut.primary_reason as string) || null;
  const action = (vOut.action_directive as string) || null;

  // Extract evidence
  const bias = (bOut.bias as string) || null;
  const biasStrength = (bOut.bias_strength as string) || null;
  const alignmentScore = typeof sOut.alignment_score === "number" ? sOut.alignment_score : null;
  const matchedRules = (sOut.matched_rules as string[]) || [];
  const missingRules = (sOut.missing_rules as string[]) || [];
  const violatedRules = (sOut.violated_rules as string[]) || [];
  const riskStatus = (valOut.risk_status as string) || null;
  const riskReward = (valOut.risk_reward as string) || null;
  const similarSetupsCount = typeof lOut.similar_setups_count === "number" ? lOut.similar_setups_count : null;

  const isApproved = verdict.toUpperCase() === "APPROVED";
  const isDisqualified = verdict.toUpperCase() === "DISQUALIFIED";

  return (
    <Card className="overflow-hidden border-2 border-primary/30 shadow-md">
      {/* TIER 1: EXECUTIVE DECISION HEADER */}
      <CardHeader
        className={
          isApproved
            ? "bg-success/10 pb-3"
            : isDisqualified
              ? "bg-destructive/10 pb-3"
              : "bg-primary/10 pb-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={
                isApproved
                  ? "flex h-3 w-3 rounded-full bg-success animate-pulse"
                  : isDisqualified
                    ? "flex h-3 w-3 rounded-full bg-destructive"
                    : "flex h-3 w-3 rounded-full bg-amber-500"
              }
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                AI Executive Decision Cockpit
              </div>
              <CardTitle className="text-xl font-black tracking-tight text-foreground">
                {headline}
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className="px-3 py-1 text-sm font-bold tracking-wide"
              variant={isApproved ? "default" : isDisqualified ? "destructive" : "secondary"}
            >
              {verdict}
            </Badge>
            {entryScore != null && (
              <Badge variant="outline" className="px-3 py-1 text-sm font-bold tabular-nums">
                Score: {entryScore}/100
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

      {/* TIER 2: SUPPORTING DECISION METRICS & EVIDENCE */}
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Bias */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Directional Bias
            </div>
            <div className="mt-1 font-bold text-foreground">
              {bias ? bias.toUpperCase() : "—"}
              {biasStrength && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({biasStrength})
                </span>
              )}
            </div>
          </div>

          {/* Alignment */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Strategy Alignment
            </div>
            <div className="mt-1 font-bold text-foreground">
              {alignmentScore != null ? `${alignmentScore}%` : "—"}
            </div>
          </div>

          {/* Risk */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Risk Status
            </div>
            <div className="mt-1 font-bold text-foreground">
              {riskStatus ? (
                <Badge
                  variant={
                    riskStatus === "acceptable"
                      ? "default"
                      : riskStatus === "warning"
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-[10px]"
                >
                  {riskStatus.toUpperCase()}
                </Badge>
              ) : (
                `${trade.risk_pct ?? 1}% Actual`
              )}
            </div>
          </div>

          {/* History */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              24-Trade History
            </div>
            <div className="mt-1 text-xs font-bold text-foreground">
              {similarSetupsCount != null ? `${similarSetupsCount} Similar Setups` : "Checked"}
            </div>
          </div>
        </div>

        {/* Confirmations Matrix */}
        {(matchedRules.length > 0 || missingRules.length > 0 || violatedRules.length > 0) && (
          <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
            {/* Matched */}
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase text-success">
                <CheckCircle2 className="h-3 w-3" /> Confirmed ({matchedRules.length})
              </div>
              {matchedRules.length === 0 ? (
                <span className="text-xs text-muted-foreground">None</span>
              ) : (
                <ul className="space-y-1 text-xs font-medium">
                  {matchedRules.map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-success">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Missing */}
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase text-amber-500">
                <AlertTriangle className="h-3 w-3" /> Missing / Pending ({missingRules.length})
              </div>
              {missingRules.length === 0 ? (
                <span className="text-xs text-muted-foreground">None missing</span>
              ) : (
                <ul className="space-y-1 text-xs font-medium">
                  {missingRules.map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-amber-500">○</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Violated */}
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase text-destructive">
                <XCircle className="h-3 w-3" /> Violated ({violatedRules.length})
              </div>
              {violatedRules.length === 0 ? (
                <span className="text-xs text-muted-foreground">Zero violations</span>
              ) : (
                <ul className="space-y-1 text-xs font-medium">
                  {violatedRules.map((r, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-destructive">✗</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
