/**
 * Context Engine — Makes AI smart by building rich, structured context
 *
 * NEVER call AI without context. This module builds a complete picture
 * of the company, industry, audience, and generation history before
 * any AI call is made.
 *
 * Replaces the simple `buildContextBlock()` in prompts.ts with a
 * full-featured context pipeline.
 */

import type {
  AiTone,
  AiIndustry,
  AiCompanyType,
  AiAudience,
} from "@/lib/ai/types";

/* ================================================================== */
/*  Core context type — everything AI needs to know                    */
/* ================================================================== */

export interface AiGenerationContext {
  /** Company identity */
  company: CompanyProfile;
  /** Content generation preferences */
  preferences: ContentPreferences;
  /** What already exists on the page/site */
  existing: ExistingContent;
  /** Memory from past generations (optional) */
  memory: GenerationMemory | null;
  /** Computed intelligence signals */
  signals: ContextSignals;
}

export interface CompanyProfile {
  name: string;
  industry: AiIndustry;
  companyType: AiCompanyType;
  /** Inferred from companyType — startup energy vs. enterprise stability */
  maturityLevel: "early" | "growth" | "established";
  /** Hiring intensity — how aggressively are they hiring */
  hiringIntensity: "passive" | "active" | "aggressive";
  /** Product category for industry-specific language */
  productCategory: string;
  /** Target geo for cultural/salary context */
  geo: "us" | "eu" | "india" | "apac" | "latam" | "global";
  /** Optional: company description for deeper personalization */
  description?: string;
  /** Optional: hiring goals text */
  hiringGoals?: string;
}

export interface ContentPreferences {
  tone: AiTone;
  audience: AiAudience;
  /** Content density — how much content per block */
  density: "compact" | "standard" | "detailed";
  /** Visual style hint */
  visualStyle: "modern" | "corporate" | "playful" | "minimal";
}

export interface ExistingContent {
  /** Block types already on the page */
  existingBlockTypes: string[];
  /** Page type being edited */
  pageType: string;
  /** Total blocks across all pages (site-wide) */
  totalSiteBlocks: number;
  /** Slugs of existing pages */
  existingPages: string[];
}

export interface GenerationMemory {
  /** Previously accepted block types (user liked these) */
  acceptedBlockTypes: string[];
  /** Previously rejected suggestions */
  rejectedBlockTypes: string[];
  /** Preferred tone from history */
  preferredTone: AiTone | null;
  /** Block structures that worked well */
  successfulStructures: string[][];
  /** Total generations for this tenant */
  totalGenerations: number;
  /** Acceptance rate (0-1) */
  acceptanceRate: number;
}

export interface ContextSignals {
  /** Is this a first-time generation (no memory) */
  isFirstGeneration: boolean;
  /** Should we include more detailed instructions */
  needsGuidance: boolean;
  /** Company size bucket for content calibration */
  companySizeBucket: "small" | "medium" | "large";
  /** Recommended number of blocks for this context */
  recommendedBlockCount: number;
  /** Whether job data is available */
  hasJobData: boolean;
}

/* ================================================================== */
/*  Context builder — the main entry point                             */
/* ================================================================== */

export interface BuildContextInput {
  companyName: string;
  industry?: AiIndustry;
  companyType?: AiCompanyType;
  tone?: AiTone;
  audience?: AiAudience;
  hiringGoals?: string;
  description?: string;
  geo?: string;
  existingBlockTypes?: string[];
  pageType?: string;
  existingPages?: string[];
  totalSiteBlocks?: number;
  memory?: GenerationMemory | null;
}

/**
 * Build a complete generation context from user inputs.
 * Infers missing values using sensible defaults based on what's provided.
 */
