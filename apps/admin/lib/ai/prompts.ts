/**
 * AI Assistant — Prompt Builder (Production-hardened)
 *
 * Constructs structured prompts that produce JSON output
 * matching block schemas exactly. Context-aware with
 * industry, audience, and company type support.
 */

import { blockSchemas, type BlockSchema, type BlockField } from "@/lib/blockSchemas";
import type { AiRequest, AiContext, AiTone } from "./types";
import type { AiJobRequest } from "./types";
import { AI_LIMITS } from "./types";

/* ================================================================== */
/*  Schema → prompt description                                        */
/* ================================================================== */

function describeField(field: BlockField): string {
  const req = field.default !== undefined ? "" : " (required)";
  switch (field.type) {
    case "text":
      return `"${field.name}": string — ${field.label}${req}`;
    case "textarea":
      return `"${field.name}": string — ${field.label} (can be longer)${req}`;
    case "select":
      return `"${field.name}": one of [${field.options?.map((o) => `"${o.value}"`).join(", ")}] — ${field.label}`;
    case "boolean":
      return `"${field.name}": true or false — ${field.label}`;
    case "image":
      return `"${field.name}": "" — ${field.label}. ALWAYS empty string.`;
    case "list":
      const subFields = field.listFields?.map((sf) => `"${sf.name}": string`).join(", ") || "";
      return `"${field.name}": array of objects with { ${subFields} } — ${field.label}`;
    default:
      return `"${field.name}": string — ${field.label}`;
  }
}

function describeSchema(schema: BlockSchema): string {
  return schema.fields.map(describeField).join("\n  ");
}

/* ================================================================== */
/*  Tone instructions                                                  */
/* ================================================================== */

const TONE_INSTRUCTIONS: Record<AiTone, string> = {
  professional:
    "Use a professional, corporate tone. Clear, confident, and authoritative.",
  friendly:
    "Use a warm, approachable, and conversational tone. Make it feel human.",
  bold:
    "Use bold, energetic language. Short punchy sentences. Create excitement.",
  minimal:
    "Use minimal, clean copy. Very concise — every word counts.",
  "hiring-focused":
    "Write specifically for recruiting/hiring. Emphasize culture, growth, and opportunity.",
};

/* ================================================================== */
/*  Build system prompt (hardened)                                     */
/* ================================================================== */

function buildSystemPrompt(): string {
  return `You are a career site content generator. You output ONLY valid JSON.

ABSOLUTE RULES — NEVER BREAK THESE:
1. Output ONLY a single JSON object. No markdown. No code fences. No explanations. No text before or after.
2. Match field names and types EXACTLY as specified.
3. For "select" fields, use ONLY the listed allowed values.
4. For "list" fields, generate 3–5 items unless instructed otherwise.
5. For "image" fields, ALWAYS return "" (empty string). Never generate URLs.
6. For "boolean" fields, use true or false (not strings).
7. Titles: max 8 words. Subtitles: max 25 words. Descriptions: max 50 words.
8. NEVER include HTML tags, markdown, or special formatting in any text value.
9. All strings must be plain text, properly escaped for JSON.
10. Keep content concise, professional, and relevant to career/recruitment sites.`;
}

/* ================================================================== */
/*  Build full-page system prompt                                      */
/* ================================================================== */

function buildPageSystemPrompt(): string {
  const blockTypes = getAvailableBlockTypes()
    .map((b) => `"${b.type}" — ${b.label} (${b.category})`)
    .join("\n  ");

  return `You are a career site page generator. You output ONLY valid JSON.

ABSOLUTE RULES:
1. Output a JSON object with a single key "blocks" containing an array.
2. Each block has: { "type": "<block-type>", "props": { ... } }
3. Generate 4–6 blocks that form a coherent career page.
4. Start with a "hero" block. End with a CTA or footer block.
5. For ALL "image" fields inside props, use "" (empty string).
6. No HTML tags in any text. Plain text only.
7. No markdown. No code fences. No explanations.
8. Titles: max 8 words. Subtitles: max 25 words.

Available block types:
  ${blockTypes}

Popular page structures:
- Careers: hero → features → testimonial → team → cta-button
- Job listing: hero → search-bar → job-list → join-talent-network
- Culture: hero → video-and-text → team → social-proof → cta-button`;
}

