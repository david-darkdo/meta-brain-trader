import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Upload, X } from "lucide-react";
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
  day_of_week: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

interface UploadedFile {
  file: File;
  previewUrl: string;
  label: string;
  is_primary: boolean;
  shot_type: "ENTRY" | "MANAGEMENT" | "EXIT" | "RESULT" | "ACCOUNT" | "CONTEXT";
}

function TradeCreator() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Form State
  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPct, setRiskPct] = useState("1.0");
  const [session, setSession] = useState("LONDON");
  const [notes, setNotes] = useState("");

  // Screenshot Uploads State
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newUploads: UploadedFile[] = files.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      label: file.name,
      is_primary: uploads.length === 0 && idx === 0,
      shot_type: "ENTRY",
    }));
    setUploads((prev) => [...prev, ...newUploads]);
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length > 0 && !updated.some((u) => u.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const handleCreateTrade = async (mode: "save" | "run") => {
    let createdTradeId: string | null = null;
    const uploadedStoragePaths: string[] = [];
    try {
      setIsSubmitting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to create a trade.");
        setIsSubmitting(false);
        return;
      }

      // 1. Validate Form Input
      const parsed = tradeSchema.safeParse({
        pair: pair.trim().toUpperCase(),
        direction,
        entry_price: entryPrice ? Number(entryPrice) : null,
        stop_loss: stopLoss ? Number(stopLoss) : null,
        take_profit: takeProfit ? Number(takeProfit) : null,
        account_size: accountSize ? Number(accountSize) : null,
        risk_pct: riskPct ? Number(riskPct) : null,
        session,
        day_of_week: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        notes: notes.trim() || null,
      });

      if (!parsed.success) {
        toast.error(parsed.error.errors[0].message);
        setIsSubmitting(false);
        return;
      }

      // AI validation is a chart-evidence pipeline. Do not create a run that
      // cannot supply the required chart screenshots.
      if (mode === "run" && uploads.length === 0) {
        throw new Error("Attach at least one chart screenshot before using Save & Run.");
      }

      // 2. Insert Base Trade Record
      const tradePayload: any = {
        user_id: user.id,
        pair: parsed.data.pair,
        direction: parsed.data.direction,
        entry_price: parsed.data.entry_price,
        stop_loss: parsed.data.stop_loss,
        take_profit: parsed.data.take_profit,
        account_size: parsed.data.account_size,
        risk_pct: parsed.data.risk_pct,
        session: parsed.data.session,
        day_of_week: parsed.data.day_of_week,
        notes: parsed.data.notes,
        trade_status: "DRAFT",
        executed: false,
        executed_at: null,
      };

      const { data: tradeData, error: tradeError } = await supabase
        .from("trades")
        .insert(tradePayload)
        .select("trade_id")
        .single();

      if (tradeError || !tradeData) {
        throw new Error(tradeError?.message || "Failed to create trade record.");
      }

      const tradeId = tradeData.trade_id;
      createdTradeId = tradeId;

      // 3. Upload Attached Screenshots if any
      if (uploads.length > 0) {
        setIsUploading(true);
        const uploadPromises = uploads.map(async (u) => {
          const fileExt = u.file.name.split(".").pop();
          const fileName = `${user.id}/${tradeId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: storageError } = await supabase.storage
            .from("trade-screenshots")
            .upload(fileName, u.file);

          if (storageError) {
            throw new Error(`Failed to upload chart screenshot "${u.file.name}": ${storageError.message}`);
          }

          uploadedStoragePaths.push(fileName);

          const {
            data: { publicUrl },
          } = supabase.storage.from("trade-screenshots").getPublicUrl(fileName);

          return {
            path: fileName,
            label: u.label,
            is_primary: u.is_primary,
            shot_type: u.shot_type,
          };
        });

        const uploadedResults = await Promise.all(uploadPromises);
        const validUploads = uploadedResults.filter(Boolean);

        if (validUploads.length > 0) {
          const { error: sErr } = await supabase.from("screenshots").insert(
            validUploads.map((u) => ({
              trade_id: tradeId,
              url: u.path,
              user_label: u.label,
              is_primary: u.is_primary,
              shot_type: u.shot_type as Database["public"]["Enums"]["screenshot_shot_type"],
              analysis_phase: "PRE" as const,
            })),
          );
          if (sErr) throw new Error(`Failed to save chart screenshot metadata: ${sErr.message}`);
        }
      }

      if (mode === "run") {
        const { error: validationError } = await supabase.functions.invoke("orchestrate-pipeline", {
          body: { trade_id: tradeId },
        });
        if (validationError) throw validationError;
        toast.success("Trade created and queued for AI Edge Validation. Execution remains separate until you explicitly execute it.");
        navigate({ to: "/trade-detail/$id", params: { id: tradeId } });
      } else {
        toast.success("Trade plan saved successfully.");
        navigate({ to: "/validator" });
      }
    } catch (err: any) {
      // Storage and database writes are separate systems. Remove uploaded
      // files when metadata/pipeline setup fails so a failed run cannot leave
      // orphaned chart evidence or a trade falsely stuck in validation.
      if (uploadedStoragePaths.length > 0) {
        await supabase.storage.from("trade-screenshots").remove(uploadedStoragePaths).catch(() => undefined);
      }
      if (createdTradeId && user?.id) {
        await supabase
          .from("trades")
          .update({
            trade_status: "DRAFT",
            processing_step: null,
            processing_error: err?.message || "Chart evidence could not be persisted.",
          })
          .eq("trade_id", createdTradeId)
          .eq("user_id", user.id);
      }
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. HEADER & TOP NAV */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate({ to: "/validator" })}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Meta Validator
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-amber-400" />
            New Trade Setup
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Log your trade parameters and chart setups for AI Edge Validation.
          </p>
        </div>
      </div>

      {/* 2. STEP INDICATOR */}
      <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeStep === 1
              ? "border-amber-400/50 bg-secondary/60 text-amber-400 shadow-sm"
              : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
          }`}
        >
          <span className="font-mono text-[10px] block opacity-70">STEP 01</span>
          Trade Parameters & Risk
        </button>
        <button
          type="button"
          onClick={() => setActiveStep(2)}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeStep === 2
              ? "border-amber-400/50 bg-secondary/60 text-amber-400 shadow-sm"
              : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
          }`}
        >
          <span className="font-mono text-[10px] block opacity-70">STEP 02</span>
          Chart Screenshots & Notes
        </button>
      </div>

      {/* 3. FORM BODY */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base text-foreground font-bold">
            {activeStep === 1 ? "1. Setup Specifications & Execution Plan" : "2. Visual Evidence & Strategy Context"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-5">
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pair" className="text-xs font-medium text-foreground">
                    Pair / Ticker <span className="text-amber-400">*</span>
                  </Label>
                  <Input
                    id="pair"
                    placeholder="e.g. EURUSD, XAUUSD, BTCUSDT"
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="bg-secondary/40 border-border uppercase font-mono focus-visible:ring-amber-400"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="direction" className="text-xs font-medium text-foreground">
                    Direction <span className="text-amber-400">*</span>
                  </Label>
                  <Select value={direction} onValueChange={(val: any) => setDirection(val)}>
                    <SelectTrigger id="direction" className="bg-secondary/40 border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="LONG" className="text-emerald-400 font-bold">LONG (BUY)</SelectItem>
                      <SelectItem value="SHORT" className="text-rose-400 font-bold">SHORT (SELL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="entryPrice" className="text-xs font-medium text-foreground">
                    Entry Price
                  </Label>
                  <Input
                    id="entryPrice"
                    type="number"
                    step="any"
                    placeholder="e.g. 1.08500"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="bg-secondary/40 border-border font-mono focus-visible:ring-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stopLoss" className="text-xs font-medium text-foreground">
                    Stop Loss
                  </Label>
                  <Input
                    id="stopLoss"
                    type="number"
                    step="any"
                    placeholder="e.g. 1.08200"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="bg-secondary/40 border-border font-mono focus-visible:ring-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="takeProfit" className="text-xs font-medium text-foreground">
                    Take Profit
                  </Label>
                  <Input
                    id="takeProfit"
                    type="number"
                    step="any"
                    placeholder="e.g. 1.09200"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="bg-secondary/40 border-border font-mono focus-visible:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
                <div className="space-y-1.5">
                  <Label htmlFor="accountSize" className="text-xs font-medium text-foreground">
                    Account Size ($)
                  </Label>
                  <Input
                    id="accountSize"
                    type="number"
                    step="any"
                    value={accountSize}
                    onChange={(e) => setAccountSize(e.target.value)}
                    className="bg-secondary/40 border-border font-mono focus-visible:ring-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="riskPct" className="text-xs font-medium text-foreground">
                    Risk Basis (%)
                  </Label>
                  <Input
                    id="riskPct"
                    type="number"
                    step="0.1"
                    value={riskPct}
                    onChange={(e) => setRiskPct(e.target.value)}
                    className="bg-secondary/40 border-border font-mono focus-visible:ring-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="session" className="text-xs font-medium text-foreground">
                    Trading Session
                  </Label>
                  <Select value={session} onValueChange={(val: any) => setSession(val)}>
                    <SelectTrigger id="session" className="bg-secondary/40 border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="ASIAN">Asian Session</SelectItem>
                      <SelectItem value="LONDON">London Session</SelectItem>
                      <SelectItem value="NEW_YORK">New York Session</SelectItem>
                      <SelectItem value="OVERLAP">London / NY Overlap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              {/* SCREENSHOT DROPZONE */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">
                  Attach Chart Screenshots (Multi-timeframe / Setup confirmation)
                </Label>
                <div className="rounded-xl border-2 border-dashed border-border/80 p-6 text-center hover:border-amber-400/50 transition-colors bg-secondary/20">
                  <Upload className="h-8 w-8 text-amber-400/80 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Click to select chart captures or drag & drop files
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WEBP up to 10MB each</p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs border-border/80"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Select Images
                  </Button>
                </div>
              </div>

              {/* UPLOAD PREVIEWS */}
              {uploads.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {uploads.map((u, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg border border-border/80 overflow-hidden bg-card/90 group"
                    >
                      <img
                        src={u.previewUrl}
                        alt={u.label}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeUpload(idx)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/80 text-foreground flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="p-2 text-[10px] space-y-1">
                        <div className="truncate font-semibold text-foreground">{u.label}</div>
                        <div className="flex items-center justify-between text-muted-foreground font-mono">
                          <span>{u.shot_type}</span>
                          {u.is_primary && (
                            <span className="text-amber-400 font-bold">PRIMARY</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* NOTES */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                  Pre-Trade Setup Logic & Market Narrative
                </Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. 4H liquidity swept below Asia low, MSS on 15m with displacement, entering on FVG retest..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="bg-secondary/40 border-border text-xs leading-relaxed focus-visible:ring-amber-400"
                />
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            {activeStep === 2 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveStep(1)}
                className="text-xs"
              >
                ← Back to Parameters
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {activeStep === 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!pair.trim()) {
                      toast.error("Please provide a currency pair / ticker.");
                      return;
                    }
                    setActiveStep(2);
                  }}
                  className="gold-gradient-btn text-xs font-semibold px-4"
                >
                  Continue to Screenshots →
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || isUploading}
                    onClick={() => handleCreateTrade("save")}
                    className="text-xs border-border/80 text-muted-foreground hover:text-foreground"
                  >
                    Save as Plan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmitting || isUploading}
                    onClick={() => handleCreateTrade("run")}
                    className="gold-gradient-btn text-xs font-semibold px-4 shadow-[0_2px_12px_rgba(245,158,11,0.2)]"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isSubmitting ? "Saving & Running..." : "Save & Run"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
