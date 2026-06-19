/**
 * Site Generator — Single Page Generation
 *
 * Two modes:
 *   - generatePage()   → legacy direct-prompt approach
 *   - generatePageV2() → NEW orchestrator pipeline (structure → content → validate → quality)
 *
 * generateSite() prefers V2 when available.
 */

import type { AiPageBlock } from "@/lib/ai/types";
import type { SiteGenerationInput, GeneratedPage, PageType } from "./siteSchema";
import { PAGE_BLUEPRINTS, SITE_LIMITS } from "./siteSchema";
import {
  buildPageBlocksPrompt,
  validatePageBlocks,
  getDefaultPageBlocks,
} from "./generateBlocks";
import { parseAiJson } from "@/lib/ai/validator";
import { orchestrate, type PageGenerationRequest } from "@/lib/ai/orchestrator";
import { callAi } from "@career-builder/ai-client";

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

  try {
    const rawOutput = await callAi(system, user, { timeoutMs: SITE_LIMITS.PAGE_TIMEOUT_MS });

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
  } catch (err: any) {
    // Fallback to defaults — NEVER return empty
    console.error(`[SiteGen] Page "${pageType}" AI failed: ${err.message}. Using defaults.`);
    blocks = getDefaultPageBlocks(pageType, blockTypes, input.companyName);
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

/* ================================================================== */
/*  V2: Orchestrator-powered page generation                           */
/*  Uses 4-layer pipeline: Context → Structure → Content → Validate    */
/* ================================================================== */

export async function generatePageV2(
  pageType: PageType,
  input: SiteGenerationInput,
  jobContext?: string,
): Promise<GeneratedPage> {
  const blueprint = PAGE_BLUEPRINTS[pageType] || PAGE_BLUEPRINTS.home;

  const request: PageGenerationRequest = {
    type: "page",
    pageType,
    companyName: input.companyName,
    industry: input.industry,
    companyType: input.companyType,
    tone: input.tone,
    audience: input.audience,
    hiringGoals: input.hiringGoals,
    tenantId: input.tenantId,
    jobContext,
  };

  const result = await orchestrate(request);

  if (result.success && result.blocks && result.blocks.length > 0) {
    console.log(
      `[SiteGen V2] Page "${pageType}": ${result.blocks.length} blocks, quality ${result.quality?.overall ?? "?"}/100 (${result.metadata.source})`,
    );

    return {
      slug: blueprint.slug,
      title: blueprint.title,
      pageType,
      blocks: result.blocks,
      description: blueprint.description,
    };
  }

  // Fallback — orchestrator already handles fallbacks internally,
  // but if we still get nothing, use legacy defaults
  console.warn(`[SiteGen V2] Page "${pageType}" orchestrator returned no blocks — using legacy defaults`);
  return {
    slug: blueprint.slug,
    title: blueprint.title,
    pageType,
    blocks: getDefaultPageBlocks(pageType, blueprint.blockTypes, input.companyName),
    description: blueprint.description,
  };
}
