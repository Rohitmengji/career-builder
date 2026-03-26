/**
 * Structure Generator — Deterministic layout intelligence
 *
 * Instead of asking AI to "generate a page" (which produces random layouts),
 * this module generates a STRUCTURED block layout based on:
 *   1. Page type (home, jobs, about, culture, benefits, contact)
 *   2. Company context (startup vs enterprise, industry)
 *   3. User memory (what they liked/rejected before)
 *   4. Content density preferences
 *
 * The AI then ONLY fills in content — it does NOT decide structure.
 * Structure is DETERMINISTIC. Content is AI-generated.
 *
 * This is the core architecture upgrade: separate STRUCTURE from CONTENT.
 */

import { blockSchemas } from "@/lib/blockSchemas";
import type { AiGenerationContext } from "@/lib/ai/context/contextEngine";

/* ================================================================== */
/*  Block layout — what the structure generator produces                */
/* ================================================================== */

export interface BlockLayout {
  /** Block type from blockSchemas */
  type: string;
  /** Visual variant (e.g., hero: "split" | "centered" | "image-right") */
  variant: string;
  /** How important this block is (1 = critical, 5 = optional) */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Content density for this specific block */
  density: "compact" | "standard" | "detailed";
  /** Unique role in the page (prevents duplicate purposes) */
  role: string;
}

export interface PageStructure {
  /** Ordered list of blocks for this page */
  layout: BlockLayout[];
  /** Total block count */
  blockCount: number;
  /** Human-readable reasoning for the structure */
  reasoning: string;
}

/* ================================================================== */
/*  Block role definitions — each block serves ONE purpose              */
/* ================================================================== */

/** Every block on a page must have a distinct role */
type BlockRole =
  | "navigation"
  | "hero-impression"
  | "social-trust"
  | "value-proposition"
  | "content-narrative"
  | "visual-storytelling"
  | "data-proof"
  | "employee-voice"
  | "team-showcase"
  | "job-search"
  | "job-categories"
  | "job-listing"
  | "faq-answers"
  | "engagement-cta"
  | "notification"
  | "talent-capture"
  | "media-gallery"
  | "tabbed-content"
  | "application-tracking"
  | "closing-cta"
  | "site-footer";

/* ================================================================== */
/*  Block variant definitions                                          */
/* ================================================================== */

const BLOCK_VARIANTS: Record<string, string[]> = {
  hero: ["centered", "split-left", "split-right", "minimal"],
  navbar: ["light", "dark", "transparent"],
  footer: ["light", "dark"],
  features: ["grid-3", "grid-2", "list"],
  testimonial: ["single-quote", "multi-card", "carousel"],
  "stats-counter": ["horizontal", "grid-4", "highlighted"],
  "image-text-grid": ["grid-3", "grid-2", "alternating"],
  "social-proof": ["logo-bar", "card-grid"],
  "cta-button": ["centered", "split", "banner"],
  "team-grid": ["grid-4", "grid-3", "featured"],
  accordion: ["simple", "bordered", "highlighted"],
  content: ["centered", "left-aligned", "two-column"],
  "video-and-text": ["video-left", "video-right"],
  "light-box": ["grid-3", "grid-4", "masonry"],
  "show-hide-tab": ["horizontal-tabs", "vertical-tabs"],
  "notification-banner": ["info", "success", "warning"],
};

/** Pick variant based on context */
function pickVariant(blockType: string, ctx: AiGenerationContext): string {
  const variants = BLOCK_VARIANTS[blockType];
  if (!variants || variants.length === 0) return "default";

  // Use context to pick intelligently
  if (blockType === "hero") {
    if (ctx.company.companyType === "enterprise") return "centered";
    if (ctx.company.companyType === "startup") return "split-left";
    if (ctx.preferences.tone === "minimal") return "minimal";
    return "centered";
  }

  if (blockType === "navbar") {
    if (ctx.preferences.visualStyle === "minimal") return "transparent";
    if (ctx.preferences.tone === "bold") return "dark";
    return "light";
  }

  if (blockType === "footer") {
    return ctx.preferences.visualStyle === "minimal" ? "light" : "dark";
  }

  if (blockType === "features") {
    const itemCount = ctx.preferences.density === "compact" ? 3 : 4;
    return itemCount <= 3 ? "grid-3" : "grid-2";
  }

  // Default: first variant
  return variants[0];
}

/* ================================================================== */
/*  Page structure templates — deterministic block sequences            */
/* ================================================================== */

