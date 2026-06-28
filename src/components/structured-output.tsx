// Render an arbitrary JSON object from an AI stage as readable key-value UI.
// Replaces raw <pre>{JSON.stringify}</pre> rendering across the app.
import { Badge } from "@/components/ui/badge";

const HIDDEN_KEYS = new Set(["stage"]);

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StructuredOutput({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => !HIDDEN_KEYS.has(k));
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <FieldCard key={k} label={humanize(k)} value={v} />
      ))}
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ValueRenderer value={value} />
    </div>
  );
}

function ValueRenderer({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>;
  }
  if (typeof value === "number") {
    return <div className="text-xl font-semibold tabular-nums">{value}</div>;
  }
  if (typeof value === "string") {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-sm text-muted-foreground">None</span>;
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i}>
            <ArrayItem item={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <dl className="space-y-1 text-sm">
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{humanize(k)}</dt>
            <dd className="flex-1"><ValueRenderer value={v} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm">{String(value)}</span>;
}

function ArrayItem({ item }: { item: unknown }) {
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
      const rest = Object.entries(obj).filter(
        ([k]) => !["label", "name", "title", "occurrences", "severity", "description", "detail"].includes(k),
      );
      return (
        <div className="rounded border border-border/60 bg-background/40 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            {sev && <Badge variant={sev === "high" ? "destructive" : sev === "medium" ? "default" : "secondary"}>{sev}</Badge>}
            {occ != null && <Badge variant="secondary">Occurred {occ}×</Badge>}
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          {rest.length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {rest.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground">{humanize(k)}:</span>
                  <span><ValueRenderer value={v} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }
  if (typeof item === "string") return <span className="text-sm">• {item}</span>;
  return <span className="text-sm">{JSON.stringify(item)}</span>;
}
