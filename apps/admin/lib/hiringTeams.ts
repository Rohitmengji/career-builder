/*
 * Hiring-team access control (ADR-0020, B6b) — the single enforcement point for
 * scoping application access to a job's hiring team.
 *
 * WHY: when the hiring_teams flag is on, non-admin roles may only see/act on
 *   applications for jobs they are a team member of. This is an ACCESS-CONTROL layer,
 *   so it must be applied at EVERY application-access path (list, mutate, bulk, and
 *   every per-application sub-route). Centralizing the rule here keeps those call
 *   sites consistent and auditable — a missed call site is a data-leak, so there is
 *   ONE helper, used everywhere.
 * HOW:
 *   - visibleJobIds(session): null = no restriction (flag off, or org-wide role);
 *     otherwise the allow-list of jobIds the user may see (possibly empty = no access).
 *   - canAccessJob(session, jobId): boolean gate for a specific job.
 * super_admin/admin are org-wide; everyone else is team-scoped when the flag is on.
 */

import { isEnabled } from "@career-builder/shared/feature-flags";
import { hiringTeamRepo } from "@career-builder/database";

interface SessionLike {
  userId: string;
  tenantId: string;
  role: string;
}

const ORG_WIDE_ROLES = new Set(["super_admin", "admin"]);

/** True when hiring-team scoping is active for THIS session (flag on + non-org-wide role). */
export function teamScopingActive(session: SessionLike): boolean {
  return isEnabled("hiring_teams") && !ORG_WIDE_ROLES.has(session.role);
}

/**
 * The jobIds this session may access applications for. Returns `null` when there is
 * NO restriction (scoping inactive). When scoping is active, returns the user's team
 * jobIds — an EMPTY array means "no access to any job" (must still be applied so the
 * user sees nothing, not everything).
 */
export async function visibleJobIds(session: SessionLike): Promise<string[] | null> {
  if (!teamScopingActive(session)) return null;
  return hiringTeamRepo.listJobIdsForUser(session.tenantId, session.userId);
}

/** Whether this session may access a specific job's applications. */
export async function canAccessJob(session: SessionLike, jobId: string): Promise<boolean> {
  if (!teamScopingActive(session)) return true;
  const ids = await hiringTeamRepo.listJobIdsForUser(session.tenantId, session.userId);
  return ids.includes(jobId);
}
