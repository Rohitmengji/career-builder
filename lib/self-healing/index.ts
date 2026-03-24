/**
 * Self-Healing System — Public API
 *
 * Re-exports all components for external use.
 */

export type {
  DetectedIssue,
  RootCause,
  FixSuggestion,
  FixPatch,
  FixHistoryEntry,
  LearningData,
  HealingReport,
  IssueCategory,
  IssueSeverity,
  FixMode,
  FixStatus,
  IssueDetector,
  DetectionContext,
  ConsoleError,
  ApiFailure,
  ObservabilityLog,
} from "./types";

export { collectInputSources, listAvailableSources, saveConsoleErrors, saveApiFailures, saveObservabilityLogs } from "./input-collector";
export { runAllDetectors, DETECTOR_REGISTRY } from "./detectors";
export { analyzeRootCauses } from "./root-cause-analyzer";
export { generateFixes } from "./fix-generator";
export { applyFixes, rollbackAll, generateDiff, savePatchFile } from "./patch-applier";
export { verifyFixes } from "./verification";
export { buildReport, saveReport } from "./reporter";
export { analyzeLearningData, getLearningReport } from "./learning";
