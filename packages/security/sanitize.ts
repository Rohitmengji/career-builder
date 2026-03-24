/*
 * @career-builder/security — Input Sanitization
 *
 * Defense against XSS, HTML injection, CSS injection, and script injection.
 * Server-side only — does NOT depend on DOM APIs.
 *
 * Principles:
 *   - Strip all HTML tags by default
 *   - Escape special characters for safe rendering
 *   - Validate hex colors to prevent CSS injection
 *   - Sanitize GrapesJS block props before persistence
 *   - Never trust user input
 */

/* ================================================================== */
/*  HTML entity escaping                                               */
/* ================================================================== */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
};

const HTML_ESCAPE_RE = /[&<>"'`/]/g;

/** Escape a string for safe insertion into HTML. */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/* ================================================================== */
/*  Strip HTML tags                                                    */
/* ================================================================== */

const TAG_RE = /<\/?[^>]+(>|$)/g;
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const EVENT_HANDLER_RE = /\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const JAVASCRIPT_URI_RE = /javascript\s*:/gi;
const DATA_URI_RE = /data\s*:[^,]*;base64/gi;

/**
 * Strip ALL HTML from a string. Returns plain text.
 * Use for any field that should never contain markup.
 */
export function stripHtml(str: string): string {
  return str
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(TAG_RE, "")
    .replace(JAVASCRIPT_URI_RE, "")
    .replace(DATA_URI_RE, "")
    .trim();
}

/**
 * Sanitize rich text: allow safe subset of tags, strip everything dangerous.
 * For job descriptions etc. where some formatting is acceptable.
 */
export function sanitizeRichText(html: string): string {
  // Remove scripts, styles, event handlers, and dangerous URIs
  let clean = html
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(JAVASCRIPT_URI_RE, "")
    .replace(DATA_URI_RE, "");

  // Remove all tags except a safe whitelist
  const ALLOWED_TAGS = new Set([
    "p", "br", "b", "i", "u", "em", "strong", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr", "span", "div", "sub", "sup",
  ]);

  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    const lower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(lower)) {
      // For allowed tags, strip attributes except href on <a>
      if (lower === "a") {
        const hrefMatch = match.match(/href\s*=\s*"([^"]*)"/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          // Only allow http/https links
          if (/^https?:\/\//i.test(href)) {
            return match.startsWith("</")
              ? `</${lower}>`
              : `<${lower} href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">`;
          }
        }
        return match.startsWith("</") ? `</${lower}>` : `<${lower}>`;
      }
      // Strip all attributes from other allowed tags
      return match.startsWith("</") ? `</${lower}>` : `<${lower}>`;
    }
    return ""; // Strip disallowed tags entirely
  });

  return clean.trim();
}

/* ================================================================== */
/*  CSS injection prevention                                           */
/* ================================================================== */

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_INJECTION_RE = /expression\s*\(|url\s*\(|@import|behavior\s*:|binding\s*:|\\00|\\u00|javascript:/gi;

/** Validate a hex color. Returns the color or null. */
export function validateHexColor(value: string): string | null {
  if (typeof value !== "string") return null;
  return HEX_COLOR_RE.test(value.trim()) ? value.trim() : null;
}

/** Sanitize a CSS value — reject anything with injection patterns. */
export function sanitizeCssValue(value: string): string | null {
  if (typeof value !== "string") return null;
  if (CSS_INJECTION_RE.test(value)) return null;
  // Only allow alphanumeric, hyphens, underscores, spaces, dots, %, px, em, rem, #
  if (!/^[a-zA-Z0-9\s\-_.%#,()]+$/.test(value)) return null;
  return value;
}

/** Sanitize an entire theme color object. Invalid values become null. */
export function sanitizeThemeColors(colors: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, val] of Object.entries(colors)) {
    if (typeof val === "string") {
      const validated = validateHexColor(val);
      if (validated) safe[key] = validated;
    }
  }
  return safe;
}

/* ================================================================== */
/*  GrapesJS block sanitization                                        */
/* ================================================================== */

/**
 * Sanitize GrapesJS block props before saving.
 * Strips script injection, event handlers, and dangerous patterns
 * from all string properties recursively.
 */
export function sanitizeBlockProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") {
      // Reject any prop that looks like it contains script injection
      result[key] = stripDangerousStrings(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? stripDangerousStrings(item)
          : typeof item === "object" && item !== null
          ? sanitizeBlockProps(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeBlockProps(value as Record<string, unknown>);
    } else {
      // numbers, booleans — pass through
      result[key] = value;
    }
  }

  return result;
}

/** Remove dangerous patterns from a string but keep the text content. */
function stripDangerousStrings(str: string): string {
  return str
    .replace(SCRIPT_RE, "")
    .replace(STYLE_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(JAVASCRIPT_URI_RE, "")
    .replace(DATA_URI_RE, "");
}

/* ================================================================== */
/*  String sanitization for general user input                         */
/* ================================================================== */

/** Trim, collapse whitespace, remove control characters. */
export function sanitizeString(input: string, maxLength = 1000): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim()
    .substring(0, maxLength);
}

/** Sanitize an email address. Lowercases and validates format. */
export function sanitizeEmail(email: string): string | null {
  const cleaned = email.trim().toLowerCase();
  // RFC 5322 simplified
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(cleaned)) {
    return null;
  }
  if (cleaned.length > 254) return null;
  return cleaned;
}

/** Sanitize a slug — only lowercase alphanumeric + hyphens. */
export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

/** Sanitize a tenant ID — only lowercase alphanumeric + hyphens. */
export function sanitizeTenantId(id: string): string | null {
  const cleaned = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (cleaned.length === 0 || cleaned.length > 50) return null;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(cleaned)) return null;
  return cleaned;
}
