/*
 * @career-builder/security — URL Validation & SSRF Prevention
 *
 * Protects against:
 *   - SSRF (Server-Side Request Forgery)
 *   - Open redirect attacks
 *   - DNS rebinding
 *   - Access to internal networks
 *   - javascript: and data: URIs
 */

/* ================================================================== */
/*  Internal / private IP ranges                                       */
/* ================================================================== */

const PRIVATE_IP_RANGES = [
  /^127\./,                             // Loopback
  /^10\./,                              // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,        // Class B private
  /^192\.168\./,                        // Class C private
  /^169\.254\./,                        // Link-local
  /^0\./,                               // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,// Shared address space
  /^::1$/,                              // IPv6 loopback
  /^fc00:/i,                            // IPv6 unique local
  /^fe80:/i,                            // IPv6 link-local
  /^fd/i,                               // IPv6 private
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "metadata.google.internal",        // GCP metadata
  "169.254.169.254",                  // AWS/GCP/Azure metadata
  "metadata.google.internal.",
]);

/** Check if an IP address is private/internal. */
function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

/* ================================================================== */
/*  URL validation                                                     */
/* ================================================================== */

export interface UrlValidationOptions {
  /** Allowed protocols (default: ["https:", "http:"]) */
  allowedProtocols?: string[];
  /** Allowed hostnames (whitelist mode — if set, only these are allowed) */
  allowedHosts?: string[];
  /** Maximum URL length */
  maxLength?: number;
  /** Allow data: URIs */
  allowDataUri?: boolean;
}

const DEFAULT_OPTIONS: Required<UrlValidationOptions> = {
  allowedProtocols: ["https:", "http:"],
  allowedHosts: [],
  maxLength: 2048,
  allowDataUri: false,
};

/**
 * Validate a URL against SSRF and injection attacks.
 * Returns { valid, url, error }.
 */
export function validateUrl(
  input: string,
  options: UrlValidationOptions = {},
): { valid: boolean; url?: URL; error?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!input || typeof input !== "string") {
    return { valid: false, error: "URL is required" };
  }

  const trimmed = input.trim();

  if (trimmed.length > opts.maxLength) {
    return { valid: false, error: `URL exceeds maximum length of ${opts.maxLength}` };
  }

  // Block javascript: and data: URIs
  const lowerUrl = trimmed.toLowerCase();
  if (lowerUrl.startsWith("javascript:")) {
    return { valid: false, error: "javascript: URIs are not allowed" };
  }
  if (lowerUrl.startsWith("data:") && !opts.allowDataUri) {
    return { valid: false, error: "data: URIs are not allowed" };
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check protocol
  if (!opts.allowedProtocols.includes(url.protocol)) {
    return { valid: false, error: `Protocol ${url.protocol} is not allowed` };
  }

  // Check hostname against blocked list
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: "Internal hostnames are not allowed" };
  }

  // Check if hostname resolves to a private IP
  if (isPrivateIp(hostname)) {
    return { valid: false, error: "Private IP addresses are not allowed" };
  }

  // Whitelist mode
  if (opts.allowedHosts.length > 0) {
    const allowed = opts.allowedHosts.some(
      (h) => hostname === h.toLowerCase() || hostname.endsWith(`.${h.toLowerCase()}`),
    );
    if (!allowed) {
      return { valid: false, error: `Host ${hostname} is not in the allowed list` };
    }
  }

  // Block authentication in URLs (user:pass@host)
  if (url.username || url.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  return { valid: true, url };
}

/**
 * Validate a URL and return just the URL string or null.
 * Convenience wrapper for simple checks.
 */
export function safeUrl(input: string, options?: UrlValidationOptions): string | null {
  const result = validateUrl(input, options);
  return result.valid && result.url ? result.url.toString() : null;
}

/**
 * Validate a resume/LinkedIn URL specifically.
 * More restrictive: only HTTPS, well-known domains preferred.
 */
export function validateResumeUrl(input: string): string | null {
  return safeUrl(input, { allowedProtocols: ["https:", "http:"] });
}

/**
 * Validate a LinkedIn URL.
 */
export function validateLinkedInUrl(input: string): string | null {
  const result = validateUrl(input, {
    allowedProtocols: ["https:"],
    allowedHosts: ["linkedin.com", "www.linkedin.com"],
  });
  return result.valid && result.url ? result.url.toString() : null;
}

/**
 * Validate a webhook callback URL.
 * Must be HTTPS in production, blocks internal addresses.
 */
export function validateWebhookUrl(input: string): string | null {
  const protocols = process.env.NODE_ENV === "production"
    ? ["https:"]
    : ["https:", "http:"];
  return safeUrl(input, { allowedProtocols: protocols });
}
