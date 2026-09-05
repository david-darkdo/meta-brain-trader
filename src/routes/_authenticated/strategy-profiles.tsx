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

const DEFAULT_PROMPTS: Record<EngineKey, string> = {
  system_identity_prompt: `I am MetaBrainTrader, an AI trading validator and risk architect.

My mission is ruthless capital accumulation and preservation for David Darkdo.

I operate with:

• zero emotion
• strict rule-based logic
• data-driven discretion
• institutional market structure analysis
• uncompromising risk management

I do not guess. I do not gamble. I execute the strategy verbatim.`,

  core_strategy_prompt: `FX David Darkdo Strategy:
• Primary Strategy: Master Break & Retest
• Secondary Strategy: Liquidity Sweep + Orderblock
• Bias Timeframes: 1D, 4H
• Entry Timeframes: 1H, 30M, 15M
• Area of Interest (AOI): Mark prior swing highs/lows and HTF order blocks
• Break Rules: Strong body close beyond level on entry timeframe
• Retest Rules: Wait for retest of broken level with clear rejection wick
• Structure Rules: Respect HTF structure; no counter-trend entries
• Displacement: Require strong impulsive displacement candle on break
• Liquidity: Hunt obvious equal highs/lows (BSL/SSL) before entry
• Orderblock: Last opposing candle before displacement
• Minimum Confirmations: 3 required`,

  entry_confirmation_prompt: `Entry Confirmation Rules:
• Confirm Break & Retest: True
• Confirm Engulfing Candle: True
• Confirm EMA Rejection & Alignment: True
• Confirm Market Structure Shift (BOS/CHoCH): True
• Confirm Liquidity Sweep: True
• Confirm Orderblock Mitigation: True
• Consecutive Candle Rule: No more than 2 same-direction candles before entry
• Confirmation Scoring: Minimum 3 confirmations required for approval`,

  risk_prompt: `Risk Engine Standard:
• Standard Strategy Risk: 1.0% per trade
• Max Daily Loss: 2.0%
• Max Weekly Trades: 2-4 quality setups
• Minimum Risk to Reward (R:R): 1:2.5 minimum (Target 1:3+)
• Trailing Stop Logic: Move to Breakeven at 1:2R; trail swing lows/highs
• Capital Preservation First: Disqualify any trade with unclear invalidation`,

  filter_prompt: `Filter Rules:
• Friday Rule: No new swing entries after 12:00 PM EST on Friday
• High Impact News Filter: No entries within 30 minutes before/after Red Folder news
• Session Filter: London & New York sessions only (07:00 - 16:00 GMT)
• Spread Filter: Max 2.0 pips spread
• Conflict Filter: Disqualify if 1D bias conflicts with 4H market structure`,

  psychology_prompt: `Psychology & Discipline Protocol:
• Pre-trade Affirmation: "I trade my plan with patience, detachment, and discipline."
• FOMO Detection: Never chase price beyond planned entry level
• Revenge Protection: Mandatory 30-minute cooling period after any loss
• Emotional Reset: Step away from charts if feeling anxiety or impatience
• Discipline Reminder: Skipping a bad setup is a profitable trading decision`,

  learning_prompt: `Learning Engine Directives:
• Lookback Memory: Last 24 closed trades
• Pattern Identification: Track recurring strengths and recurring mistakes
• Mistake Flagging: Tag repeated mistakes (e.g., early entry, moved stop loss)
• Historical Edge: Validate if setup matches high win-rate conditions`,

  education_prompt: `Education Engine Directives:
• Concept Teaching: Explain why institutional order flow behaved in this manner
• Deep Explanation: Provide institutional market narrative behind every setup
• Practice Drill: Give specific chart observation drills to reinforce mastery`,

  community_prompt: `Community Engine Directives:
• Journal Sharing: Formulate clean, professional trade summaries for sharing
• Constructive Review: Emphasize rule adherence over financial outcome`,

  investor_prompt: `Investor Engine Directives:
• Capital Allocation: Adhere strictly to master risk parameters
• Drawdown Governance: Prioritize investor capital preservation above all else
• Audit Trail: Every execution decision must be verifiable against Strategy OS rules`,
};

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
      // 1. Resolve active user session
      let uid = "";
      try {
        const { data: sess } = await supabase.auth.getSession();
        uid = sess.session?.user?.id ?? "";
      } catch (_) {}

      if (!uid) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          uid = userRes.user?.id ?? "";
        } catch (_) {}
      }

      // 2. Fetch existing Strategy OS row from database
      if (uid) {
        const { data: existing } = await supabase
          .from("strategy_os")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        if (existing) {
          return populateMissingDefaults(existing as StrategyOSRow);
        }
      }

      // 3. Fallback: Query under RLS
      const { data: rlsRow } = await supabase
        .from("strategy_os")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rlsRow) {
        return populateMissingDefaults(rlsRow as StrategyOSRow);
      }

      // 4. Create new Strategy OS row with defaults if authenticated
      if (uid) {
        try {
          const { data: created } = await supabase
            .from("strategy_os")
            .insert({
              user_id: uid,
              system_identity_prompt: DEFAULT_PROMPTS.system_identity_prompt,
              core_strategy_prompt: DEFAULT_PROMPTS.core_strategy_prompt,
              entry_confirmation_prompt: DEFAULT_PROMPTS.entry_confirmation_prompt,
              risk_prompt: DEFAULT_PROMPTS.risk_prompt,
              filter_prompt: DEFAULT_PROMPTS.filter_prompt,
              psychology_prompt: DEFAULT_PROMPTS.psychology_prompt,
              learning_prompt: DEFAULT_PROMPTS.learning_prompt,
              education_prompt: DEFAULT_PROMPTS.education_prompt,
              community_prompt: DEFAULT_PROMPTS.community_prompt,
              investor_prompt: DEFAULT_PROMPTS.investor_prompt,
            })
            .select("*")
            .maybeSingle();

          if (created) return created as StrategyOSRow;
        } catch (_) {}
      }

      // 5. Reliable in-memory fallback so Strategy OS UI ALWAYS renders immediately
      return {
        id: "local-os",
        user_id: uid || "local",
        version: 1,
        updated_at: new Date().toISOString(),
        ...DEFAULT_PROMPTS,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const activeRow = q.data ?? {
    id: "loading-os",
    user_id: "local",
    version: 1,
    updated_at: new Date().toISOString(),
    ...DEFAULT_PROMPTS,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Strategy OS</h1>
          <Badge variant="secondary">Prompt Memory</Badge>
          <Badge variant="outline" className="ml-auto">
            v{activeRow.version ?? 1}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The permanent prompt operating system for MetaBrain. Paste complete AI
          instructions into each engine. Every engine is stored verbatim, version
          controlled, and injected into the corresponding AI pipeline stage.
        </p>
      </header>

      {q.isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Synchronizing prompt memory…
        </div>
      )}

      {ENGINES.map((e) => (
        <EngineEditor
          key={e.key}
          row={activeRow}
          engine={e}
          onSaved={(next) =>
            qc.setQueryData(["strategy-os"], (old: StrategyOSRow | undefined) =>
              old ? { ...old, ...next } : { ...activeRow, ...next },
            )
          }
        />
      ))}
    </div>
  );
}

