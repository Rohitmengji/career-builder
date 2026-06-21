"use client";

/*
 * CommentsDialog — internal hiring-team comment thread for one application,
 * with @mention autocomplete over team members. Internal-only; candidates
 * never see this. Rendered as a native <dialog> (focus trap + Esc handled by
 * the platform).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Spinner, XIcon } from "@/components/ui";
import { renderSegments, mentionToken } from "@/lib/mentions";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

interface Props {
  applicationId: string;
  candidateName: string;
  currentUserId: string;
  csrf: string;
  onClose: () => void;
}

export default function CommentsDialog({ applicationId, candidateName, currentUserId, csrf, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();

  const [comments, setComments] = useState<Comment[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const inFlight = useRef(false);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const base = `/api/admin/applications/${encodeURIComponent(applicationId)}/comments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(base, { cache: "no-store" }),
        fetch("/api/admin/team", { cache: "no-store" }),
      ]);
      if (!cRes.ok) throw new Error("load");
      const cData = await cRes.json();
      setComments(cData.comments || []);
      if (tRes.ok) setTeam((await tRes.json()).team || []);
    } catch {
      setError("Unable to load comments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void load();
  }, [load]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  // Detect an "@query" immediately before the caret to drive autocomplete.
  const onBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const m = /@([\w.\-]{0,30})$/.exec(upToCaret);
    setMentionQuery(m ? m[1]!.toLowerCase() : null);
  }, []);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return team
      .filter((u) => u.name.toLowerCase().includes(mentionQuery) || u.email.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, team]);

  const insertMention = useCallback((u: TeamMember) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? body.length;
    const upToCaret = body.slice(0, caret);
    const rest = body.slice(caret);
    const replaced = upToCaret.replace(/@([\w.\-]{0,30})$/, mentionToken(u.name, u.id) + " ");
    const next = replaced + rest;
    setBody(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  }, [body]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (inFlight.current) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      inFlight.current = true;
      setPosting(true);
      setError("");
      try {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ body: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Couldn't post your comment. Please try again.");
          return;
        }
        setComments((prev) => [...prev, data.comment]);
        setBody("");
        setMentionQuery(null);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        inFlight.current = false;
        setPosting(false);
      }
    },
    [body, base, csrf],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this comment?")) return;
      try {
        const res = await fetch(`${base}?commentId=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf },
        });
        if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
      } catch {
        /* ignore — list stays as-is */
      }
    },
    [base, csrf],
  );

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
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Comments</h2>
            <p className="mt-0.5 text-sm text-gray-600">{candidateName} · internal only</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close comments"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Thread */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-blue-600"><Spinner /><span className="sr-only">Loading comments…</span></div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No comments yet. Start the discussion below.</p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.author?.name || c.author?.email || "Teammate"}</span>
                    <span className="flex items-center gap-2">
                      <time className="text-xs text-gray-500" dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
                      {c.author?.id === currentUserId && (
                        <button type="button" onClick={() => remove(c.id)} className="text-xs text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Delete</button>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-gray-700">
                    {renderSegments(c.body).map((seg, i) =>
                      seg.type === "mention" ? (
                        <span key={i} className="font-medium text-blue-700">@{seg.name}</span>
                      ) : (
                        <span key={i}>{seg.value}</span>
                      ),
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={submit} className="border-t border-gray-200 p-4">
          {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
          <div className="relative">
            <label htmlFor={`${headingId}-input`} className="sr-only">Add a comment (type @ to mention a teammate)</label>
            <textarea
              id={`${headingId}-input`}
              ref={textareaRef}
              value={body}
              onChange={onBodyChange}
              onKeyDown={(e) => { if (e.key === "Escape" && mentionQuery !== null) { e.stopPropagation(); setMentionQuery(null); } }}
              rows={3}
              maxLength={5000}
              placeholder="Add a comment… use @ to mention a teammate"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            {/* @mention autocomplete */}
            {mentionQuery !== null && suggestions.length > 0 && (
              <ul role="listbox" aria-label="Mention a teammate" className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {suggestions.map((u) => (
                  <li key={u.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => insertMention(u)} className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                      <span className="text-xs text-gray-500">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" loading={posting} disabled={posting || !body.trim()}>Comment</Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
