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
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  let targetUrl = GATEWAY_URL;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let model = opts.model ?? DEFAULTS.model;
  let provider = opts.provider ?? DEFAULTS.provider;

  if (openaiKey) {
    targetUrl = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${openaiKey}`;
    model = "gpt-4o-mini";
    provider = "openai";
  } else if (lovableKey) {
    targetUrl = GATEWAY_URL;
    headers["Lovable-API-Key"] = lovableKey;
  } else {
    throw new Error("Missing LOVABLE_API_KEY or OPENAI_API_KEY in environment");
  }

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

  let lastError: Error | null = null;
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        
        // Handle 429 Rate Limit with backoff & retry
        if (res.status === 429 && attempt < maxRetries - 1) {
          let waitMs = 1000 * Math.pow(1.5, attempt) + Math.random() * 500;
          
          // Try to parse delay from OpenAI error message e.g. "Please try again in 372ms."
          const matchMs = text.match(/try again in ([0-9.]+)ms/i);
          const matchS = text.match(/try again in ([0-9.]+)s/i);
          if (matchMs && matchMs[1]) {
            waitMs = Math.max(parseFloat(matchMs[1]) + 200, waitMs);
          } else if (matchS && matchS[1]) {
            waitMs = Math.max(parseFloat(matchS[1]) * 1000 + 200, waitMs);
          }

          console.warn(`[callAI] Rate limit 429 received. Retrying attempt ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // Handle 5xx temporary server errors with backoff
        if (res.status >= 500 && attempt < maxRetries - 1) {
          const waitMs = 1000 * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`[callAI] Server error ${res.status}. Retrying attempt ${attempt + 1}/${maxRetries} after ${Math.round(waitMs)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        throw new Error(`AI API error (${res.status}): ${text.slice(0, 500)}`);
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
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries - 1 || !lastError.message.includes("429")) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("AI call failed after retries");
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
