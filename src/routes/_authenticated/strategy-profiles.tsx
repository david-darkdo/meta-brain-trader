import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategy-profiles")({
  head: () => ({ meta: [{ title: "Strategy OS — MetaBrain Trader" }] }),
  component: StrategyOS,
});

type Section =
  | "system_profile"
  | "core_strategy"
  | "entry_confirmations"
  | "risk_engine"
  | "filter_engine"
  | "psychology_engine"
  | "learning_engine"
  | "education_engine"
  | "community_engine"
  | "investor_engine";

type Profile = {
  id: string;
  is_active: boolean;
  system_profile: Record<string, unknown>;
  core_strategy: Record<string, unknown>;
  entry_confirmations: Record<string, unknown>;
  risk_engine: Record<string, unknown>;
  filter_engine: Record<string, unknown>;
  psychology_engine: Record<string, unknown>;
  learning_engine: Record<string, unknown>;
  education_engine: Record<string, unknown>;
  community_engine: Record<string, unknown>;
  investor_engine: Record<string, unknown>;
};

const DEFAULTS: Record<Section, Record<string, unknown>> = {
  system_profile: {
    strategy_name: "FX David Darkdo",
    trading_style: "Swing + Day Hybrid",
    trade_duration: "Hours to Days",
    instruments: ["EURUSD", "GBPUSD", "XAUUSD"],
    risk_per_trade: 0.5,
    max_trades_week: 2,
    max_daily_loss: 2,
    minimum_rr: 3,
    trailing_start_rr: 2,
  },
  core_strategy: {
    primary_strategy: "Master Break & Retest",
    secondary_strategy: "Liquidity Sweep + OB",
    bias_timeframes: ["1D", "4H"],
    entry_timeframes: ["1H", "30M", "15M"],
    aoi_rules: "",
    break_rules: "",
    retest_rules: "",
    structure_rules: "",
    displacement_rules: "",
    liquidity_rules: "",
    orderblock_rules: "",
    confirmation_rules: "",
    consecutive_candle_rules: "",
  },
  entry_confirmations: {
    confirm_break_retest: true,
    confirm_head_shoulders: false,
    confirm_engulfing: true,
    confirm_doji: false,
    confirm_ema_rejection: true,
    confirm_ema_alignment: true,
    confirm_structure_shift: true,
    confirm_liquidity_sweep: true,
    confirm_orderblock: true,
    confirm_bos: true,
    confirm_choch: true,
    confirm_mss: false,
    minimum_confirmations: 3,
  },
  risk_engine: {
    risk_per_trade: 0.5,
    max_daily_loss: 2,
    max_weekly_trades: 2,
    minimum_rr: 3,
    trailing_rr: 2,
    position_sizing_method: "FIXED_PERCENT",
    volatility_adjustment: false,
    news_protection: true,
  },
  filter_engine: {
    allow_friday: false,
    trading_window_start: "07:00",
    trading_window_end: "16:00",
    high_impact_news_filter: true,
    spread_filter: true,
    session_filter: "LONDON_NY",
    weekend_filter: true,
    volatility_filter: true,
  },
  psychology_engine: {
    pretrade_prayer: "",
    pretrade_affirmation: "I trade my plan with patience and discipline.",
    reset_protocol: "Step away 30 min after any loss.",
    fomo_detection: true,
    revenge_detection: true,
    fear_detection: true,
    discipline_reminders: true,
  },
  learning_engine: {
    lookback_trades: 24,
    repeated_mistake_threshold: 2,
    pattern_promotion_threshold: 70,
    pattern_ban_threshold: 30,
    auto_lesson_extraction: true,
  },
  education_engine: {
    challenge_weak_analysis: true,
    explain_market_narrative: true,
    explain_institutional_logic: true,
    compare_ai_vs_user: true,
  },
  community_engine: {
    allow_journal_sharing: false,
    allow_ai_summary: false,
    allow_screenshot_sharing: false,
    allow_discord_export: false,
    allow_public_profiles: false,
    allow_comments: false,
    allow_likes: false,
  },
  investor_engine: {
    master_account_enabled: true,
    mirror_trades: true,
    auto_performance_updates: true,
    auto_equity_updates: true,
    investor_dashboard_enabled: true,
    risk_source: "MASTER_ACCOUNT_ONLY",
  },
};

const SECTIONS: { key: Section; title: string; description: string }[] = [
  { key: "system_profile", title: "System Profile", description: "Trader identity & execution framework" },
  { key: "core_strategy", title: "Core Strategy Engine", description: "Primary playbook, timeframes & rule blocks" },
  { key: "entry_confirmations", title: "Entry Confirmation Engine", description: "Required confluences to fire an entry" },
  { key: "risk_engine", title: "Risk Engine", description: "Position sizing, RR floors & loss caps" },
  { key: "filter_engine", title: "Filter Engine", description: "Sessions, news, spread & volatility guards" },
  { key: "psychology_engine", title: "Psychology Engine", description: "Mindset routines & emotional safeguards" },
  { key: "learning_engine", title: "Learning Engine", description: "How MetaBrain learns from your last 24 trades" },
  { key: "education_engine", title: "Education Engine", description: "How the AI teaches you per trade" },
  { key: "community_engine", title: "Community Engine", description: "Sharing, exports & social surface" },
  { key: "investor_engine", title: "Investor Engine", description: "Master account & investor mirroring" },
];

