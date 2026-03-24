/**
 * Site Generator — Block Generation
 *
 * Generates blocks for a single page using AI + schema validation.
 * Reuses the existing AI provider, prompts, and validator pipeline.
 */

import { blockSchemas, getDefaultProps, type BlockSchema } from "@/lib/blockSchemas";
import type { AiTone, AiIndustry, AiCompanyType, AiAudience, AiPageBlock } from "../types";
import type { SiteGenerationInput, PageType, PAGE_BLUEPRINTS } from "./siteSchema";
import { validateAiOutput } from "../validator";

/* ================================================================== */
/*  Job data helper (Feature 4: Job System Integration)                */
/* ================================================================== */

export interface JobSummary {
  title: string;
  department: string;
  location: string;
  type: string;
}

/** Fetch live job data for injection into AI prompts (server-side only) */
export async function fetchJobSummaries(tenantId?: string): Promise<JobSummary[]> {
  try {
    // Dynamic import to avoid bundling in client
    const { jobRepo } = await import("@career-builder/database");
    const jobs = await jobRepo.findByTenant(tenantId || "default", false);
    return (jobs || []).slice(0, 10).map((j: any) => ({
      title: j.title || "Untitled",
      department: j.department || "General",
      location: j.location || "Remote",
      type: j.employmentType || j.type || "Full-time",
    }));
  } catch {
    return [];
  }
}

/** Build a job context string for AI prompts */
export function buildJobContextString(jobs: JobSummary[]): string {
  if (jobs.length === 0) return "";
  const lines = jobs.map((j) => `- ${j.title} (${j.department}, ${j.location}, ${j.type})`).join("\n");
  return `\nACTUAL OPEN POSITIONS at the company:\n${lines}\nUse these real job titles and departments in job-related blocks (job-list, job-category, hero for jobs page, etc.).`;
}

/* ================================================================== */
/*  Per-page-type block content instructions                            */
/* ================================================================== */

const PAGE_CONTENT_PROMPTS: Record<PageType, string> = {
  home: `This is the MAIN career landing page. It should:
- Have an inspiring hero headline about joining the company
- Showcase 3-4 key reasons to work here (features)
- Include company stats/numbers that impress candidates
- Have employee testimonials
- End with a strong call-to-action to view open positions`,

  careers: `This is the main careers landing page. Same as home — inspiring hero, key reasons to join, stats, testimonials, and CTA.`,

  jobs: `This is the job listing page. It should:
- Have a focused hero about finding the right role
- Include a search bar for filtering positions
- Show a job list section
- End with a talent network signup for those who don't find a match`,

  about: `This is the About Us / company story page. It should:
- Have a hero about the company's mission
- Include detailed content about company history and vision
- Feature a video-and-text section about company culture
- Show the leadership team grid
- Feel authentic and personal`,

  culture: `This is the Culture & Values page. It should:
- Have an energetic hero about company culture
- Feature 4-6 core values or cultural pillars
- Include a photo gallery / light-box of team moments
- Show social proof (awards, certifications)
- Include real employee testimonials about the culture`,

  benefits: `This is the Benefits & Perks page. It should:
- Have a clear hero about total rewards
- List 4-6 benefit categories as features
- Include expandable accordion sections for detailed benefit info
- Show stats about benefits (e.g., PTO days, 401k match)
- End with a CTA to explore open positions`,

  contact: `This is the Contact / Get In Touch page. It should:
- Have a welcoming hero encouraging candidates to reach out
- Include contact information or office details
- Feature a talent network signup form
- Be concise and action-oriented`,
};

/* ================================================================== */
/*  Build page-specific prompt                                         */
/* ================================================================== */

