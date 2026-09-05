import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Shield,
  BookOpen,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HIDDEN_KEYS = new Set(["stage"]);

// Tier 1: Decision Fields
const DECISION_KEYS = new Set([
  "executive_headline",
  "decision_summary",
  "action_directive",
  "top_takeaway_headline",
]);

// Tier 3: Deep Dive Narrative Fields
const DEEP_DIVE_KEYS = new Set([
  "educational_explanation",
  "institutional_narrative",
  "why_it_matters",
  "practice_drill",
  "common_misconceptions",
  "coaching_summary",
  "mindset_note",
  "confidence_tip",
  "confidence_message",
  "root_cause",
  "concept",
  "historical_edge",
  "edge_signal",
  "pattern_evolution_note",
]);

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StructuredOutput({ data }: { data: Record<string, unknown> }) {
  if (!data || typeof data !== "object") return null;

  const headline = (data.executive_headline as string) || (data.top_takeaway_headline as string) || null;
  const summary = (data.decision_summary as string) || null;
  const action = (data.action_directive as string) || null;
  const hasTier1 = Boolean(headline || summary || action);

  // Separate remaining entries into Tier 2 (Evidence) and Tier 3 (Deep Dive)
  const tier2Entries: Array<[string, unknown]> = [];
  const tier3Entries: Array<[string, unknown]> = [];

  for (const [k, v] of Object.entries(data)) {
    if (HIDDEN_KEYS.has(k) || DECISION_KEYS.has(k)) continue;
    if (v == null || v === "") continue;

    if (DEEP_DIVE_KEYS.has(k)) {
      tier3Entries.push([k, v]);
    } else if (typeof v === "string" && v.length > 180) {
      // Long freeform prose automatically goes to Deep Dive
      tier3Entries.push([k, v]);
    } else {
      tier2Entries.push([k, v]);
    }
  }

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
            {data.execution_quality && (
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
            {data.risk_status && (
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

          {summary && (
            <p className="mt-2 text-sm leading-relaxed text-foreground/90 font-medium">
              {summary}
            </p>
          )}

          {action && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/30 bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary">
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span>ACTION: {action}</span>
            </div>
          )}
        </div>
      )}

      {/* TIER 2: EVIDENCE & METRICS (Compact) */}
      {tier2Entries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {tier2Entries.map(([k, v]) => (
            <EvidenceCard key={k} fieldKey={k} label={humanize(k)} value={v} />
          ))}
        </div>
      )}

      {/* TIER 3: DEEP DIVE (Collapsible Accordion) */}
      {tier3Entries.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="deep-dive" className="border-border/60">
            <AccordionTrigger className="py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span>Show Detailed Institutional Analysis & Educational Lesson</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-3 rounded-md border border-border/40 bg-muted/20 p-3">
                {tier3Entries.map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {humanize(k)}
                    </div>
                    {typeof v === "string" ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                        {v}
                      </p>
                    ) : (
                      <StructuredValueRenderer value={v} />
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

function EvidenceCard({
  fieldKey,
  label,
  value,
}: {
  fieldKey: string;
  label: string;
  value: unknown;
}) {
  // Special rules visualization
  if (fieldKey === "matched_rules" && Array.isArray(value)) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Matched Confirmations ({value.length})
        </div>
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <ul className="space-y-1">
            {value.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs font-medium text-foreground">
                <span className="text-success">✓</span>
                <span>{String(rule)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (fieldKey === "missing_rules" && Array.isArray(value)) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5" /> Missing / Pending Rules ({value.length})
        </div>
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">All required rules present</span>
        ) : (
          <ul className="space-y-1">
            {value.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs font-medium text-foreground">
                <span className="text-amber-500">○</span>
                <span>{String(rule)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (fieldKey === "violated_rules" && Array.isArray(value)) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
          <XCircle className="h-3.5 w-3.5" /> Violated Rules ({value.length})
        </div>
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <ul className="space-y-1">
            {value.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs font-medium text-foreground">
                <span className="text-destructive">✗</span>
                <span>{String(rule)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (fieldKey === "warnings" && Array.isArray(value)) {
    return (
      <div className="rounded-md border border-destructive/20 bg-card/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Warnings
        </div>
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No active warnings</span>
        ) : (
          <ul className="space-y-1">
            {value.map((w, idx) => (
              <li key={idx} className="text-xs text-foreground">
                • {String(w)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/80 bg-card/60 p-3">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <StructuredValueRenderer value={value} />
    </div>
  );
}

function StructuredValueRenderer({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "Triggered / Yes" : "No"}
      </Badge>
    );
  }
  if (typeof value === "number") {
    return <div className="text-xl font-bold tabular-nums text-foreground">{value}</div>;
  }
  if (typeof value === "string") {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-xs text-muted-foreground">None</span>;
    return (
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i}>
            <StructuredArrayItem item={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <dl className="space-y-1 text-xs">
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <dt className="shrink-0 font-medium text-muted-foreground">{humanize(k)}:</dt>
            <dd className="flex-1 font-medium text-foreground">
              <StructuredValueRenderer value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm">{String(value)}</span>;
}

function StructuredArrayItem({ item }: { item: unknown }) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    const title =
      (typeof obj.label === "string" && obj.label) ||
      (typeof obj.name === "string" && obj.name) ||
      (typeof obj.title === "string" && obj.title) ||
      null;
    const occ = typeof obj.occurrences === "number" ? obj.occurrences : null;
    const sev = typeof obj.severity === "string" ? obj.severity : null;
    const description =
      (typeof obj.description === "string" && obj.description) ||
      (typeof obj.detail === "string" && obj.detail) ||
      null;

    if (title) {
      return (
        <div className="rounded border border-border/60 bg-background/50 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">{title}</span>
            {sev && (
              <Badge
                variant={sev === "high" ? "destructive" : sev === "medium" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {sev}
              </Badge>
            )}
            {occ != null && <Badge variant="secondary" className="text-[10px]">Occurred {occ}×</Badge>}
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      );
    }
  }
  if (typeof item === "string") {
    return <span className="text-xs font-medium text-foreground">• {item}</span>;
  }
  return <span className="text-xs">{JSON.stringify(item)}</span>;
}
