import { callAI, educationalBlock } from "./ai.ts";
import {
  buildOrchestratedPrompt,
  type EngineKey,
  type PromptOS as OrchestratorPromptOS,
} from "./orchestrator.ts";

export type StageName =
  | "BLIND"
  | "STRATEGY"
  | "VALIDATION"
  | "LEARNING"
  | "VERDICT"
  | "EDUCATION"
  | "COACH";

export const STAGE_SEQUENCE: StageName[] = [
  "BLIND",
  "STRATEGY",
  "VALIDATION",
  "LEARNING",
  "VERDICT",
  "EDUCATION",
  "COACH",
];

const baseSchema = (extra: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: [...required, "educational_explanation", "institutional_narrative"],
  properties: { ...extra, ...educationalBlock },
});

export type StrategyIdentity = {
  name?: string | null;
  prompt_config?: Record<string, unknown>;
};

export type PromptOS = OrchestratorPromptOS;

export type StageContext = {
  trade: Record<string, unknown>;
  screenshotUrls: string[];
  strategyProfile: StrategyIdentity | null;
  promptOS: PromptOS | null;
  priorAnalyses: Record<string, unknown>;
  recentTrades?: Array<Record<string, unknown>>;
};

// Orchestrated system prompt for the PRETRADE pipeline. `engines` narrows
// within the pipeline's allowed manifest; the orchestrator throws if a
// blocked engine (community / investor) is ever requested here.
function sys(base: string, os: PromptOS | null, engines: EngineKey[]) {
  const requested: EngineKey[] = ["system_identity_prompt", ...engines];
  const { system } = buildOrchestratedPrompt("PRETRADE", base, os, requested);
  return system;
}