export function buildPageBlocksPrompt(
  pageType: PageType,
  blockTypes: string[],
  input: SiteGenerationInput,
  brandVoice: string,
  jobContext?: string,
): { system: string; user: string } {
  // Build schema reference for each block type on this page
  const blockRefs = blockTypes
    .filter((bt) => blockSchemas[bt])
    .map((bt) => {
      const schema = blockSchemas[bt];
      const fields = schema.fields.map((f) => {
        if (f.type === "image") return `"${f.name}": ""`;
        if (f.type === "boolean") return `"${f.name}": ${f.default ?? false}`;
        if (f.type === "select") return `"${f.name}": "${f.default || f.options?.[0]?.value || ""}"`;
        if (f.type === "list") {
          const subFields = f.listFields?.map((sf) => `"${sf.name}": "string"`).join(", ") || "";
          return `"${f.name}": [{ ${subFields} }]`;
        }
        return `"${f.name}": "string"`;
      }).join(", ");
      return `  "${bt}": { ${fields} }`;
    })
    .join("\n");

  const system = `You are a career site page generator for a multi-page career website.
You output ONLY valid JSON with a "blocks" array.

ABSOLUTE RULES:
1. Output a JSON object: { "blocks": [...] }
2. Each block: { "type": "<block-type>", "props": { ... } }
3. Generate blocks in EXACTLY this order: ${blockTypes.join(" → ")}
4. For ALL "image" fields, use "" (empty string). NEVER generate image URLs.
5. No HTML tags. No markdown. No code fences. No explanations.
6. Titles: max 8 words. Subtitles: max 25 words. Body text: max 60 words.
7. Use the EXACT field names from the schemas below.
8. For "list" fields, generate 3-5 items.
9. For "select" fields, use ONLY the allowed values from the schema.
10. Keep content consistent with the brand voice provided.

BRAND VOICE: ${brandVoice}

COMPANY: ${input.companyName}
INDUSTRY: ${input.industry}
COMPANY TYPE: ${input.companyType}`;

  const pageInstructions = PAGE_CONTENT_PROMPTS[pageType] || PAGE_CONTENT_PROMPTS.home;

  const user = `Generate content for the "${pageType.toUpperCase()}" page of ${input.companyName}'s career site.

${pageInstructions}

${input.hiringGoals ? `Hiring focus: ${input.hiringGoals}` : ""}
${input.audience ? `Target audience: ${input.audience}` : ""}
${input.prompt ? `Additional instructions: ${input.prompt}` : ""}
${jobContext || ""}

Tone: ${input.tone}

Company: ${input.companyName} (${input.companyType}, ${input.industry} industry)

Block schemas (use these EXACT field names):
${blockRefs}

Generate exactly ${blockTypes.length} blocks in this order: ${blockTypes.join(", ")}

Output format:
{
  "blocks": [
    { "type": "${blockTypes[0]}", "props": { ... } },
    ...
  ]
}

Respond with ONLY the JSON.`;

  return { system, user };
}

/* ================================================================== */
/*  Validate and fill blocks for a page                                */
/* ================================================================== */

export function validatePageBlocks(
  rawBlocks: unknown[],
  expectedTypes: string[],
): { blocks: AiPageBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const blocks: AiPageBlock[] = [];

  for (let i = 0; i < expectedTypes.length; i++) {
    const expectedType = expectedTypes[i];
    const rawBlock = rawBlocks[i];

    if (!rawBlock || typeof rawBlock !== "object") {
      // Fallback: use defaults for this block type
      warnings.push(`Block ${i + 1} (${expectedType}): missing — using defaults`);
      blocks.push({
        type: expectedType,
        props: getDefaultProps(expectedType),
      });
      continue;
    }

    const block = rawBlock as { type?: string; props?: Record<string, any> };
    const blockType = block.type || expectedType;

    // If AI returned a different type than expected, use expected type with AI's props
    if (blockType !== expectedType && blockSchemas[expectedType]) {
      warnings.push(`Block ${i + 1}: expected "${expectedType}" got "${blockType}" — corrected`);
    }

    const actualType = blockSchemas[blockType] ? blockType : expectedType;
    const validation = validateAiOutput(actualType, block.props || {});

    if (validation.warnings.length > 0) {
      warnings.push(`Block ${i + 1} (${actualType}): ${validation.warnings.join("; ")}`);
    }

    blocks.push({
      type: actualType,
      props: validation.props,
    });
  }

  return { blocks, warnings };
}

/* ================================================================== */
/*  Fallback: generate default blocks for a page type                  */
/* ================================================================== */

export function getDefaultPageBlocks(
  pageType: PageType,
  blockTypes: string[],
  companyName: string,
): AiPageBlock[] {
  return blockTypes
    .filter((bt) => blockSchemas[bt])
    .map((bt) => {
      const defaults = getDefaultProps(bt);

      // Customize with company name where applicable
      if (bt === "navbar" && defaults.companyName !== undefined) {
        defaults.companyName = companyName;
      }
      if (bt === "footer") {
        if (defaults.companyName !== undefined) defaults.companyName = companyName;
        if (defaults.copyright !== undefined) defaults.copyright = `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;
      }
      if (bt === "hero") {
        if (defaults.title !== undefined) {
          const titles: Record<PageType, string> = {
            home: `Build Your Career at ${companyName}`,
            careers: `Join ${companyName}`,
            jobs: "Find Your Next Role",
            about: `About ${companyName}`,
            culture: `Life at ${companyName}`,
            benefits: "Benefits & Perks",
            contact: "Get In Touch",
          };
          defaults.title = titles[pageType] || defaults.title;
        }
      }

      return { type: bt, props: defaults };
    });
}