/* ================================================================== */
/*  Build user prompt for each action                                  */
/* ================================================================== */

export function buildPrompt(request: AiRequest): { system: string; user: string } {
  // Full-page generation has its own flow
  if (request.action === "generate-page") {
    return buildPagePrompt(request);
  }

  const schema = blockSchemas[request.blockType];
  if (!schema) {
    throw new Error(`Unknown block type: ${request.blockType}`);
  }

  const system = buildSystemPrompt();
  const toneInstruction = request.tone
    ? TONE_INSTRUCTIONS[request.tone]
    : TONE_INSTRUCTIONS.professional;

  const contextBlock = buildContextBlock(request.context);
  const schemaDesc = describeSchema(schema);

  // Truncate user prompt to limit
  const userInstruction = request.prompt
    ? request.prompt.slice(0, AI_LIMITS.MAX_PROMPT_LENGTH)
    : "";

  let userPrompt = "";

  switch (request.action) {
    case "generate":
      userPrompt = `Generate content for a "${schema.label}" block on a career site.

${contextBlock}

Tone: ${toneInstruction}

${userInstruction ? `Additional instructions: ${userInstruction}` : ""}

Required JSON fields:
  ${schemaDesc}

Respond with ONLY the JSON object.`;
      break;

    case "improve":
      userPrompt = `Improve the content for a "${schema.label}" block.

Current content:
${JSON.stringify(request.currentProps, null, 2)}

${contextBlock}

Tone: ${toneInstruction}

${userInstruction ? `Instruction: ${userInstruction}` : "Make it more compelling, clear, and engaging."}

Required JSON fields:
  ${schemaDesc}

Keep the same structure. Improve text quality. Respond with ONLY the JSON object.`;
      break;

    case "expand":
      userPrompt = `Expand the content for a "${schema.label}" block.

Current content:
${JSON.stringify(request.currentProps, null, 2)}

${contextBlock}

Tone: ${toneInstruction}

${userInstruction ? `Instruction: ${userInstruction}` : "Add more detail, fill empty fields, expand lists to 4–5 entries."}

Required JSON fields:
  ${schemaDesc}

Keep existing content but add more. Respond with ONLY the JSON object.`;
      break;
  }

  return { system, user: userPrompt };
}

/* ================================================================== */
/*  Full-page prompt                                                   */
/* ================================================================== */

function buildPagePrompt(request: AiRequest): { system: string; user: string } {
  const system = buildPageSystemPrompt();
  const contextBlock = buildContextBlock(request.context);
  const toneInstruction = request.tone
    ? TONE_INSTRUCTIONS[request.tone]
    : TONE_INSTRUCTIONS.professional;

  const userInstruction = request.prompt
    ? request.prompt.slice(0, AI_LIMITS.MAX_PROMPT_LENGTH)
    : "Create a professional careers page";

  // Build a mini-schema reference for each block type so the AI knows
  // which props each block expects. Keep it compact.
  const blockRefs = getAvailableBlockTypes()
    .filter((b) => !["spacer", "divider", "navigate-back", "basic-image", "basic-button"].includes(b.type))
    .slice(0, 15) // Limit to keep prompt size down
    .map((b) => {
      const schema = blockSchemas[b.type];
      const fields = schema.fields.map((f) => {
        if (f.type === "image") return `"${f.name}": ""`;
        if (f.type === "boolean") return `"${f.name}": ${f.default ?? false}`;
        if (f.type === "select") return `"${f.name}": "${f.default || f.options?.[0]?.value || ""}"`;
        if (f.type === "list") return `"${f.name}": [...]`;
        return `"${f.name}": "string"`;
      }).join(", ");
      return `  "${b.type}": { ${fields} }`;
    })
    .join("\n");

  const user = `${userInstruction}

${contextBlock}

Tone: ${toneInstruction}

Block prop schemas (use these exact field names):
${blockRefs}

Generate 4–6 blocks. Output format:
{
  "blocks": [
    { "type": "hero", "props": { ... } },
    { "type": "features", "props": { ... } },
    ...
  ]
}

Respond with ONLY the JSON object.`;

  return { system, user };
}

/* ================================================================== */
/*  Context block (enhanced)                                           */
/* ================================================================== */

