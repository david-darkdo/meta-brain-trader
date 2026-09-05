import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StructuredOutput } from "@/components/structured-output";

export type Analysis = {
  analysis_id: string;
  stage: string;
  ai_output: Record<string, unknown> & { stage?: string };
  model_provider: string | null;
  model_name: string | null;
  verdict: string | null;
  entry_score: number | null;
  created_at: string;
};

const STAGE_TITLES: Record<string, string> = {
  BLIND: "1 · Blind Chart Analysis",
  STRATEGY: "2 · Strategy Alignment",
  VALIDATION: "3 · Setup Validation & Risk",
  LEARNING: "4 · Historical Learning Context",
  VERDICT: "5 · Final Decision & Verdict",
  EDUCATION: "6 · Educational Lesson",
  COACH: "7 · Pre-Trade Coaching Report",
  REVIEW: "1 · Execution vs Plan Review",
  MISTAKE: "2 · Mistake & Error Detection",
  PERFORMANCE: "3 · Performance & Strengths",
  LEARNING_UPDATE: "4 · Pattern Memory Update",
  COACH_REPORT: "5 · Post-Trade Coach Report",
};

const POST_STAGES = new Set([
  "REVIEW",
  "MISTAKE",
  "PERFORMANCE",
  "LEARNING_UPDATE",
  "COACH_REPORT",
]);

type Phase = "PRE" | "POST" | "ALL";

export function AiAnalysesPanel({
  tradeId,
  phase = "ALL",
}: {
  tradeId: string;
  phase?: Phase;
}) {
  const [items, setItems] = useState<Analysis[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("ai_analyses")
        .select(
          "analysis_id,stage,ai_output,model_provider,model_name,verdict,entry_score,created_at",
        )
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });
      if (active && data) setItems(data as Analysis[]);
    };
    load();
    const ch = supabase
      .channel(`trade-${tradeId}-analyses-${phase}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_analyses",
          filter: `trade_id=eq.${tradeId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [tradeId, phase]);

  const filtered = items.filter((a) => {
    const stageKey = (a.ai_output?.stage as string) || a.stage;
    if (phase === "PRE") return !POST_STAGES.has(stageKey);
    if (phase === "POST") return POST_STAGES.has(stageKey);
    return true;
  });

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {phase === "PRE"
            ? "Pre-Trade Intelligence Stages"
            : phase === "POST"
              ? "Post-Trade Audit Stages"
              : "AI Intelligence Stages"}
        </h3>
        <span className="text-xs text-muted-foreground">
          {filtered.length} stage{filtered.length > 1 ? "s" : ""} completed
        </span>
      </div>

      {filtered.map((a) => {
        const stageKey = (a.ai_output?.stage as string) || a.stage;
        const title = STAGE_TITLES[stageKey] ?? stageKey;
        const out = a.ai_output || {};
        const headline = (out.executive_headline as string) || null;

        return (
          <Card key={a.analysis_id} className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">{title}</CardTitle>
                  {headline && (
                    <div className="mt-0.5 font-mono text-xs font-semibold text-primary">
                      {headline}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {a.verdict && (
                    <Badge
                      variant={
                        a.verdict === "APPROVED"
                          ? "default"
                          : a.verdict === "DISQUALIFIED"
                            ? "destructive"
                            : "secondary"
                      }
                      className="font-bold"
                    >
                      {a.verdict}
                      {a.entry_score != null && ` · ${a.entry_score}/100`}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {a.model_provider}/{a.model_name?.split("/").pop()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StructuredOutput data={a.ai_output} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
