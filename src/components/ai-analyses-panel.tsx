import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
};

export function AiAnalysesPanel({ tradeId }: { tradeId: string }) {
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
      if (active) setItems((data ?? []) as Analysis[]);
    };
    load();
    const ch = supabase
      .channel(`trade-${tradeId}-analyses`)
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
  }, [tradeId]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">AI analysis</h2>
      {items.map((a) => {
        const stageKey = (a.ai_output?.stage as string) || a.stage;
        const title = STAGE_TITLES[stageKey] ?? stageKey;
        return (
          <Card key={a.analysis_id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
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
                    >
                      {a.verdict}
                      {a.entry_score != null && ` · ${a.entry_score}/100`}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {a.model_provider}/{a.model_name?.split("/").pop()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {renderStructured(a.ai_output)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function renderStructured(obj: Record<string, unknown>) {
  const entries = Object.entries(obj).filter(([k]) => k !== "stage");
  return (
    <dl className="space-y-3">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {k.replace(/_/g, " ")}
          </dt>
          <dd className="mt-1">{renderValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <ul className="list-disc space-y-1 pl-5">
        {v.map((item, i) => (
          <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") return <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(v, null, 2)}</pre>;
  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}
