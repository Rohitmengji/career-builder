/*
 * HiringTeamDialog (ADR-0020, B6b) — manage a job's hiring team.
 *
 * WHAT: add/remove tenant users from a job's hiring team. When the hiring_teams flag
 *   is on, only team members (plus admins) can see that job's applications.
 * WHY: gives admins control over who reviews which roles.
 * HOW: GET the current team + the tenant's users (admin-only endpoints), then
 *   POST/DELETE /api/admin/jobs/[id]/team. Shown only to admins (the user list it
 *   needs is admin-scoped). Effects use the await-inside-inline-async pattern.
 */
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, XIcon } from "@/components/ui";

interface Member { userId: string; name: string; email: string; role: string; }
interface OrgUser { id: string; name: string; email: string; role: string; }

export default function HiringTeamDialog({
  jobId, jobTitle, csrf, onClose,
}: { jobId: string; jobTitle: string; csrf: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", "x-csrf-token": csrf };

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/team`, { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setMembers((d.members ?? []) as Member[]); }
    } catch { /* ignore */ }
  }, [jobId]);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const [teamRes, usersRes] = await Promise.all([
          fetch(`/api/admin/jobs/${jobId}/team`, { cache: "no-store" }),
          fetch("/api/admin/users", { cache: "no-store" }),
        ]);
        if (active && teamRes.ok) { const d = await teamRes.json(); setMembers((d.members ?? []) as Member[]); }
        if (active && usersRes.ok) { const d = await usersRes.json(); setUsers((d.users ?? []) as OrgUser[]); }
      } catch { /* ignore */ }
    };
    void run();
    return () => { active = false; };
  }, [jobId]);

  const close = useCallback(() => { dialogRef.current?.close(); onClose(); }, [onClose]);

  async function add() {
    if (!pick || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/team`, { method: "POST", headers, body: JSON.stringify({ userId: pick }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not add member"); return; }
      setPick("");
      await loadTeam();
    } catch { setError("Could not add member"); } finally { setBusy(false); }
  }

  async function remove(userId: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/team`, { method: "DELETE", headers, body: JSON.stringify({ userId }) });
      if (res.ok) await loadTeam();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  const onTeam = new Set(members.map((m) => m.userId));
  const addable = users.filter((u) => !onTeam.has(u.id));

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} className="m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/30" onClose={onClose}>
      <div className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">Hiring team</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XIcon /></button>
        </div>
        <p className="mb-4 text-sm text-gray-600">{jobTitle} — members can see this role&apos;s applications.</p>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mb-4 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="team-pick" className="mb-1 block text-xs font-medium text-gray-500">Add a teammate</label>
            <select id="team-pick" value={pick} onChange={(e) => setPick(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
              <option value="">Select a user…</option>
              {addable.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <Button type="button" onClick={add} disabled={!pick || busy}>Add</Button>
        </div>

        <ul className="divide-y divide-gray-100">
          {members.length === 0 && <li className="py-2 text-sm text-gray-500">No team members yet — anyone with org-wide access can still see this role.</li>}
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
                <p className="truncate text-xs text-gray-500">{m.email} · {m.role}</p>
              </div>
              <button type="button" onClick={() => remove(m.userId)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={close}>Done</Button>
        </div>
      </div>
    </dialog>
  );
}
