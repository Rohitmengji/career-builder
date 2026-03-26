/**
 * Job Generator — Intelligent job posting generation
 *
 * Upgrades from the basic job prompt in prompts.ts to a full-featured
 * job generation system with:
 *   - Experience-level intelligence (junior vs senior tone)
 *   - Company-type adaptation (startup vs enterprise style)
 *   - Region-based salary formatting
 *   - Industry-specific terminology
 *   - Role-specific requirement templates
 */

import type { AiTone, AiJobFormData } from "@/lib/ai/types";
import type { AiGenerationContext, CompanyProfile } from "@/lib/ai/context/contextEngine";

/* ================================================================== */
/*  Job generation input                                               */
/* ================================================================== */

export interface JobGenerationInput {
  /** Job title or role (e.g., "Senior Frontend Engineer") */
  role: string;
  /** Department (optional — will be inferred if missing) */
  department?: string;
  /** Experience level */
  experienceLevel: "entry" | "mid" | "senior" | "lead" | "executive";
  /** Location */
  location: string;
  /** Employment type */
  employmentType?: "full-time" | "part-time" | "contract" | "internship";
  /** Is remote */
  isRemote?: boolean;
  /** Additional instructions from user */
  instructions?: string;
  /** Existing partial data to preserve */
  existingData?: Partial<AiJobFormData>;
}

/* ================================================================== */
/*  Experience level intelligence                                      */
/* ================================================================== */

interface ExperienceLevelConfig {
  toneModifier: string;
  salaryMultiplier: number;
  requirementCount: { min: number; max: number };
  benefitCount: { min: number; max: number };
  descriptionLength: string;
  focusAreas: string[];
}

const EXPERIENCE_CONFIGS: Record<string, ExperienceLevelConfig> = {
  entry: {
    toneModifier: "Welcoming and encouraging. Emphasize learning, mentorship, and growth. This is for someone starting their career — avoid intimidating language. Use phrases like 'you will learn', 'you will be mentored', 'grow your skills'.",
    salaryMultiplier: 0.5,
    requirementCount: { min: 4, max: 6 },
    benefitCount: { min: 4, max: 5 },
    descriptionLength: "3-4 sentences. Focus on the learning opportunity and team support.",
    focusAreas: ["learning", "mentorship", "growth", "training", "collaboration"],
  },
  mid: {
    toneModifier: "Balanced and professional. This person has 3-5 years experience. They want autonomy and impact. Emphasize ownership, interesting problems, and career progression.",
    salaryMultiplier: 1.0,
    requirementCount: { min: 5, max: 7 },
    benefitCount: { min: 4, max: 6 },
    descriptionLength: "4-5 sentences. Focus on the role's impact and the team they'll join.",
    focusAreas: ["ownership", "impact", "technical depth", "career growth", "team collaboration"],
  },
  senior: {
    toneModifier: "Peer-level and respectful. This person has 5-10+ years experience. They're evaluating YOU as much as you're evaluating them. Emphasize technical challenges, architecture decisions, and leadership opportunity.",
    salaryMultiplier: 1.6,
    requirementCount: { min: 6, max: 8 },
    benefitCount: { min: 5, max: 6 },
    descriptionLength: "4-5 sentences. Focus on technical challenges, system scale, and impact.",
    focusAreas: ["architecture", "technical leadership", "mentoring", "system design", "strategic impact"],
  },
  lead: {
    toneModifier: "Strategic and visionary. This person leads teams and drives technical direction. Emphasize scope, organizational impact, and the team they'll build. Talk about scale and strategy.",
    salaryMultiplier: 2.0,
    requirementCount: { min: 6, max: 8 },
    benefitCount: { min: 5, max: 6 },
    descriptionLength: "4-6 sentences. Focus on scope, team building, and strategic direction.",
    focusAreas: ["team building", "technical strategy", "organizational impact", "cross-functional leadership", "roadmap ownership"],
  },
  executive: {
    toneModifier: "Executive and visionary. This is a C-suite or VP-level role. Emphasize company vision, board-level impact, and transformative opportunity. Use confident, strategic language.",
    salaryMultiplier: 3.0,
    requirementCount: { min: 5, max: 7 },
    benefitCount: { min: 5, max: 6 },
    descriptionLength: "4-6 sentences. Focus on company vision, transformation, and market impact.",
    focusAreas: ["vision", "transformation", "market strategy", "organizational design", "executive leadership"],
  },
};