function buildContextBlock(context?: AiContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.companyName) parts.push(`Company: ${context.companyName}`);
  if (context.industry) parts.push(`Industry: ${context.industry}`);
  if (context.companyType) parts.push(`Company type: ${context.companyType}`);
  if (context.audience) parts.push(`Target audience: ${context.audience}`);
  if (context.pageType) parts.push(`Page type: ${context.pageType}`);
  if (context.existingBlockTypes?.length) {
    parts.push(`Existing blocks on page: ${context.existingBlockTypes.join(", ")}`);
  }
  return parts.length > 0 ? `Context:\n${parts.join("\n")}` : "";
}

/* ================================================================== */
/*  Available block types for generation suggestions                   */
/* ================================================================== */

export function getAvailableBlockTypes(): { type: string; label: string; category: string }[] {
  return Object.entries(blockSchemas).map(([type, schema]) => ({
    type,
    label: schema.label,
    category: schema.category,
  }));
}

/* ================================================================== */
/*  Job generation prompt                                              */
/* ================================================================== */

const JOB_DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"];
const JOB_EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const JOB_EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "executive"];

export function buildJobPrompt(request: AiJobRequest): { system: string; user: string } {
  const system = `You are a professional job posting generator for career sites. You output ONLY valid JSON.

ABSOLUTE RULES:
1. Output ONLY a single JSON object. No markdown. No code fences. No explanations.
2. Generate realistic, compelling job postings that attract top talent.
3. Use the exact field names and types specified below.
4. "department" must be one of: ${JOB_DEPARTMENTS.map((d) => `"${d}"`).join(", ")}
5. "employmentType" must be one of: ${JOB_EMPLOYMENT_TYPES.map((t) => `"${t}"`).join(", ")}
6. "experienceLevel" must be one of: ${JOB_EXPERIENCE_LEVELS.map((l) => `"${l}"`).join(", ")}
7. "requirements" should be newline-separated bullet points (plain text, no bullets or dashes).
8. "benefits" should be newline-separated items (plain text, no bullets or dashes).
9. "tags" should be comma-separated keywords (lowercase).
10. Salary ranges should be realistic for the role, industry, and location.
11. "description" should be 3-5 sentences covering the role, team, and impact.
12. "isRemote" and "isPublished" must be boolean true or false.
13. salaryMin and salaryMax must be numeric strings (e.g., "120000").`;

  const toneInstruction = request.tone
    ? TONE_INSTRUCTIONS[request.tone]
    : TONE_INSTRUCTIONS.professional;

  const contextBlock = buildContextBlock(request.context);

  const userInstruction = request.prompt
    ? request.prompt.slice(0, AI_LIMITS.MAX_PROMPT_LENGTH)
    : "";

  // If user has partially filled the form, include that as context
  let existingData = "";
  if (request.currentData) {
    const filled = Object.entries(request.currentData)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "" && v !== false)
      .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`);
    if (filled.length > 0) {
      existingData = `\nThe user has already filled in these fields (keep these values unless they conflict with instructions):\n{\n${filled.join(",\n")}\n}`;
    }
  }

  const user = `Generate a complete job posting for a career site.

${userInstruction ? `Instructions: ${userInstruction}` : "Create a compelling job posting for a tech company."}

${contextBlock}
${existingData}

Tone: ${toneInstruction}

Required JSON fields:
  "title": string — Job title (e.g., "Senior Frontend Engineer")
  "department": one of [${JOB_DEPARTMENTS.map((d) => `"${d}"`).join(", ")}]
  "location": string — City, State/Country (e.g., "San Francisco, CA")
  "description": string — 3-5 sentences about the role
  "employmentType": one of [${JOB_EMPLOYMENT_TYPES.map((t) => `"${t}"`).join(", ")}]
  "experienceLevel": one of [${JOB_EXPERIENCE_LEVELS.map((l) => `"${l}"`).join(", ")}]
  "salaryMin": string — Numeric string (e.g., "120000")
  "salaryMax": string — Numeric string (e.g., "180000")
  "isRemote": boolean
  "isPublished": false
  "requirements": string — Newline-separated requirements (5-8 items)
  "benefits": string — Newline-separated benefits (4-6 items)
  "tags": string — Comma-separated tags (lowercase, 4-6 tags)

Respond with ONLY the JSON object.`;

  return { system, user };
}
