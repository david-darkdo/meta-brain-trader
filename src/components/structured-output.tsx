import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Info,
} from "lucide-react";

interface StructuredOutputProps {
  data: Record<string, unknown>;
  stage?: string;
  defaultExpanded?: boolean;
}

export function StructuredOutput({
  data,
  stage = "UNKNOWN",
  defaultExpanded = false,
}: StructuredOutputProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!data || typeof data !== "object") {
    return (
      <div className="text-muted-foreground text-xs italic">
        No structured analysis output available.
      </div>
    );
  }

  // Extract Top-Level Headline and Core Verdict/Status
  const headline =
    (data.executive_headline as string) ||
    (data.headline as string) ||
    (data.decision_summary as string) ||
    null;

  const verdict =
    (data.verdict as string) ||
    (data.status as string) ||
    (data.recommendation as string) ||
    null;

  const score =
    typeof data.score === "number"
      ? data.score
      : typeof data.entry_score === "number"
        ? data.entry_score
        : null;

  const reason =
    (data.primary_reason as string) ||
    (data.rejection_reason as string) ||
    (data.justification as string) ||
    null;

  // Key-value pairs excluding top-level meta properties
  const detailEntries = Object.entries(data).filter(
    ([k]) =>
      ![
        "executive_headline",
        "headline",
        "decision_summary",
        "verdict",
        "status",
        "recommendation",
        "score",
        "entry_score",
        "primary_reason",
        "rejection_reason",
        "justification",
        "stage",
      ].includes(k),
  );

  const hasTier1 = !!(headline || verdict || score !== null || reason);

  return (
    <div className="space-y-4">
      {/* TIER 1: DECISION COCKPIT (Always Visible) */}
      {hasTier1 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {headline && (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  {headline}
                </span>
              </div>
            )}
            {Boolean(data.execution_quality) && (
              <Badge
                variant={
                  data.execution_quality === "flawless"
                    ? "default"
                    : data.execution_quality === "minor_deviation"
                      ? "secondary"
                      : "destructive"
                }
              >
                {String(data.execution_quality).replace("_", " ")}
              </Badge>
            )}
            {Boolean(data.risk_status) && (
              <Badge
                variant={
                  data.risk_status === "acceptable"
                    ? "default"
                    : data.risk_status === "warning"
                      ? "secondary"
                      : "destructive"
                }
              >
                Risk: {String(data.risk_status)}
              </Badge>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            {verdict && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Verdict:</span>
                <Badge
                  variant={
                    ["APPROVED", "CONFIRMED", "PASS", "SUCCESS"].includes(
                      verdict.toUpperCase(),
                    )
                      ? "default"
                      : ["DISQUALIFIED", "REJECTED", "FAIL", "BLOCKED"].includes(
                            verdict.toUpperCase(),
                          )
                        ? "destructive"
                        : "secondary"
                  }
                  className="font-mono font-bold tracking-wide"
                >
                  {verdict}
                </Badge>
              </div>
            )}

            {score !== null && (
              <div className="flex items-center gap-1.5 font-mono text-sm">
                <span className="text-muted-foreground text-xs">Score:</span>
                <span className="font-bold text-foreground">{score}/100</span>
              </div>
            )}
          </div>

          {reason && (
            <div className="mt-2.5 rounded border border-border/60 bg-background/50 p-2.5 text-xs text-foreground/90 leading-relaxed font-sans">
              <span className="font-semibold text-muted-foreground">Rationale: </span>
              {reason}
            </div>
          )}
        </div>
      )}

      {/* TIER 2 & 3: EXPANDABLE DETAILS & RAW PAYLOAD */}
      {detailEntries.length > 0 && (
        <Card className="border-border/60 bg-card/40">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {stage.replace(/_/g, " ")} Technical Analysis Breakdown ({detailEntries.length} items)
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {expanded && (
            <CardContent className="border-t border-border/40 p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detailEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="rounded-md border border-border/40 bg-secondary/30 p-2.5 space-y-1"
                  >
                    <div className="font-mono text-[11px] font-semibold text-primary uppercase tracking-wider">
                      {key.replace(/_/g, " ")}
                    </div>
                    <div className="text-foreground/85 leading-relaxed font-sans">
                      {renderNestedValue(val)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function renderNestedValue(val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-muted-foreground italic font-mono text-[11px]">null</span>;
  }
  if (typeof val === "boolean") {
    return (
      <Badge variant={val ? "default" : "secondary"} className="text-[10px] font-mono">
        {val ? "TRUE" : "FALSE"}
      </Badge>
    );
  }
  if (typeof val === "number" || typeof val === "string") {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-muted-foreground italic">None</span>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {val.map((item, idx) => (
          <li key={idx} className="text-xs text-foreground/90">
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof val === "object") {
    return (
      <pre className="overflow-x-auto rounded bg-secondary/50 p-2 font-mono text-[11px] text-muted-foreground leading-tight">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }
  return String(val);
}
