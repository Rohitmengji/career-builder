/*
 * Unit (contract) test for portableRepo (ADR-0030) — the candidate's OWN cross-tenant
 * applications read. Pinned invariants:
 *   - matches the EXACT lowercased email (own data only);
 *   - EXCLUDES GDPR-anonymized rows (anonymizedAt: null) so a forgotten candidate
 *     contributes nothing even if a stale share grant survived;
 *   - selects only {tenantId, status} (no PII / no other-candidate data).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("./client", () => ({ prisma: { application: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { portableRepo } from "./repositories/portableRepo";

beforeEach(() => findMany.mockReset());

describe("portableRepo.getOwnApplicationsAcrossTenants", () => {
  it("matches exact lc email + anonymizedAt:null, selects only tenantId+status", async () => {
    findMany.mockResolvedValueOnce([{ tenantId: "a", status: "hired" }]);
    const rows = await portableRepo.getOwnApplicationsAcrossTenants("JANE@X.com");
    const call = findMany.mock.calls[0][0];
    expect(call.where).toEqual({ email: "jane@x.com", anonymizedAt: null });
    expect(call.select).toEqual({ tenantId: true, status: true });
    expect(rows).toEqual([{ tenantId: "a", status: "hired" }]);
  });
});
