/**
 * AI Fallback — Template-based fallback when AI generation fails.
 *
 * When OpenAI is unavailable, rate-limited, or returns garbage,
 * we fall back to high-quality template blocks personalized with
 * the user's context (company name, industry, tone).
 *
 * This ensures the demo flow NEVER breaks — the user always gets
 * a usable career page even if AI is down.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { AiPageBlock, AiContext, AiTone } from "./types";

/* ================================================================== */
/*  Template cache (loaded once from disk)                             */
/* ================================================================== */

interface Template {
  id: string;
  name: string;
  blocks: AiPageBlock[];
}

const templateCache = new Map<string, Template>();

function loadTemplate(id: string): Template | null {
  if (templateCache.has(id)) return templateCache.get(id)!;

  try {
    const filePath = join(process.cwd(), "data", "templates", `${id}.json`);
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    const template: Template = { id: raw.id, name: raw.name, blocks: raw.blocks || [] };
    templateCache.set(id, template);
    return template;
  } catch {
    return null;
  }
}

function getAllTemplates(): Template[] {
  const ids = ["startup", "tech-company", "enterprise"];
  return ids.map(loadTemplate).filter(Boolean) as Template[];
}

/* ================================================================== */
/*  Industry → Template mapping                                        */
/* ================================================================== */

const INDUSTRY_TEMPLATE_MAP: Record<string, string> = {
  technology: "tech-company",
  saas: "tech-company",
  fintech: "tech-company",
  startup: "startup",
  healthcare: "enterprise",
  enterprise: "enterprise",
  manufacturing: "enterprise",
  consulting: "enterprise",
  education: "enterprise",
  ecommerce: "startup",
};

/* ================================================================== */
/*  Personalize template blocks with context                           */
/* ================================================================== */

function personalizeBlocks(
  blocks: AiPageBlock[],
  context?: AiContext,
  tone?: AiTone,
): AiPageBlock[] {
  const companyName = context?.companyName || "Your Company";

  return blocks.map((block) => {
    const props = { ...block.props };

    // Replace placeholder company names
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === "string") {
        props[key] = value
          .replace(/LaunchPad|TechCorp|GlobalTech/gi, companyName)
          .replace(/a Series B startup|a Fortune 500|a fast-growing/gi, getCompanyDescriptor(context));
      }
    }

    // Apply tone-specific tweaks to hero blocks
    if (block.type === "hero" && tone) {
      props.title = getToneTitle(tone, companyName);
      props.subtitle = getToneSubtitle(tone, companyName);
    }

    // Personalize navbar company name
    if (block.type === "navbar" && props.companyName) {
      props.companyName = companyName;
    }

    return { type: block.type, props };
  });
}

function getCompanyDescriptor(context?: AiContext): string {
  if (context?.companyType) return `a ${context.companyType}`;
  if (context?.industry) return `a leader in ${context.industry}`;
  return "an innovative company";
}

function getToneTitle(tone: AiTone, company: string): string {
  const titles: Record<AiTone, string> = {
    professional: "Build Your Future With Us",
    friendly: `Come Join the ${company} Family`,
    bold: "Move Fast. Build Bold. Change Everything.",
    minimal: "Work That Matters.",
    "hiring-focused": `${company} Is Hiring — Join Our Team`,
  };
  return titles[tone] || titles.professional;
}

function getToneSubtitle(tone: AiTone, company: string): string {
  const subs: Record<AiTone, string> = {
    professional: `Join ${company} and be part of a team that's shaping the future. Explore our open roles and find your next chapter.`,
    friendly: `We're a team of passionate people building something meaningful. Come see what we're about!`,
    bold: `We're building the future and we need exceptional people. No red tape. Just impact.`,
    minimal: `Open roles at ${company}.`,
    "hiring-focused": `We're growing fast and hiring across all teams. Check out our latest opportunities below.`,
  };
  return subs[tone] || subs.professional;
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Get fallback blocks when AI generation fails.
 * Selects the best template based on industry context, then
 * personalizes it with the user's company name and tone.
 */
export function getFallbackBlocks(
  context?: AiContext,
  tone?: AiTone,
): AiPageBlock[] {
  // 1. Try industry-matched template
  const industry = context?.industry || "technology";
  const templateId = INDUSTRY_TEMPLATE_MAP[industry.toLowerCase()] || "tech-company";
  let template = loadTemplate(templateId);

  // 2. Fall back to any available template
  if (!template) {
    const all = getAllTemplates();
    template = all[0] || null;
  }

  // 3. If somehow no templates exist, return minimal hardcoded blocks
  if (!template) {
    return getMinimalFallback(context, tone);
  }

  // 4. Personalize and return
  return personalizeBlocks(template.blocks, context, tone);
}

/**
 * Absolute last-resort fallback — hardcoded minimal blocks.
 * This should never be needed in production (templates exist on disk).
 */
function getMinimalFallback(context?: AiContext, tone?: AiTone): AiPageBlock[] {
  const company = context?.companyName || "Your Company";
  return [
    {
      type: "hero",
      props: {
        title: getToneTitle(tone || "professional", company),
        subtitle: getToneSubtitle(tone || "professional", company),
        ctaText: "View Open Positions",
        ctaLink: "#positions",
        textAlign: "center",
      },
    },
    {
      type: "features",
      props: {
        title: `Why ${company}?`,
        subtitle: "Here's what makes us a great place to work.",
        items: [
          { icon: "🚀", title: "Growth", desc: "Fast career progression and learning opportunities." },
          { icon: "🤝", title: "Culture", desc: "Collaborative, inclusive, and supportive team." },
          { icon: "⚖️", title: "Balance", desc: "Flexible schedules, remote options, and wellness perks." },
        ],
      },
    },
    {
      type: "content",
      props: {
        title: "Our Mission",
        body: `At ${company}, we're building something meaningful. Join us and make an impact.`,
        textAlign: "center",
      },
    },
    {
      type: "cta-button",
      props: {
        title: "Ready to Apply?",
        subtitle: "Browse our current openings and find your perfect role.",
        buttonText: "See All Jobs",
        buttonLink: "/jobs",
      },
    },
  ];
}
