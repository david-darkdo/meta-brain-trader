import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, History, Loader2, Maximize2, Save } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/strategy-profiles")({
  head: () => ({ meta: [{ title: "Strategy OS — MetaBrain Trader" }] }),
  component: StrategyOS,
});

type EngineKey =
  | "system_identity_prompt"
  | "core_strategy_prompt"
  | "entry_confirmation_prompt"
  | "risk_prompt"
  | "filter_prompt"
  | "psychology_prompt"
  | "learning_prompt"
  | "education_prompt"
  | "community_prompt"
  | "investor_prompt";

type StrategyOSRow = {
  id: string;
  user_id: string;
  version: number;
  updated_at: string;
} & Record<EngineKey, string>;

const ENGINES: {
  key: EngineKey;
  title: string;
  subtitle: string;
  placeholder: string;
}[] = [
  {
    key: "system_identity_prompt",
    title: "1 · System Identity Engine",
    subtitle:
      "MetaBrain identity, mission, AI authority, voice, behavior, institutional philosophy, capital preservation, execution authority.",
    placeholder: "Paste the complete MetaBrain identity prompt here…",
  },
  {
    key: "core_strategy_prompt",
    title: "2 · Core Strategy Engine",
    subtitle:
      "FX David Darkdo strategy, break & retest, multi-timeframe logic, AOI, displacement, liquidity, orderblocks, BOS, CHoCH, institutional footprint.",
    placeholder: "Paste the complete core strategy prompt here…",
  },
  {
    key: "entry_confirmation_prompt",
    title: "3 · Entry Confirmation Engine",
    subtitle:
      "Engulfing, doji, EMA rejection/alignment, BOS, CHoCH, liquidity sweep, orderblock, H&S, break & retest, confirmation scoring, consecutive candles.",
    placeholder: "Paste the complete entry confirmation prompt here…",
  },
  {
    key: "risk_prompt",
    title: "4 · Risk Engine",
    subtitle:
      "Risk %, drawdown control, max trades, RR logic, trailing, capital preservation, position sizing, investor restrictions.",
    placeholder: "Paste the complete risk engine prompt here…",
  },
  {
    key: "filter_prompt",
    title: "5 · Filter Engine",
    subtitle:
      "Friday rule, news filter, session filter, retail-trap filter, liquidity-trap filter, bias conflict, structural conflict, disqualification logic.",
    placeholder: "Paste the complete filter engine prompt here…",
  },
  {
    key: "psychology_prompt",
    title: "6 · Psychology Engine",
    subtitle:
      "FOMO rules, revenge rules, emotional control, discipline scoring, reset protocol, spiritual anchor, execution psychology.",
    placeholder: "Paste the complete psychology engine prompt here…",
  },
  {
    key: "learning_prompt",
    title: "7 · Learning Engine",
    subtitle:
      "Last 24 trades learning, lesson extraction, pattern scoring, promotion, disqualification, win/loss analysis, weekly & monthly review.",
    placeholder: "Paste the complete learning engine prompt here…",
  },
  {
    key: "education_prompt",
    title: "8 · Education Engine",
    subtitle:
      "Coaching, market narrative, David vs MetaBrain audit, challenge lazy analysis, teaching logic, mastery feedback.",
    placeholder: "Paste the complete education engine prompt here…",
  },
  {
    key: "community_prompt",
    title: "9 · Community Engine",
    subtitle:
      "Discord logic, journal sharing, pre/post-trade sharing, reflection sharing, AI post generation, screenshot handling, likes, comments, profile sync.",
    placeholder: "Paste the complete community engine prompt here…",
  },
  {
    key: "investor_prompt",
    title: "10 · Investor Engine",
    subtitle:
      "Investor & funded accounts, capital allocation, account mirroring, performance tracking, profit/drawdown updates, reporting, investor dashboard.",
    placeholder: "Paste the complete investor engine prompt here…",
  },
];

function StrategyOS() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["strategy-os"],
    queryFn: async (): Promise<StrategyOSRow> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { data: existing } = await supabase
        .from("strategy_os")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (existing) return existing as StrategyOSRow;

      const { data: created, error } = await supabase
        .from("strategy_os")
        .insert({ user_id: uid })
        .select("*")
        .single();
      if (error) throw error;
      return created as StrategyOSRow;
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Strategy OS</h1>
          <Badge variant="secondary">Prompt Memory</Badge>
          {q.data && (
            <Badge variant="outline" className="ml-auto">
              v{q.data.version}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          The permanent prompt operating system for MetaBrain. Paste complete AI
          instructions into each engine. Every engine is stored verbatim, version
          controlled, and injected into the corresponding AI pipeline stage.
        </p>
      </header>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Strategy OS…
        </div>
      )}

      {q.data &&
        ENGINES.map((e) => (
          <EngineEditor
            key={e.key}
            row={q.data!}
            engine={e}
            onSaved={(next) =>
              qc.setQueryData(["strategy-os"], (old: StrategyOSRow | undefined) =>
                old ? { ...old, ...next } : old,
              )
            }
          />
        ))}
    </div>
  );
}

