// ============================================================================
// META BRAIN — PROMPT ORCHESTRATION ENGINE (Layer 3)
// ----------------------------------------------------------------------------
// Non-editable, code-level layer that decides:
//   - what prompt loads
//   - when it loads
//   - what prompt is blocked
//   - execution order
//   - final system prompt construction
//
// Users CANNOT edit this file. Strategy OS (Layer 2) content is user-editable,
// but which engines a pipeline is allowed to load is fixed here.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EngineKey =
  | "system_identity_prompt"
  | "core_strategy_prompt"
  | "entry_confirmation_prompt"
  | "risk_prompt"
  | "filter_prompt"
  | "psychology_prompt"
  | "learning_prompt"
  | "education_prompt"
  | "community_prompt"
  | "investor_prompt";

export type PromptOS = Partial<Record<EngineKey, string>>;

export type PipelineId =
  | "PRETRADE"
  | "POSTTRADE"
  | "JOURNAL"
  | "COMMUNITY"
  | "INVESTOR";

// ---------------------------------------------------------------------------
// Pipeline manifests — HARD RULE: no pipeline may load all engines.
// Each list is the exact execution order for the final system prompt.
// ---------------------------------------------------------------------------
const MANIFEST: Record<PipelineId, EngineKey[]> = {
  PRETRADE: [
    "system_identity_prompt",
    "core_strategy_prompt",
    "entry_confirmation_prompt",
    "risk_prompt",
    "filter_prompt",
    "psychology_prompt",
    "learning_prompt",
    "education_prompt",
  ],
  POSTTRADE: [
    "system_identity_prompt",
    "core_strategy_prompt",
    "risk_prompt",
    "psychology_prompt",
    "learning_prompt",
    "education_prompt",
  ],
  JOURNAL: [
    "system_identity_prompt",
    "learning_prompt",
    "psychology_prompt",
    "education_prompt",
  ],
  COMMUNITY: [
    "system_identity_prompt",
    "community_prompt",
    "education_prompt",
    "learning_prompt",
  ],
  INVESTOR: [
    "system_identity_prompt",
    "investor_prompt",
    "risk_prompt",
    "learning_prompt",
  ],
};

const ALL_ENGINES: EngineKey[] = [
  "system_identity_prompt",
  "core_strategy_prompt",
  "entry_confirmation_prompt",
  "risk_prompt",
  "filter_prompt",
  "psychology_prompt",
  "learning_prompt",
  "education_prompt",
  "community_prompt",
  "investor_prompt",
];

export function loadedEngines(pipeline: PipelineId): EngineKey[] {
  return [...MANIFEST[pipeline]];
}

export function blockedEngines(pipeline: PipelineId): EngineKey[] {
  const loaded = new Set(MANIFEST[pipeline]);
  return ALL_ENGINES.filter((e) => !loaded.has(e));
}

// ---------------------------------------------------------------------------
// Orchestrated system prompt builder.
// Only engines allowed by the pipeline manifest are ever concatenated.
// `requested` may narrow further (per-stage subset), but MUST be a subset of
// the pipeline's loaded engines — otherwise we throw (failure handler).
// ---------------------------------------------------------------------------
export type OrchestratedPrompt = {
  system: string;
  loaded: EngineKey[];
  blocked: EngineKey[];
  order: EngineKey[];
  pipeline: PipelineId;
};

function block(title: string, body?: string) {
  const b = (body ?? "").trim();
  if (!b) return "";
  return `\n\n=== ${title} ===\n${b}\n=== END ${title} ===`;
}

const HEADING: Record<EngineKey, string> = {
  system_identity_prompt: "METABRAIN SYSTEM IDENTITY",
  core_strategy_prompt: "CORE STRATEGY ENGINE",
  entry_confirmation_prompt: "ENTRY CONFIRMATION ENGINE",
  risk_prompt: "RISK ENGINE",
  filter_prompt: "FILTER ENGINE",
  psychology_prompt: "PSYCHOLOGY ENGINE",
  learning_prompt: "LEARNING ENGINE",
  education_prompt: "EDUCATION ENGINE",
  community_prompt: "COMMUNITY ENGINE",
  investor_prompt: "INVESTOR ENGINE",
};

export class OrchestrationViolationError extends Error {
  constructor(
    public readonly pipeline: PipelineId,
    public readonly offending: EngineKey[],
    msg: string,
  ) {
    super(msg);
    this.name = "OrchestrationViolationError";
  }
}

export function buildOrchestratedPrompt(
  pipeline: PipelineId,
  baseInstruction: string,
  os: PromptOS | null,
  requested?: EngineKey[],
): OrchestratedPrompt {
  const allowed = MANIFEST[pipeline];
  const allowedSet = new Set(allowed);
  const blocked = blockedEngines(pipeline);
  const blockedSet = new Set(blocked);

  // Failure handler: any requested engine outside the manifest = abort.
  if (requested) {
    const bad = requested.filter((e) => !allowedSet.has(e));
    if (bad.length) {
      throw new OrchestrationViolationError(
        pipeline,
        bad,
        `Pipeline ${pipeline} blocked engines requested: ${bad.join(", ")}`,
      );
    }
  }

  // Order = manifest order, intersected with (requested ?? all allowed).
  const requestedSet = requested ? new Set(requested) : allowedSet;
  const order = allowed.filter((e) => requestedSet.has(e));

  // Extra safety: verify none of the blocked engines ever get concatenated.
  const parts: string[] = [baseInstruction];
  for (const eng of order) {
    if (blockedSet.has(eng)) {
      throw new OrchestrationViolationError(
        pipeline,
        [eng],
        `Blocked engine ${eng} attempted to load in ${pipeline}`,
      );
    }
    const body = os?.[eng];
    if (body && body.trim()) parts.push(block(HEADING[eng], body));
  }

  return {
    system: parts.join(""),
    loaded: order,
    blocked,
    order,
    pipeline,
  };
}

// ---------------------------------------------------------------------------
// Execution log — one row per AI call, written BEFORE the model call.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type ExecutionLogInput = {
  pipeline_id: PipelineId;
  stage: string;
  trade_id?: string | null;
  user_id?: string | null;
  loaded_prompts: EngineKey[];
  blocked_prompts: EngineKey[];
  execution_order: EngineKey[];
  status?: "STARTED" | "COMPLETED" | "ABORTED";
  error?: string | null;
};

export async function logExecution(input: ExecutionLogInput): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("orchestration_logs")
      .insert({
        pipeline_id: input.pipeline_id,
        stage: input.stage,
        trade_id: input.trade_id ?? null,
        user_id: input.user_id ?? null,
        loaded_prompts: input.loaded_prompts,
        blocked_prompts: input.blocked_prompts,
        execution_order: input.execution_order,
        status: input.status ?? "STARTED",
        error_message: input.error ?? null,
      })
      .select("decision_id")
      .single();
    if (error) {
      console.error("orchestration log insert failed", error.message);
      return null;
    }
    return (data as { decision_id: string }).decision_id;
  } catch (e) {
    console.error("orchestration log exception", e);
    return null;
  }
}

export async function updateExecutionLog(
  decisionId: string,
  patch: { status: "COMPLETED" | "ABORTED"; error?: string | null },
) {
  try {
    await admin
      .from("orchestration_logs")
      .update({
        status: patch.status,
        error_message: patch.error ?? null,
      })
      .eq("decision_id", decisionId);
  } catch (e) {
    console.error("orchestration log update exception", e);
  }
}
