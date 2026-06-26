/*
 * ManageTagsDialog (ADR-0016, B2b) — CRUD for the per-tenant application-tag library.
 *
 * WHAT: create a tag (label + palette colour), rename / recolour, or delete a tag.
 * WHY: the library is the source of tags recruiters apply to candidates; this is
 *   where it's curated.
 * HOW: talks to /api/admin/tags (GET/POST/PATCH/DELETE, CSRF header). Colour is
 *   chosen from the closed palette (tagColors.PALETTE) — never free text. Calls
 *   onChanged() after any mutation so the parent reloads its library + chips.
 */
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, XIcon } from "@/components/ui";
import { chipClass, swatchClass, PALETTE } from "./tagColors";

export interface LibTag {
  id: string;
  label: string;
  color: string | null;
  count: number;
}

export default function ManageTagsDialog({
  tags,
  csrf,
  onClose,
  onChanged,
}: {
  tags: LibTag[];
  csrf: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("gray");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const close = useCallback(() => { dialogRef.current?.close(); onClose(); }, [onClose]);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-csrf-token": csrf }), [csrf]);

  const create = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.replace(/\s+/g, " ").trim();
    if (!label || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/tags", { method: "POST", headers, body: JSON.stringify({ label, color: newColor }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not create tag"); }
      setNewLabel("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tag");
    } finally {
      setBusy(false);
    }
  }, [newLabel, newColor, busy, headers, onChanged]);

  async function recolor(id: string, color: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/tags", { method: "PATCH", headers, body: JSON.stringify({ id, color }) });
      if (!res.ok) throw new Error("Could not update tag");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tag");
    } finally { setBusy(false); }
  }

  async function remove(id: string, count: number) {
    if (busy) return;
    if (count > 0 && !confirm(`Delete this tag? It will be removed from ${count} application${count === 1 ? "" : "s"}.`)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/tags", { method: "DELETE", headers, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error("Could not delete tag");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete tag");
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} className="m-auto w-full max-w-lg rounded-2xl p-0 backdrop:bg-black/30" onClose={onClose}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">Manage tags</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XIcon /></button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {/* Create */}
        <form onSubmit={create} className="mb-5 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="new-tag" className="mb-1 block text-xs font-medium text-gray-500">New tag</label>
            <input
              id="new-tag"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              maxLength={40}
              placeholder="e.g. referral"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Tag colour">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={newColor === c}
                className={`h-6 w-6 rounded-full ${swatchClass(c)} ${newColor === c ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
              />
            ))}
          </div>
          <Button type="submit" disabled={busy || !newLabel.trim()}>Add</Button>
        </form>

        {/* Existing tags */}
        <div className="max-h-72 space-y-2 overflow-auto">
          {tags.length === 0 && <p className="text-sm text-gray-500">No tags yet — create one above.</p>}
          {tags.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chipClass(t.color)}`}>{t.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{t.count} used</span>
                <div className="flex items-center gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => recolor(t.id, c)}
                      aria-label={`Recolour ${t.label} ${c}`}
                      className={`h-4 w-4 rounded-full ${swatchClass(c)} ${t.color === c ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                    />
                  ))}
                </div>
                <button type="button" onClick={() => remove(t.id, t.count)} aria-label={`Delete ${t.label}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><XIcon /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={close}>Done</Button>
        </div>
      </div>
    </dialog>
  );
}
