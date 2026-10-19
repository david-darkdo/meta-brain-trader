import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ProxyBody = {
  trade_id: string;
  system: string;
  user: string;
  images?: string[];
  schema: Record<string, unknown>;
  schema_name?: string;
  model?: string;
};

export const Route = createFileRoute("/api/ai-proxy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = (message: string, status: number) =>
          Response.json({ error: message }, { status });
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return fail("Authentication required.", 401);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!supabaseUrl || !supabaseKey || !openaiKey) {
          console.error("[ai-proxy] Required server environment is missing.");
          return fail("Vercel AI service is not configured.", 503);
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: auth, error: authError } = await supabase.auth.getUser(token);
        if (authError || !auth.user) return fail("Invalid authentication token.", 401);

        let body: ProxyBody;
        try { body = await request.json() as ProxyBody; }
        catch { return fail("Invalid JSON body.", 400); }
        if (!body.trade_id || !body.system || !body.user || !body.schema) {
          return fail("trade_id, system, user and schema are required.", 400);
        }
        if (body.system.length > 30000 || body.user.length > 30000 ||
            !Array.isArray(body.images) || body.images.length > 8 ||
            body.images.some((url) => typeof url !== "string" || url.length > 5000)) {
          return fail("AI request exceeds allowed limits.", 413);
        }
        const { data: trade, error: tradeError } = await supabase
          .from("trades").select("trade_id").eq("trade_id", body.trade_id).maybeSingle();
        if (tradeError || !trade) return fail("Trade not found or access denied.", 404);

        const schemaName = (body.schema_name || "emit_structured_output").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
        const model = body.model || "gpt-4o";
        const content: Array<Record<string, unknown>> = [{ type: "text", text: body.user }];
        for (const url of body.images ?? []) content.push({ type: "image_url", image_url: { url } });

        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: body.system }, { role: "user", content }],
            tools: [{ type: "function", function: {
              name: schemaName, description: "Emit the structured analysis result.", parameters: body.schema,
            }}],
            tool_choice: { type: "function", function: { name: schemaName } },
          }),
        });
        if (!upstream.ok) {
          const errorText = await upstream.text();
          console.error("[ai-proxy] OpenAI request failed:", upstream.status, errorText.slice(0, 300));
          return fail(`OpenAI request failed (${upstream.status}).`, upstream.status === 429 ? 429 : 502);
        }
        const payload = await upstream.json();
        const raw = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!raw) return fail("OpenAI returned no structured tool result.", 502);
        try {
          return Response.json({ output: typeof raw === "string" ? JSON.parse(raw) : raw, provider: "openai", model });
        } catch {
          return fail("OpenAI returned invalid structured JSON.", 502);
        }
      },
    },
  },
});
