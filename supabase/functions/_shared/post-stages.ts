// Post-trade pipeline stage definitions. Reuses the model-agnostic callAI
// abstraction; does NOT alter pre-trade stages. All system prompts are
// constructed via the code-level Prompt Orchestration Engine (POSTTRADE
// manifest) — Community, Investor, and Entry Confirmation are blocked here.

import { callAI, educationalBlock } from "./ai.ts";
import {
  buildOrchestratedPrompt,
  type EngineKey,
  type PromptOS as OrchestratorPromptOS,
} from "./orchestrator.ts";

export type PromptOS = OrchestratorPromptOS;

export type PostStageName =
  | "REVIEW"
  | "MISTAKE"
  | "PERFORMANCE"
  | "LEARNING_UPDATE"
  | "COACH_REPORT";

export const POST_STAGE_SEQUENCE: PostStageName[] = [
  "REVIEW",
  "MISTAKE",
  "PERFORMANCE",
  "LEARNING_UPDATE",
  "COACH_REPORT",
];

const baseSchema = (extra: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: [...required, "educational_explanation", "institutional_narrative"],
  properties: { ...extra, ...educationalBlock },
});

export type PostStageContext = {
  trade: Record<string, unknown>;
  result: Record<string, unknown> | null;
  reflections: Array<Record<string, unknown>>;
  priorPre: Record<string, unknown>;
  priorPost: Record<string, unknown>;
  recentTrades: Array<Record<string, unknown>>;
  screenshotUrls: string[];
  promptOS: PromptOS | null;
};

function sys(base: string, os: PromptOS | null, engines: EngineKey[]) {
  const requested: EngineKey[] = ["system_identity_prompt", ...engines];
  const { system } = buildOrchestratedPrompt("POSTTRADE", base, os, requested);
  return system;
}

export async function runPostStage(stage: PostStageName, ctx: PostStageContext) {
  const os = ctx.promptOS;
  switch (stage) {
    case "REVIEW":
      return callAI({
        system: sys(
          "You review what actually happened in the trade vs. the original plan and pre-trade analysis. Be objective.",
          os,
          ["core_strategy_prompt"],
        ),
        user: `Trade plan: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nPre-trade analyses: ${JSON.stringify(ctx.priorPre)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            execution_summary: { type: "string" },
            plan_vs_actual: { type: "string" },
            adherence_score: { type: "number", minimum: 0, maximum: 100 },
            deviations: { type: "array", items: { type: "string" } },
          },
          ["execution_summary", "plan_vs_actual", "adherence_score", "deviations"],
        ),
      });

    case "MISTAKE":
      return callAI({
        system: sys(
          "You identify mistakes and process errors in this trade. Tag each with a short canonical label from the Psychology + Filter engines.",
          os,
          ["psychology_prompt", "filter_prompt", "risk_prompt"],
        ),
        user: `Review: ${JSON.stringify(ctx.priorPost.REVIEW ?? null)}\nTrade: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        schema: baseSchema(
          {
            mistakes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "description", "severity"],
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                },
              },
            },
            root_cause: { type: "string" },
          },
          ["mistakes", "root_cause"],
        ),
      });

    case "PERFORMANCE":
      return callAI({
        system: sys(
          "You compute and interpret trade performance using numeric inputs. Identify strengths shown.",
          os,
          ["risk_prompt"],
        ),
        user: `Trade: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nReview: ${JSON.stringify(ctx.priorPost.REVIEW ?? null)}`,
        schema: baseSchema(
          {
            outcome_summary: { type: "string" },
            risk_taken: { type: "string" },
            reward_captured: { type: "string" },
            strengths: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "description"],
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
          ["outcome_summary", "risk_taken", "reward_captured", "strengths"],
        ),
      });

    case "LEARNING_UPDATE":
      return callAI({
        system: sys(
          "You aggregate the last 24 trades plus this trade's mistakes and strengths to surface recurring patterns. Output canonical short labels suitable for tagging.",
          os,
          ["learning_prompt"],
        ),
        user: `This trade mistakes: ${JSON.stringify(ctx.priorPost.MISTAKE ?? null)}\nThis trade strengths: ${JSON.stringify(ctx.priorPost.PERFORMANCE ?? null)}\nLast 24 trades summary: ${JSON.stringify(ctx.recentTrades)}`,
        schema: baseSchema(
          {
            recurring_mistakes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "occurrences"],
                properties: {
                  label: { type: "string" },
                  occurrences: { type: "number" },
                },
              },
            },
            recurring_strengths: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "occurrences"],
                properties: {
                  label: { type: "string" },
                  occurrences: { type: "number" },
                },
              },
            },
            edge_signal: { type: "string" },
          },
          ["recurring_mistakes", "recurring_strengths", "edge_signal"],
        ),
      });

    case "COACH_REPORT":
      return callAI({
        system: sys(
          "You are the MetaBrain head coach delivering the final post-trade report. Actionable, kind, specific.",
          os,
          ["psychology_prompt", "education_prompt"],
        ),
        user: `All pre-trade analyses: ${JSON.stringify(ctx.priorPre)}\nAll post-trade stages so far: ${JSON.stringify(ctx.priorPost)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        schema: baseSchema(
          {
            coaching_summary: { type: "string" },
            top_lesson: { type: "string" },
            next_focus: { type: "string" },
            confidence_message: { type: "string" },
          },
          ["coaching_summary", "top_lesson", "next_focus", "confidence_message"],
        ),
      });
  }
}

