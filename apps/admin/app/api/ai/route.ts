/**
 * AI Assistant — API Route (Production-hardened)
 *
 * POST /api/ai
 * Accepts AiRequest, returns AiResponse.
 * Auth-protected, rate-limited, timeout-protected, schema-validated.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AiRequest, AiResponse, AiAction } from "@/lib/ai/types";
import { AI_LIMITS } from "@/lib/ai/types";
import { validateCsrf } from "@/lib/auth";
import { buildPrompt } from "@/lib/ai/prompts";
import { buildJobPrompt } from "@/lib/ai/prompts";
import { validateAiOutput, validatePageOutput, validateJobOutput, parseAiJson } from "@/lib/ai/validator";
import { blockSchemas } from "@/lib/blockSchemas";
import { subscriptionRepo, prisma } from "@career-builder/database";
import { JOB_AI_CREDITS_PER_WEEK } from "@/lib/stripe/config";

/* ================================================================== */
/*  Per-action rate limiter                                            */
/* ================================================================== */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** Per-user daily cap — prevents abuse even if IP rotates */
const userDailyMap = new Map<string, { count: number; resetAt: number }>();
const USER_DAILY_AI_LIMIT = 200; // max AI calls per user per day

function isUserDailyLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userDailyMap.get(userId);
  if (!entry || now > entry.resetAt) {
    userDailyMap.set(userId, { count: 1, resetAt: now + 86_400_000 }); // 24h
    return false;
  }
  entry.count++;
  return entry.count > USER_DAILY_AI_LIMIT;
}

function isRateLimited(ip: string, action: AiAction): boolean {
  const now = Date.now();
  const key = `${ip}:${action}`;
  const limit = AI_LIMITS.RATE_LIMITS[action] || 10;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Periodic cleanup to prevent memory leak (every 5 min)
let lastCleanup = Date.now();
function cleanupRateLimits() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
  for (const [key, entry] of userDailyMap) {
    if (now > entry.resetAt) userDailyMap.delete(key);
  }
}

/* ================================================================== */
/*  Auth check helper                                                  */
/* ================================================================== */

async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; role: string } | null> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const res = await fetch(new URL("/api/auth", req.url), {
      headers: { cookie: cookieHeader },
    });
    const data = await res.json();
    if (data.authenticated && data.user) {
      return data.user;
    }
  } catch {
    // ignore
  }
  return null;
}

/* ================================================================== */
/*  AI Provider — OpenAI-compatible (with timeout)                     */
/*  Supports both Responses API (gpt-5.x) and Chat Completions (gpt-4)*/
/* ================================================================== */

/** Models that use the newer Responses API */
const RESPONSES_API_MODELS = /^(gpt-5|o[1-9])/;

async function callAiProvider(
  system: string,
  user: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Timeout protection
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_LIMITS.TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    // Choose API based on model
    const useResponsesApi = RESPONSES_API_MODELS.test(model);

    if (useResponsesApi) {
      // ── Responses API (GPT-5.x, o-series) ──────────────────────
      const res = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          instructions: system,
          input: user,
          text: {
            format: { type: "json_object" },
          },
          max_output_tokens: AI_LIMITS.MAX_TOKENS,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        throw new Error(`AI provider error (${res.status}): ${err}`);
      }

      const data = await res.json();

      // output_text is an SDK convenience — raw REST uses output array
      if (data.output_text) return data.output_text;

      // Parse output array: find the assistant message with text content
      if (Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === "output_text" && c.text) return c.text;
            }
          }
        }
      }

      // Last resort: stringify the whole response for debugging
      console.error("[AI] Unexpected Responses API format:", JSON.stringify(data).slice(0, 500));
      throw new Error("Unexpected AI response format — could not extract text output");
    } else {
      // ── Chat Completions API (GPT-4o, GPT-4o-mini, etc.) ───────
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.7,
          max_tokens: AI_LIMITS.MAX_TOKENS,
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
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================================================================== */
/*  Response cache (same request → same response for 5 min)            */
/* ================================================================== */

const responseCache = new Map<string, { response: AiResponse; expiresAt: number }>();

function getCacheKey(req: AiRequest): string {
  return JSON.stringify({
    action: req.action,
    blockType: req.blockType,
    prompt: req.prompt || "",
    tone: req.tone || "professional",
    currentProps: req.currentProps,
  });
}

// Periodic cache cleanup
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (now > entry.expiresAt) responseCache.delete(key);
  }
}