function EngineEditor({
  row,
  engine,
  onSaved,
}: {
  row: StrategyOSRow;
  engine: { key: EngineKey; title: string; subtitle: string; placeholder: string };
  onSaved: (patch: Partial<StrategyOSRow>) => void;
}) {
  const initial = row[engine.key] ?? "";
  const [value, setValue] = useState<string>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "dirty">("idle");
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initial);

  useEffect(() => {
    setValue(row[engine.key] ?? "");
    lastSaved.current = row[engine.key] ?? "";
  }, [row, engine.key]);

  const save = useMutation({
    mutationFn: async (next: string) => {
      const { data, error } = await supabase
        .from("strategy_os")
        .update({ [engine.key]: next } as never)
        .eq("id", row.id)
        .select("version,updated_at")
        .single();
      if (error) throw error;
      return { next, meta: data as { version: number; updated_at: string } };
    },
    onMutate: () => setStatus("saving"),
    onSuccess: ({ next, meta }) => {
      lastSaved.current = next;
      setStatus("saved");
      onSaved({
        [engine.key]: next,
        version: meta.version,
        updated_at: meta.updated_at,
      } as Partial<StrategyOSRow>);
      setTimeout(() => setStatus("idle"), 1200);
    },
    onError: (e) => {
      setStatus("dirty");
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
  });

  const scheduleSave = (next: string) => {
    setValue(next);
    setStatus(next === lastSaved.current ? "idle" : "dirty");
    if (timer.current) clearTimeout(timer.current);
    if (next === lastSaved.current) return;
    timer.current = setTimeout(() => save.mutate(next), 1200);
  };

  const saveNow = () => {
    if (timer.current) clearTimeout(timer.current);
    if (value !== lastSaved.current) save.mutate(value);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{engine.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{engine.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1"
            >
              <History className="h-3.5 w-3.5" /> History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
              className="gap-1"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Expand
            </Button>
            <Button
              size="sm"
              onClick={saveNow}
              disabled={value === lastSaved.current || save.isPending}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => scheduleSave(e.target.value)}
          placeholder={engine.placeholder}
          spellCheck={false}
          className="min-h-[260px] resize-y font-mono text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Storage: strategy_os.{engine.key}</span>
          <span>{value.length.toLocaleString()} chars</span>
        </div>
      </CardContent>

      {/* Fullscreen editor */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{engine.title}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={value}
            onChange={(e) => scheduleSave(e.target.value)}
            placeholder={engine.placeholder}
            spellCheck={false}
            className="min-h-[70vh] resize-none font-mono text-sm leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{value.length.toLocaleString()} chars</span>
            <div className="flex items-center gap-2">
              <StatusPill status={status} />
              <Button size="sm" onClick={saveNow} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Save now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        strategyOsId={row.id}
        engineKey={engine.key}
        engineTitle={engine.title}
        onRestore={(content) => {
          scheduleSave(content);
          setHistoryOpen(false);
          toast.success("Restored prior version — remember to save if autosave is off.");
        }}
      />
    </Card>
  );
}

function StatusPill({ status }: { status: "idle" | "saving" | "saved" | "dirty" }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-500">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  if (status === "dirty")
    return <span className="text-xs text-amber-400">Unsaved changes</span>;
  return null;
}

function HistoryDialog({
  open,
  onOpenChange,
  strategyOsId,
  engineKey,
  engineTitle,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  strategyOsId: string;
  engineKey: EngineKey;
  engineTitle: string;
  onRestore: (content: string) => void;
}) {
  const q = useQuery({
    queryKey: ["strategy-os-history", strategyOsId, engineKey],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_os_versions")
        .select("id,version,new_content,previous_content,created_at")
        .eq("strategy_os_id", strategyOsId)
        .eq("engine_key", engineKey)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{engineTitle} — Version History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          {q.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          )}
          {q.data && q.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          )}
          <ul className="space-y-3">
            {(q.data ?? []).map((v) => (
              <li key={v.id} className="rounded-md border border-border/60 bg-card/40 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    v{v.version} ·{" "}
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRestore(v.new_content ?? "")}
                  >
                    Restore
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground/90">
                  {(v.new_content ?? "").slice(0, 2000) ||
                    "(empty)"}
                  {v.new_content && v.new_content.length > 2000 ? "\n…" : ""}
                </pre>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
