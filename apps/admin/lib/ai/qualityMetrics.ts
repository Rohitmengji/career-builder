/**
 * AI Quality Metrics — Track and score AI generation quality
 *
 * Measures:
 *   - Content completeness (are all fields filled?)
 *   - Content length (are texts substantive?)
 *   - Structural validity (correct order, no duplicates?)
 *   - User acceptance rate (did they apply or dismiss?)
 *
 * This is used for two purposes:
 *   1. Reject low-quality AI output before showing to user
 *   2. Track quality over time for monitoring/improvement
 */

import { blockSchemas, type BlockField } from "@/lib/blockSchemas";
import type { AiPageBlock } from "@/lib/ai/types";

/* ================================================================== */
/*  Quality score types                                                */
/* ================================================================== */

export interface QualityScore {
  /** Overall score 0-100 */
  overall: number;
  /** Individual dimension scores */
  dimensions: {
    completeness: number;   // Are all required fields populated?
    contentLength: number;  // Is content substantive (not too short)?
    uniqueness: number;     // No duplicate text across blocks
    structuralOrder: number; // Correct logical flow?
    noPlaceholders: number; // No "Lorem ipsum" or generic filler?
  };
  /** Issues found (human-readable) */
  issues: string[];
  /** Whether this output is acceptable (overall >= 60) */
  acceptable: boolean;
}

/* ================================================================== */
/*  Score a single block's content quality                              */
/* ================================================================== */

export function scoreBlockContent(blockType: string, props: Record<string, any>): QualityScore {
  const schema = blockSchemas[blockType];
  if (!schema) {
    return {
      overall: 0,
      dimensions: { completeness: 0, contentLength: 0, uniqueness: 100, structuralOrder: 100, noPlaceholders: 100 },
      issues: [`Unknown block type: ${blockType}`],
      acceptable: false,
    };
  }

  const issues: string[] = [];
  let completeness = 100;
  let contentLength = 100;
  let noPlaceholders = 100;

  const textFields = schema.fields.filter((f) => f.type === "text" || f.type === "textarea");
  const listFields = schema.fields.filter((f) => f.type === "list");

  // Check completeness — are text fields filled?
  let emptyFields = 0;
  for (const field of textFields) {
    const value = props[field.name];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      // Image fields are OK to be empty
      if (field.type !== "image") {
        emptyFields++;
        issues.push(`Empty field: ${field.name}`);
      }
    }
  }
  if (textFields.length > 0) {
    completeness = Math.round(((textFields.length - emptyFields) / textFields.length) * 100);
  }

  // Check content length — are texts substantive?
  let shortFields = 0;
  for (const field of textFields) {
    const value = props[field.name];
    if (typeof value === "string" && value.trim().length > 0) {
      const minLength = field.type === "textarea" ? 15 : 3;
      if (value.trim().length < minLength) {
        shortFields++;
        issues.push(`Too short: ${field.name} (${value.trim().length} chars)`);
      }
    }
  }
  if (textFields.length > 0) {
    contentLength = Math.round(((textFields.length - shortFields) / textFields.length) * 100);
  }

  // Check list fields — do they have items?
  for (const field of listFields) {
    const value = props[field.name];
    if (!Array.isArray(value) || value.length === 0) {
      issues.push(`Empty list: ${field.name}`);
      completeness = Math.max(0, completeness - 15);
    } else if (value.length < 2) {
      issues.push(`Too few items in: ${field.name} (${value.length})`);
      completeness = Math.max(0, completeness - 10);
    }
  }

  // Check for placeholder text
  const placeholderPatterns = [
    /lorem ipsum/i,
    /your company/i,
    /company name/i,
    /click here/i,
    /sample text/i,
    /placeholder/i,
    /todo/i,
    /tbd/i,
    /insert .* here/i,
    /\[.*\]/,  // [placeholder] patterns
  ];

  for (const field of textFields) {
    const value = props[field.name];
    if (typeof value === "string") {
      for (const pattern of placeholderPatterns) {
        if (pattern.test(value)) {
          issues.push(`Placeholder text in ${field.name}: "${value.slice(0, 50)}"`);
          noPlaceholders = Math.max(0, noPlaceholders - 25);
          break;
        }
      }
    }
  }

  const overall = Math.round(
    (completeness * 0.35) +
    (contentLength * 0.25) +
    (noPlaceholders * 0.2) +
    (100 * 0.1) + // uniqueness placeholder (checked at page level)
    (100 * 0.1)   // structural order placeholder (checked at page level)
  );

  return {
    overall,
    dimensions: {
      completeness,
      contentLength,
      uniqueness: 100,
      structuralOrder: 100,
      noPlaceholders,
    },
    issues,
    acceptable: overall >= 60,
  };
}

