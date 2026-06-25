import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Target, BookOpen, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MetaBrain Trader" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: trades } = useQuery({
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

  const stats = [
    { label: "Total trades", value: trades?.length ?? 0, icon: BarChart3 },
    { label: "Win rate", value: "—", icon: TrendingUp, hint: "Coming soon" },
    { label: "Avg R", value: "—", icon: Target, hint: "Coming soon" },
    { label: "Lessons logged", value: "—", icon: BookOpen, hint: "Coming soon" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your trading workspace at a glance.</p>
        </div>
        <Button asChild>
          <Link to="/trade-creator"><Plus className="mr-2 h-4 w-4" />New trade</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent trades</CardTitle>
        </CardHeader>
        <CardContent>
          {!trades || trades.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">No trades yet.</p>
              <Button asChild className="mt-4">
                <Link to="/trade-creator">Log your first trade</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {trades.map((t) => (
                <li key={t.trade_id}>
                  <Link
                    to="/trade-detail/$id"
                    params={{ id: t.trade_id }}
                    className="flex items-center justify-between gap-4 py-3 hover:bg-secondary/40 -mx-2 px-2 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${t.direction === "LONG" ? "bg-success" : "bg-destructive"}`} />
                      <div>
                        <div className="font-medium">{t.pair}</div>
                        <div className="text-xs text-muted-foreground">{t.direction} · {new Date(t.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.trade_status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader><CardTitle className="text-base">Performance trends</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Charts will appear here once you log results.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
