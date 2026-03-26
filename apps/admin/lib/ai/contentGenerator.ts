/**
 * Content Generator — AI-powered content for individual blocks
 *
 * This is SEPARATE from the Structure Generator.
 * Structure decides WHAT blocks to show. Content Generator fills WHAT they say.
 *
 * Architecture:
 *   structureGenerator.generateStructure() → BlockLayout[]
 *   contentGenerator.generateBlockContent() → props per block
 *
 * Uses role-based prompting — the AI takes on different personas:
 *   - Product designer (for hero, features, image grids)
 *   - Copywriter (for CTAs, testimonials, content blocks)
 *   - Recruiter (for job-related blocks, talent network)
 *   - Data analyst (for stats, social proof)
 */

import { blockSchemas, getDefaultProps, type BlockField } from "@/lib/blockSchemas";
import type { AiGenerationContext } from "@/lib/ai/context/contextEngine";
import { serializeContext } from "@/lib/ai/context/contextEngine";
import type { BlockLayout } from "@/lib/ai/structureGenerator";
import type { AiPageBlock } from "@/lib/ai/types";

/* ================================================================== */
/*  Role-based persona system                                          */
/* ================================================================== */

type AiPersona = "product-designer" | "copywriter" | "recruiter" | "data-analyst" | "culture-lead";

const PERSONA_INSTRUCTIONS: Record<AiPersona, string> = {
  "product-designer": `You are a SENIOR PRODUCT DESIGNER at a top design agency (Pentagram, IDEO level).
You think in visual hierarchies, whitespace, and information architecture.
Your content is scannable, card-friendly, and designed for modern grid layouts.
Every heading works as a standalone visual anchor. Every section has clear visual purpose.
You write like Apple or Stripe's career pages — clean, impactful, no fluff.`,

  copywriter: `You are an AWARD-WINNING CONVERSION COPYWRITER (Joanna Wiebe, Eddie Shleyner level).
You write headlines that stop scrollers. Every word earns its place.
You use power verbs, specific numbers, and emotional triggers.
Your CTAs create urgency without being pushy. Your copy converts browsers to applicants.
No corporate buzzwords. No filler. Every sentence moves the reader toward action.`,

  recruiter: `You are a VP OF TALENT at a top tech company (Google, Stripe, Notion level).
You understand what top candidates look for: growth, impact, culture, compensation.
You write job descriptions that attract A-players, not just fill seats.
You emphasize what's unique about this company — specific programs, team dynamics, real impact.
Your language is authentic and credible. Candidates can smell BS — you keep it real.`,

  "data-analyst": `You are a SENIOR DATA ANALYST who communicates company metrics compellingly.
You turn boring numbers into impressive stories. "500 employees" becomes "527 experts across 23 countries".
You use specific numbers (not round numbers) to feel authentic: "4.7/5" not "High rating".
Every stat you present tells a story about the company's growth, scale, or impact.
You know which metrics impress candidates: retention rate, growth rate, team size, customer count.`,

  "culture-lead": `You are a HEAD OF CULTURE at a company known for its amazing workplace.
You write about culture from the inside — specific rituals, real programs, genuine values.
Not generic "we value teamwork" but specific "Every Friday we ship something we're proud of".
Your language is warm, human, and specific. You cite real programs, events, and traditions.
You make candidates feel FOMO — they want to be part of this culture.`,
};

/** Map block types to their ideal persona */
const BLOCK_PERSONA_MAP: Record<string, AiPersona> = {
  // Product designer — visual/structural blocks
  hero: "product-designer",
  features: "product-designer",
  "image-text-grid": "product-designer",
  "light-box": "product-designer",
  carousel: "product-designer",

  // Copywriter — persuasion/conversion blocks
  "cta-button": "copywriter",
  content: "copywriter",
  "notification-banner": "copywriter",
  "basic-button": "copywriter",

  // Recruiter — job/talent blocks
  "search-bar": "recruiter",
  "search-results": "recruiter",
  "job-details": "recruiter",
  "job-category": "recruiter",
  "join-talent-network": "recruiter",
  "job-alert": "recruiter",
  "application-status": "recruiter",

  // Data analyst — numbers/proof blocks
  "stats-counter": "data-analyst",
  "social-proof": "data-analyst",

  // Culture lead — people/culture blocks
  testimonial: "culture-lead",
  "team-grid": "culture-lead",
  "show-hide-tab": "culture-lead",
  "video-and-text": "culture-lead",
  accordion: "recruiter", // FAQ tends to be hiring-focused

  // Navigation — product designer
  navbar: "product-designer",
  footer: "product-designer",
};

/* ================================================================== */
/*  Schema description builder                                         */
/* ================================================================== */

