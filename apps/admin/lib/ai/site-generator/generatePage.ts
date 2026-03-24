/**
 * Site Generator — Single Page Generation
 *
 * Generates all blocks for one page by calling the AI provider.
 * Validates output against block schemas.
 * Falls back to defaults if AI fails.
 */

import type { AiPageBlock } from "../types";
import type { SiteGenerationInput, GeneratedPage, PageType } from "./siteSchema";
import { PAGE_BLUEPRINTS, SITE_LIMITS } from "./siteSchema";
import {
  buildPageBlocksPrompt,
  validatePageBlocks,
  getDefaultPageBlocks,
} from "./generateBlocks";
import { parseAiJson } from "../validator";

/* ================================================================== */
/*  AI Provider caller — reuses the same config as /api/ai             */
/* ================================================================== */

const RESPONSES_API_MODELS = /^(gpt-5|o[1-9])/;

async function callAi(system: string, user: string, timeoutMs: number): Promise<string> {
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
    const useResponsesApi = RESPONSES_API_MODELS.test(model);

    if (useResponsesApi) {
      const res = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          instructions: system,
          input: user,
          text: { format: { type: "json_object" } },
          max_output_tokens: 1200,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown");
        throw new Error(`AI error (${res.status}): ${err}`);
      }

      const data = await res.json();
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
      throw new Error("Unexpected AI response format");
    } else {
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
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown");
        throw new Error(`AI error (${res.status}): ${err}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("AI page generation timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================================================================== */
/*  Generate a single page                                             */
/* ================================================================== */

export async function generatePage(
  pageType: PageType,
  blockTypes: string[],
  input: SiteGenerationInput,
  brandVoice: string,
  jobContext?: string,
): Promise<GeneratedPage> {
  const blueprint = PAGE_BLUEPRINTS[pageType] || PAGE_BLUEPRINTS.home;

  // Build prompt (include job context for job-related pages)
  const { system, user } = buildPageBlocksPrompt(pageType, blockTypes, input, brandVoice, jobContext);

  let blocks: AiPageBlock[];
  let warnings: string[] = [];

  try {
    const rawOutput = await callAi(system, user, SITE_LIMITS.PAGE_TIMEOUT_MS);

    if (!rawOutput || rawOutput.trim().length === 0) {
      throw new Error("Empty AI response");
    }

    const parsed = parseAiJson(rawOutput) as { blocks?: unknown[] };

    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error("AI response missing blocks array");
    }

    // Validate blocks against expected types
    const validated = validatePageBlocks(parsed.blocks, blockTypes);
    blocks = validated.blocks;
    warnings = validated.warnings;
  } catch (err: any) {
    // Fallback to defaults — NEVER return empty
    console.error(`[SiteGen] Page "${pageType}" AI failed: ${err.message}. Using defaults.`);
    blocks = getDefaultPageBlocks(pageType, blockTypes, input.companyName);
    warnings = [`AI generation failed for ${pageType} page — using template defaults. Error: ${err.message}`];
  }

  // Ensure navbar/footer have correct company name
  blocks = blocks.map((block) => {
    if (block.type === "navbar" || block.type === "footer") {
      const props = { ...block.props };
      if (props.companyName !== undefined) props.companyName = input.companyName;
      if (block.type === "footer" && props.copyright !== undefined) {
        props.copyright = `© ${new Date().getFullYear()} ${input.companyName}. All rights reserved.`;
      }
      return { ...block, props };
    }
    return block;
  });

  return {
    slug: blueprint.slug,
    title: blueprint.title,
    pageType,
    blocks,
    description: blueprint.description,
  };
}
