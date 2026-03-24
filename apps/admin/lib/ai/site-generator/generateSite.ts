/**
 * Site Generator — Orchestrator
 *
 * Top-level entry point that:
 *   1. Creates a site plan (which pages, which blocks)
 *   2. Generates pages in parallel batches
 *   3. Validates everything
 *   4. Returns a complete GeneratedSite for preview
 *
 * The user MUST approve before anything is saved to the database.
 */

import type { SiteGenerationInput, GeneratedSite, GeneratedPage, PageType, SitePagePlan } from "./siteSchema";
import { PAGE_BLUEPRINTS, SITE_LIMITS } from "./siteSchema";
import { generatePage } from "./generatePage";
import { getDefaultPageBlocks, fetchJobSummaries, buildJobContextString } from "./generateBlocks";

/* ================================================================== */
/*  Brand voice generator                                              */
/* ================================================================== */

function generateBrandVoice(input: SiteGenerationInput): string {
  const toneMap: Record<string, string> = {
    professional: "Professional, confident, and authoritative. Use clear, polished corporate language. Think McKinsey, Deloitte, or Stripe.",
    friendly: "Warm, human, and conversational. Make it feel personal and approachable. Think Notion, Figma, or Slack.",
    bold: "Bold, energetic, and exciting. Short punchy sentences. Create urgency and excitement. Think Vercel, Linear, or Supabase.",
    minimal: "Clean and minimal. Every word counts. No fluff. Whitespace is your friend. Think Apple, Aesop, or Muji.",
    "hiring-focused": "Recruiting-focused and persuasive. Emphasize growth, culture, and opportunity. Think Google Careers or Netflix Jobs.",
  };

  const companyTypeVoice: Record<string, string> = {
    startup: "Fast-paced startup energy. Emphasize impact, ownership, and moving fast. Candidates should feel like they'll shape the company's future.",
    scaleup: "Growing company momentum. Balance startup agility with emerging stability. Highlight the rare window of joining at the right time.",
    enterprise: "Established and trusted. Emphasize scale, stability, and world-class benefits. Candidates should feel they're joining an institution.",
    agency: "Creative and dynamic. Emphasize variety, collaboration, and exciting client work. Each day brings something new.",
    nonprofit: "Mission-driven and purposeful. Emphasize impact, meaning, and making a difference. Work that matters.",
  };

  const industryContext: Record<string, string> = {
    technology: "Use modern tech language. Reference innovation, engineering excellence, and building products that scale.",
    fintech: "Blend finance credibility with tech innovation. Reference trust, security, and democratizing finance.",
    healthcare: "Emphasize patient impact and care. Reference improving lives, clinical excellence, and health outcomes.",
    education: "Emphasize learning and growth. Reference empowering students, teachers, and lifelong learning.",
    ecommerce: "Emphasize customer obsession and growth. Reference scale, user experience, and marketplace dynamics.",
    saas: "Emphasize product craft and customer success. Reference ARR growth, platform thinking, and developer experience.",
    consulting: "Emphasize problem-solving and expertise. Reference client impact, thought leadership, and career development.",
    manufacturing: "Emphasize precision and innovation. Reference operational excellence, sustainability, and engineering.",
    media: "Emphasize storytelling and creativity. Reference content, audience, and cultural impact.",
    nonprofit: "Emphasize mission and social impact. Reference community, service, and making a difference.",
    other: "Use inclusive, professional language that appeals to a broad range of candidates.",
  };

  return `BRAND VOICE:
${toneMap[input.tone] || toneMap.professional}
${companyTypeVoice[input.companyType] || ""}

INDUSTRY CONTEXT:
${industryContext[input.industry] || industryContext.other}

COMPANY: ${input.companyName}
INDUSTRY: ${input.industry}
TYPE: ${input.companyType}
${input.hiringGoals ? `HIRING FOCUS: ${input.hiringGoals}` : ""}
${input.audience ? `TARGET AUDIENCE: ${input.audience}` : ""}

DESIGN PHILOSOPHY:
- Write like a senior product designer + conversion copywriter
- Large, impactful headings (6-8 words max, punchy)
- Subtitles that add value (15-25 words, explain the benefit)
- Card-based UI sections with clean grid layouts
- Generous whitespace between sections
- Stats/numbers that impress (quantify everything possible)
- 3-5 items per list section (quality over quantity)
- Each section should have a clear purpose and CTA intent
- No generic filler text — every word should earn its place`;
}

