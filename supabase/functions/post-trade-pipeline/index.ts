// Post-trade pipeline orchestrator. Runs REVIEW -> MISTAKE -> PERFORMANCE ->
// LEARNING_UPDATE -> COACH_REPORT sequentially. Persists each stage to
// ai_analyses (reusing the existing analysis_stage enum + ai_output.stage tag),
// updates trades.processing_step, and writes learning_insights rows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  POST_STAGE_SEQUENCE,
  runPostStage,
  type PostStageContext,
  type PostStageName,
} from "../_shared/post-stages.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Map post-stage to the existing analysis_stage enum value.
function aiStageFor(stage: PostStageName): "BLIND" | "COMPARATIVE" | "VERDICT" {
  return stage === "COACH_REPORT" ? "VERDICT" : "COMPARATIVE";
}

async function signScreenshot(path: string) {
  const { data } = await admin.storage
    .from("trade-screenshots")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function recordInsights(
  userId: string,
  tradeId: string,
  learning: Record<string, unknown>,
) {
  const mistakes = (learning.recurring_mistakes as Array<Record<string, unknown>>) ?? [];
  const strengths = (learning.recurring_strengths as Array<Record<string, unknown>>) ?? [];

  const upsertOne = async (
    category: "MISTAKE" | "STRENGTH",
    label: string,
    occurrences: number,
  ) => {
    if (!label) return;
    const { data: existing } = await admin
      .from("learning_insights")
      .select("id,referenced_trade_ids,occurrences")
      .eq("user_id", userId)
      .eq("category", category)
      .eq("content", label)
      .maybeSingle();
    if (existing) {
      const refs = new Set<string>([...(existing.referenced_trade_ids ?? []), tradeId]);
      await admin
        .from("learning_insights")
        .update({
          referenced_trade_ids: Array.from(refs),
          occurrences: Math.max(existing.occurrences ?? 1, occurrences),
        })
        .eq("id", existing.id);
    } else {
      await admin.from("learning_insights").insert({
        user_id: userId,
        category,
        content: label,
        referenced_trade_ids: [tradeId],
        occurrences,
      });
    }
  };

  for (const m of mistakes) {
    await upsertOne("MISTAKE", String(m.label ?? ""), Number(m.occurrences ?? 1));
  }
  for (const s of strengths) {
    await upsertOne("STRENGTH", String(s.label ?? ""), Number(s.occurrences ?? 1));
  }
}

async function runPipeline(tradeId: string) {
  const { data: trade, error: tErr } = await admin
    .from("trades")
    .select("*")
    .eq("trade_id", tradeId)
    .single();
  if (tErr || !trade) throw new Error(`Trade not found: ${tErr?.message}`);

  const { data: result } = await admin
    .from("results")
    .select("*")
    .eq("trade_id", tradeId)
    .maybeSingle();

  const { data: reflections } = await admin
    .from("reflections")
    .select("section_type,content,updated_at")
    .eq("trade_id", tradeId);

  const { data: priorAnalyses } = await admin
    .from("ai_analyses")
    .select("ai_output")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  const priorPre: Record<string, unknown> = {};
  const priorPost: Record<string, unknown> = {};
  for (const a of priorAnalyses ?? []) {
    const o = (a as { ai_output: Record<string, unknown> }).ai_output;
    const stage = (o?.stage as string) || "";
    if (POST_STAGE_SEQUENCE.includes(stage as PostStageName)) {
      priorPost[stage] = o;
    } else if (stage) {
      priorPre[stage] = o;
    }
  }

  const { data: shots } = await admin
    .from("screenshots")
    .select("url")
    .eq("trade_id", tradeId);
  const signed = (
    await Promise.all((shots ?? []).map((s) => signScreenshot(s.url)))
  ).filter((u): u is string => !!u);

  const { data: recent } = await admin
    .from("trades")
    .select("trade_id,pair,direction,trade_status,created_at")
    .eq("user_id", trade.user_id)
    .neq("trade_id", tradeId)
    .order("created_at", { ascending: false })
    .limit(24);

  const { data: promptOS } = await admin
    .from("strategy_os")
    .select(
      "system_identity_prompt,core_strategy_prompt,entry_confirmation_prompt,risk_prompt,filter_prompt,psychology_prompt,learning_prompt,education_prompt,community_prompt,investor_prompt",
    )
    .eq("user_id", trade.user_id)
    .maybeSingle();

  const ctx: PostStageContext = {
    trade,
    result: result ?? null,
    reflections: reflections ?? [],
    priorPre,
    priorPost,
    recentTrades: recent ?? [],
    screenshotUrls: signed,
    promptOS: promptOS ?? null,
  };

  const stepMap: Record<PostStageName, string> = {
    REVIEW: "POST_REVIEW",
    MISTAKE: "POST_MISTAKE",
    PERFORMANCE: "POST_PERFORMANCE",
    LEARNING_UPDATE: "POST_LEARNING",
    COACH_REPORT: "POST_COACH",
  };

  for (const stage of POST_STAGE_SEQUENCE) {
    await admin
      .from("trades")
      .update({ processing_step: stepMap[stage] })
      .eq("trade_id", tradeId);

    try {
      const { output, provider, model } = await runPostStage(stage, ctx);
      ctx.priorPost[stage] = output;

      const o = output as Record<string, unknown>;
      const coachingNotes =
        stage === "COACH_REPORT" && typeof o.coaching_summary === "string"
          ? (o.coaching_summary as string)
          : null;

      await admin.from("ai_analyses").insert({
        trade_id: tradeId,
        stage: aiStageFor(stage),
        ai_output: { stage, ...output },
        model_provider: provider,
        model_name: model,
        prompt_snapshot: `post:${stage}`,
        coaching_notes: coachingNotes,
      });

      if (stage === "LEARNING_UPDATE") {
        await recordInsights(trade.user_id, tradeId, output as Record<string, unknown>);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from("trades")
        .update({
          processing_step: "POST_FAILED",
          processing_error: `post:${stage}: ${msg}`,
        })
        .eq("trade_id", tradeId);
      await admin.from("job_queue").insert({
        trade_id: tradeId,
        stage: `POST_${stage}`,
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
      processing_step: "POST_COMPLETED",
      trade_status: "POST_ANALYZED",
      processing_error: null,
    })
    .eq("trade_id", tradeId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { trade_id } = await req.json();
    if (!trade_id) throw new Error("trade_id required");

    await admin
      .from("trades")
      .update({
        trade_status: "POST_ANALYSIS",
        processing_step: "POST_PENDING",
        processing_error: null,
      })
      .eq("trade_id", trade_id);

    // @ts-ignore EdgeRuntime is available in Supabase functions
    EdgeRuntime.waitUntil(
      runPipeline(trade_id).catch((e) => console.error("post-trade pipeline error", e)),
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