interface StructureTemplate {
  /** Block type */
  type: string;
  /** Role this block plays */
  role: BlockRole;
  /** Priority (1 = must have, 5 = nice to have) */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Only include for certain company types */
  companyTypes?: string[];
  /** Exclude for certain company types */
  excludeCompanyTypes?: string[];
  /** Only include for certain page types */
  requiredForPageType?: boolean;
}

const PAGE_STRUCTURES: Record<string, StructureTemplate[]> = {
  home: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "social-proof", role: "social-trust", priority: 2 },
    { type: "features", role: "value-proposition", priority: 1, requiredForPageType: true },
    { type: "stats-counter", role: "data-proof", priority: 2 },
    { type: "image-text-grid", role: "visual-storytelling", priority: 3 },
    { type: "testimonial", role: "employee-voice", priority: 2 },
    { type: "team-grid", role: "team-showcase", priority: 3, companyTypes: ["startup", "scaleup"] },
    { type: "accordion", role: "faq-answers", priority: 3 },
    { type: "cta-button", role: "closing-cta", priority: 1, requiredForPageType: true },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  careers: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "social-proof", role: "social-trust", priority: 2 },
    { type: "features", role: "value-proposition", priority: 1, requiredForPageType: true },
    { type: "stats-counter", role: "data-proof", priority: 2 },
    { type: "image-text-grid", role: "visual-storytelling", priority: 3 },
    { type: "testimonial", role: "employee-voice", priority: 2 },
    { type: "accordion", role: "faq-answers", priority: 3 },
    { type: "cta-button", role: "closing-cta", priority: 1, requiredForPageType: true },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  jobs: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "search-bar", role: "job-search", priority: 1, requiredForPageType: true },
    { type: "job-category", role: "job-categories", priority: 2 },
    { type: "search-results", role: "job-listing", priority: 1, requiredForPageType: true },
    { type: "notification-banner", role: "notification", priority: 4 },
    { type: "join-talent-network", role: "talent-capture", priority: 2 },
    { type: "cta-button", role: "closing-cta", priority: 2 },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  about: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "content", role: "content-narrative", priority: 1, requiredForPageType: true },
    { type: "video-and-text", role: "media-gallery", priority: 3 },
    { type: "features", role: "value-proposition", priority: 2 },
    { type: "image-text-grid", role: "visual-storytelling", priority: 3 },
    { type: "team-grid", role: "team-showcase", priority: 2 },
    { type: "stats-counter", role: "data-proof", priority: 2 },
    { type: "social-proof", role: "social-trust", priority: 3 },
    { type: "cta-button", role: "closing-cta", priority: 1, requiredForPageType: true },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  culture: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "features", role: "value-proposition", priority: 1, requiredForPageType: true },
    { type: "image-text-grid", role: "visual-storytelling", priority: 2 },
    { type: "light-box", role: "media-gallery", priority: 3 },
    { type: "social-proof", role: "social-trust", priority: 3 },
    { type: "testimonial", role: "employee-voice", priority: 2 },
    { type: "video-and-text", role: "content-narrative", priority: 3 },
    { type: "stats-counter", role: "data-proof", priority: 3 },
    { type: "cta-button", role: "closing-cta", priority: 1, requiredForPageType: true },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  benefits: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "features", role: "value-proposition", priority: 1, requiredForPageType: true },
    { type: "stats-counter", role: "data-proof", priority: 2 },
    { type: "accordion", role: "faq-answers", priority: 2 },
    { type: "image-text-grid", role: "visual-storytelling", priority: 3 },
    { type: "show-hide-tab", role: "tabbed-content", priority: 3 },
    { type: "testimonial", role: "employee-voice", priority: 3 },
    { type: "social-proof", role: "social-trust", priority: 4 },
    { type: "cta-button", role: "closing-cta", priority: 1, requiredForPageType: true },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
  contact: [
    { type: "navbar", role: "navigation", priority: 1, requiredForPageType: true },
    { type: "hero", role: "hero-impression", priority: 1, requiredForPageType: true },
    { type: "content", role: "content-narrative", priority: 1, requiredForPageType: true },
    { type: "image-text-grid", role: "visual-storytelling", priority: 3 },
    { type: "join-talent-network", role: "talent-capture", priority: 2 },
    { type: "accordion", role: "faq-answers", priority: 3 },
    { type: "cta-button", role: "closing-cta", priority: 2 },
    { type: "footer", role: "site-footer", priority: 1, requiredForPageType: true },
  ],
};