function StrategyOS() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["strategy-os"],
    queryFn: async (): Promise<Profile> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { data: existing } = await supabase
        .from("strategy_profiles")
        .select("*")
        .eq("user_id", uid)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) return existing as unknown as Profile;

      const { data: created, error } = await supabase
        .from("strategy_profiles")
        .insert({
          user_id: uid,
          name: (DEFAULTS.system_profile.strategy_name as string) ?? "MetaBrain OS",
          is_active: true,
          prompt_config: {},
          ...DEFAULTS,
        })
        .select("*")
        .single();
      if (error) throw error;
      return created as unknown as Profile;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Strategy OS</h1>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The editable operating system that controls how MetaBrain validates every trade.
          Core AI logic stays inside the engine — these sections shape its behavior.
        </p>
      </header>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your operating system…
        </div>
      )}

      {q.data &&
        SECTIONS.map((s) => (
          <SectionCard
            key={s.key}
            profileId={q.data!.id}
            section={s.key}
            title={s.title}
            description={s.description}
            value={(q.data![s.key] ?? {}) as Record<string, unknown>}
            onSaved={(next) =>
              qc.setQueryData(["strategy-os"], (old: Profile | undefined) =>
                old ? { ...old, [s.key]: next } : old,
              )
            }
          />
        ))}
    </div>
  );
}

function SectionCard({
  profileId,
  section,
  title,
  description,
  value,
  onSaved,
}: {
  profileId: string;
  section: Section;
  title: string;
  description: string;
  value: Record<string, unknown>;
  onSaved: (next: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(section === "system_profile");
  const merged = useMemo(() => ({ ...DEFAULTS[section], ...value }), [section, value]);
  const [draft, setDraft] = useState<Record<string, unknown>>(merged);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    setDraft(merged);
  }, [merged]);

  const save = useMutation({
    mutationFn: async (next: Record<string, unknown>) => {
      const { error } = await supabase
        .from("strategy_profiles")
        .update({ [section]: next })
        .eq("id", profileId);
      if (error) throw error;
      return next;
    },
    onMutate: () => setStatus("saving"),
    onSuccess: (next) => {
      setStatus("saved");
      onSaved(next);
      setTimeout(() => setStatus("idle"), 1200);
    },
    onError: (e) => {
      setStatus("idle");
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
  });

  const update = (key: string, val: unknown) => {
    const next = { ...draft, [key]: val };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(next), 600);
  };

  // Skip the very first effect from triggering save loops
  useEffect(() => {
    firstRender.current = false;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {status === "saving" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving
                </span>
              )}
              {status === "saved" && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <FieldGrid section={section} draft={draft} onChange={update} />
            {section === "investor_engine" && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
                Investors do not choose risk. Performance is derived from actual master-account
                execution (pre → live → post → journal → performance engine).
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FieldGrid({
  section,
  draft,
  onChange,
}: {
  section: Section;
  draft: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  const defaults = DEFAULTS[section];
  const keys = Object.keys(defaults);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {keys.map((key) => {
        const def = defaults[key];
        const val = draft[key];
        const label = humanize(key);

        if (typeof def === "boolean") {
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 p-3 sm:col-span-1"
            >
              <Label htmlFor={key} className="text-sm">{label}</Label>
              <Switch
                id={key}
                checked={!!val}
                onCheckedChange={(c) => onChange(key, c)}
              />
            </div>
          );
        }

        if (typeof def === "number") {
          return (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                step="0.1"
                value={Number(val ?? 0)}
                onChange={(e) => onChange(key, Number(e.target.value))}
              />
            </div>
          );
        }

        if (Array.isArray(def)) {
          return (
            <div key={key} className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                placeholder="comma,separated,values"
                value={Array.isArray(val) ? (val as string[]).join(", ") : ""}
                onChange={(e) =>
                  onChange(
                    key,
                    e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          );
        }

        // string
        const isLong = /rules|protocol|affirmation|prayer|narrative/.test(key);
        if (isLong) {
          return (
            <div key={key} className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={key}>{label}</Label>
              <Textarea
                id={key}
                rows={2}
                value={String(val ?? "")}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </div>
          );
        }

        return (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={String(val ?? "")}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

function humanize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\brr\b/gi, "RR")
    .replace(/\bai\b/gi, "AI")
    .replace(/\bema\b/gi, "EMA")
    .replace(/\bbos\b/gi, "BOS")
    .replace(/\bchoch\b/gi, "CHoCH")
    .replace(/\bmss\b/gi, "MSS")
    .replace(/\baoi\b/gi, "AOI")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Unused export to satisfy tree-shaking warnings — Button kept for future actions
export const _btn = Button;
