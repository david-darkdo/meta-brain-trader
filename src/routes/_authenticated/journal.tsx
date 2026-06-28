import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";

const searchSchema = z.object({
  insight: z.string().optional(),
  category: z.enum(["MISTAKE", "STRENGTH", "PATTERN"]).optional(),
});

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Journal — MetaBrain Trader" }] }),
  validateSearch: searchSchema,
  component: Journal,
});

function Journal() {
  const { insight, category } = useSearch({ from: "/_authenticated/journal" });

  const tradesQ = useQuery({
    queryKey: ["journal", "trades", insight ?? "", category ?? ""],
    queryFn: async () => {
      // If filtering by insight, fetch the referenced trade ids first.
      let allowedIds: string[] | null = null;
      if (insight) {
        const q = supabase
          .from("learning_insights")
          .select("referenced_trade_ids,content,category")
          .eq("content", insight);
        if (category) q.eq("category", category);
        const { data } = await q;
        allowedIds = Array.from(new Set((data ?? []).flatMap((r) => r.referenced_trade_ids ?? [])));
        if (allowedIds.length === 0) return [];
      }
      let query = supabase
        .from("trades")
        .select("trade_id,pair,direction,trade_status,executed,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (allowedIds) query = query.in("trade_id", allowedIds);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">All trades, filterable by learned pattern.</p>
        </div>
        {insight && (
          <div className="flex items-center gap-2">
            <Badge variant={category === "STRENGTH" ? "default" : "destructive"}>{category ?? "Pattern"}</Badge>
            <span className="text-sm">{insight}</span>
            <Button asChild size="sm" variant="ghost"><Link to="/journal"><X className="h-3.5 w-3.5" /></Link></Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{insight ? `Trades tagged "${insight}"` : "All trades"}</CardTitle></CardHeader>
        <CardContent>
          {!tradesQ.data || tradesQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades match this filter.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tradesQ.data.map((t) => (
                <li key={t.trade_id}>
                  <Link to="/trade-detail/$id" params={{ id: t.trade_id }}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-secondary/40">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${t.direction === "LONG" ? "bg-success" : "bg-destructive"}`} />
                      <div>
                        <div className="font-medium">{t.pair}</div>
                        <div className="text-xs text-muted-foreground">{t.direction} · {new Date(t.created_at).toLocaleDateString()} · {t.executed ? "Executed" : "Skipped"}</div>
                      </div>
                    </div>
                    <Badge variant="secondary">{t.trade_status}</Badge>
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
