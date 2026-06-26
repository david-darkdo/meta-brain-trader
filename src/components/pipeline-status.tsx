import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "BLIND", label: "Analyzing screenshots" },
  { key: "STRATEGY", label: "Matching strategy profile" },
  { key: "VALIDATION", label: "Validating setup quality" },
  { key: "LEARNING", label: "Reviewing your recent trades" },
  { key: "VERDICT", label: "Issuing verdict" },
  { key: "EDUCATION", label: "Generating educational lesson" },
  { key: "COACH", label: "Writing coaching report" },
] as const;

const ORDER = ["PENDING", ...STEPS.map((s) => s.key), "COMPLETED"] as const;

export function PipelineStatus({
  tradeId,
  initialStep,
  initialError,
}: {
  tradeId: string;
  initialStep: string;
  initialError: string | null;
}) {
  const [step, setStep] = useState<string>(initialStep);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    setStep(initialStep);
    setError(initialError);
  }, [initialStep, initialError]);

  useEffect(() => {
    const ch = supabase
      .channel(`trade-${tradeId}-pipeline`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
          filter: `trade_id=eq.${tradeId}`,
        },
        (payload) => {
          const next = payload.new as { processing_step: string; processing_error: string | null };
          setStep(next.processing_step);
          setError(next.processing_error);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tradeId]);

  const currentIdx = ORDER.indexOf(step as (typeof ORDER)[number]);
  const failed = step === "FAILED";
  const completed = step === "COMPLETED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {completed
            ? "AI analysis complete"
            : failed
              ? "AI analysis failed"
              : "AI pipeline running"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {STEPS.map((s, i) => {
          const stepIdx = i + 1;
          const done = completed || currentIdx > stepIdx;
          const active = !completed && !failed && currentIdx === stepIdx;
          return (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span
                className={cn(
                  done && "text-foreground",
                  active && "font-medium text-foreground",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
        {failed && error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
