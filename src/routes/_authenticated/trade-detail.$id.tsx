import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Brain } from "lucide-react";
import { toast } from "sonner";
import { PipelineStatus } from "@/components/pipeline-status";
import { PostPipelineStatus } from "@/components/post-pipeline-status";
import { AiAnalysesPanel } from "@/components/ai-analyses-panel";
import { ResultForm } from "@/components/result-form";
import { ReflectionSections } from "@/components/reflection-sections";

export const Route = createFileRoute("/_authenticated/trade-detail/$id")({
  head: () => ({ meta: [{ title: "Trade — MetaBrain Trader" }] }),
  component: TradeDetail,
});

type Trade = {
  trade_id: string;
  pair: string;
  direction: string;
  trade_status: string;
  processing_step: string;
  processing_error: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  account_size: number | null;
  risk_pct: number | null;
  session: string | null;
  notes: string | null;
  created_at: string;
};

const PRE_STEPS = new Set([
  "PENDING", "BLIND", "STRATEGY", "VALIDATION", "LEARNING",
  "VERDICT", "EDUCATION", "COACH", "COMPLETED", "FAILED",
]);
const POST_STEPS = new Set([
  "POST_PENDING", "POST_REVIEW", "POST_MISTAKE", "POST_PERFORMANCE",
  "POST_LEARNING", "POST_COACH", "POST_COMPLETED", "POST_FAILED",
]);

function TradeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const tradeQ = useQuery({
    queryKey: ["trade", id],
    queryFn: async (): Promise<Trade> => {
      const { data, error } = await supabase
        .from("trades")
        .select("trade_id,pair,direction,trade_status,processing_step,processing_error,entry_price,stop_loss,take_profit,account_size,risk_pct,session,notes,created_at")
        .eq("trade_id", id)
        .single();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Trade;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`trade-${id}-row`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trades", filter: `trade_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["trade", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const runFn = async (fn: "orchestrate-pipeline" | "post-trade-pipeline") => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify({ trade_id: id }),
    });
    if (!res.ok) throw new Error(await res.text());
  };

  const startPre = useMutation({
    mutationFn: () => runFn("orchestrate-pipeline"),
    onSuccess: () => { toast.success("AI analysis started"); qc.invalidateQueries({ queryKey: ["trade", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const startPost = useMutation({
    mutationFn: () => runFn("post-trade-pipeline"),
    onSuccess: () => { toast.success("Post-trade analysis started"); qc.invalidateQueries({ queryKey: ["trade", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const shotsQ = useQuery({
    queryKey: ["trade", id, "screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenshots")
        .select("screenshot_id,url,user_label,is_primary")
        .eq("trade_id", id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      const signed = await Promise.all(
        (data ?? []).map(async (s) => {
          const { data: sig } = await supabase.storage
            .from("trade-screenshots").createSignedUrl(s.url, 60 * 60);
          return { ...s, signedUrl: sig?.signedUrl ?? null };
        }),
      );
      return signed;
    },
  });

  if (tradeQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (tradeQ.error || !tradeQ.data) return <p className="text-sm text-destructive">Trade not found.</p>;

  const t = tradeQ.data;
  const editable = t.trade_status === "DRAFT";
  const preDone = t.trade_status === "PRE_ANALYZED" || t.trade_status === "POST_ANALYSIS" || t.trade_status === "POST_ANALYZED";
  const showPrePipeline = !editable && PRE_STEPS.has(t.processing_step);
  const showPostPipeline = POST_STEPS.has(t.processing_step);
  const canRunPost = preDone && !showPostPipeline;

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{t.pair}</h1>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${t.direction === "LONG" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{t.direction}</span>
            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.trade_status}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Created {new Date(t.created_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button size="sm" className="gap-2" onClick={() => startPre.mutate()} disabled={startPre.isPending}>
              <Sparkles className="h-4 w-4" />
              {startPre.isPending ? "Starting…" : "Run AI analysis"}
            </Button>
          )}
          {canRunPost && (
            <Button size="sm" variant="secondary" className="gap-2" onClick={() => startPost.mutate()} disabled={startPost.isPending}>
              <Brain className="h-4 w-4" />
              {startPost.isPending ? "Starting…" : "Run post-trade analysis"}
            </Button>
          )}
        </div>
      </div>

      {showPrePipeline && (
        <PipelineStatus tradeId={t.trade_id} initialStep={t.processing_step} initialError={t.processing_error} />
      )}
      {showPostPipeline && (
        <PostPipelineStatus tradeId={t.trade_id} initialStep={t.processing_step} initialError={t.processing_error} />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Trade plan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field k="Entry" v={t.entry_price} />
          <Field k="Stop loss" v={t.stop_loss} />
          <Field k="Take profit" v={t.take_profit} />
          <Field k="Account size" v={t.account_size} />
          <Field k="Risk %" v={t.risk_pct} />
          <Field k="Session" v={t.session} />
          {t.notes && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Notes</div>
              <p className="mt-1 whitespace-pre-wrap">{t.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Screenshots</CardTitle></CardHeader>
        <CardContent>
          {shotsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !shotsQ.data || shotsQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screenshots attached.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {shotsQ.data.map((s) => (
                <figure key={s.screenshot_id} className="space-y-1">
                  {s.signedUrl ? (
                    <img src={s.signedUrl} alt={s.user_label ?? "trade screenshot"} className="w-full rounded-md border border-border" />
                  ) : (
                    <div className="aspect-video rounded-md bg-muted" />
                  )}
                  <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.user_label || "Unlabeled"}</span>
                    {s.is_primary && <span className="text-primary">Primary</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AiAnalysesPanel tradeId={t.trade_id} />

      {preDone && <ResultForm tradeId={t.trade_id} />}

      <ReflectionSections tradeId={t.trade_id} />
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | number | null }) {
  return (
    <div>
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? "—"}</div>
    </div>
  );
}