export function buildGenerationContext(input: BuildContextInput): AiGenerationContext {
  const industry = input.industry || "technology";
  const companyType = input.companyType || "startup";
  const tone = input.tone || "professional";
  const audience = input.audience || "general";

  const company: CompanyProfile = {
    name: input.companyName || "Company",
    industry,
    companyType,
    maturityLevel: inferMaturityLevel(companyType),
    hiringIntensity: inferHiringIntensity(companyType, input.hiringGoals),
    productCategory: inferProductCategory(industry),
    geo: inferGeo(input.geo),
    description: input.description,
    hiringGoals: input.hiringGoals,
  };

  const preferences: ContentPreferences = {
    tone,
    audience,
    density: inferDensity(companyType, tone),
    visualStyle: inferVisualStyle(companyType, tone),
  };

  const existing: ExistingContent = {
    existingBlockTypes: input.existingBlockTypes || [],
    pageType: input.pageType || "home",
    totalSiteBlocks: input.totalSiteBlocks || 0,
    existingPages: input.existingPages || [],
  };

  const memory = input.memory || null;

  const signals: ContextSignals = {
    isFirstGeneration: !memory || memory.totalGenerations === 0,
    needsGuidance: !memory || memory.totalGenerations < 3,
    companySizeBucket: inferCompanySizeBucket(companyType),
    recommendedBlockCount: inferRecommendedBlockCount(companyType, existing.pageType),
    hasJobData: false, // Set by caller after fetching job data
  };

  return { company, preferences, existing, memory, signals };
}

/* ================================================================== */
/*  Context → prompt string serializer                                 */
/* ================================================================== */

/**
 * Serialize context into a string for injection into AI prompts.
 * This replaces the old `buildContextBlock()` function.
 */
export function serializeContext(ctx: AiGenerationContext): string {
  const parts: string[] = [];

  // Company identity
  parts.push(`COMPANY: ${ctx.company.name}`);
  parts.push(`INDUSTRY: ${ctx.company.industry} (${ctx.company.productCategory})`);
  parts.push(`COMPANY TYPE: ${ctx.company.companyType} (${ctx.company.maturityLevel} stage)`);
  parts.push(`HIRING MODE: ${ctx.company.hiringIntensity}`);
  parts.push(`GEO: ${ctx.company.geo}`);

  if (ctx.company.description) {
    parts.push(`ABOUT: ${ctx.company.description}`);
  }
  if (ctx.company.hiringGoals) {
    parts.push(`HIRING GOALS: ${ctx.company.hiringGoals}`);
  }

  // Content preferences
  parts.push(`\nCONTENT STYLE:`);
  parts.push(`  Tone: ${ctx.preferences.tone}`);
  parts.push(`  Audience: ${ctx.preferences.audience}`);
  parts.push(`  Density: ${ctx.preferences.density}`);
  parts.push(`  Visual style: ${ctx.preferences.visualStyle}`);

  // Existing content awareness
  if (ctx.existing.existingBlockTypes.length > 0) {
    parts.push(`\nEXISTING BLOCKS ON PAGE: ${ctx.existing.existingBlockTypes.join(", ")}`);
    parts.push(`DO NOT duplicate these block types unless specifically appropriate.`);
  }
  if (ctx.existing.existingPages.length > 0) {
    parts.push(`EXISTING SITE PAGES: ${ctx.existing.existingPages.join(", ")}`);
  }

  // Memory-based guidance
  if (ctx.memory && ctx.memory.totalGenerations > 0) {
    parts.push(`\nLEARNED PREFERENCES (from ${ctx.memory.totalGenerations} previous generations):`);
    if (ctx.memory.acceptedBlockTypes.length > 0) {
      parts.push(`  User prefers: ${ctx.memory.acceptedBlockTypes.slice(0, 10).join(", ")}`);
    }
    if (ctx.memory.rejectedBlockTypes.length > 0) {
      parts.push(`  User dislikes: ${ctx.memory.rejectedBlockTypes.slice(0, 10).join(", ")}`);
    }
    if (ctx.memory.preferredTone) {
      parts.push(`  Preferred tone: ${ctx.memory.preferredTone}`);
    }
    parts.push(`  Acceptance rate: ${Math.round(ctx.memory.acceptanceRate * 100)}%`);
  }

  // Signals
  if (ctx.signals.isFirstGeneration) {
    parts.push(`\nNOTE: This is the user's FIRST generation — provide high-quality, impressive defaults.`);
  }

  return parts.join("\n");
}

