/**
 * AI Assistant — Output Validator (Production-hardened)
 *
 * Validates AI-generated props against block schemas.
 * Sanitizes strings, rejects invalid structure, fills missing defaults.
 * This is the safety barrier — nothing passes to the editor without validation.
 */

import { blockSchemas, getDefaultProps, type BlockField } from "@/lib/blockSchemas";
import { AI_LIMITS } from "./types";
import type { AiPageBlock, AiJobFormData } from "./types";

export interface ValidationResult {
  valid: boolean;
  props: Record<string, any>;
  warnings: string[];
  errors: string[];
}

export interface PageValidationResult {
  valid: boolean;
  blocks: AiPageBlock[];
  warnings: string[];
  errors: string[];
}

/**
 * Parse and validate AI output against a block schema.
 * Returns sanitized props or detailed errors.
 */
export function validateAiOutput(
  blockType: string,
  raw: unknown,
): ValidationResult {
  const schema = blockSchemas[blockType];
  if (!schema) {
    return { valid: false, props: {}, warnings: [], errors: [`Unknown block type: "${blockType}"`] };
  }

  const defaults = getDefaultProps(blockType);
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Must be an object
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, props: defaults, warnings: [], errors: ["AI output is not a valid JSON object"] };
  }

  const input = raw as Record<string, any>;
  const result: Record<string, any> = {};

  // 2. Validate each field from schema
  for (const field of schema.fields) {
    const value = input[field.name];

    if (value === undefined || value === null) {
      // Use default
      result[field.name] = defaults[field.name];
      if (field.type !== "image" && field.type !== "boolean") {
        warnings.push(`Field "${field.name}" missing — using default`);
      }
      continue;
    }

    // Validate by type
    const validated = validateField(field, value);
    if (validated.error) {
      warnings.push(`Field "${field.name}": ${validated.error} — using default`);
      result[field.name] = defaults[field.name];
    } else {
      result[field.name] = validated.value;
    }
  }

  return {
    valid: errors.length === 0,
    props: result,
    warnings,
    errors,
  };
}

/**
 * Validate a full-page AI response (array of blocks).
 */
export function validatePageOutput(raw: unknown): PageValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, blocks: [], warnings: [], errors: ["AI output is not a valid JSON object"] };
  }

  const input = raw as Record<string, any>;
  const rawBlocks = input.blocks;

  if (!Array.isArray(rawBlocks)) {
    return { valid: false, blocks: [], warnings: [], errors: ["AI output missing 'blocks' array"] };
  }

  if (rawBlocks.length === 0) {
    return { valid: false, blocks: [], warnings: [], errors: ["AI returned empty blocks array"] };
  }

  // Cap at MAX_PAGE_BLOCKS
  const capped = rawBlocks.slice(0, AI_LIMITS.MAX_PAGE_BLOCKS);
  if (rawBlocks.length > AI_LIMITS.MAX_PAGE_BLOCKS) {
    warnings.push(`Truncated from ${rawBlocks.length} to ${AI_LIMITS.MAX_PAGE_BLOCKS} blocks`);
  }

  const validBlocks: AiPageBlock[] = [];

  for (let i = 0; i < capped.length; i++) {
    const block = capped[i];
    if (!block || typeof block !== "object" || !block.type) {
      warnings.push(`Block ${i + 1}: invalid structure — skipped`);
      continue;
    }

    const schema = blockSchemas[block.type];
    if (!schema) {
      warnings.push(`Block ${i + 1}: unknown type "${block.type}" — skipped`);
      continue;
    }

    // Validate props against schema
    const validation = validateAiOutput(block.type, block.props || {});
    if (validation.warnings.length > 0) {
      warnings.push(`Block ${i + 1} (${block.type}): ${validation.warnings.join("; ")}`);
    }

    validBlocks.push({
      type: block.type,
      props: validation.props,
    });
  }

  if (validBlocks.length === 0) {
    return { valid: false, blocks: [], warnings, errors: ["No valid blocks in AI response"] };
  }

  return {
    valid: true,
    blocks: validBlocks,
    warnings,
    errors,
  };
}

/* ================================================================== */
/*  Per-field validation                                                */
/* ================================================================== */

function validateField(
  field: BlockField,
  value: unknown,
): { value: any; error?: string } {
  switch (field.type) {
    case "text":
    case "textarea":
      if (typeof value !== "string") {
        return { value: String(value), error: "converted to string" };
      }
      return { value: sanitizeString(value) };

    case "select":
      if (typeof value !== "string") {
        return { value: field.default, error: "not a string" };
      }
      const allowed = field.options?.map((o) => o.value) || [];
      if (!allowed.includes(value)) {
        return { value: field.default, error: `"${value}" not in allowed values` };
      }
      return { value };

    case "boolean":
      return { value: Boolean(value) };

    case "image":
      if (typeof value !== "string") return { value: "" };
      // Only allow safe URL patterns
      if (value && !isValidImageUrl(value)) {
        return { value: "", error: "invalid image URL format" };
      }
      return { value: sanitizeString(value) };

    case "list":
      if (!Array.isArray(value)) {
        return { value: field.defaultItems || [], error: "not an array" };
      }
      const validatedItems = value
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => validateListItem(field, item))
        .slice(0, 20); // Cap at 20 items for safety
      return { value: validatedItems };

    default:
      return { value: typeof value === "string" ? sanitizeString(value) : String(value) };
  }
}