/* ================================================================== */
/*  Region-based salary intelligence                                   */
/* ================================================================== */

interface SalaryRange {
  /** Base salary range for a mid-level role (USD equivalent) */
  baseMid: { min: number; max: number };
  /** Currency code */
  currency: string;
  /** Currency symbol */
  symbol: string;
  /** Formatting style */
  format: "us" | "eu" | "india";
}

const REGION_SALARIES: Record<string, SalaryRange> = {
  us: {
    baseMid: { min: 100000, max: 150000 },
    currency: "USD",
    symbol: "$",
    format: "us",
  },
  eu: {
    baseMid: { min: 60000, max: 95000 },
    currency: "EUR",
    symbol: "€",
    format: "eu",
  },
  india: {
    baseMid: { min: 1200000, max: 2500000 },
    currency: "INR",
    symbol: "₹",
    format: "india",
  },
  apac: {
    baseMid: { min: 80000, max: 130000 },
    currency: "USD",
    symbol: "$",
    format: "us",
  },
  latam: {
    baseMid: { min: 40000, max: 80000 },
    currency: "USD",
    symbol: "$",
    format: "us",
  },
  global: {
    baseMid: { min: 90000, max: 140000 },
    currency: "USD",
    symbol: "$",
    format: "us",
  },
};

/** Calculate salary range based on geo, experience level, and industry */
export function calculateSalaryRange(
  geo: CompanyProfile["geo"],
  experienceLevel: string,
  industry?: string,
): { min: string; max: string; currency: string } {
  const regionConfig = REGION_SALARIES[geo] || REGION_SALARIES.us;
  const expConfig = EXPERIENCE_CONFIGS[experienceLevel] || EXPERIENCE_CONFIGS.mid;

  // Industry multipliers (tech/fintech pay more)
  const industryMultipliers: Record<string, number> = {
    technology: 1.15,
    fintech: 1.2,
    saas: 1.1,
    healthcare: 1.05,
    consulting: 1.0,
    ecommerce: 1.0,
    education: 0.85,
    nonprofit: 0.75,
    manufacturing: 0.9,
    media: 0.9,
    other: 1.0,
  };

  const industryMul = industryMultipliers[industry || "technology"] || 1.0;

  const min = Math.round(regionConfig.baseMid.min * expConfig.salaryMultiplier * industryMul);
  const max = Math.round(regionConfig.baseMid.max * expConfig.salaryMultiplier * industryMul);

  return {
    min: String(min),
    max: String(max),
    currency: regionConfig.currency,
  };
}

/* ================================================================== */
/*  Company-type style modifiers                                       */
/* ================================================================== */

const COMPANY_TYPE_STYLE: Record<string, string> = {
  startup: `STARTUP STYLE:
- Emphasize impact and ownership ("You won't just fill a role — you'll shape the product")
- Mention fast pace, small team, wearing multiple hats
- Highlight equity/stock options
- Be authentic about challenges ("We move fast and break things — you'll thrive in ambiguity")
- Shorter, punchier descriptions`,

  scaleup: `SCALEUP STYLE:
- Emphasize growth moment ("We're at an inflection point — this is the rare window")
- Mention growing team, expanding markets, proven product
- Balance startup energy with emerging stability
- Highlight career trajectory as company grows
- Professional but energetic tone`,

  enterprise: `ENTERPRISE STYLE:
- Emphasize scale and stability ("Join a team of 10,000+ building products used by millions")
- Mention comprehensive benefits, structured career paths, global opportunities
- Use polished, corporate language (but avoid being boring)
- Highlight brand prestige, Fortune 500 perks, research opportunities
- Longer, more detailed descriptions`,

  agency: `AGENCY STYLE:
- Emphasize variety and creativity ("Every week brings a new challenge")
- Mention client diversity, portfolio building, collaborative culture
- Highlight creative freedom and skills development
- Be energetic and creative in tone
- Medium-length descriptions`,

  nonprofit: `NONPROFIT STYLE:
- Emphasize mission and impact ("Your work directly improves lives")
- Be transparent about the mission-driven nature
- Highlight meaningful work, supportive team, community impact
- Don't oversell compensation — focus on purpose and culture
- Warm, authentic tone`,
};

