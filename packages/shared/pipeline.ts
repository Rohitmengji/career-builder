/*
 * @career-builder/shared/pipeline — pure pipeline-stage semantics (ADR-0015).
 *
 * Applications today move through 6 fixed statuses. This module introduces a
 * `kind` semantic layer so a tenant can rename/insert/reorder stages WITHOUT
 * breaking the features that reason about the lifecycle (offers status-sync,
 * responsiveness, analytics). Every consumer reasons about `kind`, never the
 * literal label. `DEFAULT_STAGES` maps 1:1 to today's 6 statuses, so with the
 * default pipeline the system behaves exactly as before. Pure + framework-agnostic;
 * `packages/database` must NOT import this (layering) — it duplicates the tiny
 * label map it needs.
 */

export type StageKind = "applied" | "in_process" | "offer" | "hired" | "rejected" | "custom";

export const STAGE_KINDS: readonly StageKind[] = [
  "applied",
  "in_process",
  "offer",
  "hired",
  "rejected",
  "custom",
] as const;

export interface StageSeed {
  key: string;
  label: string;
  kind: StageKind;
  order: number;
  isTerminal: boolean;
}

/** The default pipeline — identical in meaning to today's 6 statuses. */
export const DEFAULT_STAGES: readonly StageSeed[] = [
  { key: "applied", label: "Applied", kind: "applied", order: 0, isTerminal: false },
  { key: "screening", label: "Under Review", kind: "in_process", order: 1, isTerminal: false },
  { key: "interview", label: "Interview", kind: "in_process", order: 2, isTerminal: false },
  { key: "offer", label: "Offer", kind: "offer", order: 3, isTerminal: false },
  { key: "hired", label: "Hired", kind: "hired", order: 4, isTerminal: true },
  { key: "rejected", label: "Not Selected", kind: "rejected", order: 5, isTerminal: true },
] as const;

/** Legacy status string → kind (for backfill + back-compat derivation). */
export const LEGACY_STATUS_TO_KIND: Record<string, StageKind> = {
  applied: "applied",
  screening: "in_process",
  interview: "in_process",
  offer: "offer",
  hired: "hired",
  rejected: "rejected",
};

/** Canonical default stage key for a kind (resolving a target stage by kind). */
export const KIND_DEFAULT_KEY: Record<StageKind, string> = {
  applied: "applied",
  in_process: "screening",
  offer: "offer",
  hired: "hired",
  rejected: "rejected",
  custom: "screening",
};

export function isStageKind(v: unknown): v is StageKind {
  return typeof v === "string" && (STAGE_KINDS as readonly string[]).includes(v);
}

/** Terminal = no auto-advance out (hired/rejected). */
export function isTerminal(kind: StageKind): boolean {
  return kind === "hired" || kind === "rejected";
}

/**
 * "Responded" mirrors responsiveness.ts: anything past the initial applied state
 * counts as a response (incl. rejection). Only `applied` is not-yet-responded.
 */
export function isResponded(kind: StageKind): boolean {
  return kind !== "applied";
}

/** Mirrors the offers PRE_OFFER allowlist {applied, screening, interview}. */
export function isPreOffer(kind: StageKind): boolean {
  return kind === "applied" || kind === "in_process" || kind === "custom";
}

/** Mirrors the offers PRE_HIRE allowlist {applied, screening, interview, offer}. */
export function isPreHire(kind: StageKind): boolean {
  return isPreOffer(kind) || kind === "offer";
}

/** The 6 canonical application statuses the reasoners (offers/responsiveness/analytics) use. */
export const CANONICAL_STATUSES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

/** Canonical status a kind collapses to (custom mid-funnel stages count as "interview"). */
const KIND_TO_STATUS: Record<StageKind, string> = {
  applied: "applied",
  in_process: "interview",
  offer: "offer",
  hired: "hired",
  rejected: "rejected",
  custom: "interview",
};

/**
 * The canonical `Application.status` to persist for a given stage. This keeps the
 * 6-value `status` field — which offers status-sync, the responsiveness badge, and
 * analytics all read UNCHANGED — valid even for custom stages. A default stage keeps
 * its exact key (so screening stays "screening"); a custom stage collapses to its
 * kind's canonical status. The custom stage detail lives in `stageId` for the board.
 */
export function statusForStage(stage: { key: string; kind: StageKind | string }): string {
  if ((CANONICAL_STATUSES as readonly string[]).includes(stage.key)) return stage.key;
  return KIND_TO_STATUS[stage.kind as StageKind] ?? "interview";
}
