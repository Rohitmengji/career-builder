/**
 * AI Site Context — Persistent memory for site generation.
 *
 * Stores brand voice, company info, tone, and generation history
 * per tenant so that regeneration and new page generation stay
 * consistent with the original site creation intent.
 *
 * Persisted to the database via a simple key-value approach
 * on the tenant config API. On the client, stored in localStorage
 * as a fast cache.
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface SiteContext {
  /** Company name */
  companyName: string;
  /** Industry classification */
  industry: string;
  /** Company size / type */
  companyType: string;
  /** Content tone */
  tone: string;
  /** Target audience */
  audience: string;
  /** Hiring goals / focus areas */
  hiringGoals: string;
  /** Generated brand voice string for AI consistency */
  brandVoice: string;
  /** User's original prompt */
  originalPrompt: string;
  /** ISO timestamp of when context was created */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Slugs of pages that exist for this tenant */
  pageSlugs: string[];
}

const STORAGE_KEY = "cb:site-context";

/* ================================================================== */
/*  Client-side helpers (localStorage cache)                           */
/* ================================================================== */

/** Load context from localStorage (fast, synchronous) */
export function loadSiteContext(): SiteContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SiteContext;
  } catch {
    return null;
  }
}

/** Save context to localStorage */
export function saveSiteContextLocal(ctx: SiteContext): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // quota exceeded — non-fatal
  }
}

/** Clear local context */
export function clearSiteContext(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/* ================================================================== */
/*  Server persistence (via /api/site-context)                         */
/* ================================================================== */

/** Save context to server */
export async function saveSiteContextToServer(ctx: SiteContext): Promise<boolean> {
  try {
    const csrf = typeof document !== "undefined"
      ? (document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/)?.[1] || "")
      : "";

    const res = await fetch("/api/site-context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(ctx),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Load context from server */
export async function loadSiteContextFromServer(): Promise<SiteContext | null> {
  try {
    const res = await fetch("/api/site-context");
    if (!res.ok) return null;
    const data = await res.json();
    return data.context || null;
  } catch {
    return null;
  }
}

/* ================================================================== */
/*  Build context from generation input                                */
/* ================================================================== */

export function buildSiteContext(
  input: {
    companyName: string;
    industry: string;
    companyType: string;
    tone: string;
    audience?: string;
    hiringGoals?: string;
    prompt?: string;
  },
  brandVoice: string,
  pageSlugs: string[],
): SiteContext {
  const now = new Date().toISOString();
  return {
    companyName: input.companyName,
    industry: input.industry,
    companyType: input.companyType,
    tone: input.tone,
    audience: input.audience || "general",
    hiringGoals: input.hiringGoals || "",
    brandVoice,
    originalPrompt: input.prompt || "",
    createdAt: now,
    updatedAt: now,
    pageSlugs,
  };
}

/* ================================================================== */
/*  Smart regeneration options                                         */
/* ================================================================== */

export interface RegenOption {
  id: string;
  label: string;
  icon: string;
  promptSuffix: string;
}

export const REGEN_OPTIONS: RegenOption[] = [
  {
    id: "improve-tone",
    label: "Improve tone",
    icon: "🎨",
    promptSuffix: "Improve the tone to be more refined, polished, and on-brand. Keep the same structure.",
  },
  {
    id: "more-engaging",
    label: "Make more engaging",
    icon: "⚡",
    promptSuffix: "Make the content more engaging, compelling, and action-oriented. Use stronger calls-to-action and more vivid language.",
  },
  {
    id: "optimize-hiring",
    label: "Optimize for hiring",
    icon: "🎯",
    promptSuffix: "Optimize all content specifically for hiring and recruitment. Emphasize career growth, culture, and why candidates should apply.",
  },
  {
    id: "shorten",
    label: "Shorten content",
    icon: "✂️",
    promptSuffix: "Make all content more concise. Shorter titles, briefer descriptions. Every word should earn its place.",
  },
  {
    id: "more-professional",
    label: "More professional",
    icon: "👔",
    promptSuffix: "Make the content more professional, corporate, and authoritative. Suitable for enterprise audiences.",
  },
  {
    id: "more-friendly",
    label: "More friendly & warm",
    icon: "😊",
    promptSuffix: "Make the content warmer, more human, and conversational. It should feel approachable and inviting.",
  },
  {
    id: "full-regenerate",
    label: "Full regenerate",
    icon: "🔄",
    promptSuffix: "",
  },
];
