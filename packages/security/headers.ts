/*
 * @career-builder/security — Security Headers
 *
 * Production-grade HTTP security headers.
 * Apply via Next.js middleware or next.config.ts headers.
 *
 * Covers:
 *   - Content Security Policy (CSP)
 *   - XSS protection
 *   - Clickjacking prevention
 *   - MIME sniffing prevention
 *   - Referrer policy
 *   - HSTS
 *   - Permissions policy
 */

/* ================================================================== */
/*  CSP Builder                                                        */
/* ================================================================== */

export interface CspConfig {
  /** Allow inline styles (needed for some CSS-in-JS / GrapesJS) */
  allowInlineStyles?: boolean;
  /** Allow inline scripts (needed for Next.js hydration bootstrap) */
  allowInlineScripts?: boolean;
  /** Allow eval (needed for GrapesJS editor — admin only!) */
  allowEval?: boolean;
  /** Additional trusted script sources */
  scriptSources?: string[];
  /** Additional trusted style sources */
  styleSources?: string[];
  /** Additional trusted image sources */
  imgSources?: string[];
  /** Additional trusted connect sources (API, WebSocket) */
  connectSources?: string[];
  /** Additional trusted font sources */
  fontSources?: string[];
  /** Additional trusted frame sources */
  frameSources?: string[];
  /** Report URI for CSP violations */
  reportUri?: string;
}

export function buildCsp(config: CspConfig = {}): string {
  const directives: string[] = [];

  // Default: block everything not explicitly allowed
  directives.push("default-src 'self'");

  // Scripts
  const scriptSrc = ["'self'"];
  if (config.allowInlineScripts) scriptSrc.push("'unsafe-inline'"); // Next.js hydration needs this
  if (config.allowEval) scriptSrc.push("'unsafe-eval'"); // GrapesJS needs this
  if (config.scriptSources) scriptSrc.push(...config.scriptSources);
  directives.push(`script-src ${scriptSrc.join(" ")}`);

  // Styles
  const styleSrc = ["'self'"];
  if (config.allowInlineStyles) styleSrc.push("'unsafe-inline'");
  styleSrc.push("https://fonts.googleapis.com"); // Google Fonts
  styleSrc.push("https://cdnjs.cloudflare.com"); // Font Awesome (GrapesJS)
  styleSrc.push("https://cdn.jsdelivr.net"); // Tailwind CDN (GrapesJS canvas)
  if (config.styleSources) styleSrc.push(...config.styleSources);
  directives.push(`style-src ${styleSrc.join(" ")}`);

  // Images — allow https: for user-uploaded content and external images in the editor
  const imgSrc = ["'self'", "data:", "blob:", "https:"];
  if (config.imgSources) imgSrc.push(...config.imgSources);
  directives.push(`img-src ${imgSrc.join(" ")}`);

  // Fonts
  const fontSrc = ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"];
  if (config.fontSources) fontSrc.push(...config.fontSources);
  directives.push(`font-src ${fontSrc.join(" ")}`);

  // Connect (API, WebSocket, SSE)
  const connectSrc = ["'self'"];
  if (config.connectSources) connectSrc.push(...config.connectSources);
  directives.push(`connect-src ${connectSrc.join(" ")}`);

  // Frames
  const frameSrc = config.frameSources?.length
    ? `frame-src ${config.frameSources.join(" ")}`
    : "frame-src 'none'";
  directives.push(frameSrc);

  // Objects (Flash, etc.) — always block
  directives.push("object-src 'none'");

  // Base URI — prevent base tag hijacking
  directives.push("base-uri 'self'");

  // Form actions
  directives.push("form-action 'self'");

  // Frame ancestors — prevent clickjacking
  directives.push("frame-ancestors 'none'");

  // Report
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join("; ");
}

/* ================================================================== */
/*  Header presets                                                     */
/* ================================================================== */

export interface SecurityHeaderConfig {
  csp?: CspConfig;
  /** Whether this is the admin app (more permissive for GrapesJS) */
  isAdmin?: boolean;
}

/** Get all security headers as a Record. */
export function getSecurityHeaders(config: SecurityHeaderConfig = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  const isDev = process.env.NODE_ENV !== "production";

  // Dev-mode connect sources (Turbopack HMR uses WebSocket)
  const devConnectSources = isDev
    ? ["ws://localhost:3000", "ws://localhost:3001", "http://localhost:3000", "http://localhost:3001"]
    : [];

  // Production connect sources from env
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const adminApiUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL || process.env.ADMIN_API_URL;
  const envConnectSources = [
    ...(appUrl ? [appUrl] : []),
    ...(adminApiUrl ? [adminApiUrl] : []),
  ];

  // Geo-pricing APIs (read-only, trusted — needed for region-based pricing)
  const geoConnectSources = [
    "https://api.country.is",
    "https://ipwho.is",
    "https://ipapi.co",
  ];

  // GrapesJS telemetry (editor sends anonymous usage data)
  const editorConnectSources = config.isAdmin
    ? ["https://app.grapesjs.com"]
    : [];

  // CSP — admin is more permissive for GrapesJS editor
  const cspConfig: CspConfig = config.isAdmin
    ? {
        allowInlineStyles: true,
        allowInlineScripts: true, // Next.js hydration bootstrap
        allowEval: true, // GrapesJS requires eval
        connectSources: [...devConnectSources, ...envConnectSources, ...geoConnectSources, ...editorConnectSources],
        frameSources: ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com"],
        ...(config.csp || {}),
      }
    : {
        allowInlineStyles: true, // Tailwind / design tokens inject inline styles
        allowInlineScripts: true, // Next.js hydration bootstrap
        connectSources: [...devConnectSources, ...envConnectSources, ...geoConnectSources],
        frameSources: ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com"],
        ...(config.csp || {}),
      };
  headers["Content-Security-Policy"] = buildCsp(cspConfig);

  // Prevent clickjacking
  headers["X-Frame-Options"] = "DENY";

  // Prevent MIME sniffing
  headers["X-Content-Type-Options"] = "nosniff";

  // XSS filter (legacy browsers)
  headers["X-XSS-Protection"] = "1; mode=block";

  // Referrer policy — send origin only
  headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

  // HSTS — force HTTPS (1 year, include subdomains)
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // Permissions policy — disable unnecessary browser APIs
  headers["Permissions-Policy"] = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
  ].join(", ");

  // Prevent caching of sensitive pages
  headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
  headers["Pragma"] = "no-cache";

  return headers;
}

/** Convert headers record to Next.js header format. */
export function toNextHeaders(headers: Record<string, string>): { key: string; value: string }[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}