function validateListItem(
  field: BlockField,
  item: Record<string, any>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const sf of field.listFields || []) {
    const val = item[sf.name];
    result[sf.name] = typeof val === "string" ? sanitizeString(val) : (sf.default || "");
  }
  return result;
}

/* ================================================================== */
/*  Sanitization                                                       */
/* ================================================================== */

/**
 * Strip HTML tags, script content, and dangerous patterns.
 * Extra strict: also removes encoded entities and null bytes.
 */
function sanitizeString(str: string): string {
  return str
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Remove all HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove event handlers
    .replace(/on\w+\s*=/gi, "")
    // Remove dangerous protocols
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    // Remove HTML entities that could re-encode dangerous content
    .replace(/&#x?[0-9a-f]+;?/gi, "")
    // Collapse excessive whitespace
    .replace(/\s{3,}/g, "  ")
    .trim()
    // Cap string length at 500 chars for safety
    .slice(0, 500);
}

function isValidImageUrl(url: string): boolean {
  if (!url) return true; // empty is OK
  try {
    const u = new URL(url, "https://example.com");
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    // Could be a relative path like /api/media/file/xxx
    return url.startsWith("/") && !url.includes("<") && !url.includes("javascript:");
  }
}

/* ================================================================== */
/*  Job output validation                                              */
/* ================================================================== */

const VALID_DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"];
const VALID_EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const VALID_EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "executive"];

export interface JobValidationResult {
  valid: boolean;
  job: AiJobFormData;
  warnings: string[];
  errors: string[];
}

export function validateJobOutput(raw: unknown): JobValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      job: getDefaultJob(),
      warnings: [],
      errors: ["AI output is not a valid JSON object"],
    };
  }

  const input = raw as Record<string, any>;

  // Validate and sanitize each field
  const title = typeof input.title === "string" ? sanitizeString(input.title) : "";
  if (!title) errors.push("Missing title");

  let department = typeof input.department === "string" ? input.department : "";
  if (!VALID_DEPARTMENTS.includes(department)) {
    // Try case-insensitive match
    const match = VALID_DEPARTMENTS.find((d) => d.toLowerCase() === department.toLowerCase());
    if (match) {
      department = match;
    } else {
      warnings.push(`Invalid department "${department}" — defaulting to Engineering`);
      department = "Engineering";
    }
  }

  const location = typeof input.location === "string" ? sanitizeString(input.location) : "";
  if (!location) warnings.push("Missing location");

  const description = typeof input.description === "string" ? sanitizeString(input.description) : "";
  if (!description) warnings.push("Missing description");

  let employmentType = typeof input.employmentType === "string" ? input.employmentType : "full-time";
  if (!VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    warnings.push(`Invalid employment type "${employmentType}" — defaulting to full-time`);
    employmentType = "full-time";
  }

  let experienceLevel = typeof input.experienceLevel === "string" ? input.experienceLevel : "mid";
  if (!VALID_EXPERIENCE_LEVELS.includes(experienceLevel)) {
    warnings.push(`Invalid experience level "${experienceLevel}" — defaulting to mid`);
    experienceLevel = "mid";
  }

  // Salary: accept number or string
  let salaryMin = "";
  if (input.salaryMin !== undefined && input.salaryMin !== null) {
    const num = parseInt(String(input.salaryMin));
    if (!isNaN(num) && num > 0) salaryMin = String(num);
  }

  let salaryMax = "";
  if (input.salaryMax !== undefined && input.salaryMax !== null) {
    const num = parseInt(String(input.salaryMax));
    if (!isNaN(num) && num > 0) salaryMax = String(num);
  }

  const isRemote = typeof input.isRemote === "boolean" ? input.isRemote : false;
  const isPublished = typeof input.isPublished === "boolean" ? input.isPublished : false;

  const requirements = typeof input.requirements === "string"
    ? sanitizeString(input.requirements)
    : Array.isArray(input.requirements)
      ? input.requirements.map((r: any) => sanitizeString(String(r))).join("\n")
      : "";

  const benefits = typeof input.benefits === "string"
    ? sanitizeString(input.benefits)
    : Array.isArray(input.benefits)
      ? input.benefits.map((b: any) => sanitizeString(String(b))).join("\n")
      : "";

  const tags = typeof input.tags === "string"
    ? sanitizeString(input.tags)
    : Array.isArray(input.tags)
      ? input.tags.map((t: any) => sanitizeString(String(t))).join(", ")
      : "";

  return {
    valid: errors.length === 0,
    job: {
      title,
      department,
      location,
      description,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      isRemote,
      isPublished,
      requirements,
      benefits,
      tags,
    },
    warnings,
    errors,
  };
}

function getDefaultJob(): AiJobFormData {
  return {
    title: "",
    department: "Engineering",
    location: "",
    description: "",
    employmentType: "full-time",
    experienceLevel: "mid",
    salaryMin: "",
    salaryMax: "",
    isRemote: false,
    isPublished: false,
    requirements: "",
    benefits: "",
    tags: "",
  };
}

/**
 * Try to parse a JSON string from AI output.
 * Handles common LLM quirks: code fences, trailing commas, explanation text.
 */
export function parseAiJson(text: string): unknown {
  // Strip markdown code fences
  let cleaned = text
    .replace(/^```json?\s*/gm, "")
    .replace(/^```\s*/gm, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // ignore
  }

  // Try to extract JSON object from mixed content
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      // Remove trailing commas before } or ]
      const fixed = match[0]
        .replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(fixed);
    } catch {
      // ignore
    }
  }

  throw new Error("Could not parse AI response as JSON");
}
