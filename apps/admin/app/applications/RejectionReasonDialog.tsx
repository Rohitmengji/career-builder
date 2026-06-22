"use client";

/*
 * RejectionReasonDialog — capture a structured adverse-action reason on reject
 * (ADR-0010). The reason is OPTIONAL (reject always proceeds); the candidate only
 * sees a curated message if the recruiter opts in AND the disclosure flag is on.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, XIcon } from "@/components/ui";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "No reason (reject without recording)" },
  { value: "screening_failed", label: "Didn't meet screening criteria" },
  { value: "experience_gap", label: "Experience gap vs. requirements" },
  { value: "role_filled", label: "Role filled / closed" },
  { value: "stronger_candidates", label: "Moved forward with other candidates" },
  { value: "not_responsive", label: "Candidate not responsive" },
  { value: "other", label: "Other" },
];

interface Props {
  applicationId: string;
  candidateName: string;
  csrf: string;
  disclosureEnabled: boolean;
  onClose: (rejected: boolean) => void;
}

export default function RejectionReasonDialog({ applicationId, candidateName, csrf, disclosureEnabled, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [category, setCategory] = useState("");
  const [freeText, setFreeText] = useState("");
  const [share, setShare] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const close = useCallback((rejected: boolean) => { dialogRef.current?.close(); onClose(rejected); }, [onClose]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setError("");
      try {
        const body: Record<string, unknown> = { id: applicationId, status: "rejected" };
        if (category) {
          body.adverseAction = {
            category,
            ...(freeText.trim() ? { freeText: freeText.trim() } : {}),
            sharedWithCandidate: disclosureEnabled && share,
            ...(share && message.trim() ? { candidateMessage: message.trim() } : {}),
          };
        }
        const res = await fetch("/api/admin/applications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Couldn't reject."); return; }
        close(true);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, applicationId, category, freeText, share, message, disclosureEnabled, csrf, close],
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); close(false); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(false); }}
      aria-labelledby={headingId}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex open:items-center open:justify-center"
    >
      <div className="mx-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Reject application</h2>
            <p className="mt-0.5 text-sm text-gray-600">{candidateName}</p>
          </div>
          <button type="button" onClick={() => close(false)} aria-label="Cancel"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block text-sm font-medium text-gray-700">Reason <span className="font-normal text-gray-400">(optional, internal)</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          {category && (
            <>
              <label className="block text-sm font-medium text-gray-700">Internal notes <span className="font-normal text-gray-400">(never shown to the candidate)</span>
                <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={2} maxLength={5000}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
              </label>

              {disclosureEnabled ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <label className="flex items-start gap-2 text-sm text-gray-800">
                    <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                    <span>Share a message with the candidate (optional). If blank, a neutral standard message for the reason is sent.</span>
                  </label>
                  {share && (
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000}
                      placeholder="e.g. Thanks for applying. We've decided to move forward with candidates whose experience more closely matched this role."
                      className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Candidate disclosure is off for this workspace — the reason is recorded internally only.</p>
              )}
            </>
          )}

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <Button type="submit" variant="danger" loading={saving} disabled={saving}>Reject</Button>
            <Button type="button" variant="secondary" onClick={() => close(false)}>Cancel</Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
