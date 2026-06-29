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
  trend_model?: Record<string, unknown>;
  area_of_interest?: Record<string, unknown>;
  confirmation_rules?: Record<string, unknown>;
  risk_rules?: Record<string, unknown>;
  disqualification_rules?: Record<string, unknown>;
  educational_expectations?: Record<string, unknown>;
  coaching_expectations?: Record<string, unknown>;
  system_profile?: Record<string, unknown>;
  core_strategy?: Record<string, unknown>;
  entry_confirmations?: Record<string, unknown>;
  risk_engine?: Record<string, unknown>;
  filter_engine?: Record<string, unknown>;
  psychology_engine?: Record<string, unknown>;
  learning_engine?: Record<string, unknown>;
  education_engine?: Record<string, unknown>;
  community_engine?: Record<string, unknown>;
  investor_engine?: Record<string, unknown>;
};

export type StageContext = {
  trade: Record<string, unknown>;
  screenshotUrls: string[];
  strategyProfile: StrategyIdentity | null;
  priorAnalyses: Record<string, unknown>;
  recentTrades?: Array<Record<string, unknown>>;
};

function strategyBlock(profile: StrategyIdentity | null): string {
  if (!profile) return "No active strategy profile.";
  const sp = (profile.system_profile ?? {}) as Record<string, unknown>;
  return `STRATEGY OPERATING SYSTEM:\n${JSON.stringify({
    name: sp.strategy_name ?? profile.name ?? "Untitled",
    system_profile: profile.system_profile ?? {},
    core_strategy: profile.core_strategy ?? {},
    entry_confirmations: profile.entry_confirmations ?? {},
    risk_engine: profile.risk_engine ?? {},
    filter_engine: profile.filter_engine ?? {},
    psychology_engine: profile.psychology_engine ?? {},
    learning_engine: profile.learning_engine ?? {},
    education_engine: profile.education_engine ?? {},
    legacy: {
      trend_model: profile.trend_model ?? {},
      area_of_interest: profile.area_of_interest ?? {},
      confirmation_rules: profile.confirmation_rules ?? {},
      risk_rules: profile.risk_rules ?? {},
      disqualification_rules: profile.disqualification_rules ?? {},
      prompt_config: profile.prompt_config ?? {},
    },
  })}`;
}

export async function runStage(stage: StageName, ctx: StageContext) {
  switch (stage) {
    case "BLIND":
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

    case "STRATEGY": {
      return callAI({
        system: `You evaluate the trade against the user's full active strategy identity. Apply EVERY rule block. Cite the rule name when it matches or is violated.\n${strategyBlock(ctx.strategyProfile)}`,
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
    }

    case "VALIDATION":
      return callAI({
        system:
          "You validate trade setup quality (risk/reward, invalidation clarity, entry timing).",
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
        system:
          "You analyze the trader's recent history to surface relevant patterns from prior trades.",
        user: `Current trade: ${JSON.stringify(ctx.trade)}\nLast 24 trades summary: ${JSON.stringify(ctx.recentTrades ?? [])}\nBlind: ${JSON.stringify(ctx.priorAnalyses.BLIND ?? null)}`,
        schema: baseSchema(
          {
            recurring_strengths: { type: "array", items: { type: "string" } },
            recurring_mistakes: { type: "array", items: { type: "string" } },
            similar_setups_count: { type: "number" },
            historical_edge: { type: "string" },
          },
          [
            "recurring_strengths",
            "recurring_mistakes",
            "similar_setups_count",
            "historical_edge",
          ],
        ),
      });

    case "VERDICT":
      return callAI({
        system:
          "You issue the final verdict integrating all prior stages. Be decisive.",
        user: `All prior stages: ${JSON.stringify(ctx.priorAnalyses)}`,
        schema: baseSchema(
          {
            verdict: {
              type: "string",
              enum: ["APPROVED", "DISQUALIFIED", "NEUTRAL"],
            },
            entry_score: { type: "number", minimum: 0, maximum: 100 },
            primary_reason: { type: "string" },
            risk_factors: { type: "array", items: { type: "string" } },
          },
          ["verdict", "entry_score", "primary_reason", "risk_factors"],
        ),
      });

    case "EDUCATION":
      return callAI({
        system:
          "You generate an educational lesson around this setup, accessible to intermediate traders.",
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
        system:
          "You are an empathetic trading coach. Provide actionable, personal coaching notes.",
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
