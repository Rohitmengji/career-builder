/*
 * NotificationBell — recruiter in-app notifications (ADR-0009, Phase 4).
 * Bell + unread badge + dropdown. Polls /api/admin/notifications; mark-read PATCH
 * carries the cb_csrf cookie token.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const c = document.cookie.split(";").find((x) => x.trim().startsWith("cb_csrf="));
  return c ? c.split("=")[1] : "";
}

function relativeTime(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async (): Promise<{ notifications?: Notification[]; unread?: number } | null> => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchNotifs();
    if (data) { setItems(data.notifications || []); setUnread(data.unread || 0); }
  }, [fetchNotifs]);

  useEffect(() => {
    let active = true;
    const apply = async () => {
      const data = await fetchNotifs();
      if (active && data) { setItems(data.notifications || []); setUnread(data.unread || 0); }
    };
    void apply();
    const t = setInterval(apply, 60_000);
    return () => { active = false; clearInterval(t); };
  }, [fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
        body: "{}",
      });
    } catch {
      /* optimistic */
    }
  }, []);

  const onToggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) void refresh();
      return next;
    });
  }, [refresh]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {items.map((n) => {
                  const inner = (
                    <div className="flex items-start gap-2">
                      {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />}
                      <div className={`min-w-0 ${n.readAt ? "pl-3.5" : ""}`}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-gray-600">{n.body}</p>}
                        <p className="mt-0.5 text-[11px] text-gray-400">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id} className={`px-4 py-3 ${n.readAt ? "" : "bg-blue-50/40"}`}>
                      {n.link ? (
                        <a href={n.link} className="block hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">{inner}</a>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
