// Master orchestrator: runs BLIND -> STRATEGY -> VALIDATION -> LEARNING ->
// VERDICT -> EDUCATION -> COACH sequentially. Triggered when a trade is moved
// to PRE_ANALYSIS. Persists per-stage outputs to ai_analyses and updates
// trades.processing_step in realtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { STAGE_SEQUENCE, runStage, type StageContext, type StageName } from "../_shared/stages.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signScreenshot(path: string) {
  const { data } = await admin.storage
    .from("trade-screenshots")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function runPipeline(tradeId: string) {
  // Load trade
  const { data: trade, error: tErr } = await admin
    .from("trades")
    .select("*")
    .eq("trade_id", tradeId)
    .single();
  if (tErr || !trade) throw new Error(`Trade not found: ${tErr?.message}`);

  // Strategy identity (current or active)
  let profile = null;
  const profileSelect = "name,prompt_config,trend_model,area_of_interest,confirmation_rules,risk_rules,disqualification_rules,educational_expectations,coaching_expectations";
  if (trade.current_strategy_profile_id) {
    const { data } = await admin
      .from("strategy_profiles")
      .select(profileSelect)
      .eq("id", trade.current_strategy_profile_id)
      .maybeSingle();
    profile = data;
  }
  if (!profile) {
    const { data } = await admin
      .from("strategy_profiles")
      .select(profileSelect)
      .eq("user_id", trade.user_id)
      .eq("is_active", true)
      .maybeSingle();
    profile = data;
  }

  // Screenshots
  const { data: shots } = await admin
    .from("screenshots")
    .select("url")
    .eq("trade_id", tradeId);
  const signed = (
    await Promise.all((shots ?? []).map((s) => signScreenshot(s.url)))
  ).filter((u): u is string => !!u);

  // Recent 24 trades for learning context
  const { data: recent } = await admin
    .from("trades")
    .select("trade_id,pair,direction,trade_status,created_at")
    .eq("user_id", trade.user_id)
    .neq("trade_id", tradeId)
    .order("created_at", { ascending: false })
    .limit(24);

  const priorAnalyses: Record<string, unknown> = {};
  const ctx: StageContext = {
    trade,
    screenshotUrls: signed,
    strategyProfile: profile,
    priorAnalyses,
    recentTrades: recent ?? [],
  };

  for (const stage of STAGE_SEQUENCE) {
    await admin
      .from("trades")
      .update({ processing_step: stage })
      .eq("trade_id", tradeId);

    const aiStage: "BLIND" | "COMPARATIVE" | "VERDICT" =
      stage === "BLIND" ? "BLIND" : stage === "VERDICT" ? "VERDICT" : "COMPARATIVE";

    try {
      const { output, provider, model } = await runStage(stage as StageName, ctx);
      priorAnalyses[stage] = output;

      const o = output as Record<string, unknown>;
      const verdict =
        stage === "VERDICT" && typeof o.verdict === "string"
          ? (o.verdict as "APPROVED" | "DISQUALIFIED" | "NEUTRAL")
          : null;
      const entryScore =
        stage === "VERDICT" && typeof o.entry_score === "number"
          ? (o.entry_score as number)
          : null;
      const coachingNotes =
        stage === "COACH" && typeof o.coaching_summary === "string"
          ? (o.coaching_summary as string)
          : null;

      await admin.from("ai_analyses").insert({
        trade_id: tradeId,
        stage: aiStage,
        ai_output: { stage, ...output },
        model_provider: provider,
        model_name: model,
        prompt_snapshot: `stage:${stage}`,
        verdict,
        entry_score: entryScore,
        coaching_notes: coachingNotes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from("trades")
        .update({ processing_step: "FAILED", processing_error: `${stage}: ${msg}` })
        .eq("trade_id", tradeId);
      await admin.from("job_queue").insert({
        trade_id: tradeId,
        stage,
        status: "FAILED",
        last_error: msg,
        attempts: 1,
      });
      throw err;
    }
  }

  await admin
    .from("trades")
    .update({
      processing_step: "COMPLETED",
      trade_status: "PRE_ANALYZED",
      processing_error: null,
    })
    .eq("trade_id", tradeId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade_id } = await req.json();
    if (!trade_id) throw new Error("trade_id required");

    // Mark as PRE_ANALYSIS immediately so UI flips
    await admin
      .from("trades")
      .update({ trade_status: "PRE_ANALYSIS", processing_step: "PENDING", processing_error: null })
      .eq("trade_id", trade_id);

    // Run in background so we can return immediately for realtime UX
    // @ts-ignore - EdgeRuntime available in Supabase functions
    EdgeRuntime.waitUntil(
      runPipeline(trade_id).catch((e) => console.error("pipeline error", e)),
    );

    return new Response(JSON.stringify({ status: "started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
