import { callAI, educationalBlock } from "./ai.ts";

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

export type PromptOS = {
  system_identity_prompt?: string;
  core_strategy_prompt?: string;
  entry_confirmation_prompt?: string;
  risk_prompt?: string;
  filter_prompt?: string;
  psychology_prompt?: string;
  learning_prompt?: string;
  education_prompt?: string;
  community_prompt?: string;
  investor_prompt?: string;
};

export type StageContext = {
  trade: Record<string, unknown>;
  screenshotUrls: string[];
  strategyProfile: StrategyIdentity | null;
  promptOS: PromptOS | null;
  priorAnalyses: Record<string, unknown>;
  recentTrades?: Array<Record<string, unknown>>;
};

function block(title: string, body?: string) {
  const b = (body ?? "").trim();
  if (!b) return "";
  return `\n\n=== ${title} ===\n${b}\n=== END ${title} ===`;
}

function sys(base: string, os: PromptOS | null, engines: (keyof PromptOS)[]) {
  const identity = os?.system_identity_prompt?.trim();
  const parts = [
    identity ? block("METABRAIN SYSTEM IDENTITY", identity) : "",
    ...engines.map((k) => block(k.replace(/_/g, " ").toUpperCase(), os?.[k])),
  ]
    .filter(Boolean)
    .join("");
  return `${base}${parts}`;
}

export async function runStage(stage: StageName, ctx: StageContext) {
  const os = ctx.promptOS;

  switch (stage) {
    case "BLIND":
      // Vision-only, deliberately no strategy context injected.
      return callAI({
        system:
          "You are a vision-only price action analyst. Analyze ONLY the chart screenshots provided. Do NOT use any text context, user notes, or trade plan. Report what you see structurally.",
        user: "Perform a blind chart analysis. Identify structure, key levels, candles, momentum.",
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            market_structure: { type: "string" },
            key_levels: { type: "array", items: { type: "string" } },
            momentum: { type: "string" },
            bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          },
          ["market_structure", "key_levels", "momentum", "bias"],
        ),
      });

    case "STRATEGY":
      return callAI({
        system: sys(
          "You evaluate the trade against the trader's Strategy OS. Apply EVERY rule verbatim from the engines below. Cite exact rule names when matched or violated.",
          os,
          ["core_strategy_prompt", "entry_confirmation_prompt", "filter_prompt"],
        ),
        user: `Trade plan: ${JSON.stringify(ctx.trade)}\nBlind analysis: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            alignment_score: { type: "number", minimum: 0, maximum: 100 },
            matched_rules: { type: "array", items: { type: "string" } },
            violated_rules: { type: "array", items: { type: "string" } },
            disqualification_triggered: { type: "boolean" },
          },
          ["alignment_score", "matched_rules", "violated_rules", "disqualification_triggered"],
        ),
      });

    case "VALIDATION":
      return callAI({
        system: sys(
          "You validate trade setup quality (risk/reward, invalidation clarity, entry timing) strictly against the Risk Engine below.",
          os,
          ["risk_prompt", "filter_prompt"],
        ),
        user: `Trade: ${JSON.stringify(ctx.trade)}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}\nStrategy: ${JSON.stringify(ctx.priorAnalyses.STRATEGY ?? null)}`,
        schema: baseSchema(
          {
            risk_reward: { type: "string" },
            entry_quality: { type: "string" },
            invalidation_clarity: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
          },
          ["risk_reward", "entry_quality", "invalidation_clarity", "warnings"],
        ),
      });

    case "LEARNING":
      return callAI({
        system: sys(
          "You analyze the trader's recent history to surface relevant patterns from prior trades, following the Learning Engine directives.",
          os,
          ["learning_prompt"],
        ),
        user: `Current trade: ${JSON.stringify(ctx.trade)}\nLast 24 trades summary: ${JSON.stringify(ctx.recentTrades ?? [])}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        schema: baseSchema(
          {
            recurring_strengths: { type: "array", items: { type: "string" } },
            recurring_mistakes: { type: "array", items: { type: "string" } },
            similar_setups_count: { type: "number" },
            historical_edge: { type: "string" },
          },
          ["recurring_strengths", "recurring_mistakes", "similar_setups_count", "historical_edge"],
        ),
      });

    case "VERDICT":
      return callAI({
        system: sys(
          "You issue the final verdict integrating all prior stages. Be decisive. Enforce the System Identity and Risk Engine authority.",
          os,
          ["risk_prompt", "filter_prompt"],
        ),
        user: `All prior stages: ${JSON.stringify(ctx.priorAnalyses)}`,
        schema: baseSchema(
          {
            verdict: { type: "string", enum: ["APPROVED", "DISQUALIFIED", "NEUTRAL"] },
            entry_score: { type: "number", minimum: 0, maximum: 100 },
            primary_reason: { type: "string" },
            risk_factors: { type: "array", items: { type: "string" } },
          },
          ["verdict", "entry_score", "primary_reason", "risk_factors"],
        ),
      });

    case "EDUCATION":
      return callAI({
        system: sys(
          "You generate an educational lesson around this setup, following the Education Engine directives.",
          os,
          ["education_prompt"],
        ),
        user: `Verdict: ${JSON.stringify(ctx.priorAnalyses.VERDICT ?? null)}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        schema: baseSchema(
          {
            concept: { type: "string" },
            why_it_matters: { type: "string" },
            common_misconceptions: { type: "array", items: { type: "string" } },
            practice_drill: { type: "string" },
          },
          ["concept", "why_it_matters", "common_misconceptions", "practice_drill"],
        ),
      });

    case "COACH":
      return callAI({
        system: sys(
          "You are the MetaBrain coach. Provide actionable, personal coaching notes guided by the Psychology Engine.",
          os,
          ["psychology_prompt", "education_prompt"],
        ),
        user: `All analyses: ${JSON.stringify(ctx.priorAnalyses)}`,
        schema: baseSchema(
          {
            coaching_summary: { type: "string" },
            next_action: { type: "string" },
            mindset_note: { type: "string" },
            confidence_tip: { type: "string" },
          },
          ["coaching_summary", "next_action", "mindset_note", "confidence_tip"],
        ),
      });
  }
}