function describeFieldForAi(field: BlockField): string {
  switch (field.type) {
    case "text":
      return `"${field.name}": string — ${field.label}. Max 80 chars.`;
    case "textarea":
      return `"${field.name}": string — ${field.label}. 20-150 chars.`;
    case "select":
      return `"${field.name}": one of [${field.options?.map((o) => `"${o.value}"`).join(", ")}]`;
    case "boolean":
      return `"${field.name}": true or false`;
    case "image":
      return `"${field.name}": "" (ALWAYS empty string for images)`;
    case "list": {
      const subFields = field.listFields?.map((sf) => `"${sf.name}": string`).join(", ") || "";
      return `"${field.name}": array of objects with { ${subFields} } — generate 3-5 items`;
    }
    default:
      return `"${field.name}": string`;
  }
}

/* ================================================================== */
/*  Content generation prompt builder                                  */
/* ================================================================== */

export interface ContentPrompt {
  system: string;
  user: string;
  persona: AiPersona;
}

/**
 * Build a content-generation prompt for a single block.
 * Uses role-based prompting with the appropriate persona.
 */
export function buildBlockContentPrompt(
  blockLayout: BlockLayout,
  ctx: AiGenerationContext,
  pageType: string,
  blockIndex: number,
  totalBlocks: number,
): ContentPrompt {
  const schema = blockSchemas[blockLayout.type];
  if (!schema) {
    throw new Error(`Unknown block type: ${blockLayout.type}`);
  }

  const persona = BLOCK_PERSONA_MAP[blockLayout.type] || "product-designer";
  const personaInstruction = PERSONA_INSTRUCTIONS[persona];

  const fieldDescriptions = schema.fields.map(describeFieldForAi).join("\n  ");
  const contextString = serializeContext(ctx);

  // Position-aware instructions
  const positionHint = getPositionHint(blockLayout.type, blockIndex, totalBlocks, pageType);

  // Density-aware instructions
  const densityHint = getDensityHint(blockLayout.density);

  const system = `${personaInstruction}

You output ONLY valid JSON. No markdown. No code fences. No explanations.

ABSOLUTE RULES:
1. Output ONLY a single JSON object with the exact fields listed below.
2. Match field names and types EXACTLY.
3. For "image" fields: ALWAYS return "" (empty string). NEVER generate URLs.
4. For "select" fields: use ONLY the listed allowed values.
5. For "list" fields: generate 3-5 items with distinct, specific content.
6. For "boolean" fields: use true or false (not strings).
7. NEVER use placeholder text like "Lorem ipsum" or "Your Company".
8. NEVER use the company name as "${ctx.company.name}" in every sentence — vary the language.
9. Each text value must be UNIQUE — no repeated phrases across fields.
10. All content must be contextually relevant to a ${ctx.company.industry} company.

${densityHint}`;

  const user = `Generate content for the "${schema.label}" block (${blockLayout.role}).

POSITION: Block ${blockIndex + 1} of ${totalBlocks} on the "${pageType}" page.
${positionHint}

VARIANT: ${blockLayout.variant}

${contextString}

Required JSON fields:
  ${fieldDescriptions}

Respond with ONLY the JSON object.`;

  return { system, user, persona };
}

/**
 * Build a batch content-generation prompt for ALL blocks on a page.
 * More efficient than individual calls — one AI call for the whole page.
 */
