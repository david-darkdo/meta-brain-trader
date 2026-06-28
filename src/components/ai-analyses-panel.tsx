import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StructuredOutput } from "@/components/structured-output";

type Analysis = {
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
  BLIND: "Blind chart analysis",
  STRATEGY: "Strategy alignment",
  VALIDATION: "Setup validation",
  LEARNING: "Learning from history",
  VERDICT: "Final verdict",
  EDUCATION: "Educational lesson",
  COACH: "Coaching report",
  REVIEW: "Execution review",
  MISTAKE: "Mistake engine",
  PERFORMANCE: "Performance engine",
  LEARNING_UPDATE: "Learning update",
  COACH_REPORT: "Post-trade coach report",
};

const POST_STAGES = new Set(["REVIEW","MISTAKE","PERFORMANCE","LEARNING_UPDATE","COACH_REPORT"]);
type Phase = "PRE" | "POST" | "ALL";

export function AiAnalysesPanel({ tradeId, phase = "ALL" }: { tradeId: string; phase?: Phase }) {
  const [items, setItems] = useState<Analysis[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("ai_analyses")
        .select("analysis_id,stage,ai_output,model_provider,model_name,verdict,entry_score,created_at")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });
      if (active) setItems((data ?? []) as Analysis[]);
    };
    load();
    const ch = supabase
      .channel(`trade-${tradeId}-analyses`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_analyses", filter: `trade_id=eq.${tradeId}` },
        () => load(),
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [tradeId]);

  const filtered = items.filter((a) => {
    const stageKey = (a.ai_output?.stage as string) || a.stage;
    if (phase === "PRE") return !POST_STAGES.has(stageKey);
    if (phase === "POST") return POST_STAGES.has(stageKey);
    return true;
  });

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-4">
      {filtered.map((a) => {
        const stageKey = (a.ai_output?.stage as string) || a.stage;
        const title = STAGE_TITLES[stageKey] ?? stageKey;
        return (
          <Card key={a.analysis_id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <div className="flex items-center gap-2">
                  {a.verdict && (
                    <Badge variant={a.verdict === "APPROVED" ? "default" : a.verdict === "DISQUALIFIED" ? "destructive" : "secondary"}>
                      {a.verdict}{a.entry_score != null && ` · ${a.entry_score}/100`}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
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
