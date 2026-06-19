/*
 * @mention parsing for application comments (pure).
 *
 * Mentions are encoded inline in the comment body as `@[Display Name](userId)`
 * tokens (inserted by the composer's autocomplete). The userId is therefore
 * authoritative and parsed server-side — the server never trusts a separate
 * client-supplied recipient list, and re-validates each id against the tenant's
 * users before notifying (no cross-tenant notification / enumeration).
 */

// Name: any chars except a closing bracket; userId: cuid-ish token.
const MENTION_RE = /@\[([^\]]{1,80})\]\(([A-Za-z0-9_-]{1,40})\)/g;

export interface ParsedMention {
  name: string;
  userId: string;
}

/** Extract unique mentions ({name, userId}) from a comment body. */
export function extractMentions(body: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const userId = m[2]!;
    if (!seen.has(userId)) {
      seen.add(userId);
      out.push({ name: m[1]!, userId });
    }
  }
  return out;
}

/** Just the unique userIds referenced in a body. */
export function extractMentionIds(body: string): string[] {
  return extractMentions(body).map((m) => m.userId);
}

export type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; userId: string };

/**
 * Split a body into text + mention segments for safe rendering. The UI renders
 * each segment as React text (auto-escaped) — never via innerHTML.
 */
export function renderSegments(body: string): Segment[] {
  const segs: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) segs.push({ type: "text", value: body.slice(last, idx) });
    segs.push({ type: "mention", name: m[1]!, userId: m[2]! });
    last = idx + m[0].length;
  }
  if (last < body.length) segs.push({ type: "text", value: body.slice(last) });
  return segs;
}

/** Build a mention token for insertion by the composer. */
export function mentionToken(name: string, userId: string): string {
  // Strip ] and ) from the display name so the token can't be broken/injected.
  const safeName = name.replace(/[\]()]/g, "").trim().slice(0, 80) || "user";
  return `@[${safeName}](${userId})`;
}
