// Centralized AI service. Abstracts provider/model and forces structured JSON output
// via the Lovable AI Gateway (OpenAI-compatible).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AIProvider = "google" | "openai";

export type AICallOptions = {
  provider?: AIProvider;
  model?: string;
  system: string;
  user: string;
  images?: string[]; // public/signed URLs or data: URLs
  schema: Record<string, unknown>; // JSON schema for structured output
  schemaName?: string;
};

export type AICallResult<T = unknown> = {
  output: T;
  provider: string;
  model: string;
};

const DEFAULTS = {
  provider: "google" as const,
  model: "google/gemini-2.5-flash",
};

export async function callAI<T = unknown>(
  opts: AICallOptions,
): Promise<AICallResult<T>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const provider = opts.provider ?? DEFAULTS.provider;
  const model = opts.model ?? DEFAULTS.model;

  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: opts.user },
  ];
  for (const url of opts.images ?? []) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const body = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: opts.schemaName ?? "emit_structured_output",
          description: "Emit the structured analysis result.",
          parameters: opts.schema,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: opts.schemaName ?? "emit_structured_output" },
    },
  };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  const raw = call?.function?.arguments;
  if (!raw) {
    throw new Error(
      `AI did not return tool call. Body: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  let parsed: T;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as T);
  } catch (e) {
    throw new Error(`Failed to parse AI JSON: ${(e as Error).message}`);
  }
  return { output: parsed, provider, model };
}

// Universal educational block schema appended to every stage's output.
export const educationalBlock = {
  educational_explanation: {
    type: "string",
    description: "Plain-English educational explanation of the finding.",
  },
  institutional_narrative: {
    type: "string",
    description: "How institutional players would interpret this context.",
  },
};
