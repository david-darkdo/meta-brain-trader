import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PipelineStatus } from "@/components/pipeline-status";
import { AiAnalysesPanel } from "@/components/ai-analyses-panel";

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

  // Listen for trade row updates so trade_status / processing_step stay fresh
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

  const startAnalysis = useMutation({
    mutationFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orchestrate-pipeline`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ trade_id: id }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("AI analysis started");
      qc.invalidateQueries({ queryKey: ["trade", id] });
    },
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
            .from("trade-screenshots")
            .createSignedUrl(s.url, 60 * 60);
          return { ...s, signedUrl: sig?.signedUrl ?? null };
        }),
      );
      return signed;
    },
  });

  const reflectionsQ = useQuery({
    queryKey: ["trade", id, "reflections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reflections")
        .select("id,content,is_lesson,updated_at")
        .eq("trade_id", id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newReflection, setNewReflection] = useState("");
  const addReflection = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("reflections").insert({ trade_id: id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewReflection("");
      qc.invalidateQueries({ queryKey: ["trade", id, "reflections"] });
      toast.success("Reflection added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (tradeQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (tradeQ.error || !tradeQ.data) return <p className="text-sm text-destructive">Trade not found.</p>;

  const t = tradeQ.data;
  const editable = t.trade_status === "DRAFT";
  const showPipeline =
    t.trade_status !== "DRAFT" || t.processing_step !== "PENDING";

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
        {editable ? (
          <Button size="sm" className="gap-2" onClick={() => startAnalysis.mutate()} disabled={startAnalysis.isPending}>
            <Sparkles className="h-4 w-4" />
            {startAnalysis.isPending ? "Starting…" : "Run AI analysis"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Pencil className="h-4 w-4" /> Locked (analysis ran)
          </Button>
        )}
      </div>

      {showPipeline && (
        <PipelineStatus
          tradeId={t.trade_id}
          initialStep={t.processing_step}
          initialError={t.processing_error}
        />
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

      <Card>
        <CardHeader><CardTitle className="text-base">Reflections</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder="What did you learn? What would you do differently?"
              value={newReflection}
              onChange={(e) => setNewReflection(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!newReflection.trim() || addReflection.isPending} onClick={() => addReflection.mutate(newReflection.trim())}>
                {addReflection.isPending ? "Saving…" : "Add reflection"}
              </Button>
            </div>
          </div>

          {reflectionsQ.data && reflectionsQ.data.length > 0 && (
            <ul className="space-y-3">
              {reflectionsQ.data.map((r) => (
                <ReflectionItem key={r.id} reflection={r} tradeId={id} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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

function ReflectionItem({
  reflection,
  tradeId,
}: {
  reflection: { id: string; content: string; updated_at: string };
  tradeId: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reflection.content);
  useEffect(() => { setDraft(reflection.content); }, [reflection.content]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reflections").update({ content: draft }).eq("id", reflection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["trade", tradeId, "reflections"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reflections").delete().eq("id", reflection.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trade", tradeId, "reflections"] }),
  });

  return (
    <li className="rounded-md border border-border bg-card p-3">
      {editing ? (
        <div className="space-y-2">
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(reflection.content); }}>Cancel</Button>
            <Button size="sm" disabled={save.isPending || !draft.trim()} onClick={() => save.mutate()}>Save</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm">{reflection.content}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(reflection.updated_at).toLocaleString()}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate()}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