function populateMissingDefaults(row: StrategyOSRow): StrategyOSRow {
  const populated = { ...row };
  for (const key of Object.keys(DEFAULT_PROMPTS) as EngineKey[]) {
    if (!populated[key] || populated[key].trim() === "") {
      populated[key] = DEFAULT_PROMPTS[key];
    }
  }
  return populated;
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
  const initial = row[engine.key] || DEFAULT_PROMPTS[engine.key] || "";
  const [value, setValue] = useState<string>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "dirty">("idle");
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initial);

  useEffect(() => {
    const nextVal = row[engine.key] || DEFAULT_PROMPTS[engine.key] || "";
    setValue(nextVal);
    lastSaved.current = nextVal;
  }, [row, engine.key]);

  const save = useMutation({
    mutationFn: async (next: string) => {
      if (row.id === "local-os" || row.id === "loading-os") {
        // Upsert row if it wasn't in db yet
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) throw new Error("Please sign in to save prompts to cloud.");
        const { data, error } = await supabase
          .from("strategy_os")
          .upsert({ user_id: uid, [engine.key]: next }, { onConflict: "user_id" })
          .select("id,version,updated_at")
          .single();
        if (error) throw error;
        return { next, meta: data as { id: string; version: number; updated_at: string } };
      }

      const { data, error } = await supabase
        .from("strategy_os")
        .update({ [engine.key]: next } as never)
        .eq("id", row.id)
        .select("id,version,updated_at")
        .single();
      if (error) throw error;
      return { next, meta: data as { id: string; version: number; updated_at: string } };
    },
    onMutate: () => setStatus("saving"),
    onSuccess: ({ next, meta }) => {
      lastSaved.current = next;
      setStatus("saved");
      onSaved({
        id: meta.id || row.id,
        [engine.key]: next,
        version: meta.version || (row.version + 1),
        updated_at: meta.updated_at || new Date().toISOString(),
      } as Partial<StrategyOSRow>);
      toast.success(`${engine.title} saved`);
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
    timer.current = setTimeout(() => save.mutate(next), 1500);
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
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold">{engine.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{engine.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="h-8 gap-1 text-xs"
            >
              <History className="h-3.5 w-3.5" /> History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
              className="h-8 gap-1 text-xs"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Expand
            </Button>
            <Button
              size="sm"
              onClick={saveNow}
              disabled={value === lastSaved.current || save.isPending}
              className="h-8 gap-1.5 text-xs font-semibold"
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
          className="min-h-[220px] resize-y bg-background font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Storage: strategy_os.{engine.key}</span>
          <span className="font-mono">{value.length.toLocaleString()} chars</span>
        </div>
      </CardContent>

      {/* Fullscreen expanded dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{engine.title}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={value}
            onChange={(e) => scheduleSave(e.target.value)}
            placeholder={engine.placeholder}
            spellCheck={false}
            className="min-h-[65vh] resize-none font-mono text-xs leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{value.length.toLocaleString()} chars</span>
            <div className="flex items-center gap-2">
              <StatusPill status={status} />
              <Button size="sm" onClick={saveNow} className="gap-1.5 font-semibold">
                <Save className="h-3.5 w-3.5" /> Save now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        strategyOsId={row.id}
        engineKey={engine.key}
        engineTitle={engine.title}
        onRestore={(content) => {
          scheduleSave(content);
          setHistoryOpen(false);
          toast.success("Restored prior version");
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
    enabled: open && strategyOsId !== "local-os" && strategyOsId !== "loading-os",
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
          {(!q.data || q.data.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No previous versions saved yet. Versions are logged automatically whenever you save a prompt.
            </p>
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
                  {(v.new_content ?? "").slice(0, 2000) || "(empty)"}
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
