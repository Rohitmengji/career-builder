/**
 * AI Orchestrator — The master conductor
 *
 * This is the single entry point for ALL AI generation in the system.
 * It coordinates the 4-layer pipeline:
 *
 *   1. Context Engine    → builds rich context
 *   2. Structure Generator → decides WHAT blocks to show
 *   3. Content Generator  → fills in WHAT they say
 *   4. Validator          → ensures output matches schema
 *
 * Flow:
 *   Request → Context → Structure → Content → Validate → Quality Score → Output
 *
 * If validation fails → retry once with stricter prompt
 * If retry fails → fall back to template defaults
 * NEVER return invalid or empty output
 */

import type { AiPageBlock, AiTone, AiIndustry, AiCompanyType, AiAudience } from "@/lib/ai/types";
import {
  buildGenerationContext,
  type AiGenerationContext,
  type BuildContextInput,
} from "@/lib/ai/context/contextEngine";
import {
  loadMemory,
  saveMemory,
  recordGeneration,
  recordAccepted,
  recordRejected,
  recordStructure,
  toGenerationMemory,
} from "@/lib/ai/context/memorySystem";
import {
  generateStructure,
  getBlockTypes,
  type PageStructure,
  type BlockLayout,
} from "@/lib/ai/structureGenerator";
import {
  buildPageContentPrompt,
  buildBlockContentPrompt,
  generateFallbackPage,
  generateFallbackContent,
  type ContentPrompt,
} from "@/lib/ai/contentGenerator";
import { buildJobGenerationPrompt, type JobGenerationInput } from "@/lib/ai/jobGenerator";
import { validateAiOutput, validatePageOutput, validateJobOutput, parseAiJson } from "@/lib/ai/validator";
import { scorePageQuality, scoreBlockContent, shouldRegenerate, type QualityScore } from "@/lib/ai/qualityMetrics";
import { blockSchemas, getDefaultProps } from "@/lib/blockSchemas";

/* ================================================================== */
/*  Orchestrator output types                                          */
/* ================================================================== */

export interface OrchestrationResult {
  /** Whether the generation succeeded */
  success: boolean;
  /** Generated blocks (for page generation) */
  blocks?: AiPageBlock[];
  /** Generated props (for single block generation) */
  props?: Record<string, any>;
  /** Quality score of the output */
  quality?: QualityScore;
  /** Structure that was used */
  structure?: PageStructure;
  /** Human-readable explanation */
  explanation: string;
  /** Warnings from validation */
  warnings: string[];
  /** Error message if failed */
  error?: string;
  /** Generation metadata */
  metadata: {
    /** Total time in ms */
    durationMs: number;
    /** Which layer produced the output (ai | fallback) */
    source: "ai" | "fallback";
    /** Model used */
    model: string;
    /** Whether memory was used */
    memoryUsed: boolean;
    /** Number of retries */
    retries: number;
  };
}

/* ================================================================== */
/*  Orchestrator input types                                           */
/* ================================================================== */

export interface PageGenerationRequest {
  type: "page";
  pageType: string;
  companyName: string;
  industry?: AiIndustry;
  companyType?: AiCompanyType;
  tone?: AiTone;
  audience?: AiAudience;
  hiringGoals?: string;
  description?: string;
  geo?: string;
  prompt?: string;
  /** Tenant ID for memory loading */
  tenantId?: string;
  /** Existing blocks on the page */
  existingBlockTypes?: string[];
  /** Existing pages in the site */
  existingPages?: string[];
  /** Job context string (pre-built) */
  jobContext?: string;
}

export interface BlockGenerationRequest {
  type: "block";
  action: "generate" | "improve" | "expand";
  blockType: string;
  currentProps?: Record<string, any>;
  companyName: string;
  industry?: AiIndustry;
  companyType?: AiCompanyType;
  tone?: AiTone;
  audience?: AiAudience;
  prompt?: string;
  tenantId?: string;
  pageType?: string;
  existingBlockTypes?: string[];
}