/* ================================================================== */
/*  Inference helpers — derive intelligence from minimal input         */
/* ================================================================== */

function inferMaturityLevel(companyType: AiCompanyType): "early" | "growth" | "established" {
  switch (companyType) {
    case "startup": return "early";
    case "scaleup": return "growth";
    case "agency": return "growth";
    case "enterprise": return "established";
    case "nonprofit": return "established";
    default: return "growth";
  }
}

function inferHiringIntensity(
  companyType: AiCompanyType,
  hiringGoals?: string,
): "passive" | "active" | "aggressive" {
  if (hiringGoals && /urgent|asap|immediately|rapid|fast|scale/i.test(hiringGoals)) {
    return "aggressive";
  }
  switch (companyType) {
    case "startup": return "aggressive";
    case "scaleup": return "active";
    case "enterprise": return "active";
    default: return "active";
  }
}

function inferProductCategory(industry: AiIndustry): string {
  const map: Record<AiIndustry, string> = {
    technology: "Software & Platform",
    fintech: "Financial Technology",
    healthcare: "Health & Life Sciences",
    education: "EdTech & Learning",
    ecommerce: "Commerce & Marketplace",
    saas: "Cloud Software",
    consulting: "Professional Services",
    manufacturing: "Industrial & Manufacturing",
    media: "Media & Entertainment",
    nonprofit: "Social Impact",
    other: "General Business",
  };
  return map[industry] || "General Business";
}

function inferGeo(geo?: string): CompanyProfile["geo"] {
  if (!geo) return "us";
  const lower = geo.toLowerCase();
  if (/india|mumbai|bangalore|delhi|hyderabad/i.test(lower)) return "india";
  if (/europe|uk|london|berlin|paris|amsterdam/i.test(lower)) return "eu";
  if (/japan|korea|singapore|australia|sydney/i.test(lower)) return "apac";
  if (/brazil|mexico|argentina|colombia/i.test(lower)) return "latam";
  if (/global|international|worldwide/i.test(lower)) return "global";
  return "us";
}

function inferDensity(companyType: AiCompanyType, tone: AiTone): ContentPreferences["density"] {
  if (tone === "minimal") return "compact";
  if (companyType === "enterprise") return "detailed";
  return "standard";
}

function inferVisualStyle(companyType: AiCompanyType, tone: AiTone): ContentPreferences["visualStyle"] {
  if (tone === "minimal") return "minimal";
  if (tone === "bold") return "modern";
  if (companyType === "enterprise") return "corporate";
  if (companyType === "startup") return "modern";
  return "modern";
}

function inferCompanySizeBucket(companyType: AiCompanyType): ContextSignals["companySizeBucket"] {
  switch (companyType) {
    case "startup": return "small";
    case "scaleup":
    case "agency": return "medium";
    case "enterprise": return "large";
    default: return "medium";
  }
}

function inferRecommendedBlockCount(companyType: AiCompanyType, pageType: string): number {
  // Base counts by page type
  const baseCounts: Record<string, number> = {
    home: 10,
    careers: 10,
    jobs: 9,
    about: 11,
    culture: 11,
    benefits: 11,
    contact: 8,
  };

  const base = baseCounts[pageType] || 10;

  // Enterprise gets more blocks (more content to show)
  if (companyType === "enterprise") return Math.min(base + 2, 14);
  // Startups get fewer but punchier blocks
  if (companyType === "startup") return Math.max(base - 1, 8);

  return base;
}
