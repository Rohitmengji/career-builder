/*
 * Barrel for the AI generation-context module — the single public entry point
 * callers import from (`lib/ai/context`) instead of reaching into siblings.
 *
 * Re-exports the three cooperating pieces that assemble what the ai-client is
 * fed when generating/regenerating site content:
 *   - siteContext   — the per-tenant site context (load/save locally + server),
 *   - contextEngine — builds & serializes the prompt context from inputs
 *                     (company profile, preferences, existing content, signals),
 *   - memorySystem  — accept/reject/structure history that biases future output.
 * Pure re-exports: no logic lives here, so add new context exports to this list.
 */
export {
  loadSiteContext,
  saveSiteContextLocal,
  clearSiteContext,
  saveSiteContextToServer,
  loadSiteContextFromServer,
  buildSiteContext,
  REGEN_OPTIONS,
  type SiteContext,
  type RegenOption,
} from "./siteContext";

export {
  buildGenerationContext,
  serializeContext,
  type AiGenerationContext,
  type BuildContextInput,
  type CompanyProfile,
  type ContentPreferences,
  type ExistingContent,
  type GenerationMemory,
  type ContextSignals,
} from "./contextEngine";

export {
  loadMemory,
  saveMemory,
  createEmptyMemory,
  recordGeneration,
  recordAccepted,
  recordRejected,
  recordStructure,
  toGenerationMemory,
  loadMemoryFromApi,
  type MemoryRecord,
} from "./memorySystem";