/* ================================================================== */
/*  POST handler                                                       */
/* ================================================================== */

export async function POST(req: NextRequest) {
  // Periodic cleanup
  cleanupRateLimits();
  cleanupCache();

  // 1. Rate limit
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // 2. Auth check
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" } satisfies AiResponse,
      { status: 401 },
    );
  }

  // 2.0. CSRF validation
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json(
      { success: false, error: "Invalid CSRF token" } satisfies AiResponse,
      { status: 403 },
    );
  }

  if (user.role === "viewer") {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" } satisfies AiResponse,
      { status: 403 },
    );
  }

  // 2a. Per-user daily rate limit (prevents IP rotation abuse)
  if (isUserDailyLimited(user.id)) {
    return NextResponse.json(
      { success: false, error: `Daily AI limit reached (${USER_DAILY_AI_LIMIT} requests/day). Try again tomorrow.` } satisfies AiResponse,
      { status: 429 },
    );
  }

  // 2b. Server-side subscription check — plan & status only (credit check happens after parsing action)
  const aiCheck = await subscriptionRepo.canUseAi(user.id);
  if (!aiCheck.allowed && aiCheck.reason !== "No AI credits remaining") {
    // Block if not subscribed at all (free plan, inactive subscription, user not found)
    // Credit checks happen per-action below (job credits are separate)
    return NextResponse.json(
      { success: false, error: aiCheck.reason || "AI features require a Pro or Enterprise plan." } satisfies AiResponse,
      { status: 403 },
    );
  }

  // 3. Parse request body
  let body: AiRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" } satisfies AiResponse,
      { status: 400 },
    );
  }

  // 4. Validate input
  if (!body.action || !body.blockType) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: action, blockType" } satisfies AiResponse,
      { status: 400 },
    );
  }
  if (!["generate", "improve", "expand", "generate-page", "generate-job"].includes(body.action)) {
    return NextResponse.json(
      { success: false, error: "Invalid action. Use: generate, improve, expand, generate-page, generate-job" } satisfies AiResponse,
      { status: 400 },
    );
  }

  // For single-block actions, validate block type
  if (body.action !== "generate-page" && body.action !== "generate-job" && !blockSchemas[body.blockType]) {
    return NextResponse.json(
      { success: false, error: `Unknown block type: ${body.blockType}` } satisfies AiResponse,
      { status: 400 },
    );
  }

  // 5. Prompt size limit
  if (body.prompt && body.prompt.length > AI_LIMITS.MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Prompt too long (max ${AI_LIMITS.MAX_PROMPT_LENGTH} characters)` } satisfies AiResponse,
      { status: 400 },
    );
  }

  // 6. Rate limit (after validation, to avoid counting invalid requests)
  if (isRateLimited(ip, body.action as AiAction)) {
    const limit = AI_LIMITS.RATE_LIMITS[body.action as AiAction] || 10;
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded (${limit}/min for ${body.action}). Please wait.` } satisfies AiResponse,
      { status: 429 },
    );
  }

  // Determine if this is a job AI action (uses separate weekly credit pool)
  const isJobAction = body.action === "generate-job";

  // 6b. Action-specific credit check
  if (isJobAction) {
    // Job AI has a separate weekly credit limit (25/week for Pro & Enterprise)
    const sub = await subscriptionRepo.getByUserId(user.id);
    const userPlan = sub?.plan || "free";
    const weeklyJobLimit = JOB_AI_CREDITS_PER_WEEK[userPlan] || 0;
    const jobCheck = await subscriptionRepo.canUseJobAi(user.id, weeklyJobLimit);
    if (!jobCheck.allowed) {
      return NextResponse.json(
        { success: false, error: jobCheck.reason || "No job AI credits remaining this week." } satisfies AiResponse,
        { status: 403 },
      );
    }
  } else {
    // Page/block AI uses the main credit pool
    if (!aiCheck.allowed) {
      return NextResponse.json(
        { success: false, error: aiCheck.reason || "No AI credits remaining." } satisfies AiResponse,
        { status: 403 },
      );
    }
  }

  // 7. Check cache — still decrement a credit for cached responses
  //    to prevent unlimited free AI via cache hits
  const cacheKey = getCacheKey(body);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    const credited = isJobAction
      ? await subscriptionRepo.decrementJobCredit(user.id)
      : await subscriptionRepo.decrementCredit(user.id);
    if (!credited) {
      return NextResponse.json(
        { success: false, error: isJobAction ? "Weekly job AI credits exhausted." : "No AI credits remaining. Please upgrade your plan." } satisfies AiResponse,
        { status: 403 },
      );
    }
    return NextResponse.json(cached.response);
  }

  // 8. PRE-PAY: Decrement credit BEFORE calling OpenAI
  //    This prevents "free AI" if the server crashes after OpenAI responds
  const prePaid = isJobAction
    ? await subscriptionRepo.decrementJobCredit(user.id)
    : await subscriptionRepo.decrementCredit(user.id);
  if (!prePaid) {
    return NextResponse.json(
      { success: false, error: isJobAction ? "Weekly job AI credits exhausted." : "No AI credits remaining. Please upgrade your plan." } satisfies AiResponse,
      { status: 403 },
    );
  }

  // 9. Build prompt & call AI
  try {
    let promptPair: { system: string; user: string };
    if (body.action === "generate-job") {
      promptPair = buildJobPrompt({
        action: "generate-job",
        currentData: body.currentProps as any,
        prompt: body.prompt,
        tone: body.tone,
        context: body.context,
      });
    } else {
      promptPair = buildPrompt(body);
    }
    const { system, user: userPrompt } = promptPair;

    // Check total prompt size
    const totalChars = system.length + userPrompt.length;
    if (totalChars > AI_LIMITS.MAX_TOTAL_PROMPT_CHARS) {
      // Truncate user prompt to fit, but still allow the request
      // This is a soft limit — we log a warning but don't reject
      console.warn(`[AI] Prompt size ${totalChars} exceeds soft limit ${AI_LIMITS.MAX_TOTAL_PROMPT_CHARS}`);
    }

    const rawOutput = await callAiProvider(system, userPrompt);

    // 9. Parse JSON from AI output
    if (!rawOutput || rawOutput.trim().length === 0) {
      console.error("[AI] Empty response from provider");
      return NextResponse.json({
        success: false,
        error: "AI returned an empty response. Please try again.",
      } satisfies AiResponse);
    }

    let parsed: unknown;
    try {
      parsed = parseAiJson(rawOutput);
    } catch (parseErr: any) {
      console.error("[AI] Parse error. Raw output:", rawOutput.slice(0, 500));
      return NextResponse.json({
        success: false,
        error: process.env.NODE_ENV !== "production"
          ? `Failed to parse AI response: ${rawOutput.slice(0, 200)}`
          : "Failed to parse AI response. Please try again.",
      } satisfies AiResponse);
    }

    // 10. Validate — branch on action type
    let response: AiResponse;

    if (body.action === "generate-job") {
      const validation = validateJobOutput(parsed);
      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: `Job generation failed: ${validation.errors.join(", ")}`,
        } satisfies AiResponse);
      }

      response = {
        success: true,
        props: validation.job as any,
        blockType: "job",
        explanation: `Generated job posting: ${validation.job.title}${validation.warnings.length ? ` (${validation.warnings.join("; ")})` : ""}`,
      };
    } else if (body.action === "generate-page") {
      const validation = validatePageOutput(parsed);
      if (!validation.valid || validation.blocks.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Page generation failed: ${validation.errors.join(", ")}`,
        } satisfies AiResponse);
      }

      response = {
        success: true,
        blocks: validation.blocks,
        blockType: "page",
        explanation: buildExplanation(body, validation.warnings),
      };
    } else {
      const validation = validateAiOutput(body.blockType, parsed);
      if (validation.errors.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Validation failed: ${validation.errors.join(", ")}`,
        } satisfies AiResponse);
      }

      response = {
        success: true,
        props: validation.props,
        blockType: body.blockType,
        explanation: buildExplanation(body, validation.warnings),
      };
    }

    // 11. Cache the response (credit already decremented in step 8)
    responseCache.set(cacheKey, { response, expiresAt: Date.now() + AI_LIMITS.CACHE_TTL });

    return NextResponse.json(response);
  } catch (err: any) {
    // REFUND: Restore the pre-paid credit since AI generation failed
    try {
      const refundField = isJobAction ? "jobAiCredits" : "aiCredits";
      await prisma.user.update({
        where: { id: user.id },
        data: { [refundField]: { increment: 1 } },
      });
      console.log(`[AI] Refunded 1 ${refundField} credit to user ${user.id} after failure`);
    } catch (refundErr) {
      console.error(`[AI] CRITICAL: Failed to refund credit for user ${user.id}:`, refundErr);
    }

    const rawMsg = err.message || String(err);
    console.error("[AI] Error:", rawMsg);

    // User-friendly error messages with the actual error in dev
    const isDev = process.env.NODE_ENV !== "production";
    let errorMsg = "AI generation failed. Please try again.";

    if (rawMsg.includes("OPENAI_API_KEY")) {
      errorMsg = "AI is not configured. Add OPENAI_API_KEY to your environment.";
    } else if (rawMsg.includes("timed out") || rawMsg.includes("AbortError")) {
      errorMsg = "AI request timed out (15s). Try a simpler prompt.";
    } else if (rawMsg.includes("429") || rawMsg.includes("rate_limit")) {
      errorMsg = "AI provider rate limit hit. Please wait a moment.";
    } else if (rawMsg.includes("401") || rawMsg.includes("invalid_api_key")) {
      errorMsg = "AI API key is invalid or expired. Check your OPENAI_API_KEY.";
    } else if (rawMsg.includes("403")) {
      errorMsg = "AI API access denied. Check your API key permissions.";
    } else if (rawMsg.includes("insufficient_quota") || rawMsg.includes("billing")) {
      errorMsg = "AI credits exhausted. Add credits at platform.openai.com.";
    } else if (rawMsg.includes("model_not_found") || rawMsg.includes("does not exist")) {
      errorMsg = `AI model "${process.env.AI_MODEL || "gpt-5.4-mini"}" not available. Check AI_MODEL in .env.local.`;
    } else if (isDev) {
      // In development, show the actual error for debugging
      errorMsg = `AI error: ${rawMsg.slice(0, 300)}`;
    }

    return NextResponse.json({
      success: false,
      error: errorMsg,
    } satisfies AiResponse);
  }
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function buildExplanation(req: AiRequest, warnings: string[]): string {
  const actionLabel: Record<string, string> = {
    generate: "Generated",
    improve: "Improved",
    expand: "Expanded",
    "generate-page": "Generated full page",
  };

  const label = actionLabel[req.action] || "Generated";
  const schema = blockSchemas[req.blockType];
  let explanation = req.action === "generate-page"
    ? `${label} with AI`
    : `${label} content for "${schema?.label || req.blockType}" block`;
  if (req.tone) explanation += ` in ${req.tone} tone`;
  if (warnings.length > 0) explanation += `. Notes: ${warnings.slice(0, 3).join("; ")}`;
  return explanation;
}
