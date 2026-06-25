import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trade-creator")({
  head: () => ({ meta: [{ title: "New trade — MetaBrain Trader" }] }),
  component: TradeCreator,
});

const tradeSchema = z.object({
  pair: z.string().trim().min(1, "Pair is required").max(20),
  direction: z.enum(["LONG", "SHORT"]),
  entry_price: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  stop_loss: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  take_profit: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  account_size: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  risk_pct: z.coerce.number().min(0).max(100).optional().or(z.literal("").transform(() => undefined)),
  session: z.string().max(40).optional(),
  notes: z.string().max(4000).optional(),
});

type Screenshot = { file: File; label: string; id: string };

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
    account_size: "",
    risk_pct: "",
    session: "",
    notes: "",
  });
  const [shots, setShots] = useState<Screenshot[]>([]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Screenshot[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is over 10MB`);
        continue;
      }
      next.push({ file, label: "", id: crypto.randomUUID() });
    }
    setShots((s) => [...s, ...next]);
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
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");

      const insertPayload = {
        user_id: userId,
        trade_status: "DRAFT" as const,
        pair: parsed.data.pair,
        direction: parsed.data.direction,
        entry_price: parsed.data.entry_price ?? null,
        stop_loss: parsed.data.stop_loss ?? null,
        take_profit: parsed.data.take_profit ?? null,
        account_size: parsed.data.account_size ?? null,
        risk_pct: parsed.data.risk_pct ?? null,
        session: parsed.data.session || null,
        notes: parsed.data.notes || null,
      };

      const { data: trade, error } = await supabase
        .from("trades")
        .insert(insertPayload)
        .select("trade_id")
        .single();
      if (error) throw error;

      // Upload screenshots in parallel
      const uploads = await Promise.all(
        shots.map(async (shot, idx) => {
          const ext = shot.file.name.split(".").pop() || "png";
          const path = `${userId}/${trade.trade_id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("trade-screenshots")
            .upload(path, shot.file, { contentType: shot.file.type });
          if (upErr) throw upErr;
          return { path, label: shot.label.trim() || null, is_primary: idx === 0 };
        }),
      );

      if (uploads.length > 0) {
        const { error: sErr } = await supabase.from("screenshots").insert(
          uploads.map((u) => ({
            trade_id: trade.trade_id,
            url: u.path,
            user_label: u.label,
            is_primary: u.is_primary,
          })),
        );
        if (sErr) throw sErr;
      }

      toast.success("Trade saved as draft");
      navigate({ to: "/trade-detail/$id", params: { id: trade.trade_id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save trade");
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
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Trade details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pair">Pair *</Label>
                <Input id="pair" placeholder="EURUSD" value={form.pair} onChange={(e) => update("pair", e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label>Direction *</Label>
                <Select value={form.direction} onValueChange={(v) => update("direction", v as "LONG" | "SHORT")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">Long</SelectItem>
                    <SelectItem value="SHORT">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label htmlFor="entry">Entry</Label><Input id="entry" type="number" step="any" value={form.entry_price} onChange={(e) => update("entry_price", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="sl">Stop loss</Label><Input id="sl" type="number" step="any" value={form.stop_loss} onChange={(e) => update("stop_loss", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="tp">Take profit</Label><Input id="tp" type="number" step="any" value={form.take_profit} onChange={(e) => update("take_profit", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="acct">Account size</Label><Input id="acct" type="number" step="any" value={form.account_size} onChange={(e) => update("account_size", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="risk">Risk %</Label><Input id="risk" type="number" step="any" value={form.risk_pct} onChange={(e) => update("risk_pct", e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={form.session} onValueChange={(v) => update("session", v)}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia">Asia</SelectItem>
                  <SelectItem value="London">London</SelectItem>
                  <SelectItem value="New York">New York</SelectItem>
                  <SelectItem value="Overlap">Overlap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={4} placeholder="Thesis, context, anything worth remembering…" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Screenshots</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-8 text-center hover:bg-secondary/50">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Tap to add chart screenshots</span>
              <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB each</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>

            {shots.length > 0 && (
              <ul className="space-y-3">
                {shots.map((s, i) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                    <img src={URL.createObjectURL(s.file)} alt="" className="h-16 w-16 rounded object-cover" />
                    <div className="flex-1 space-y-1">
                      <div className="truncate text-xs text-muted-foreground">{s.file.name}{i === 0 && " · primary"}</div>
                      <Input
                        placeholder="Label (e.g. 4H structure)"
                        value={s.label}
                        onChange={(e) => setShots((arr) => arr.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShots((arr) => arr.filter((x) => x.id !== s.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Pair" v={form.pair || "—"} />
            <Row k="Direction" v={form.direction} />
            <Row k="Entry / SL / TP" v={`${form.entry_price || "—"} / ${form.stop_loss || "—"} / ${form.take_profit || "—"}`} />
            <Row k="Account / Risk" v={`${form.account_size || "—"} · ${form.risk_pct || "—"}%`} />
            <Row k="Session" v={form.session || "—"} />
            <Row k="Screenshots" v={`${shots.length} attached`} />
            <Row k="Status" v="DRAFT" />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={step === 1 || busy} onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} disabled={step === 1 && !form.pair.trim()}>Next</Button>
        ) : (
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
