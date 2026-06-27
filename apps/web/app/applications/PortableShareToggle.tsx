/*
 * PortableShareToggle (ADR-0030) — candidate opt-in to share their verified track record.
 *
 * WHAT: a toggle letting the candidate reveal their VERIFIED cross-platform track record
 *   (counts only — applications / interviews / offers / hires across employers, never
 *   which) to this employer. Fully revocable.
 * WHY: the candidate owns their hiring history; this lets them use it as a portable asset.
 * HOW: GET/POST /api/profile/portable-share. Renders nothing if the flag is off (404).
 *   React 19: await-inside-inline-async then setState.
 */
"use client";

import { useEffect, useState } from "react";

export default function PortableShareToggle() {
  const [shared, setShared] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch("/api/profile/portable-share", { cache: "no-store" });
        if (!res.ok) return; // flag off → render nothing
        const d = await res.json();
        if (active) setShared(Boolean(d.shared));
      } catch { /* ignore */ }
    };
    void run();
    return () => { active = false; };
  }, []);

  if (shared === null) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !shared;
    setShared(next); // optimistic
    try {
      const res = await fetch("/api/profile/portable-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share: next }),
      });
      if (!res.ok) setShared(!next); // rollback
    } catch { setShared(!next); } finally { setBusy(false); }
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Share your verified track record</p>
          <p className="mt-1 text-sm text-gray-600">
            Let this employer see a verified summary of your hiring history across the platform — how many roles you&apos;ve applied to and how far you&apos;ve progressed (interviews, offers). Only counts are shared, never which companies. You can turn this off anytime.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shared}
          aria-label="Share my verified track record with this employer"
          onClick={toggle}
          disabled={busy}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${shared ? "bg-indigo-600" : "bg-gray-300"} disabled:opacity-60`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${shared ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