export async function runStage(stage: StageName, ctx: StageContext) {
  const os = ctx.promptOS;

  switch (stage) {
    case "BLIND":
      // Vision-only, deliberately no strategy context injected.
      return callAI({
        system:
          "You are a vision-only price action analyst. Analyze ONLY the chart screenshots provided. Do NOT use any text context, user notes, or trade plan. Report what you see structurally. Evaluate the complete chart context, formulate your deep reasoning, and emit both the complete analytical fields and concise decision-oriented fields (executive_headline, decision_summary, action_directive, bias_strength).",
        user: "Perform a blind chart analysis. Identify structure, key levels, candles, momentum.",
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word ultra-concise uppercase status headline (e.g., 'BEARISH STRUCTURE — STRONG MOMENTUM', 'RANGE-BOUND CONSOLIDATION AT SUPPORT').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise, plain-English sentences summarizing the primary structural find, key level context, and directional bias.",
            },
            action_directive: {
              type: "string",
              description: "One clear action-oriented instruction (e.g., 'Monitor 4H support zone for rejection', 'No action; market is choppy').",
            },
            market_structure: { type: "string" },
            key_levels: { type: "array", items: { type: "string" } },
            momentum: { type: "string" },
            bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
            bias_strength: { type: "string", enum: ["strong", "moderate", "weak"] },
          },
          [
            "executive_headline",
            "decision_summary",
            "action_directive",
            "market_structure",
            "key_levels",
            "momentum",
            "bias",
            "bias_strength",
          ],
        ),
      });

    case "STRATEGY":
      return callAI({
        system: sys(
          "You evaluate the trade against the trader's Strategy OS. Apply EVERY rule verbatim from the engines below. Cite exact rule names when matched or violated. Distinguish confirmed evidence from assumptions. Evaluate matched, missing, and violated rules, and produce both detailed reasoning and concise decision fields (executive_headline, decision_summary, missing_rules, action_directive).",
          os,
          ["core_strategy_prompt", "entry_confirmation_prompt", "filter_prompt"],
        ),
        user: `Trade plan: ${JSON.stringify(ctx.trade)}\nBlind analysis: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase headline summarizing strategy compliance (e.g., 'CORE ALIGNMENT VERIFIED', 'DISQUALIFIED — MISSING CONFIRMATIONS', 'SETUP CONDITIONAL').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise, plain-English sentences summarizing strategy alignment, confirmations present vs missing, and filter status.",
            },
            action_directive: {
              type: "string",
              description: "Clear action directive based on strategy rules (e.g., 'Wait for lower timeframe confirmation trigger.', 'Disqualify setup immediately.').",
            },
            alignment_score: { type: "number", minimum: 0, maximum: 100 },
            matched_rules: { type: "array", items: { type: "string" } },
            missing_rules: { type: "array", items: { type: "string" } },
            violated_rules: { type: "array", items: { type: "string" } },
            disqualification_triggered: { type: "boolean" },
          },
          [
            "executive_headline",
            "decision_summary",
            "action_directive",
            "alignment_score",
            "matched_rules",
            "missing_rules",
            "violated_rules",
            "disqualification_triggered",
          ],
        ),
      });

    case "VALIDATION":
      return callAI({
        system: sys(
          "You validate trade setup quality (risk/reward, invalidation clarity, entry timing) strictly against the Risk Engine below. Note: Strategy Standard Risk is 1%. Compare actual risk to strategy risk without modifying the actual numbers. Produce both detailed validation and concise decision fields (executive_headline, decision_summary, risk_status, action_directive).",
          os,
          ["risk_prompt", "filter_prompt"],
        ),
        user: `Trade: ${JSON.stringify(ctx.trade)}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}\nStrategy: ${JSON.stringify(ctx.priorAnalyses.STRATEGY ?? null)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase risk headline (e.g., 'RISK PARAMETERS VALID', 'EXCESSIVE RISK DEVIATION', 'CLEAN INVALIDATION').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences evaluating R:R feasibility, risk parameters, and invalidation clarity.",
            },
            risk_status: {
              type: "string",
              enum: ["acceptable", "warning", "unacceptable"],
            },
            action_directive: {
              type: "string",
              description: "Action directive regarding risk and entry timing (e.g., 'Proceed with planned 1% risk allocation.', 'Adjust stop loss to structural invalidation before entry.').",
            },
            risk_reward: { type: "string" },
            entry_quality: { type: "string" },
            invalidation_clarity: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
          },
          [
            "executive_headline",
            "decision_summary",
            "risk_status",
            "action_directive",
            "risk_reward",
            "entry_quality",
            "invalidation_clarity",
            "warnings",
          ],
        ),
      });

    case "LEARNING":
      return callAI({
        system: sys(
          "You analyze the trader's recent history to surface relevant patterns from prior trades, following the Learning Engine directives. Evaluate historical edge, recurring strengths, and recurring mistakes. Produce both comprehensive analysis and concise decision fields (executive_headline, decision_summary, historical_warning, action_directive).",
          os,
          ["learning_prompt"],
        ),
        user: `Current trade: ${JSON.stringify(ctx.trade)}\nLast 24 trades summary: ${JSON.stringify(ctx.recentTrades ?? [])}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase pattern headline (e.g., 'PROVEN EDGE PATTERN', 'HIGH-RISK RECURRING MISTAKE DETECTED', 'INSUFFICIENT HISTORICAL SAMPLE').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences summarizing historical edge and warnings relevant to this exact setup.",
            },
            historical_warning: {
              type: "string",
              description: "Specific warning derived from historical mistakes (or 'None' if clean).",
            },
            action_directive: {
              type: "string",
              description: "Action instruction based on historical trade lessons.",
            },
            recurring_strengths: { type: "array", items: { type: "string" } },
            recurring_mistakes: { type: "array", items: { type: "string" } },
            similar_setups_count: { type: "number" },
            historical_edge: { type: "string" },
          },
          [
            "executive_headline",
            "decision_summary",
            "historical_warning",
            "action_directive",
            "recurring_strengths",
            "recurring_mistakes",
            "similar_setups_count",
            "historical_edge",
          ],
        ),
      });

    case "VERDICT":
      return callAI({
        system: sys(
          "You issue the final verdict integrating all prior stages (Blind, Strategy, Validation, Learning). Be decisive. Enforce the System Identity and Risk Engine authority. You must generate the authoritative Executive Decision: verdict, entry_score, executive_headline, decision_summary, and action_directive.",
          os,
          ["risk_prompt", "filter_prompt"],
        ),
        user: `All prior stages: ${JSON.stringify(ctx.priorAnalyses)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase master decision headline (e.g., 'BUY SETUP — APPROVED', 'SELL SETUP — CONDITIONAL', 'DISQUALIFIED — RISK VIOLATION').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise, plain-English sentences summarizing the market condition, strategy alignment, confirmed vs missing elements, and final status.",
            },
            action_directive: {
              type: "string",
              description: "One clear imperative instruction for the trader (e.g., 'EXECUTE ENTRY AT PLANNED LEVEL', 'WAIT FOR 15M CLOSE BEFORE EXECUTING', 'DO NOT ENTER — CANCEL ORDER').",
            },
            verdict: { type: "string", enum: ["APPROVED", "DISQUALIFIED", "NEUTRAL"] },
            entry_score: { type: "number", minimum: 0, maximum: 100 },
            primary_reason: { type: "string" },
            risk_factors: { type: "array", items: { type: "string" } },
          },
          [
            "executive_headline",
            "decision_summary",
            "action_directive",
            "verdict",
            "entry_score",
            "primary_reason",
            "risk_factors",
          ],
        ),
      });

    case "EDUCATION":
      return callAI({
        system: sys(
          "You generate an educational lesson around this setup, following the Education Engine directives. Produce both the detailed institutional lesson and concise takeaway fields (executive_headline, decision_summary, action_directive).",
          os,
          ["education_prompt"],
        ),
        user: `Verdict: ${JSON.stringify(ctx.priorAnalyses.VERDICT ?? null)}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase core lesson headline (e.g., 'LIQUIDITY SWEEP RECOGNITION', 'MULTIPLE TIMEFRAME ALIGNMENT').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences summarizing the core educational principle demonstrated by this setup.",
            },
            action_directive: {
              type: "string",
              description: "Concrete practice drill or observation takeaway.",
            },
            concept: { type: "string" },
            why_it_matters: { type: "string" },
            common_misconceptions: { type: "array", items: { type: "string" } },
            practice_drill: { type: "string" },
          },
          [
            "executive_headline",
            "decision_summary",
            "action_directive",
            "concept",
            "why_it_matters",
            "common_misconceptions",
            "practice_drill",
          ],
        ),
      });

    case "COACH":
      return callAI({
        system: sys(
          "You are the MetaBrain coach. Provide actionable, personal coaching notes guided by the Psychology Engine. Produce both empathetic detailed coaching and concise actionable decision fields (executive_headline, decision_summary, primary_mindset_anchor, action_directive).",
          os,
          ["psychology_prompt", "education_prompt"],
        ),
        user: `All analyses: ${JSON.stringify(ctx.priorAnalyses)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase coach headline (e.g., 'DISCIPLINE & PATIENCE ANCHOR', 'AVOID FOMO CHASE').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences providing immediate psychological orientation before trade execution.",
            },
            primary_mindset_anchor: {
              type: "string",
              description: "Short key psychological anchor or reminder phrase.",
            },
            action_directive: {
              type: "string",
              description: "Action-oriented mindset directive for this trade.",
            },
            coaching_summary: { type: "string" },
            next_action: { type: "string" },
            mindset_note: { type: "string" },
            confidence_tip: { type: "string" },
          },
          [
            "executive_headline",
            "decision_summary",
            "primary_mindset_anchor",
            "action_directive",
            "coaching_summary",
            "next_action",
            "mindset_note",
            "confidence_tip",
          ],
        ),
      });
  }
}
