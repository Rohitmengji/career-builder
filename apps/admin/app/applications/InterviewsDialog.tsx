"use client";

/*
 * InterviewsDialog — schedule + manage interviews for one application (ADR-0006).
 * Recruiter-facing; lists existing interviews and a compact schedule form.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Spinner, XIcon } from "@/components/ui";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}
interface Interview {
  id: string;
  status: string;
  type: string;
  round: number;
  scheduledAt: string;
  durationMins: number;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  interviewer?: { id: string; name: string } | null;
}

interface Props {
  applicationId: string;
  candidateName: string;
  csrf: string;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = { phone: "Phone", video: "Video", onsite: "On-site" };

export default function InterviewsDialog({ applicationId, candidateName, csrf, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Schedule form
  const localTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [when, setWhen] = useState("");
  const [type, setType] = useState("video");
  const [interviewerId, setInterviewerId] = useState("");
  const [durationMins, setDurationMins] = useState(45);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");

  const base = `/api/admin/interviews`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [iRes, tRes] = await Promise.all([
        fetch(`${base}?applicationId=${encodeURIComponent(applicationId)}`, { cache: "no-store" }),
        fetch("/api/admin/team", { cache: "no-store" }),
      ]);
      if (iRes.status === 404) { setError("Interview scheduling isn't enabled for this workspace."); return; }
      if (!iRes.ok) throw new Error("load");
      setInterviews((await iRes.json()).interviews || []);
      if (tRes.ok) setTeam((await tRes.json()).team || []);
    } catch {
      setError("Unable to load interviews. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applicationId, base]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void load();
  }, [load]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const schedule = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!when || saving) return;
      setSaving(true);
      setError("");
      try {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            applicationId,
            scheduledAt: new Date(when).toISOString(),
            type,
            durationMins,
            timezone: localTz,
            ...(interviewerId ? { interviewerId } : {}),
            ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
            ...(location.trim() ? { location: location.trim() } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || "Couldn't schedule the interview."); return; }
        setInterviews((prev) => [data.interview, ...prev]);
        setWhen(""); setMeetingUrl(""); setLocation("");
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [when, saving, base, csrf, applicationId, type, durationMins, localTz, interviewerId, meetingUrl, location],
  );

  const act = useCallback(
    async (id: string, action: "cancel" | "complete" | "no_show") => {
      try {
        const res = await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ id, action }),
        });
        if (res.ok) {
          const status = action === "cancel" ? "cancelled" : action === "complete" ? "completed" : "no_show";
          setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
        }
      } catch { /* keep list as-is */ }
    },
    [base, csrf],
  );

  const fmt = (iso: string, tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        timeZoneName: "short", timeZone: tz,
      }).format(new Date(iso));
    } catch { return new Date(iso).toLocaleString(); }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      aria-labelledby={headingId}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex open:items-center open:justify-center"
    >
      <div className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Interviews</h2>
            <p className="mt-0.5 text-sm text-gray-600">{candidateName}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close interviews"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-blue-600"><Spinner /><span className="sr-only">Loading…</span></div>
          ) : error ? (
            <p role="alert" className="py-6 text-center text-sm text-gray-600">{error}</p>
          ) : (
            <>
              {interviews.length === 0 ? (
                <p className="mb-5 text-sm text-gray-500">No interviews scheduled yet.</p>
              ) : (
                <ul className="mb-5 space-y-3">
                  {interviews.map((iv) => (
                    <li key={iv.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{fmt(iv.scheduledAt, iv.timezone)}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {TYPE_LABELS[iv.type] || iv.type} · {iv.durationMins}m · Round {iv.round}
                            {iv.interviewer?.name ? ` · ${iv.interviewer.name}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                          {iv.status.replace("_", " ")}
                        </span>
                      </div>
                      {(iv.status === "scheduled" || iv.status === "confirmed") && (
                        <div className="mt-2 flex gap-3 text-xs">
                          <button type="button" onClick={() => act(iv.id, "complete")} className="font-medium text-blue-600 hover:underline">Mark complete</button>
                          <button type="button" onClick={() => act(iv.id, "cancel")} className="font-medium text-red-600 hover:underline">Cancel</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={schedule} className="space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900">Schedule an interview</p>
                <label className="block text-xs font-medium text-gray-600">
                  When <span className="text-gray-400">({localTz})</span>
                  <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-xs font-medium text-gray-600">Type
                    <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
                      <option value="video">Video</option><option value="phone">Phone</option><option value="onsite">On-site</option>
                    </select>
                  </label>
                  <label className="w-24 text-xs font-medium text-gray-600">Minutes
                    <input type="number" min={5} max={480} value={durationMins} onChange={(e) => setDurationMins(parseInt(e.target.value) || 45)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                  </label>
                </div>
                <label className="block text-xs font-medium text-gray-600">Interviewer
                  <select value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
                    <option value="">Unassigned</option>
                    {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
                <input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="Meeting link (optional)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" maxLength={300}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                <Button type="submit" size="sm" loading={saving} disabled={saving || !when}>Schedule + notify candidate</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
