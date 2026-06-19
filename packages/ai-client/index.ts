/*
 * @career-builder/ai-client — single AI provider caller (SERVER-ONLY).
 *
 * Previously this exact logic was copy-pasted three times:
 *   - apps/admin/lib/ai/orchestrator.ts            (callAi)
 *   - apps/admin/lib/ai/site-generator/generatePage.ts (callAi)
 *   - apps/admin/app/api/ai/route.ts               (callAiProvider)
 *
 * OpenAI-compatible: configured entirely via env so the provider/model can be
 * swapped without code changes:
 *   - OPENAI_API_KEY   (required)
 *   - OPENAI_BASE_URL  (default https://api.openai.com/v1)
 *   - AI_MODEL         (default gpt-4o-mini)
 *
 * Routes automatically between the Responses API (gpt-5.x / o-series reasoning
 * models) and Chat Completions (gpt-4o family) based on the model id. Reasoning
 * models reject a non-default `temperature` and return 400, so it is sent ONLY
 * on the chat/completions path — never on the Responses path. (The old
 * api/ai/route.ts copy sent it on both, which silently 400'd reasoning models.)
 *
 * Server-only: reads process.env secrets and calls the provider directly.
 * Never import this from a client component.
 */

/** Models that use the newer Responses API (reasoning models). */
const RESPONSES_API_MODELS = /^(gpt-5|o[1-9])/;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_TOKENS = 3200;
const DEFAULT_TEMPERATURE = 0.7;

export interface CallAiOptions {
  /** Abort the request after this many ms. Default 15000. */
  timeoutMs?: number;
  /** Max tokens for the response. Default 3200. */
  maxTokens?: number;
  /**
   * Sampling temperature (chat/completions only). Default 0.7. Ignored on the
   * Responses API path because reasoning models reject non-default values.
   */
  temperature?: number;
}

/**
 * Call the configured AI provider and return the raw text output (typically a
 * JSON string — callers parse/validate it). Throws on missing key, non-2xx
 * response, timeout, or an unparseable response shape.
 */
export async function callAi(
  system: string,
  user: string,
  options: CallAiOptions = {},
): Promise<string> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    if (RESPONSES_API_MODELS.test(model)) {
      // ── Responses API (gpt-5.x, o-series reasoning models) ──────────
      // NOTE: no `temperature` — reasoning models 400 on a non-default value,
      // which would silently push every call into the caller's fallback path.
      const res = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          instructions: system,
          input: user,
          text: { format: { type: "json_object" } },
          max_output_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        throw new Error(`AI provider error (${res.status}): ${err}`);
      }

      const data = await res.json();

      // output_text is an SDK convenience — raw REST uses the output array.
      if (data.output_text) return data.output_text;

      if (Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === "output_text" && c.text) return c.text;
            }
          }
        }
      }

      console.error("[ai-client] Unexpected Responses API format:", JSON.stringify(data).slice(0, 500));
      throw new Error("Unexpected AI response format — could not extract text output");
    }

    // ── Chat Completions API (gpt-4o, gpt-4o-mini, etc.) ──────────────
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      throw new Error(`AI provider error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
