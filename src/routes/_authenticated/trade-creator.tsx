import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trade-creator")({
  head: () => ({ meta: [{ title: "New trade — MetaBrain Trader" }] }),
  component: TradeCreator,
});

const tradeSchema = z.object({
  pair: z.string().min(2, "Currency pair / ticker required (e.g. EURUSD, BTCUSD)"),
  direction: z.enum(["LONG", "SHORT"]),
  entry_price: z.coerce.number().positive().optional().nullable(),
  stop_loss: z.coerce.number().positive().optional().nullable(),
  take_profit: z.coerce.number().positive().optional().nullable(),
  account_size: z.coerce.number().positive().optional().nullable(),
  risk_pct: z.coerce.number().min(0.01).max(100).optional().nullable(),
  session: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ShotItem = {
  file: File;
  previewUrl: string;
  label: string;
  shot_type: string;
};

const COMMON_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "XAUUSD", "BTCUSD", "ETHUSD", "US30", "NAS100", "GER40"];

function TradeCreator() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    pair: "",
    direction: "LONG" as "LONG" | "SHORT",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    account_size: "10000",
    risk_pct: "1.0",
    session: "London",
    day_of_week: new Date().toLocaleDateString("en-US", { weekday: "Monday" }),
    notes: "",
  });

  const [shots, setShots] = useState<ShotItem[]>([]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const added: ShotItem[] = files.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      label: "",
      shot_type: "ENTRY",
    }));
    setShots((prev) => [...prev, ...added]);
  }

  function removeShot(idx: number) {
    setShots((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].previewUrl);
      copy.splice(idx, 1);
      return copy;
    });
  }

  async function save() {
    const parsed = tradeSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user?.id) throw new Error(userErr?.message || "Please sign in to save trades");
      const userId = userRes.user.id;

      // Ensure user record exists in public.users to avoid RLS/FK errors
      await supabase.from("users").upsert({
        user_id: userId,
        email: userRes.user.email || null,
        subscription_tier: "FREE",
      }, { onConflict: "user_id" }).catch(() => null);

      const insertPayload: Record<string, any> = {
        user_id: userId,
        trade_status: "DRAFT" as const,
        pair: parsed.data.pair.toUpperCase().trim(),
        direction: parsed.data.direction,
        entry_price: parsed.data.entry_price ?? null,
        stop_loss: parsed.data.stop_loss ?? null,
        take_profit: parsed.data.take_profit ?? null,
        account_size: parsed.data.account_size ?? null,
        risk_pct: parsed.data.risk_pct ?? null,
        session: parsed.data.session || null,
        day_of_week: form.day_of_week || null,
        notes: parsed.data.notes || null,
      };

      let tradeId: string | null = null;
      const { data: trade, error } = await supabase
        .from("trades")
        .insert(insertPayload)
        .select("trade_id")
        .single();

      if (error) {
        if (error.message?.includes("day_of_week") || error.code === "PGRST204") {
          delete insertPayload.day_of_week;
          const { data: fbTrade, error: fbError } = await supabase
            .from("trades")
            .insert(insertPayload)
            .select("trade_id")
            .single();
          if (fbError) throw new Error(fbError.message || fbError.details || "Database error saving trade");
          tradeId = fbTrade.trade_id;
        } else {
          throw new Error(error.message || error.details || "Database error saving trade");
        }
      } else {
        tradeId = trade.trade_id;
      }

      if (!tradeId) throw new Error("Failed to create trade record");

      // Upload screenshots in parallel with try-catch safety
      if (shots.length > 0) {
        const uploads = await Promise.all(
          shots.map(async (shot, idx) => {
            try {
              const ext = shot.file.name.split(".").pop() || "png";
              const path = `${userId}/${tradeId}/${crypto.randomUUID()}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from("trade-screenshots")
                .upload(path, shot.file, { contentType: shot.file.type, upsert: true });
              if (upErr) console.warn("Screenshot upload warning:", upErr.message);
              return { path, label: shot.label.trim() || null, is_primary: idx === 0, shot_type: shot.shot_type };
            } catch (e) {
              console.warn("Screenshot error:", e);
              return null;
            }
          }),
        );

        const validUploads = uploads.filter((u): u is NonNullable<typeof u> => u !== null && !!u.path);
        if (validUploads.length > 0) {
          const { error: sErr } = await supabase.from("screenshots").insert(
            validUploads.map((u) => ({
              trade_id: tradeId,
              url: u.path,
              user_label: u.label,
              is_primary: u.is_primary,
              shot_type: u.shot_type,
              analysis_phase: "PRE" as const,
            })),
          );
          if (sErr) console.warn("Screenshots DB insert warning:", sErr.message);
        }
      }

      toast.success("Trade saved as draft");
      navigate({ to: "/trade-detail/$id", params: { id: tradeId } });
    } catch (err: any) {
      console.error("Save trade error:", err);
      let errMsg = err?.message || err?.error_description || err?.details || (typeof err === "string" ? err : String(err));
      if (errMsg.includes("Failed to fetch") || errMsg.includes("fetch failed") || errMsg.includes("NetworkError")) {
        errMsg = "Unable to connect to Supabase database. Please check your Supabase project status in the Supabase Dashboard.";
      }
      toast.error(errMsg || "Failed to save trade");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New trade</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step} of 3 — saved as DRAFT.</p>
      </div>

      <div className="flex gap-2">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-secondary"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-secondary"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-primary" : "bg-secondary"}`} />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Trade details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Ticker / Pair</Label>
              <Input
                placeholder="EURUSD, BTCUSD, US30"
                value={form.pair}
                onChange={(e) => setForm({ ...form, pair: e.target.value.toUpperCase() })}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_PAIRS.slice(0, 7).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setForm({ ...form, pair: p })}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.direction === "LONG" ? "default" : "outline"}
                    className={form.direction === "LONG" ? "bg-success hover:bg-success/90" : ""}
                    onClick={() => setForm({ ...form, direction: "LONG" })}
                  >
                    LONG
                  </Button>
                  <Button
                    type="button"
                    variant={form.direction === "SHORT" ? "destructive" : "outline"}
                    onClick={() => setForm({ ...form, direction: "SHORT" })}
                  >
                    SHORT
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={form.session} onValueChange={(v) => setForm({ ...form, session: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asian">Asian</SelectItem>
                    <SelectItem value="London">London</SelectItem>
                    <SelectItem value="New York">New York</SelectItem>
                    <SelectItem value="Overlap">Overlap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Entry price</Label>
                <Input type="number" step="any" placeholder="1.0850" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Stop loss</Label>
                <Input type="number" step="any" placeholder="1.0820" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Take profit</Label>
                <Input type="number" step="any" placeholder="1.0920" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account size ($)</Label>
                <Input type="number" step="any" value={form.account_size} onChange={(e) => setForm({ ...form, account_size: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Risk %</Label>
                <Input type="number" step="any" value={form.risk_pct} onChange={(e) => setForm({ ...form, risk_pct: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trade Plan / Confluence Notes</Label>
              <Textarea rows={3} placeholder="Key zone, HTF bias, news catalyst..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)}>Next: Attach Chart Screenshots</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Pre-trade chart screenshots</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Upload chart screenshots (Entry, HTF, Setup)</p>
              <p className="text-xs text-muted-foreground">PNG, JPG or WEBP accepted</p>
              <Input type="file" multiple accept="image/*" className="mt-4 max-w-xs" onChange={onFileChange} />
            </div>

            {shots.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {shots.map((s, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-md border border-border bg-card p-3">
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
                      onClick={() => removeShot(idx)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <img src={s.previewUrl} alt="Chart preview" className="h-36 w-full rounded object-cover" />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Select
                        value={s.shot_type}
                        onValueChange={(v) => {
                          const copy = [...shots];
                          copy[idx].shot_type = v;
                          setShots(copy);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTRY">Entry Chart</SelectItem>
                          <SelectItem value="HTF">HTF Context</SelectItem>
                          <SelectItem value="SETUP">Pattern Setup</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Label / Timeframe"
                        value={s.label}
                        onChange={(e) => {
                          const copy = [...shots];
                          copy[idx].label = e.target.value;
                          setShots(copy);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)}>Next: Review & Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Review trade plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border bg-secondary/20 p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pair</span>
                <span className="font-semibold">{form.pair || "EURUSD"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction</span>
                <span className={`font-semibold ${form.direction === "LONG" ? "text-success" : "text-destructive"}`}>{form.direction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry / SL / TP</span>
                <span className="font-medium">{form.entry_price || "—"} / {form.stop_loss || "—"} / {form.take_profit || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account / Risk</span>
                <span className="font-medium">${form.account_size} · {form.risk_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session</span>
                <span className="font-medium">{form.session}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Day</span>
                <span className="font-medium">{form.day_of_week}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Screenshots</span>
                <span className="font-medium">{shots.length} attached</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-primary">DRAFT</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={save} disabled={busy} className="bg-success hover:bg-success/90">
                {busy ? "Saving draft..." : "Save draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