/* ================================================================== */
/*  Structure generator — the main entry point                         */
/* ================================================================== */

/**
 * Generate a deterministic page structure based on context.
 *
 * Rules enforced:
 *   - Min 8 blocks, max 14 blocks (configurable by context)
 *   - No duplicate block types (except where logically valid)
 *   - Logical order: navigation → hero → content → CTA → footer
 *   - Required blocks always included (priority 1)
 *   - Optional blocks filtered by company type and priority
 *   - Memory-aware: prefer blocks the user has accepted before
 */
export function generateStructure(
  pageType: string,
  ctx: AiGenerationContext,
): PageStructure {
  const normalizedPageType = pageType === "careers" ? "home" : pageType;
  const templates = PAGE_STRUCTURES[normalizedPageType] || PAGE_STRUCTURES.home;

  // Step 1: Start with required blocks (priority 1 or requiredForPageType)
  const required = templates.filter(
    (t) => t.priority === 1 || t.requiredForPageType,
  );

  // Step 2: Filter optional blocks by company type
  const optional = templates.filter(
    (t) => t.priority > 1 && !t.requiredForPageType,
  ).filter((t) => {
    if (t.companyTypes && !t.companyTypes.includes(ctx.company.companyType)) return false;
    if (t.excludeCompanyTypes && t.excludeCompanyTypes.includes(ctx.company.companyType)) return false;
    return true;
  });

  // Step 3: Sort optional by priority + memory preference
  const scored = optional.map((t) => {
    let score = (6 - t.priority) * 10; // Higher priority = higher score

    // Boost blocks the user has accepted before
    if (ctx.memory?.acceptedBlockTypes.includes(t.type)) {
      score += 15;
    }
    // Penalize blocks the user has rejected before
    if (ctx.memory?.rejectedBlockTypes.includes(t.type)) {
      score -= 20;
    }

    return { ...t, score };
  }).sort((a, b) => b.score - a.score);

  // Step 4: Pick blocks up to recommended count
  const targetCount = ctx.signals.recommendedBlockCount;
  const requiredCount = required.length;
  const optionalSlots = Math.max(0, targetCount - requiredCount);
  const selectedOptional = scored.slice(0, optionalSlots);

  // Step 5: Merge and maintain logical order
  const allSelected = [...required, ...selectedOptional];
  const ordered = sortByTemplateOrder(allSelected, templates);

  // Step 6: Validate — every block type must exist in blockSchemas
  const validated = ordered.filter((t) => blockSchemas[t.type]);

  // Step 7: Enforce constraints
  const constrained = enforceConstraints(validated, ctx);

  // Step 8: Build final layout with variants
  const layout: BlockLayout[] = constrained.map((t) => ({
    type: t.type,
    variant: pickVariant(t.type, ctx),
    priority: t.priority,
    density: ctx.preferences.density,
    role: t.role,
  }));

  const reasoning = buildReasoning(layout, ctx, pageType);

  return {
    layout,
    blockCount: layout.length,
    reasoning,
  };
}

/* ================================================================== */
/*  Helper: sort blocks by their order in the template                 */
/* ================================================================== */

function sortByTemplateOrder(
  selected: StructureTemplate[],
  templates: StructureTemplate[],
): StructureTemplate[] {
  const orderMap = new Map<string, number>();
  templates.forEach((t, i) => orderMap.set(t.type, i));

  return [...selected].sort((a, b) => {
    const orderA = orderMap.get(a.type) ?? 999;
    const orderB = orderMap.get(b.type) ?? 999;
    return orderA - orderB;
  });
}

/* ================================================================== */
/*  Helper: enforce structural constraints                             */
/* ================================================================== */

