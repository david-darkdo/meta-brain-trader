import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteSingleTrade } from "@/lib/trade-delete-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Sparkles, Brain, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PipelineStatus } from "@/components/pipeline-status";
import { PostPipelineStatus } from "@/components/post-pipeline-status";
import { AiAnalysesPanel, type Analysis } from "@/components/ai-analyses-panel";
import { PreTradeCockpit } from "@/components/pre-trade-cockpit";
import { PostTradeCockpit } from "@/components/post-trade-cockpit";
import { ResultForm } from "@/components/result-form";
import { ReflectionSections } from "@/components/reflection-sections";
import { PostScreenshotUploader } from "@/components/post-screenshot-uploader";
import { AgreementBadges } from "@/components/agreement-badges";

export const Route = createFileRoute("/_authenticated/trade-detail/$id")({
  head: () => ({ meta: [{ title: "Trade — MetaBrain Trader" }] }),
  component: TradeDetail,
});

type Trade = {
  trade_id: string;
  user_id: string;
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
  executed: boolean;
  created_at: string;
};

const PRE_STEPS = new Set([
  "PENDING",
  "BLIND",
  "STRATEGY",
  "VALIDATION",
  "LEARNING",
  "VERDICT",
  "EDUCATION",
  "COACH",
  "COMPLETED",
  "FAILED",
]);
const POST_STEPS = new Set([
  "POST_PENDING",
  "POST_REVIEW",
  "POST_MISTAKE",
  "POST_PERFORMANCE",
  "POST_LEARNING",
  "POST_COACH",
  "POST_COMPLETED",
  "POST_FAILED",
]);

const POST_STAGE_SET = new Set([
  "REVIEW",
  "MISTAKE",
  "PERFORMANCE",
  "LEARNING_UPDATE",
  "COACH_REPORT",
]);

function TradeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pre" | "post" | "reflection">("pre");

  const tradeQ = useQuery({
    queryKey: ["trade", id],
    queryFn: async (): Promise<Trade> => {
      const { data, error } = await supabase
        .from("trades")
        .select(
          "trade_id,user_id,pair,direction,trade_status,processing_step,processing_error,entry_price,stop_loss,take_profit,account_size,risk_pct,session,notes,executed,created_at",
        )
        .eq("trade_id", id)
        .single();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Trade;
    },
  });

  const resultQ = useQuery({
    queryKey: ["trade", id, "result-exists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("results")
        .select("*")
        .eq("trade_id", id)
        .maybeSingle();
      return data;
    },
  });

  const analysesQ = useQuery({
    queryKey: ["trade", id, "analyses"],
    queryFn: async (): Promise<Analysis[]> => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select(
          "analysis_id,stage,ai_output,model_provider,model_name,verdict,entry_score,created_at",
        )
        .eq("trade_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Analysis[];
    },
  });

  const verdictQ = useQuery({
    queryKey: ["trade", id, "verdict"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_analyses")
        .select("ai_output,verdict")
        .eq("trade_id", id)
        .eq("stage", "VERDICT")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`trade-${id}-row`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trades", filter: `trade_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["trade", id] });
          qc.invalidateQueries({ queryKey: ["trade", id, "analyses"] });
        },
      )
      .subscribe();

    const chAnalyses = supabase
      .channel(`trade-${id}-analyses-realtime`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_analyses", filter: `trade_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["trade", id, "analyses"] });
          qc.invalidateQueries({ queryKey: ["trade", id, "verdict"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(chAnalyses);
    };
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
    onSuccess: () => {
      toast.success("AI analysis started");
      qc.invalidateQueries({ queryKey: ["trade", id] });
      qc.invalidateQueries({ queryKey: ["trade", id, "analyses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const startPost = useMutation({
    mutationFn: () => runFn("post-trade-pipeline"),
    onSuccess: () => {
      toast.success("Post-trade analysis started");
      qc.invalidateQueries({ queryKey: ["trade", id] });
      qc.invalidateQueries({ queryKey: ["trade", id, "analyses"] });
      setTab("post");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleExecuted = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("trades")
        .update({ executed: next })
        .eq("trade_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trade", id] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSingleTrade(id),
    onSuccess: () => {
      toast.success("Trade deleted");
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["dashboard_metrics"] });
      qc.invalidateQueries({ queryKey: ["learning_insights"] });
      navigate({ to: "/journal" });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete trade"),
  });

  const shotsQ = useQuery({
    queryKey: ["trade", id, "pre-screenshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenshots")
        .select("screenshot_id,url,user_label,is_primary,shot_type")
        .eq("trade_id", id)
        .eq("analysis_phase", "PRE")
        .order("is_primary", { ascending: false });
      if (error) throw error;
      const signed = await Promise.all(
        (data ?? []).map(async (s) => {
          const { data: sig } = await supabase.storage
            .from("trade-screenshots")
            .createSignedUrl(s.url, 60 * 60);
          return { ...s, signedUrl: sig?.signedUrl ?? null };
        }),
      );
      return signed;
    },
  });

  if (tradeQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (tradeQ.error || !tradeQ.data)
    return <p className="text-sm text-destructive">Trade not found.</p>;

  const t = tradeQ.data;
  const editable = t.trade_status === "DRAFT";
  const preDone = ["PRE_ANALYZED", "POST_ANALYSIS", "POST_ANALYZED"].includes(t.trade_status);
  const showPrePipeline = !editable && PRE_STEPS.has(t.processing_step);
  const showPostPipeline = POST_STEPS.has(t.processing_step);
  const canRunPost = preDone && !showPostPipeline;
  const postCompleted =
    t.processing_step === "POST_COMPLETED" || t.trade_status === "POST_ANALYZED";
  const postTabAvailable = preDone || !!resultQ.data;
  const reflectionUnlocked = postCompleted;
  const verdict =
    verdictQ.data?.verdict ??
    (verdictQ.data?.ai_output as { verdict?: string } | null)?.verdict ??
    null;

  const allAnalyses = analysesQ.data ?? [];
  const preAnalyses = allAnalyses.filter((a) => {
    const stageKey = (a.ai_output?.stage as string) || a.stage;
    return !POST_STAGE_SET.has(stageKey);
  });
  const postAnalyses = allAnalyses.filter((a) => {
    const stageKey = (a.ai_output?.stage as string) || a.stage;
    return POST_STAGE_SET.has(stageKey);
  });

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{t.pair}</h1>
            <Badge variant={t.direction === "LONG" ? "default" : "destructive"}>
              {t.direction}
            </Badge>
            <Badge variant="secondary">{t.trade_status}</Badge>
            <AgreementBadges verdict={verdict} executed={t.executed} hasResult={!!resultQ.data} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {new Date(t.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <Label htmlFor="executed" className="text-xs font-semibold">
              Executed
            </Label>
            <Switch
              id="executed"
              checked={t.executed}
              onCheckedChange={(v) => toggleExecuted.mutate(v)}
            />
          </div>
          {editable && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => startPre.mutate()}
              disabled={startPre.isPending}
            >
              <Sparkles className="h-4 w-4" />
              {startPre.isPending ? "Starting…" : "Run AI analysis"}
            </Button>
          )}
          {canRunPost && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => startPost.mutate()}
              disabled={startPost.isPending}
            >
              <Brain className="h-4 w-4" />
              {startPost.isPending ? "Starting…" : "Run post-trade analysis"}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete Trade
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Trade ({t.pair})?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this trade, its screenshots, reflections, and AI
                  analysis records. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMut.mutate()}
                >
                  Delete Trade
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {showPrePipeline && (
        <PipelineStatus
          tradeId={t.trade_id}
          initialStep={t.processing_step}
          initialError={t.processing_error}
        />
      )}
      {showPostPipeline && (
        <PostPipelineStatus
          tradeId={t.trade_id}
          initialStep={t.processing_step}
          initialError={t.processing_error}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="pre">Pre-trade</TabsTrigger>
          <TabsTrigger value="post" disabled={!postTabAvailable}>
            Post-trade audit
          </TabsTrigger>
          <TabsTrigger value="reflection" disabled={!reflectionUnlocked} className="gap-1">
            {!reflectionUnlocked && <Lock className="h-3 w-3" />}Reflection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre" className="space-y-6 pt-4">
          {/* LEVEL 1: PRE-TRADE DECISION COCKPIT */}
          <PreTradeCockpit trade={t} analyses={preAnalyses} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trade plan</CardTitle>
            </CardHeader>
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
            <CardHeader>
              <CardTitle className="text-base">Pre-trade screenshots</CardTitle>
            </CardHeader>
            <CardContent>
              {shotsQ.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading screenshots…</p>
              ) : !shotsQ.data || shotsQ.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pre-trade screenshots uploaded.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {shotsQ.data.map((s) => (
                    <div
                      key={s.screenshot_id}
                      className="overflow-hidden rounded-md border border-border bg-card"
                    >
                      {s.signedUrl ? (
                        <a href={s.signedUrl} target="_blank" rel="noreferrer">
                          <img
                            src={s.signedUrl}
                            alt={s.user_label ?? "Pre-trade chart"}
                            className="h-48 w-full object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                          Image unavailable
                        </div>
                      )}
                      <div className="p-3 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span>{s.shot_type}</span>
                          {s.is_primary && (
                            <Badge variant="outline" className="text-[10px]">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {s.user_label && (
                          <div className="mt-1 text-muted-foreground">{s.user_label}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PRE-TRADE DETAILED INTELLIGENCE PANEL */}
          <AiAnalysesPanel tradeId={t.trade_id} phase="PRE" />
        </TabsContent>

        <TabsContent value="post" className="space-y-6 pt-4">
          {/* LEVEL 1: POST-TRADE DECISION COCKPIT */}
          <PostTradeCockpit trade={t} result={resultQ.data ?? null} analyses={postAnalyses} />

          <ResultForm tradeId={t.trade_id} existingResult={resultQ.data} />
          <PostScreenshotUploader tradeId={t.trade_id} />

          {resultQ.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Post-trade analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Run the post-trade AI pipeline to audit execution vs. strategy, log behavioral
                  mistakes or strengths, and extract lessons.
                </p>
                {canRunPost && (
                  <Button
                    onClick={() => startPost.mutate()}
                    disabled={startPost.isPending}
                    className="gap-2"
                  >
                    <Brain className="h-4 w-4" />
                    {startPost.isPending ? "Starting…" : "Run post-trade analysis"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* POST-TRADE DETAILED AUDIT PANEL */}
          <AiAnalysesPanel tradeId={t.trade_id} phase="POST" />
        </TabsContent>

        <TabsContent value="reflection" className="space-y-6 pt-4">
          <ReflectionSections tradeId={t.trade_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ k, v }: { k: string; v: number | string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? "—"}</div>
    </div>
  );
}
