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
  BookOpen,
  Plus,
  AlertTriangle,
  Trophy,
  ShieldCheck,
  Handshake,
  Activity,
  BookMarked,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/validator")({
  head: () => ({ meta: [{ title: "Meta Validator — Trading Intelligence & Edge Validation" }] }),
  component: MetaValidatorPlatform,
});

function MetaValidatorPlatform() {
  const tradesQ = useQuery({
    queryKey: ["trades", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("trade_id, pair, direction, trade_status, created_at")
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
        .limit(10);
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
    { label: "Trust", value: m ? `${m.trust_score}` : "—", icon: BookOpen },
  ];

  return (
    <div className="space-y-8">
      {/* INTERNAL META VALIDATOR HEADER & TOOLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Meta Validator</h1>
            <Badge variant="outline" className="text-xs font-mono">
              AI ENGINE ACTIVE
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Canonical trading intelligence, edge validation, and execution analytics.
          </p>
        </div>

        {/* INTERNAL VALIDATOR NAVIGATION & ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/journal">
              <Layers className="mr-1.5 h-4 w-4" />
              Journal
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/strategy-profiles">
              <BookMarked className="mr-1.5 h-4 w-4" />
              Strategies
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/trade-creator">
              <Plus className="mr-1.5 h-4 w-4" />
              New Trade
            </Link>
          </Button>
        </div>
      </div>

      {/* CORE TRADING METRICS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* RULE VIOLATIONS & PROFITABLE BEHAVIORS */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Most violated rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {m?.most_violated_rule ? (
              <Link
                to="/journal"
                search={{ insight: m.most_violated_rule, category: "MISTAKE" }}
                className="text-lg font-medium hover:underline text-destructive"
              >
                {m.most_violated_rule}
              </Link>
            ) : (
              <p className="text-lg font-medium text-muted-foreground">No data yet</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Click to inspect trades with this infraction.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-emerald-500" /> Most profitable behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            {m?.most_profitable_behavior ? (
              <Link
                to="/journal"
                search={{ insight: m.most_profitable_behavior, category: "STRENGTH" }}
                className="text-lg font-medium hover:underline text-emerald-500"
              >
                {m.most_profitable_behavior}
              </Link>
            ) : (
              <p className="text-lg font-medium text-muted-foreground">No data yet</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Recurring strength across recent trades.</p>
          </CardContent>
        </Card>
      </div>

      {/* LEARNING INSIGHTS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {!insightsQ.data || insightsQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Insights will appear automatically after your first post-trade analysis executes.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {insightsQ.data.map((i) => (
                <li key={i.id}>
                  <Link
                    to="/journal"
                    search={{ insight: i.content, category: i.category as "MISTAKE" | "STRENGTH" }}
                    className="block rounded-md border border-border p-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant={
                          i.category === "MISTAKE"
                            ? "destructive"
                            : i.category === "STRENGTH"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {i.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Occurred {i.occurrences}×</span>
                    </div>
                    <div className="mt-2 text-sm font-medium">{i.content}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* RECENT TRADES */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Trades</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/journal">View all in Journal</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!tradesQ.data || tradesQ.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">No trades in validator yet.</p>
              <Button asChild className="mt-4">
                <Link to="/trade-creator">Validate your first trade</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tradesQ.data.map((t) => (
                <li key={t.trade_id}>
                  <Link
                    to="/trade-detail/$id"
                    params={{ id: t.trade_id }}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          t.direction === "LONG" ? "bg-emerald-500" : "bg-destructive"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{t.pair}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.direction} · {new Date(t.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {t.trade_status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
