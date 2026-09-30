import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  BarChart3,
  Target,
  ShieldCheck,
  Handshake,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Plus,
  BookOpen,
  Sliders,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/validator")({
  head: () => ({ meta: [{ title: "Meta Validator — Trading Intelligence & Edge Validation" }] }),
  component: MetaValidatorPlatform,
});

function MetaValidatorPlatform() {
  const tradesQ = useQuery({
    queryKey: ["trades", "recent_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select(`
          trade_id,
          pair,
          direction,
          trade_status,
          created_at,
          executed_at,
          results (
            pnl_percent,
            outcome
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const metricsQ = useQuery({
    queryKey: ["dashboard_metrics"],
    queryFn: async () => {
      const { data } = await supabase.from("dashboard_metrics").select("*").maybeSingle();
      return data;
    },
  });

  const insightsQ = useQuery({
    queryKey: ["learning_insights", "top"],
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_insights")
        .select("id,category,content,occurrences,updated_at")
        .order("occurrences", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const m = metricsQ.data;
  const stats = [
    { label: "Closed trades", value: m?.closed_trades ?? 0, icon: BarChart3 },
    { label: "Win rate", value: m ? `${m.win_rate}%` : "—", icon: TrendingUp },
    { label: "Avg R", value: m ? m.avg_rr : "—", icon: Target },
    { label: "Discipline", value: m ? `${m.discipline_score}` : "—", icon: ShieldCheck },
    { label: "Agreement", value: m ? `${m.agreement_score}` : "—", icon: Handshake },
    { label: "Override", value: m ? `${m.override_score}` : "—", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* 1. PLATFORM IDENTITY & BANNER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
          Meta Validator
        </h1>
        {/* 2. SUPPORTING STATEMENT */}
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Disciplined trading for real results.
        </p>
      </div>

      {/* HERO BANNER CARD */}
      <div className="relative overflow-hidden rounded-2xl gold-card-hero p-5 sm:p-7">
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
              Disciplined Trading for{" "}
              <span className="gold-gradient-text">Real Results</span>
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-timeframe AI edge validation, trade execution rules, and rigorous performance metrics.
            </p>
          </div>

          {/* Sleek Golden Bull Vector / Emblem Graphic */}
          <div className="hidden xs:flex shrink-0 items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
            <svg
              className="h-12 w-12 sm:h-14 sm:w-14"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 48L24 36L34 42L48 22"
                stroke="#F59E0B"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M38 22H48V32"
                stroke="#FDE68A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="48" r="3" fill="#D97706" />
              <circle cx="24" cy="36" r="3" fill="#D97706" />
              <circle cx="34" cy="42" r="3" fill="#D97706" />
              <circle cx="48" cy="22" r="4" fill="#FDE68A" />
              <path
                d="M20 18C16 12 10 14 8 18C12 20 16 22 22 24"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M44 18C48 12 54 14 56 18C52 20 48 22 42 24"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. VALIDATION PERFORMANCE — STRICTLY ABOVE RECENT TRADES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Validation Performance
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {stats.map((s) => (
            <Card key={s.label} className="bg-card/60 border-border/70 p-3">
              <div className="flex items-center justify-between text-muted-foreground pb-1">
                <span className="text-[11px] font-medium">{s.label}</span>
                <s.icon className="h-3.5 w-3.5 text-amber-400/80" />
              </div>
              <div className="text-lg font-bold text-foreground font-mono">{s.value}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. VALIDATOR ACTION DOCK — 4 COMPACT REUSABLE APPLICATION ACTIONS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Validator Action Dock
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* NEW TRADE */}
          <Link
            to="/trade-creator"
            className="group relative flex items-center gap-3 rounded-xl border border-amber-500/40 bg-card/90 p-3 sm:p-3.5 transition-all duration-200 hover:border-amber-400 hover:bg-card hover:shadow-[0_4px_20px_rgba(245,158,11,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0 overflow-hidden text-left">
              <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">
                New Trade
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden xs:block">
                Plan & execute trade
              </div>
            </div>
          </Link>

          {/* JOURNAL */}
          <Link
            to="/journal"
            className="group relative flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-3.5 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 overflow-hidden text-left">
              <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">
                Journal
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden xs:block">
                Personal notebook
              </div>
            </div>
          </Link>

          {/* STRATEGY PROFILES */}
          <Link
            to="/strategy-profiles"
            className="group relative flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-3.5 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
              <Sliders className="h-4 w-4" />
            </div>
            <div className="min-w-0 overflow-hidden text-left">
              <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">
                Strategy
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden xs:block">
                Manage setups & edge
              </div>
            </div>
          </Link>

          {/* TRADE ANALYSIS */}
          <Link
            to="/trade-analysis"
            className="group relative flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-3.5 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-amber-400 group-hover:scale-105 transition-transform">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 overflow-hidden text-left">
              <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">
                Trade Analysis
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden xs:block">
                AI insights & records
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 5. RECENT TRADES */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            Recent Trades
          </h2>
          <Link
            to="/trade-analysis"
            className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!tradesQ.data || tradesQ.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
            <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
            <Button asChild size="sm" className="mt-3 gold-gradient-btn">
              <Link to="/trade-creator">Create your first trade</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tradesQ.data.slice(0, 5).map((t: any) => {
              const res = Array.isArray(t.results) ? t.results[0] : t.results;
              const pnlPct = res?.pnl_percent !== undefined && res?.pnl_percent !== null ? Number(res.pnl_percent) : null;
              const outcome = res?.outcome || (t.trade_status === "JOURNALED" ? "CLOSED" : t.trade_status);
              const isWin = outcome === "WIN" || (pnlPct !== null && pnlPct > 0);
              const isLoss = outcome === "LOSS" || (pnlPct !== null && pnlPct < 0);

              return (
                <Link
                  key={t.trade_id}
                  to="/trade-detail/$id"
                  params={{ id: t.trade_id }}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        t.direction === "LONG" ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t.pair} <span className="text-xs text-muted-foreground font-normal">· {t.direction}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(t.executed_at || t.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {outcome && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isWin
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : isLoss
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : "bg-secondary text-muted-foreground border border-border"
                        }`}
                      >
                        {outcome}
                      </span>
                    )}

                    {pnlPct !== null && (
                      <span
                        className={`text-xs font-mono font-semibold ${
                          pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {pnlPct >= 0 ? "+" : ""}
                        {pnlPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. LEARNING INSIGHTS & RULE DISCIPLINE */}
      {insightsQ.data && insightsQ.data.length > 0 && (
        <Card className="bg-card/50 border-border/70">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Learning Insights & Rule Discipline
              </span>
              <Link
                to="/trade-analysis"
                className="text-xs text-amber-400 hover:text-amber-300 font-normal"
              >
                View all insights
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {insightsQ.data.map((i) => (
                <Link
                  key={i.id}
                  to="/trade-analysis"
                  search={{ insight: i.content, category: i.category as any }}
                  className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs flex items-center justify-between gap-2 hover:border-border hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-foreground font-medium truncate">{i.content}</span>
                  <Badge
                    variant={i.category === "MISTAKE" ? "destructive" : "default"}
                    className="shrink-0 text-[10px]"
                  >
                    {i.category} · {i.occurrences}×
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