function enforceConstraints(
  blocks: StructureTemplate[],
  ctx: AiGenerationContext,
): StructureTemplate[] {
  const result = [...blocks];

  // Constraint 1: Must start with navbar
  if (result.length > 0 && result[0].type !== "navbar") {
    const navIdx = result.findIndex((b) => b.type === "navbar");
    if (navIdx > 0) {
      const [nav] = result.splice(navIdx, 1);
      result.unshift(nav);
    }
  }

  // Constraint 2: Hero must be second (right after navbar)
  if (result.length > 1 && result[1].type !== "hero") {
    const heroIdx = result.findIndex((b) => b.type === "hero");
    if (heroIdx > 1) {
      const [hero] = result.splice(heroIdx, 1);
      result.splice(1, 0, hero);
    }
  }

  // Constraint 3: Footer must be last
  if (result.length > 0 && result[result.length - 1].type !== "footer") {
    const footerIdx = result.findIndex((b) => b.type === "footer");
    if (footerIdx >= 0 && footerIdx < result.length - 1) {
      const [footer] = result.splice(footerIdx, 1);
      result.push(footer);
    }
  }

  // Constraint 4: CTA must be second-to-last (before footer)
  const ctaIdx = result.findIndex((b) => b.type === "cta-button");
  const footerIdx = result.findIndex((b) => b.type === "footer");
  if (ctaIdx >= 0 && footerIdx >= 0 && ctaIdx < footerIdx - 1) {
    const [cta] = result.splice(ctaIdx, 1);
    // Insert just before footer
    const newFooterIdx = result.findIndex((b) => b.type === "footer");
    result.splice(newFooterIdx, 0, cta);
  }

  // Constraint 5: No duplicate block types (deduplicate)
  const seen = new Set<string>();
  const deduped: StructureTemplate[] = [];
  for (const block of result) {
    if (!seen.has(block.type)) {
      seen.add(block.type);
      deduped.push(block);
    }
  }

  // Constraint 6: Min 8 blocks (pad with safe defaults if needed)
  // Only pad if we're significantly under — don't add random blocks
  if (deduped.length < 8) {
    const padOptions: StructureTemplate[] = [
      { type: "social-proof", role: "social-trust", priority: 3 },
      { type: "stats-counter", role: "data-proof", priority: 3 },
      { type: "testimonial", role: "employee-voice", priority: 3 },
      { type: "accordion", role: "faq-answers", priority: 3 },
    ];

    for (const opt of padOptions) {
      if (deduped.length >= 8) break;
      if (!seen.has(opt.type) && blockSchemas[opt.type]) {
        // Insert before CTA/footer
        const insertIdx = deduped.findIndex((b) => b.type === "cta-button" || b.type === "footer");
        if (insertIdx >= 0) {
          deduped.splice(insertIdx, 0, opt);
        } else {
          deduped.push(opt);
        }
        seen.add(opt.type);
      }
    }
  }

  // Constraint 7: Max 14 blocks
  if (deduped.length > 14) {
    // Remove lowest priority blocks from the middle (keep nav, hero, cta, footer)
    const protected_types = new Set(["navbar", "hero", "cta-button", "footer"]);
    const removable = deduped
      .map((b, i) => ({ ...b, index: i }))
      .filter((b) => !protected_types.has(b.type))
      .sort((a, b) => b.priority - a.priority); // Highest priority number = lowest importance

    let removeCount = deduped.length - 14;
    const removeIndices = new Set<number>();
    for (const block of removable) {
      if (removeCount <= 0) break;
      removeIndices.add(block.index);
      removeCount--;
    }

    return deduped.filter((_, i) => !removeIndices.has(i));
  }

  return deduped;
}

/* ================================================================== */
/*  Helper: build human-readable reasoning                             */
/* ================================================================== */

function buildReasoning(layout: BlockLayout[], ctx: AiGenerationContext, pageType: string): string {
  const parts: string[] = [];

  parts.push(`Generated ${layout.length}-block structure for "${pageType}" page.`);
  parts.push(`Company: ${ctx.company.name} (${ctx.company.companyType}, ${ctx.company.industry}).`);
  parts.push(`Style: ${ctx.preferences.tone} tone, ${ctx.preferences.density} density.`);

  const requiredCount = layout.filter((b) => b.priority === 1).length;
  const optionalCount = layout.length - requiredCount;
  parts.push(`${requiredCount} required + ${optionalCount} contextual blocks.`);

  if (ctx.memory && ctx.memory.totalGenerations > 0) {
    parts.push(`Memory-informed: ${ctx.memory.totalGenerations} previous generations, ${Math.round(ctx.memory.acceptanceRate * 100)}% acceptance rate.`);
  }

  return parts.join(" ");
}

/* ================================================================== */
/*  Utility: get block types from structure                            */
/* ================================================================== */

/** Extract ordered block type list from a PageStructure */
export function getBlockTypes(structure: PageStructure): string[] {
  return structure.layout.map((b) => b.type);
}

/** Get the variant for a specific block in the structure */
export function getBlockVariant(structure: PageStructure, blockType: string): string {
  const block = structure.layout.find((b) => b.type === blockType);
  return block?.variant || "default";
}