export function buildPageContentPrompt(
  layouts: BlockLayout[],
  ctx: AiGenerationContext,
  pageType: string,
): ContentPrompt {
  const contextString = serializeContext(ctx);

  // Build schema reference for each block
  const blockRefs = layouts
    .filter((layout) => blockSchemas[layout.type])
    .map((layout, i) => {
      const schema = blockSchemas[layout.type]!;
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
      return `  Block ${i + 1}: "${layout.type}" (${layout.role}) → { ${fields} }`;
    })
    .join("\n");

  // Page-specific content direction
  const pageDirection = getPageContentDirection(pageType, ctx);

  const system = `You are an ELITE career site content team: product designer + copywriter + recruiter + data analyst.
You create world-class career pages that rival Stripe, Notion, and Linear.
You output ONLY valid JSON with a "blocks" array.

ABSOLUTE RULES:
1. Output: { "blocks": [{ "type": "<type>", "props": { ... } }, ...] }
2. Generate blocks in EXACTLY the order listed. Do NOT skip or reorder.
3. For ALL "image" fields: use "" (empty string). NEVER generate URLs.
4. No HTML tags. No markdown. No code fences. No explanations.
5. Use the EXACT field names from the schemas below.
6. For "select" fields: ONLY use allowed values from schema.
7. NEVER use placeholder text. Every word must be specific and relevant.
8. NEVER repeat the same phrase across different blocks.
9. Each block must serve its stated ROLE — content must match purpose.
10. Build a narrative flow — each block should connect to the next.

CONTENT QUALITY STANDARDS:
- Titles: 4-8 words, punchy, use power verbs. NO generic "Welcome to..."
- Subtitles: 12-25 words, explain benefit or value proposition
- Body text: 20-60 words, specific and actionable
- List items: 3-5 per list, each item distinct and valuable
- Stats: Use specific numbers (e.g., "527" not "500+", "4.8/5" not "High")
- Employee names: Realistic, diverse names with real job titles
- Testimonials: 20-40 words, specific about projects/growth/culture
- CTAs: 2-5 words, action-oriented ("View Open Roles", "Start Your Journey")`;

  const user = `Generate production-quality content for a ${pageType.toUpperCase()} page.

${pageDirection}

${contextString}

BLOCK SCHEMAS (generate in this exact order):
${blockRefs}

Generate EXACTLY ${layouts.length} blocks. Respond with ONLY the JSON.`;

  return { system, user, persona: "product-designer" };
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function getPositionHint(blockType: string, index: number, total: number, pageType: string): string {
  if (index === 0) return "This is the FIRST block — it sets the tone for the entire page.";
  if (index === 1) return "This is the HERO — the most important visual impression. Make it powerful.";
  if (index === total - 1) return "This is the LAST block — it wraps up the page. Keep it clean.";
  if (index === total - 2) return "This is the CLOSING CTA — create urgency and a clear next step.";
  if (index < total / 3) return "This is in the UPPER section — build credibility and interest.";
  if (index < (total * 2) / 3) return "This is in the MIDDLE section — provide depth and evidence.";
  return "This is in the LOWER section — reinforce the message and drive action.";
}

function getDensityHint(density: BlockLayout["density"]): string {
  switch (density) {
    case "compact":
      return `DENSITY: COMPACT — Be concise. Short titles (4-6 words), brief descriptions (15-30 words), 3 list items max. Every word must earn its place.`;
    case "detailed":
      return `DENSITY: DETAILED — Be thorough. Rich titles (6-8 words), detailed descriptions (30-60 words), 4-5 list items. Provide comprehensive information.`;
    default:
      return `DENSITY: STANDARD — Balanced content. Titles 5-8 words, descriptions 20-40 words, 3-4 list items. Professional and clear.`;
  }
}

function getPageContentDirection(pageType: string, ctx: AiGenerationContext): string {
  const company = ctx.company.name;
  const type = ctx.company.companyType;

  const directions: Record<string, string> = {
    home: `This is the MAIN career landing page for ${company}. It should feel like a top-tier ${type} career page. Build excitement about working here. Show scale, impact, and opportunity.`,
    careers: `This is the CAREERS hub for ${company}. Focus on why candidates should apply. Show culture, benefits, growth opportunities, and open roles.`,
    jobs: `This is the JOB LISTING page. Purely functional — help candidates find and apply to roles quickly. Minimal marketing, maximum usability.`,
    about: `This is the ABOUT US page. Tell ${company}'s story authentically — mission, values, leadership, and what makes them unique. Not marketing — storytelling.`,
    culture: `This is the CULTURE page. Show what daily life is like at ${company}. Specific programs, real traditions, genuine values. Make candidates feel FOMO.`,
    benefits: `This is the BENEFITS page. Showcase ${company}'s total rewards package. Make it scannable and impressive. Use specific numbers, not vague claims.`,
    contact: `This is the CONTACT page. Keep it focused and action-oriented. Make it easy to reach out or sign up for updates.`,
  };

  return directions[pageType] || directions.home;
}

/* ================================================================== */
/*  Fallback content for when AI fails                                 */
/* ================================================================== */

/**
 * Generate fallback content for a block using schema defaults + context personalization.
 * Used when AI call fails — NEVER return empty blocks.
 */
export function generateFallbackContent(
  blockType: string,
  ctx: AiGenerationContext,
): Record<string, any> {
  const defaults = getDefaultProps(blockType);
  const companyName = ctx.company.name;

  // Personalize defaults with company name
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === "string") {
      defaults[key] = value
        .replace(/Acme Inc\./g, companyName)
        .replace(/Your Company/g, companyName)
        .replace(/our company/gi, companyName);
    }
  }

  // Set navbar/footer company name
  if (blockType === "navbar" || blockType === "footer") {
    if (defaults.companyName !== undefined) defaults.companyName = companyName;
  }
  if (blockType === "footer" && defaults.copyright !== undefined) {
    defaults.copyright = `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;
  }

  return defaults;
}

/**
 * Generate fallback blocks for an entire page.
 */
export function generateFallbackPage(
  layouts: BlockLayout[],
  ctx: AiGenerationContext,
): AiPageBlock[] {
  return layouts
    .filter((layout) => blockSchemas[layout.type])
    .map((layout) => ({
      type: layout.type,
      props: generateFallbackContent(layout.type, ctx),
    }));
}