/* ================================================================== */
/*  Job generation prompt builder                                      */
/* ================================================================== */

export function buildJobGenerationPrompt(
  input: JobGenerationInput,
  ctx: AiGenerationContext,
): { system: string; user: string } {
  const expConfig = EXPERIENCE_CONFIGS[input.experienceLevel] || EXPERIENCE_CONFIGS.mid;
  const companyStyle = COMPANY_TYPE_STYLE[ctx.company.companyType] || COMPANY_TYPE_STYLE.startup;
  const salary = calculateSalaryRange(ctx.company.geo, input.experienceLevel, ctx.company.industry);

  const system = `You are a VP OF TALENT at a world-class ${ctx.company.industry} company.
You write job postings that attract top-tier candidates — not generic job board spam.
You output ONLY valid JSON.

ABSOLUTE RULES:
1. Output ONLY a single JSON object. No markdown. No code fences.
2. Use the EXACT field names listed below.
3. "department" must be one of: "Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"
4. "employmentType" must be one of: "full-time", "part-time", "contract", "internship"
5. "experienceLevel" must be one of: "entry", "mid", "senior", "lead", "executive"
6. "requirements" and "benefits" must be newline-separated items (no bullets or dashes)
7. "tags" must be comma-separated lowercase keywords
8. Salary must be realistic for ${ctx.company.geo.toUpperCase()} market, ${ctx.company.industry} industry
9. "isPublished" must be false (user approves before publishing)

EXPERIENCE LEVEL: ${input.experienceLevel.toUpperCase()}
${expConfig.toneModifier}

${companyStyle}

FOCUS AREAS for this level: ${expConfig.focusAreas.join(", ")}

SALARY GUIDANCE: ${salary.min}-${salary.max} ${salary.currency} range is typical for this level/geo/industry. Adjust based on role specifics.`;

  // Build existing data section
  let existingDataSection = "";
  if (input.existingData) {
    const filled = Object.entries(input.existingData)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "" && v !== false)
      .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`);
    if (filled.length > 0) {
      existingDataSection = `\nUSER HAS ALREADY FILLED:\n{\n${filled.join(",\n")}\n}\nKeep these values. Fill in everything else.`;
    }
  }

  const user = `Generate a ${input.experienceLevel}-level "${input.role}" job posting for ${ctx.company.name}.

COMPANY: ${ctx.company.name} (${ctx.company.companyType} in ${ctx.company.industry})
LOCATION: ${input.location}
REMOTE: ${input.isRemote ? "Yes, remote-friendly" : "On-site or hybrid"}
EMPLOYMENT: ${input.employmentType || "full-time"}
GEO: ${ctx.company.geo}
${ctx.company.hiringGoals ? `HIRING FOCUS: ${ctx.company.hiringGoals}` : ""}
${input.instructions ? `ADDITIONAL INSTRUCTIONS: ${input.instructions}` : ""}
${existingDataSection}

Required JSON fields:
  "title": string — Exact job title (e.g., "Senior Frontend Engineer")
  "department": one of ["Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"]
  "location": string — City, State/Country
  "description": string — ${expConfig.descriptionLength}
  "employmentType": one of ["full-time", "part-time", "contract", "internship"]
  "experienceLevel": "${input.experienceLevel}"
  "salaryMin": string — Realistic number for this role/geo
  "salaryMax": string — Realistic number for this role/geo
  "isRemote": ${input.isRemote ?? false}
  "isPublished": false
  "requirements": string — ${expConfig.requirementCount.min}-${expConfig.requirementCount.max} newline-separated requirements
  "benefits": string — ${expConfig.benefitCount.min}-${expConfig.benefitCount.max} newline-separated benefits
  "tags": string — 4-6 comma-separated lowercase keywords

Respond with ONLY the JSON object.`;

  return { system, user };
}
