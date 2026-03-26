/**
 * AI Memory System — Learning from user behavior
 *
 * Tracks what users accept/reject from AI suggestions to improve
 * future generations. Stored per-tenant in the database via AppConfig.
 *
 * Memory is lightweight and privacy-safe — stores block types and
 * preferences, NOT the actual content.
 *
 * Storage: AppConfig table with key = `ai_memory:{tenantId}`
 */

import type { AiTone } from "@/lib/ai/types";
import type { GenerationMemory } from "@/lib/ai/context/contextEngine";

/* ================================================================== */
/*  Memory record — what we track per tenant                           */
/* ================================================================== */

export interface MemoryRecord {
  tenantId: string;
  /** Block types the user accepted (applied to editor) */
  acceptedBlocks: string[];
  /** Block types the user rejected (dismissed) */
  rejectedBlocks: string[];
  /** Successful page structures (arrays of block type sequences) */
  successfulStructures: string[][];
  /** Tone preferences (most recently used) */
  toneHistory: AiTone[];
  /** Total generations performed */
  totalGenerations: number;
  /** Total accepted (applied) */
  totalAccepted: number;
  /** Total rejected (dismissed) */
  totalRejected: number;
  /** ISO timestamp of last generation */
  lastGenerationAt: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

/* ================================================================== */
/*  Memory limits (prevent unbounded growth)                           */
/* ================================================================== */

const MEMORY_LIMITS = {
  /** Max accepted block types to remember */
  MAX_ACCEPTED_BLOCKS: 50,
  /** Max rejected block types to remember */
  MAX_REJECTED_BLOCKS: 30,
  /** Max successful structures to remember */
  MAX_STRUCTURES: 10,
  /** Max tone history entries */
  MAX_TONE_HISTORY: 20,
} as const;

/* ================================================================== */
/*  Create empty memory                                                */
/* ================================================================== */

export function createEmptyMemory(tenantId: string): MemoryRecord {
  const now = new Date().toISOString();
  return {
    tenantId,
    acceptedBlocks: [],
    rejectedBlocks: [],
    successfulStructures: [],
    toneHistory: [],
    totalGenerations: 0,
    totalAccepted: 0,
    totalRejected: 0,
    lastGenerationAt: now,
    createdAt: now,
  };
}

/* ================================================================== */
/*  Memory updates — immutable operations                              */
/* ================================================================== */

/** Record a new generation attempt */
export function recordGeneration(memory: MemoryRecord, tone: AiTone): MemoryRecord {
  return {
    ...memory,
    totalGenerations: memory.totalGenerations + 1,
    lastGenerationAt: new Date().toISOString(),
    toneHistory: [...memory.toneHistory, tone].slice(-MEMORY_LIMITS.MAX_TONE_HISTORY),
  };
}

/** Record that user accepted AI output (applied to editor) */
export function recordAccepted(memory: MemoryRecord, blockTypes: string[]): MemoryRecord {
  const newAccepted = [...memory.acceptedBlocks, ...blockTypes]
    .slice(-MEMORY_LIMITS.MAX_ACCEPTED_BLOCKS);

  return {
    ...memory,
    acceptedBlocks: newAccepted,
    totalAccepted: memory.totalAccepted + 1,
  };
}

/** Record that user rejected AI output (dismissed) */
export function recordRejected(memory: MemoryRecord, blockTypes: string[]): MemoryRecord {
  const newRejected = [...memory.rejectedBlocks, ...blockTypes]
    .slice(-MEMORY_LIMITS.MAX_REJECTED_BLOCKS);

  return {
    ...memory,
    rejectedBlocks: newRejected,
    totalRejected: memory.totalRejected + 1,
  };
}

/** Record a successful page structure */
export function recordStructure(memory: MemoryRecord, structure: string[]): MemoryRecord {
  const newStructures = [...memory.successfulStructures, structure]
    .slice(-MEMORY_LIMITS.MAX_STRUCTURES);

  return {
    ...memory,
    successfulStructures: newStructures,
  };
}

/* ================================================================== */
/*  Memory → GenerationMemory converter                                */
/* ================================================================== */

/** Convert raw memory record to the context engine's GenerationMemory format */
export function toGenerationMemory(record: MemoryRecord): GenerationMemory {
  // Calculate most preferred tone from history
  let preferredTone: AiTone | null = null;
  if (record.toneHistory.length > 0) {
    const counts = new Map<AiTone, number>();
    for (const tone of record.toneHistory) {
      counts.set(tone, (counts.get(tone) || 0) + 1);
    }
    let maxCount = 0;
    for (const [tone, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        preferredTone = tone;
      }
    }
  }

  const total = record.totalAccepted + record.totalRejected;
  const acceptanceRate = total > 0 ? record.totalAccepted / total : 0.5;

  return {
    acceptedBlockTypes: [...new Set(record.acceptedBlocks)],
    rejectedBlockTypes: [...new Set(record.rejectedBlocks)],
    preferredTone,
    successfulStructures: record.successfulStructures,
    totalGenerations: record.totalGenerations,
    acceptanceRate,
  };
}

/* ================================================================== */
/*  Persistence — AppConfig key-value store                            */
/* ================================================================== */

const MEMORY_KEY_PREFIX = "ai_memory:";

/** Load memory from database (server-side only) */
export async function loadMemory(tenantId: string): Promise<MemoryRecord> {
  try {
    const { prisma } = await import("@career-builder/database");
    const config = await prisma.appConfig.findUnique({
      where: { key: `${MEMORY_KEY_PREFIX}${tenantId}` },
    });

    if (!config?.value) {
      return createEmptyMemory(tenantId);
    }

    const parsed = JSON.parse(config.value) as MemoryRecord;
    // Validate shape minimally — return empty on corruption
    if (!parsed || typeof parsed.totalGenerations !== "number") {
      console.error(`[AiMemory] Corrupted memory for tenant ${tenantId} — resetting`);
      return createEmptyMemory(tenantId);
    }

    return parsed;
  } catch (err) {
    console.error(`[AiMemory] Failed to load memory for tenant ${tenantId}:`, err);
    return createEmptyMemory(tenantId);
  }
}

/** Save memory to database (server-side only) */
export async function saveMemory(memory: MemoryRecord): Promise<boolean> {
  try {
    const { prisma } = await import("@career-builder/database");
    await prisma.appConfig.upsert({
      where: { key: `${MEMORY_KEY_PREFIX}${memory.tenantId}` },
      create: {
        key: `${MEMORY_KEY_PREFIX}${memory.tenantId}`,
        value: JSON.stringify(memory),
      },
      update: {
        value: JSON.stringify(memory),
      },
    });
    return true;
  } catch (err) {
    console.error(`[AiMemory] Failed to save memory for tenant ${memory.tenantId}:`, err);
    return false;
  }
}

/** Load memory for client-side context (via API) */
export async function loadMemoryFromApi(): Promise<GenerationMemory | null> {
  try {
    const res = await fetch("/api/ai/memory");
    if (!res.ok) return null;
    const data = await res.json();
    return data.memory || null;
  } catch {
    return null;
  }
}
