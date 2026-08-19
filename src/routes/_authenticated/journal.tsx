import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteSingleTrade, deleteAllUserTrades } from "@/lib/trade-delete-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tradesQ = useQuery({
    queryKey: ["journal", "trades", insight ?? "", category ?? ""],
    queryFn: async () => {
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["journal"] });
    qc.invalidateQueries({ queryKey: ["trades"] });
    qc.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    qc.invalidateQueries({ queryKey: ["learning_insights"] });
  };

  const deleteSingleMut = useMutation({
    mutationFn: async (tradeId: string) => {
      setDeletingId(tradeId);
      await deleteSingleTrade(tradeId);
    },
    onSuccess: () => {
      toast.success("Trade deleted");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete trade");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const deleteAllMut = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not authenticated");
      await deleteAllUserTrades(userId);
    },
    onSuccess: () => {
      toast.success("All trade history cleared");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to clear trade history");
    },
  });

  const hasTrades = tradesQ.data && tradesQ.data.length > 0;

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
        <div className="flex items-center gap-2">
          {insight && (
            <div className="flex items-center gap-2">
              <Badge variant={category === "STRENGTH" ? "default" : "destructive"}>{category ?? "Pattern"}</Badge>
              <span className="text-sm">{insight}</span>
              <Button asChild size="sm" variant="ghost"><Link to="/journal"><X className="h-3.5 w-3.5" /></Link></Button>
            </div>
          )}
          {hasTrades && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Trade History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all trades, chart screenshots, post-trade reflections, and AI analyses from your account. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteAllMut.mutate()}
                  >
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{insight ? `Trades tagged "${insight}"` : "All trades"}</CardTitle></CardHeader>
        <CardContent>
          {!tradesQ.data || tradesQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades match this filter.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tradesQ.data.map((t) => (
                <li key={t.trade_id} className="flex items-center justify-between gap-2 py-2">
                  <Link to="/trade-detail/$id" params={{ id: t.trade_id }}
                    className="flex flex-1 items-center justify-between gap-4 rounded-md p-2 hover:bg-secondary/40">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${t.direction === "LONG" ? "bg-success" : "bg-destructive"}`} />
                      <div>
                        <div className="font-medium">{t.pair}</div>
                        <div className="text-xs text-muted-foreground">{t.direction} · {new Date(t.created_at).toLocaleDateString()} · {t.executed ? "Executed" : "Skipped"}</div>
                      </div>
                    </div>
                    <Badge variant="secondary">{t.trade_status}</Badge>
                  </Link>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingId === t.trade_id}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Trade ({t.pair})?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this trade, its screenshots, reflections, and AI analysis records.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteSingleMut.mutate(t.trade_id)}
                        >
                          Delete Trade
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