/* ================================================================== */
/*  Create site plan                                                   */
/* ================================================================== */

export function createSitePlan(input: SiteGenerationInput): SitePagePlan[] {
  // Always include required pages
  const pageTypes: PageType[] = [...SITE_LIMITS.REQUIRED_PAGE_TYPES];

  // Add optional pages based on company type / industry
  const optionalPages: PageType[] = ["culture", "benefits"];

  // Startups/agencies get culture page, enterprise gets benefits
  if (input.companyType === "startup" || input.companyType === "agency") {
    if (!pageTypes.includes("culture")) pageTypes.push("culture");
  }
  if (input.companyType === "enterprise" || input.companyType === "scaleup") {
    if (!pageTypes.includes("benefits")) pageTypes.push("benefits");
  }

  // Always add culture if not present (it's valuable for any career site)
  if (!pageTypes.includes("culture")) pageTypes.push("culture");

  // Add contact page
  if (!pageTypes.includes("contact")) pageTypes.push("contact");

  // Add benefits if not present and we have room
  if (!pageTypes.includes("benefits") && pageTypes.length < SITE_LIMITS.MAX_PAGES) {
    pageTypes.push("benefits");
  }

  // Cap at max pages
  const capped = pageTypes.slice(0, SITE_LIMITS.MAX_PAGES);

  return capped.map((pageType) => {
    const blueprint = PAGE_BLUEPRINTS[pageType] || PAGE_BLUEPRINTS.home;
    return {
      slug: blueprint.slug,
      title: blueprint.title,
      pageType,
      description: blueprint.description,
      blockTypes: blueprint.blockTypes.slice(0, SITE_LIMITS.MAX_BLOCKS_PER_PAGE),
    };
  });
}

/* ================================================================== */
/*  Parallel batch helper                                              */
/* ================================================================== */

async function generateInBatches(
  plans: SitePagePlan[],
  input: SiteGenerationInput,
  brandVoice: string,
  jobContext: string,
  onProgress?: (completed: number, total: number, pageName: string) => void,
): Promise<GeneratedPage[]> {
  const results: GeneratedPage[] = [];
  const batchSize = SITE_LIMITS.MAX_PARALLEL_PAGES;

  // Page types that benefit from job data
  const JOB_PAGES = new Set<PageType>(["jobs", "home", "careers"]);

  for (let i = 0; i < plans.length; i += batchSize) {
    const batch = plans.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map((plan) => {
        const pageJobCtx = JOB_PAGES.has(plan.pageType) ? jobContext : undefined;
        return generatePage(plan.pageType, plan.blockTypes, input, brandVoice, pageJobCtx);
      }),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const plan = batch[j];

      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Fallback to defaults — NEVER return empty pages
        console.error(`[SiteGen] Page "${plan.pageType}" failed:`, result.reason);
        results.push({
          slug: plan.slug,
          title: plan.title,
          pageType: plan.pageType,
          blocks: getDefaultPageBlocks(plan.pageType, plan.blockTypes, input.companyName),
          description: plan.description,
        });
      }

      onProgress?.(results.length, plans.length, plan.title);
    }
  }

  return results;
}

/* ================================================================== */
/*  Main entry: generateSite                                           */
/* ================================================================== */

