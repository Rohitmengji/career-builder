/**
 * Site Generator — Block Generation
 *
 * Generates blocks for a single page using AI + schema validation.
 * Reuses the existing AI provider, prompts, and validator pipeline.
 */

import { blockSchemas, getDefaultProps, type BlockSchema } from "@/lib/blockSchemas";
import type { AiTone, AiIndustry, AiCompanyType, AiAudience, AiPageBlock } from "@/lib/ai/types";
import type { SiteGenerationInput, PageType, PAGE_BLUEPRINTS } from "./siteSchema";
import { validateAiOutput } from "@/lib/ai/validator";

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
  home: `This is the MAIN career landing page — the most important page of the site.
It should feel like a top-tier SaaS career page (think Stripe, Notion, Figma).

SECTION-BY-SECTION INSTRUCTIONS (in order):
1. NAVBAR: Company logo area with navigation links (Careers, About, Culture, Benefits, Jobs)
2. HERO: Large, bold headline (6-8 words max). Something aspirational — "Build What Matters" or "Shape the Future of [Industry]". Subtitle should explain the opportunity (15-25 words). Include a CTA button like "View Open Roles" or "Explore Careers".
3. SOCIAL-PROOF: Logos or trust signals — awards, certifications, "Best Places to Work", press mentions. Use 4-6 items. Short one-liner descriptions.
4. FEATURES: 3-5 key reasons to work here. Each with an icon-worthy title (2-4 words) and a compelling description (15-25 words). Think: "Unlimited Growth", "Global Impact", "Ship Fast", "Own Your Work".
5. IMAGE-TEXT-GRID: Visual storytelling section. 3-4 cards with titles and descriptions showing different aspects of working there (engineering, design, culture, growth).
6. STATS-COUNTER: Impressive numbers — employees, countries, funding raised, products shipped, customer count. Use 4-6 stats with short labels. Make numbers feel ambitious.
7. TESTIMONIAL: 2-3 employee quotes. Use realistic names, real job titles, genuine-sounding quotes about growth, culture, or impact. NOT generic praise.
8. ACCORDION: FAQ section — "How do I apply?", "What's the interview process?", "Do you offer remote work?", "What's the onboarding like?". 4-6 items with detailed answers.
9. CTA-BUTTON: Strong closing CTA — "Ready to Join Us?" or "Your Next Chapter Starts Here". Button text: "See Open Positions".
10. FOOTER: Standard footer with company name, copyright, and navigation links.`,

  careers: `This is the main CAREERS landing page — can serve as the primary careers hub.
It should feel modern, energetic, and conversion-focused.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Career-focused headline — "We're Hiring" or "Find Your Next Big Thing". Subtitle about opportunity and growth. CTA: "Browse Open Roles".
3. SOCIAL-PROOF: Company awards, recognitions, employer brand signals. 4-6 items.
4. FEATURES: What makes this company special as an employer? 4-5 pillars like "Learning Budget", "Remote-First", "Equity for All", "Unlimited PTO", "Career Ladders".
5. STATS-COUNTER: Key hiring/company metrics — open roles, team size, growth rate, employee satisfaction score.
6. IMAGE-TEXT-GRID: Department spotlights — Engineering, Design, Product, Marketing, Operations. Each with a short pitch.
7. TESTIMONIAL: 2-3 employee stories about career growth, mentorship, or exciting projects.
8. ACCORDION: Common candidate questions about culture, process, benefits, remote policy.
9. CTA-BUTTON: "Explore Open Positions" or "Start Your Application".
10. FOOTER: Standard footer.`,

  jobs: `This is the JOB LISTING page — purely functional and conversion-oriented.
Candidates come here to find and apply to roles.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Short, focused — "Open Positions" or "Find Your Role". Subtitle about the variety/number of roles. Keep it minimal.
3. SEARCH-BAR: Job search/filter interface. Make it prominent.
4. JOB-CATEGORY: Department categories — Engineering, Design, Product, Marketing, Sales, Operations. Each with an icon-worthy title and brief count/description.
5. JOB-LIST: The main job listing section. This is the core of the page.
6. NOTIFICATION-BANNER: "Can't find what you're looking for? Set up a job alert!" — encourage engagement.
7. JOIN-TALENT-NETWORK: For candidates who don't find a match — capture their info for future roles.
8. CTA-BUTTON: "Don't See Your Role? Reach Out Directly" or "Submit a General Application".
9. FOOTER: Standard footer.`,

  about: `This is the ABOUT US page — telling the company's story and mission.
It should feel authentic, human, and inspiring. Think storytelling, not marketing.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Mission-driven headline — "Our Mission" or "Why We Exist" or "Building [X] for [Y]". Subtitle should capture the company's purpose in one sentence.
3. CONTENT: Company origin story — founding story, what problem they're solving, the vision. 2-3 paragraphs of authentic, compelling narrative. NOT corporate boilerplate.
4. VIDEO-AND-TEXT: "Meet Our Team" or "Inside Our Offices" — a section that pairs visual content with a personal narrative about the company culture.
5. FEATURES: Company values — 4-6 core values with meaningful descriptions. E.g., "Radical Transparency", "Customer Obsession", "Bias for Action", "Continuous Learning".
6. IMAGE-TEXT-GRID: Leadership or team spotlights. 3-4 profiles with titles and brief descriptions of their journey.
7. TEAM-GRID: Extended team section — leadership team with names, titles, and short bios.
8. STATS-COUNTER: Company milestones — founded year, team size, countries, customers served, products shipped.
9. SOCIAL-PROOF: Press mentions, partner logos, or industry recognitions.
10. CTA-BUTTON: "Join Our Story" or "Be Part of What's Next". Button: "View Open Roles".
11. FOOTER: Standard footer.`,

  culture: `This is the CULTURE & VALUES page — the heart and soul of the employer brand.
It should feel vibrant, genuine, and immersive. Show, don't just tell.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Energetic, culture-forward headline — "Life at [Company]" or "This Is How We Work" or "Culture Is Our Superpower". Subtitle about what makes the culture unique.
3. FEATURES: 4-6 core cultural pillars. Not generic values — specific, distinctive pillars like "Maker Fridays", "No Meeting Wednesdays", "Open Salary Policy", "Quarterly Hackathons", "Learning Stipend".
4. IMAGE-TEXT-GRID: Visual culture showcase — team events, office spaces, remote work moments, hackathons. 4-6 cards with captions.
5. LIGHT-BOX: Photo gallery of team moments, events, celebrations. 4-8 images with short captions.
6. SOCIAL-PROOF: Awards — "Best Places to Work", "Top Startup Culture", Glassdoor ratings. 4-6 items.
7. TESTIMONIAL: 3-4 employee quotes about the culture — specific stories, not generic praise. Use diverse roles and backgrounds.
8. VIDEO-AND-TEXT: "A Day in the Life" or "How We Collaborate" — narrative section about daily work life.
9. STATS-COUNTER: Culture metrics — employee retention rate, internal promotion rate, average tenure, eNPS score.
10. CTA-BUTTON: "Experience Our Culture" or "Join the Team". Button: "See Open Roles".
11. FOOTER: Standard footer.`,

  benefits: `This is the BENEFITS & PERKS page — showing the total rewards package.
It should feel generous, organized, and easy to scan. Think comparison-card layouts.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Clear, benefit-focused headline — "Total Rewards" or "We Invest in You" or "Benefits That Matter". Subtitle about the philosophy behind benefits.
3. FEATURES: 4-6 major benefit categories as cards — "Health & Wellness", "Financial Security", "Time Off & Flexibility", "Learning & Growth", "Family & Life", "Perks & Extras". Each with 2-3 sentence descriptions.
4. STATS-COUNTER: Key benefit numbers — PTO days, 401k match %, learning budget, parental leave weeks, wellness stipend amount. Make them impressive.
5. ACCORDION: Detailed benefit breakdowns — expandable sections for each category with specifics. 6-8 items covering health insurance, retirement, PTO policy, parental leave, remote work, learning budget, equipment stipend, etc.
6. IMAGE-TEXT-GRID: Lifestyle benefits — remote work flexibility, office perks, team retreats, professional development. 3-4 visual cards.
7. SHOW-HIDE-TAB: Tabbed comparison — Benefits by role type or by location. Show different benefit tiers or packages.
8. TESTIMONIAL: 2-3 employee quotes specifically about benefits — work-life balance, parental leave experience, professional development.
9. SOCIAL-PROOF: Benefits-related awards or certifications — "Top Benefits by Glassdoor", "Family-Friendly Workplace".
10. CTA-BUTTON: "Ready to Join?" or "See What's Open". Button: "Explore Open Positions".
11. FOOTER: Standard footer.`,

  contact: `This is the CONTACT / GET IN TOUCH page — action-oriented and concise.
Keep it focused and easy to use. Not too many sections.

SECTION-BY-SECTION INSTRUCTIONS:
1. NAVBAR: Standard navigation
2. HERO: Welcoming headline — "Let's Talk" or "Get In Touch" or "We'd Love to Hear From You". Short subtitle about being open to conversations.
3. CONTENT: Contact details — email, phone, office addresses, social media links. Clear and easy to find. Include recruiter contact info.
4. IMAGE-TEXT-GRID: Office locations or department contacts — 2-3 cards with location/team details.
5. JOIN-TALENT-NETWORK: "Stay Connected" — talent community signup for future opportunities.
6. ACCORDION: FAQ for candidates — "How long does the hiring process take?", "Can I apply to multiple roles?", "Do you sponsor visas?". 4-6 items.
7. CTA-BUTTON: "Browse Open Positions" or "Submit Your Resume".
8. FOOTER: Standard footer.`,
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

  const system = `You are an elite career site content generator. You create world-class career pages that rival Stripe, Notion, Figma, and Linear.
You output ONLY valid JSON with a "blocks" array.

ABSOLUTE RULES:
1. Output a JSON object: { "blocks": [...] }
2. Each block: { "type": "<block-type>", "props": { ... } }
3. Generate blocks in EXACTLY this order: ${blockTypes.join(" → ")}
4. For ALL "image" fields, use "" (empty string). NEVER generate image URLs.
5. No HTML tags. No markdown. No code fences. No explanations.
6. Use the EXACT field names from the schemas below.
7. For "select" fields, use ONLY the allowed values from the schema.
8. Keep content consistent with the brand voice provided.

CONTENT QUALITY RULES:
- Titles: 4-8 words, punchy and memorable. Use power verbs. NO generic phrases like "Welcome to Our Company".
- Subtitles: 12-25 words, explain the benefit or value proposition clearly.
- Body text: 20-60 words, specific and actionable. Mention real-sounding details.
- List items: 3-5 items per list section. Each item should feel distinct and valuable.
- Stats/numbers: Use specific, impressive numbers (not round numbers). E.g., "127 countries" not "100+ countries". "4.8/5 Glassdoor" not "High rating".
- Employee names: Use realistic, diverse names with actual job titles.
- Testimonial quotes: Write genuine-sounding quotes with specific details about projects, growth, or experiences. 20-40 words each.
- CTAs: Strong, action-oriented button text (2-5 words). "View Open Roles", "Start Your Journey", "Explore Careers".
- NEVER use generic filler like "Lorem ipsum", "Your Company", "We are a company that...", or "Click here".
- NEVER repeat the same phrase across different sections.
- Each section must have a DISTINCT purpose — no redundant content.

DESIGN-AWARE CONTENT:
- Write content that looks great in a card-based, modern grid layout
- Headings should work as standalone visual anchors
- Keep consistent voice and energy across all sections
- Build narrative flow — each section should logically follow the previous one
- End pages with urgency and a clear next step

${brandVoice}

COMPANY: ${input.companyName}
INDUSTRY: ${input.industry}
COMPANY TYPE: ${input.companyType}`;

  const pageInstructions = PAGE_CONTENT_PROMPTS[pageType] || PAGE_CONTENT_PROMPTS.home;

  const user = `Generate production-quality content for the "${pageType.toUpperCase()}" page of ${input.companyName}'s career site.

PAGE PURPOSE & STRUCTURE:
${pageInstructions}

CONTEXT:
${input.hiringGoals ? `• Hiring focus: ${input.hiringGoals}` : ""}
${input.audience ? `• Target audience: ${input.audience}` : ""}
${input.prompt ? `• Additional instructions: ${input.prompt}` : ""}
${jobContext || ""}

Company: ${input.companyName} (${input.companyType} in ${input.industry} industry)
Tone: ${input.tone}

Block schemas (use these EXACT field names and types):
${blockRefs}

Generate EXACTLY ${blockTypes.length} blocks in this order: ${blockTypes.join(", ")}

IMPORTANT REMINDERS:
- Every text field must have meaningful, specific content (NO empty strings for text fields)
- Image fields must be "" (empty string)
- List fields should have 3-5 items each
- Make each section feel like it was written by a senior content strategist
- Content should flow as a cohesive page narrative, not isolated sections

Output format:
{
  "blocks": [
    { "type": "${blockTypes[0]}", "props": { ... } },
    ...${blockTypes.length > 1 ? `\n    { "type": "${blockTypes[blockTypes.length - 1]}", "props": { ... } }` : ""}
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
  const seenTitles = new Set<string>();

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

    // Post-validation: fill empty text fields and check duplicates
    const props = validation.props;
    const schema = blockSchemas[actualType];
    if (schema) {
      for (const field of schema.fields) {
        // Check for empty text fields that should have content
        if (
          (field.type === "text" || field.type === "textarea") &&
          typeof props[field.name] === "string" &&
          props[field.name].trim() === "" &&
          field.default
        ) {
          props[field.name] = field.default;
          warnings.push(`Block ${i + 1} (${actualType}): empty "${field.name}" — filled with default`);
        }
      }

      // Detect duplicate titles across blocks
      const titleField = props.title || props.heading || props.name;
      if (typeof titleField === "string" && titleField.trim()) {
        const normalized = titleField.trim().toLowerCase();
        if (seenTitles.has(normalized)) {
          warnings.push(`Block ${i + 1} (${actualType}): duplicate title "${titleField}"`);
        }
        seenTitles.add(normalized);
      }
    }

    blocks.push({
      type: actualType,
      props,
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
            careers: `Join the ${companyName} Team`,
            jobs: "Find Your Next Role",
            about: `Our Story — ${companyName}`,
            culture: `Life at ${companyName}`,
            benefits: "Benefits That Matter",
            contact: "Let's Connect",
          };
          defaults.title = titles[pageType] || defaults.title;
        }
        if (defaults.subtitle !== undefined) {
          const subtitles: Record<PageType, string> = {
            home: `Join a team that's shaping the future. Explore open roles and discover why top talent chooses ${companyName}.`,
            careers: `We're looking for passionate people to help us build something extraordinary. See what's open.`,
            jobs: `Browse our open positions and find the role that matches your skills and ambitions.`,
            about: `Learn about our mission, our values, and the people who make ${companyName} a great place to work.`,
            culture: `Discover what makes our culture unique — from how we work to how we celebrate together.`,
            benefits: `We believe in taking care of our people. Explore our comprehensive benefits package.`,
            contact: `Have questions about careers at ${companyName}? We'd love to hear from you.`,
          };
          defaults.subtitle = subtitles[pageType] || defaults.subtitle;
        }
      }
      if (bt === "features" && defaults.title !== undefined) {
        defaults.title = `Why ${companyName}?`;
        if (defaults.subtitle !== undefined) {
          defaults.subtitle = "What makes us different — and why our team loves working here.";
        }
      }
      if (bt === "cta-button") {
        if (defaults.title !== undefined) defaults.title = "Ready to Make an Impact?";
        if (defaults.subtitle !== undefined) defaults.subtitle = `Your next chapter starts at ${companyName}. Explore open roles and apply today.`;
        if (defaults.buttonText !== undefined) defaults.buttonText = "View Open Positions";
      }
      if (bt === "social-proof" && defaults.title !== undefined) {
        defaults.title = "Trusted & Recognized";
      }
      if (bt === "stats-counter" && defaults.title !== undefined) {
        defaults.title = `${companyName} by the Numbers`;
      }
      if (bt === "testimonial" && defaults.title !== undefined) {
        defaults.title = "Hear From Our Team";
      }
      if (bt === "accordion" && defaults.title !== undefined) {
        defaults.title = "Frequently Asked Questions";
      }

      return { type: bt, props: defaults };
    });
}