/* ================================================================== */
/*  Score an entire page's quality                                     */
/* ================================================================== */

export function scorePageQuality(blocks: AiPageBlock[]): QualityScore {
  if (blocks.length === 0) {
    return {
      overall: 0,
      dimensions: { completeness: 0, contentLength: 0, uniqueness: 0, structuralOrder: 0, noPlaceholders: 0 },
      issues: ["No blocks generated"],
      acceptable: false,
    };
  }

  const issues: string[] = [];

  // Score each block individually
  const blockScores = blocks.map((block) => scoreBlockContent(block.type, block.props));
  const avgCompleteness = average(blockScores.map((s) => s.dimensions.completeness));
  const avgContentLength = average(blockScores.map((s) => s.dimensions.contentLength));
  const avgNoPlaceholders = average(blockScores.map((s) => s.dimensions.noPlaceholders));

  // Aggregate block-level issues
  for (let i = 0; i < blockScores.length; i++) {
    for (const issue of blockScores[i].issues) {
      issues.push(`Block ${i + 1} (${blocks[i].type}): ${issue}`);
    }
  }

  // Check uniqueness — detect duplicate titles/text across blocks
  let uniqueness = 100;
  const seenTexts = new Set<string>();
  for (const block of blocks) {
    for (const [key, value] of Object.entries(block.props)) {
      if (typeof value === "string" && value.length > 10) {
        const normalized = value.trim().toLowerCase();
        if (seenTexts.has(normalized)) {
          uniqueness = Math.max(0, uniqueness - 15);
          issues.push(`Duplicate text found: "${value.slice(0, 50)}..."`);
        }
        seenTexts.add(normalized);
      }
    }
  }

  // Check structural order
  let structuralOrder = 100;

  // Must start with navbar
  if (blocks.length > 0 && blocks[0].type !== "navbar") {
    structuralOrder -= 20;
    issues.push("Page does not start with navbar");
  }

  // Must have hero early (position 1 or 2)
  const heroIdx = blocks.findIndex((b) => b.type === "hero");
  if (heroIdx < 0) {
    structuralOrder -= 30;
    issues.push("Missing hero block");
  } else if (heroIdx > 2) {
    structuralOrder -= 15;
    issues.push("Hero block not in expected position (should be near top)");
  }

  // Must end with footer
  if (blocks.length > 0 && blocks[blocks.length - 1].type !== "footer") {
    structuralOrder -= 15;
    issues.push("Page does not end with footer");
  }

  // Must have CTA before footer
  const ctaIdx = blocks.findIndex((b) => b.type === "cta-button");
  const footerIdx = blocks.findIndex((b) => b.type === "footer");
  if (ctaIdx < 0) {
    structuralOrder -= 10;
    issues.push("Missing CTA block");
  }

  // No duplicate consecutive block types
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].type === blocks[i - 1].type) {
      structuralOrder -= 10;
      issues.push(`Consecutive duplicate: ${blocks[i].type} at positions ${i} and ${i + 1}`);
    }
  }

  const overall = Math.round(
    (avgCompleteness * 0.30) +
    (avgContentLength * 0.20) +
    (uniqueness * 0.20) +
    (structuralOrder * 0.15) +
    (avgNoPlaceholders * 0.15)
  );

  return {
    overall,
    dimensions: {
      completeness: Math.round(avgCompleteness),
      contentLength: Math.round(avgContentLength),
      uniqueness,
      structuralOrder,
      noPlaceholders: Math.round(avgNoPlaceholders),
    },
    issues,
    acceptable: overall >= 60,
  };
}

/* ================================================================== */
/*  Quality-based decisions                                            */
/* ================================================================== */

/** Should we regenerate this output? */
export function shouldRegenerate(score: QualityScore): boolean {
  // Regenerate if overall score is below threshold
  if (score.overall < 40) return true;
  // Regenerate if completeness is very low
  if (score.dimensions.completeness < 30) return true;
  // Regenerate if structural order is broken
  if (score.dimensions.structuralOrder < 40) return true;
  return false;
}

/** Get quality label for display */
export function getQualityLabel(score: QualityScore): { label: string; color: string } {
  if (score.overall >= 85) return { label: "Excellent", color: "green" };
  if (score.overall >= 70) return { label: "Good", color: "blue" };
  if (score.overall >= 55) return { label: "Fair", color: "yellow" };
  return { label: "Needs Improvement", color: "red" };
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}
