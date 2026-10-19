// Provider adapter for the Vercel deployment.
// The OpenAI credential stays exclusively in Vercel's server environment.
// Supabase Edge Functions forward the authenticated user's short-lived JWT;
// the Vercel endpoint validates that identity and trade ownership before spending tokens.
export type AIProvider = "openai" | "google";
export type AICallOptions = {
  provider?: AIProvider;
  model?: string;
  system: string;
  user: string;
  images?: string[];
  schema: Record<string, unknown>;
  schemaName?: string;
  authorizationToken: string;
  tradeId: string;
};
export type AICallResult<T = unknown> = { output: T; provider: string; model: string };

export async function callAI<T = unknown>(opts: AICallOptions): Promise<AICallResult<T>> {
  const endpoint = Deno.env.get("VERCEL_AI_PROXY_URL") || "https://meta-brain-trader.vercel.app/api/ai-proxy";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.authorizationToken}`,
    },
    body: JSON.stringify({
      trade_id: opts.tradeId,
      system: opts.system,
      user: opts.user,
      images: opts.images ?? [],
      schema: opts.schema,
      schema_name: opts.schemaName ?? "emit_structured_output",
      model: opts.model ?? "gpt-4o",
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Vercel AI proxy error (${response.status}): ${message.slice(0, 500)}`);
  }
  const result = await response.json();
  if (!result?.output) throw new Error("Vercel AI proxy returned an empty structured result.");
  return { output: result.output as T, provider: "openai", model: result.model ?? "gpt-4o" };
}

export const educationalBlock = {
  educational_explanation: { type: "string", description: "Plain-English educational explanation of the finding." },
  institutional_narrative: { type: "string", description: "How institutional players would interpret this context." },
};