export interface JobGenerationRequest {
  type: "job";
  role: string;
  department?: string;
  experienceLevel: "entry" | "mid" | "senior" | "lead" | "executive";
  location: string;
  employmentType?: "full-time" | "part-time" | "contract" | "internship";
  isRemote?: boolean;
  instructions?: string;
  existingData?: Record<string, any>;
  companyName: string;
  industry?: AiIndustry;
  companyType?: AiCompanyType;
  tone?: AiTone;
  geo?: string;
  tenantId?: string;
}

export type GenerationRequest = PageGenerationRequest | BlockGenerationRequest | JobGenerationRequest;

/* ================================================================== */
/*  AI Provider — centralized call function                            */
/* ================================================================== */

const RESPONSES_API_MODELS = /^(gpt-5|o[1-9])/;

async function callAi(system: string, user: string, timeoutMs: number = 15000): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const useResponsesApi = RESPONSES_API_MODELS.test(model);

    if (useResponsesApi) {
      const res = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          instructions: system,
          input: user,
          text: { format: { type: "json_object" } },
          max_output_tokens: 3200,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown");
        throw new Error(`AI error (${res.status}): ${err}`);
      }

      const data = await res.json();
      if (data.output_text) return data.output_text;

      if (Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === "output_text" && c.text) return c.text;
            }
          }
        }
      }
      throw new Error("Unexpected AI response format");
    } else {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.7,
          max_tokens: 3200,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown");
        throw new Error(`AI error (${res.status}): ${err}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("AI generation timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================================================================== */
/*  Page generation orchestration                                      */
/* ================================================================== */

async function orchestratePage(req: PageGenerationRequest): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  let retries = 0;

  // 1. Load memory (if tenant is known)
  let memory = null;
  let memoryRecord = null;
  if (req.tenantId) {
    try {
      memoryRecord = await loadMemory(req.tenantId);
      memory = toGenerationMemory(memoryRecord);
    } catch (err) {
      console.error("[Orchestrator] Memory load failed:", err);
      // Non-fatal — continue without memory
    }
  }

  // 2. Build context
  const contextInput: BuildContextInput = {
    companyName: req.companyName,
    industry: req.industry,
    companyType: req.companyType,
    tone: req.tone,
    audience: req.audience,
    hiringGoals: req.hiringGoals,
    description: req.description,
    geo: req.geo,
    existingBlockTypes: req.existingBlockTypes,
    pageType: req.pageType,
    existingPages: req.existingPages,
    memory,
  };
  const ctx = buildGenerationContext(contextInput);

  // 3. Generate structure (deterministic — no AI call)
  const structure = generateStructure(req.pageType, ctx);
  const blockTypes = getBlockTypes(structure);
  console.log(`[Orchestrator] Structure: ${blockTypes.join(" → ")} (${structure.blockCount} blocks)`);

  // 4. Generate content (AI call)
  let blocks: AiPageBlock[];

  try {
    const prompt = buildPageContentPrompt(structure.layout, ctx, req.pageType);
    const rawOutput = await callAi(prompt.system, prompt.user, 30000);

    if (!rawOutput || rawOutput.trim().length === 0) {
      throw new Error("Empty AI response");
    }

    const parsed = parseAiJson(rawOutput) as { blocks?: unknown[] };
    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error("AI response missing blocks array");
    }

    // 5. Validate each block against schema
    const validatedBlocks: AiPageBlock[] = [];
    for (let i = 0; i < blockTypes.length; i++) {
      const expectedType = blockTypes[i];
      const rawBlock = parsed.blocks[i];

      if (!rawBlock || typeof rawBlock !== "object") {
        warnings.push(`Block ${i + 1} (${expectedType}): missing — using fallback`);
        validatedBlocks.push({
          type: expectedType,
          props: generateFallbackContent(expectedType, ctx),
        });
        continue;
      }

      const block = rawBlock as { type?: string; props?: Record<string, any> };
      const actualType = block.type && blockSchemas[block.type] ? block.type : expectedType;

      if (actualType !== expectedType) {
        warnings.push(`Block ${i + 1}: expected "${expectedType}" got "${block.type}" — corrected`);
      }

      const validation = validateAiOutput(actualType, block.props || {});
      if (validation.warnings.length > 0) {
        warnings.push(`Block ${i + 1} (${actualType}): ${validation.warnings.join("; ")}`);
      }

      validatedBlocks.push({ type: actualType, props: validation.props });
    }

    blocks = validatedBlocks;

    // 6. Quality score
    const quality = scorePageQuality(blocks);

    // 7. Auto-retry if quality is too low (once)
    if (shouldRegenerate(quality) && retries === 0) {
      retries++;
      console.log(`[Orchestrator] Quality too low (${quality.overall}) — retrying with stricter prompt`);

      try {
        const retryPrompt = buildPageContentPrompt(structure.layout, ctx, req.pageType);
        retryPrompt.system += `\n\nPREVIOUS ATTEMPT SCORED ${quality.overall}/100. Issues: ${quality.issues.slice(0, 5).join("; ")}. DO BETTER.`;

        const retryOutput = await callAi(retryPrompt.system, retryPrompt.user, 30000);
        const retryParsed = parseAiJson(retryOutput) as { blocks?: unknown[] };

        if (retryParsed && Array.isArray(retryParsed.blocks)) {
          const retryValidated: AiPageBlock[] = [];
          for (let i = 0; i < blockTypes.length; i++) {
            const expectedType = blockTypes[i];
            const rawBlock = retryParsed.blocks[i];

            if (!rawBlock || typeof rawBlock !== "object") {
              retryValidated.push(blocks[i]); // Keep original
              continue;
            }

            const block = rawBlock as { type?: string; props?: Record<string, any> };
            const actualType = block.type && blockSchemas[block.type] ? block.type : expectedType;
            const validation = validateAiOutput(actualType, block.props || {});
            retryValidated.push({ type: actualType, props: validation.props });
          }

          const retryQuality = scorePageQuality(retryValidated);
          if (retryQuality.overall > quality.overall) {
            blocks = retryValidated;
            console.log(`[Orchestrator] Retry improved quality: ${quality.overall} → ${retryQuality.overall}`);
          }
        }
      } catch (retryErr) {
        console.error("[Orchestrator] Retry failed:", retryErr);
        // Keep original blocks — retry failure is non-fatal
      }
    }

    // 8. Ensure navbar/footer have correct company name
    blocks = blocks.map((block) => {
      if (block.type === "navbar" || block.type === "footer") {
        const props = { ...block.props };
        if (props.companyName !== undefined) props.companyName = req.companyName;
        if (block.type === "footer" && props.copyright !== undefined) {
          props.copyright = `© ${new Date().getFullYear()} ${req.companyName}. All rights reserved.`;
        }
        return { ...block, props };
      }
      return block;
    });

    // 9. Update memory
    if (memoryRecord && req.tenantId) {
      try {
        const updated = recordGeneration(memoryRecord, req.tone || "professional");
        await saveMemory(updated);
      } catch (err) {
        console.error("[Orchestrator] Memory save failed:", err);
      }
    }

    const finalQuality = scorePageQuality(blocks);
    const duration = Date.now() - startTime;

    console.log(`[Orchestrator] Page "${req.pageType}" generated: ${blocks.length} blocks, quality ${finalQuality.overall}/100, ${duration}ms`);

    return {
      success: true,
      blocks,
      quality: finalQuality,
      structure,
      explanation: `Generated ${blocks.length}-block ${req.pageType} page for ${req.companyName}. Quality: ${finalQuality.overall}/100. ${structure.reasoning}`,
      warnings,
      metadata: {
        durationMs: duration,
        source: "ai",
        model,
        memoryUsed: !!memory,
        retries,
      },
    };

  } catch (err: any) {
    // FALLBACK — never return empty
    console.error(`[Orchestrator] Page generation failed: ${err.message}. Using fallback.`);

    blocks = generateFallbackPage(structure.layout, ctx);
    const quality = scorePageQuality(blocks);
    const duration = Date.now() - startTime;

    return {
      success: true, // Still "success" — we have blocks to show
      blocks,
      quality,
      structure,
      explanation: `Fallback content generated for ${req.pageType} page (AI unavailable). ${blocks.length} blocks.`,
      warnings: [...warnings, `AI generation failed: ${err.message}. Using template defaults.`],
      metadata: {
        durationMs: duration,
        source: "fallback",
        model,
        memoryUsed: false,
        retries,
      },
    };
  }
}

/* ================================================================== */
/*  Single block generation orchestration                              */
/* ================================================================== */

async function orchestrateBlock(req: BlockGenerationRequest): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const warnings: string[] = [];

  const schema = blockSchemas[req.blockType];
  if (!schema) {
    return {
      success: false,
      explanation: `Unknown block type: ${req.blockType}`,
      warnings: [],
      error: `Unknown block type: ${req.blockType}`,
      metadata: { durationMs: 0, source: "fallback", model, memoryUsed: false, retries: 0 },
    };
  }

  // Build context
  const ctx = buildGenerationContext({
    companyName: req.companyName,
    industry: req.industry,
    companyType: req.companyType,
    tone: req.tone,
    audience: req.audience,
    existingBlockTypes: req.existingBlockTypes,
    pageType: req.pageType,
  });

  // Build a single-block layout for the content generator
  const layout: BlockLayout = {
    type: req.blockType,
    variant: "default",
    priority: 1,
    density: ctx.preferences.density,
    role: "content-narrative",
  };

  try {
    const prompt = buildBlockContentPrompt(layout, ctx, req.pageType || "home", 0, 1);

    // For improve/expand, include current props
    let userPrompt = prompt.user;
    if (req.action === "improve" && req.currentProps) {
      userPrompt = `IMPROVE the following content. Make it more compelling, clear, and engaging.\n\nCurrent content:\n${JSON.stringify(req.currentProps, null, 2)}\n\n${req.prompt ? `User instruction: ${req.prompt}\n\n` : ""}${prompt.user}`;
    } else if (req.action === "expand" && req.currentProps) {
      userPrompt = `EXPAND the following content. Add more detail, fill empty fields, expand lists.\n\nCurrent content:\n${JSON.stringify(req.currentProps, null, 2)}\n\n${req.prompt ? `User instruction: ${req.prompt}\n\n` : ""}${prompt.user}`;
    } else if (req.prompt) {
      userPrompt = `${req.prompt}\n\n${prompt.user}`;
    }

    const rawOutput = await callAi(prompt.system, userPrompt);
    const parsed = parseAiJson(rawOutput);
    const validation = validateAiOutput(req.blockType, parsed);

    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    const quality = scoreBlockContent(req.blockType, validation.props);
    const duration = Date.now() - startTime;

    return {
      success: true,
      props: validation.props,
      quality,
      explanation: `Generated ${schema.label} content. Quality: ${quality.overall}/100.`,
      warnings,
      metadata: {
        durationMs: duration,
        source: "ai",
        model,
        memoryUsed: false,
        retries: 0,
      },
    };

  } catch (err: any) {
    console.error(`[Orchestrator] Block generation failed: ${err.message}`);

    const fallbackProps = generateFallbackContent(req.blockType, ctx);
    const quality = scoreBlockContent(req.blockType, fallbackProps);

    return {
      success: true,
      props: fallbackProps,
      quality,
      explanation: `Fallback content for ${schema.label} (AI unavailable).`,
      warnings: [`AI failed: ${err.message}. Using defaults.`],
      metadata: {
        durationMs: Date.now() - startTime,
        source: "fallback",
        model,
        memoryUsed: false,
        retries: 0,
      },
    };
  }
}

/* ================================================================== */
/*  Job generation orchestration                                       */
/* ================================================================== */

async function orchestrateJob(req: JobGenerationRequest): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const ctx = buildGenerationContext({
    companyName: req.companyName,
    industry: req.industry,
    companyType: req.companyType,
    tone: req.tone,
    geo: req.geo,
  });

  const jobInput: JobGenerationInput = {
    role: req.role,
    department: req.department,
    experienceLevel: req.experienceLevel,
    location: req.location,
    employmentType: req.employmentType,
    isRemote: req.isRemote,
    instructions: req.instructions,
    existingData: req.existingData as any,
  };

  try {
    const prompt = buildJobGenerationPrompt(jobInput, ctx);
    const rawOutput = await callAi(prompt.system, prompt.user);
    const parsed = parseAiJson(rawOutput);
    const validation = validateJobOutput(parsed);

    if (validation.warnings.length > 0) {
      console.log(`[Orchestrator] Job warnings: ${validation.warnings.join("; ")}`);
    }

    return {
      success: validation.valid,
      props: validation.job as any,
      explanation: `Generated ${req.experienceLevel}-level ${req.role} posting for ${req.companyName}.`,
      warnings: validation.warnings,
      error: validation.errors.length > 0 ? validation.errors.join("; ") : undefined,
      metadata: {
        durationMs: Date.now() - startTime,
        source: "ai",
        model,
        memoryUsed: false,
        retries: 0,
      },
    };

  } catch (err: any) {
    console.error(`[Orchestrator] Job generation failed: ${err.message}`);
    return {
      success: false,
      explanation: "Job generation failed.",
      warnings: [],
      error: err.message,
      metadata: {
        durationMs: Date.now() - startTime,
        source: "fallback",
        model,
        memoryUsed: false,
        retries: 0,
      },
    };
  }
}

/* ================================================================== */
/*  Main entry point — route to appropriate orchestrator                */
/* ================================================================== */

/**
 * Orchestrate any AI generation request.
 * This is the SINGLE entry point for all AI operations.
 */
export async function orchestrate(request: GenerationRequest): Promise<OrchestrationResult> {
  switch (request.type) {
    case "page":
      return orchestratePage(request);
    case "block":
      return orchestrateBlock(request);
    case "job":
      return orchestrateJob(request);
    default:
      return {
        success: false,
        explanation: "Unknown request type",
        warnings: [],
        error: "Unknown request type",
        metadata: {
          durationMs: 0,
          source: "fallback",
          model: process.env.AI_MODEL || "gpt-4o-mini",
          memoryUsed: false,
          retries: 0,
        },
      };
  }
}

/* ================================================================== */
/*  Memory feedback — called after user accepts/rejects                */
/* ================================================================== */

/**
 * Record user feedback on AI output (server-side).
 * Call this after user applies or dismisses AI suggestions.
 */
export async function recordFeedback(
  tenantId: string,
  action: "accepted" | "rejected",
  blockTypes: string[],
): Promise<void> {
  try {
    const memory = await loadMemory(tenantId);

    let updated;
    if (action === "accepted") {
      updated = recordAccepted(memory, blockTypes);
      // If it was a full page, also record the structure
      if (blockTypes.length > 3) {
        updated = recordStructure(updated, blockTypes);
      }
    } else {
      updated = recordRejected(memory, blockTypes);
    }

    await saveMemory(updated);
    console.log(`[Orchestrator] Recorded ${action} feedback for ${blockTypes.length} blocks (tenant: ${tenantId})`);
  } catch (err) {
    console.error("[Orchestrator] Failed to record feedback:", err);
    // Non-fatal — don't break the user flow for memory failure
  }
}