export async function generateSite(
  input: SiteGenerationInput,
  onProgress?: (completed: number, total: number, pageName: string) => void,
): Promise<GeneratedSite> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // 1. Validate input
  if (!input.companyName || input.companyName.trim().length === 0) {
    throw new Error("Company name is required");
  }
  if (input.companyName.length > 100) {
    throw new Error("Company name too long (max 100 chars)");
  }

  // 2. Generate brand voice for consistency across pages
  const brandVoice = generateBrandVoice(input);

  // 3. Fetch live job data for job-related pages (Feature 4)
  let jobContext = "";
  try {
    const jobs = await fetchJobSummaries(input.tenantId);
    jobContext = buildJobContextString(jobs);
    if (jobs.length > 0) {
      console.log(`[SiteGen] Loaded ${jobs.length} live jobs for AI context`);
    }
  } catch {
    // Non-fatal — AI will generate placeholder job data
  }

  // 4. Create site plan
  const plan = createSitePlan(input);
  console.log(`[SiteGen] Plan: ${plan.map((p) => p.pageType).join(", ")} (${plan.length} pages)`);

  // 5. Check total block count won't exceed limit
  const totalBlocks = plan.reduce((sum, p) => sum + p.blockTypes.length, 0);
  if (totalBlocks > SITE_LIMITS.MAX_TOTAL_BLOCKS) {
    warnings.push(`Total blocks (${totalBlocks}) exceeds limit — some pages may be trimmed`);
  }

  // 6. Generate pages in parallel batches
  const pages = await generateInBatches(plan, input, brandVoice, jobContext, onProgress);

  // 7. Verify total time
  const elapsed = Date.now() - startTime;
  if (elapsed > SITE_LIMITS.SITE_TIMEOUT_MS) {
    warnings.push(`Generation took ${Math.round(elapsed / 1000)}s (exceeded ${SITE_LIMITS.SITE_TIMEOUT_MS / 1000}s target)`);
  }

  // 8. Collect all page warnings
  // (individual page warnings are already in each page's blocks via generatePage)

  console.log(`[SiteGen] Complete: ${pages.length} pages, ${pages.reduce((s, p) => s + p.blocks.length, 0)} total blocks in ${Math.round(elapsed / 1000)}s`);

  return {
    companyName: input.companyName,
    pages,
    summary: `Generated ${pages.length}-page career site for ${input.companyName} (${input.industry}, ${input.companyType}). Pages: ${pages.map((p) => p.title).join(", ")}. Total blocks: ${pages.reduce((s, p) => s + p.blocks.length, 0)}.`,
    warnings,
  };
}

/* ================================================================== */
/*  Regenerate a single page within an existing site                   */
/* ================================================================== */

export async function regeneratePage(
  site: GeneratedSite,
  pageIndex: number,
  input: SiteGenerationInput,
  regenOption?: { id: string; promptSuffix: string },
): Promise<GeneratedSite> {
  if (pageIndex < 0 || pageIndex >= site.pages.length) {
    throw new Error("Invalid page index");
  }

  const existingPage = site.pages[pageIndex];
  let brandVoice = generateBrandVoice(input);

  // Append smart regeneration instructions to brand voice
  if (regenOption?.promptSuffix) {
    brandVoice += `\n\nSPECIAL INSTRUCTION: ${regenOption.promptSuffix}`;
  }

  const blueprint = PAGE_BLUEPRINTS[existingPage.pageType] || PAGE_BLUEPRINTS.home;

  // Fetch live job data for job-related pages
  let jobContext: string | undefined;
  const JOB_PAGES = new Set<PageType>(["jobs", "home", "careers"]);
  if (JOB_PAGES.has(existingPage.pageType)) {
    try {
      const jobs = await fetchJobSummaries(input.tenantId);
      const ctx = buildJobContextString(jobs);
      if (ctx) jobContext = ctx;
    } catch {
      // Non-fatal — regen without job data
    }
  }

  const newPage = await generatePage(
    existingPage.pageType,
    blueprint.blockTypes,
    input,
    brandVoice,
    jobContext,
  );

  const newPages = [...site.pages];
  newPages[pageIndex] = newPage;

  const regenLabel = regenOption?.id ? ` with "${regenOption.id}"` : "";
  return {
    ...site,
    pages: newPages,
    summary: `${site.summary} (page "${existingPage.title}" regenerated${regenLabel})`,
  };
}

/* ================================================================== */
/*  Remove a page from site                                            */
/* ================================================================== */

export function removePage(site: GeneratedSite, pageIndex: number): GeneratedSite {
  if (pageIndex < 0 || pageIndex >= site.pages.length) {
    throw new Error("Invalid page index");
  }

  const newPages = site.pages.filter((_, i) => i !== pageIndex);
  return {
    ...site,
    pages: newPages,
    summary: `${site.summary} (removed page ${pageIndex + 1})`,
  };
}
