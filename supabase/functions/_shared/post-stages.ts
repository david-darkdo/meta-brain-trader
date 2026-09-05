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
          "You review what actually happened in the trade vs. the original plan and pre-trade analysis. Be objective and factual. Evaluate plan adherence and execution quality. Note: Strategy standard risk is 1%; compare actual risk to planned risk without normalizing numbers. Produce both detailed review and concise decision fields (executive_headline, decision_summary, execution_quality, action_directive).",
          os,
          ["core_strategy_prompt"],
        ),
        user: `Trade plan: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nPre-trade analyses: ${JSON.stringify(ctx.priorPre)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        images: ctx.screenshotUrls,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase review headline (e.g., 'PLAN FOLLOWED — CLEAN EXECUTION', 'EXECUTION DEVIATION — EARLY EXIT', 'MAJOR RULE BREACH').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise plain-English sentences summarizing execution vs original plan, noting adherence and any deviations.",
            },
            execution_quality: {
              type: "string",
              enum: ["flawless", "minor_deviation", "major_violation"],
            },
            action_directive: {
              type: "string",
              description: "Action instruction derived from execution audit (e.g., 'Log execution accuracy in journal.', 'Review trade management rules before next setup.').",
            },
            execution_summary: { type: "string" },
            plan_vs_actual: { type: "string" },
            adherence_score: { type: "number", minimum: 0, maximum: 100 },
            deviations: { type: "array", items: { type: "string" } },
          },
          [
            "executive_headline",
            "decision_summary",
            "execution_quality",
            "action_directive",
            "execution_summary",
            "plan_vs_actual",
            "adherence_score",
            "deviations",
          ],
        ),
      });

    case "MISTAKE":
      return callAI({
        system: sys(
          "You identify mistakes and process errors in this trade. Tag each with a short canonical label from the Psychology + Filter engines. Produce both detailed root cause analysis and concise decision fields (executive_headline, decision_summary, primary_mistake_tag, action_directive).",
          os,
          ["psychology_prompt", "risk_prompt"],
        ),
        user: `Review: ${JSON.stringify(ctx.priorPost.REVIEW ?? null)}\nTrade: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase mistake headline (e.g., 'ZERO MISTAKES DETECTED', 'FOMO ENTRY DETECTED', 'STOP LOSS MOVED PREMATURELY').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences summarizing whether any tactical or psychological mistakes occurred and their severity.",
            },
            primary_mistake_tag: {
              type: "string",
              description: "Primary canonical mistake tag (e.g., 'None', 'Chasing Price', 'Premature Exit', 'Risk Overallocation').",
            },
            action_directive: {
              type: "string",
              description: "Corrective action directive to prevent repeating the mistake.",
            },
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
          [
            "executive_headline",
            "decision_summary",
            "primary_mistake_tag",
            "action_directive",
            "mistakes",
            "root_cause",
          ],
        ),
      });

    case "PERFORMANCE":
      return callAI({
        system: sys(
          "You compute and interpret trade performance using numeric inputs. Identify strengths shown. Produce both detailed performance analysis and concise decision fields (executive_headline, decision_summary, r_multiple_rating, action_directive).",
          os,
          ["risk_prompt"],
        ),
        user: `Trade: ${JSON.stringify(ctx.trade)}\nResult: ${JSON.stringify(ctx.result)}\nReview: ${JSON.stringify(ctx.priorPost.REVIEW ?? null)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase performance headline (e.g., 'TARGET REACHED (+3.2R)', 'CONTROLLED LOSS (-1.0R)', 'BREAKEVEN MANAGEMENT').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences summarizing financial/R-multiple outcome and key execution strengths.",
            },
            r_multiple_rating: {
              type: "string",
              enum: ["high_performance", "standard_target", "suboptimal", "loss"],
            },
            action_directive: {
              type: "string",
              description: "Performance action takeaway (e.g., 'Maintain current R:R targets on swing setups.', 'Review profit taking rules.').",
            },
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
          [
            "executive_headline",
            "decision_summary",
            "r_multiple_rating",
            "action_directive",
            "outcome_summary",
            "risk_taken",
            "reward_captured",
            "strengths",
          ],
        ),
      });

    case "LEARNING_UPDATE":
      return callAI({
        system: sys(
          "You aggregate the last 24 trades plus this trade's mistakes and strengths to surface recurring patterns. Output canonical short labels suitable for tagging. Produce both detailed edge signals and concise decision fields (executive_headline, decision_summary, pattern_evolution_note, action_directive).",
          os,
          ["learning_prompt"],
        ),
        user: `This trade mistakes: ${JSON.stringify(ctx.priorPost.MISTAKE ?? null)}\nThis trade strengths: ${JSON.stringify(ctx.priorPost.PERFORMANCE ?? null)}\nLast 24 trades summary: ${JSON.stringify(ctx.recentTrades)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase learning memory headline (e.g., 'PATIENCE EDGE REINFORCED', 'REPEATED FRIDAY LOSS PATTERN', 'STABLE DISCIPLINE TREND').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences summarizing how this trade impacts historical behavioral edge and pattern memory.",
            },
            pattern_evolution_note: {
              type: "string",
              description: "Short note on pattern evolution across recent trade history.",
            },
            action_directive: {
              type: "string",
              description: "Action instruction updating trader's tactical focus.",
            },
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
          [
            "executive_headline",
            "decision_summary",
            "pattern_evolution_note",
            "action_directive",
            "recurring_mistakes",
            "recurring_strengths",
            "edge_signal",
          ],
        ),
      });

    case "COACH_REPORT":
      return callAI({
        system: sys(
          "You are the MetaBrain head coach delivering the final post-trade report. Actionable, kind, specific. Produce the master post-trade executive decision summary, core lesson, top takeaway, and action directive alongside detailed coaching.",
          os,
          ["psychology_prompt", "education_prompt"],
        ),
        user: `All pre-trade analyses: ${JSON.stringify(ctx.priorPre)}\nAll post-trade stages so far: ${JSON.stringify(ctx.priorPost)}\nReflections: ${JSON.stringify(ctx.reflections)}`,
        schema: baseSchema(
          {
            executive_headline: {
              type: "string",
              description: "2-7 word uppercase final coach audit headline (e.g., 'VALID DISCIPLINE — WELL MANAGED', 'PROFITABLE BUT UNDISCIPLINED', 'CONTROLLED RISK ON LOSS').",
            },
            decision_summary: {
              type: "string",
              description: "2-3 concise sentences providing the master post-trade audit debrief (outcome, plan adherence, key psychological or technical takeaway).",
            },
            top_takeaway_headline: {
              type: "string",
              description: "Short single-phrase headline for the primary takeaway.",
            },
            core_lesson: {
              type: "string",
              description: "The single biggest permanent rule or lesson extracted from this trade.",
            },
            action_directive: {
              type: "string",
              description: "Clear directive for what must change or continue on the next trade.",
            },
            coaching_summary: { type: "string" },
            top_lesson: { type: "string" },
            next_focus: { type: "string" },
            confidence_message: { type: "string" },
          },
          [
            "executive_headline",
            "decision_summary",
            "top_takeaway_headline",
            "core_lesson",
            "action_directive",
            "coaching_summary",
            "top_lesson",
            "next_focus",
            "confidence_message",
          ],
        ),
      });
  }
}

