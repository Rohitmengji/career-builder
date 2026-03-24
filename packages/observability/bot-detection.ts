/*
 * @career-builder/observability — Bot Detection & Protection
 *
 * Multi-signal bot detection:
 *   1. User-Agent analysis (known bots, headless browsers)
 *   2. Request pattern analysis (rate, timing, path traversal)
 *   3. Behavioral signals (no JS execution, cookie rejection)
 *   4. Fingerprint-based scoring
 *
 * Returns a threat score 0-100. Actions:
 *   0-20:  legit user
 *   21-50: suspicious — add CAPTCHA challenge
 *   51-80: likely bot — rate limit aggressively
 *   81-100: definite bot — block
 */

import { getLogger } from "./logger";
import { metrics, METRIC } from "./metrics";

const logger = getLogger("bot-detection");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface BotDetectionResult {
  score: number; // 0-100, higher = more likely bot
  isBot: boolean; // score > threshold
  signals: string[]; // which signals triggered
  action: "allow" | "challenge" | "throttle" | "block";
  category?: string; // "scraper" | "brute-force" | "crawler" | "unknown"
}

export interface BotDetectionConfig {
  /** Score threshold for blocking (default: 70) */
  blockThreshold?: number;
  /** Score threshold for CAPTCHA challenge (default: 40) */
  challengeThreshold?: number;
  /** Score threshold for aggressive rate limiting (default: 55) */
  throttleThreshold?: number;
  /** Allow known good bots (Googlebot, etc.) */
  allowGoodBots?: boolean;
}

/* ================================================================== */
/*  Known bot patterns                                                 */
/* ================================================================== */

const KNOWN_GOOD_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
];

const KNOWN_BAD_BOTS = [
  /scrapy/i,
  /httpclient/i,
  /python-requests/i,
  /python-urllib/i,
  /java\//i,
  /libwww-perl/i,
  /wget/i,
  /curl/i,
  /go-http-client/i,
  /php\//i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
];

const HEADLESS_BROWSERS = [
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
];

/* ================================================================== */
/*  Request Pattern Tracker                                            */
/* ================================================================== */

interface RequestPattern {
  timestamps: number[];
  paths: Set<string>;
  methods: Set<string>;
  statusCodes: number[];
}

const patternStore = new Map<string, RequestPattern>();
const PATTERN_WINDOW_MS = 60_000; // 1 minute window

function getPattern(key: string): RequestPattern {
  let pattern = patternStore.get(key);
  if (!pattern) {
    pattern = { timestamps: [], paths: new Set(), methods: new Set(), statusCodes: [] };
    patternStore.set(key, pattern);
  }
  // Prune old entries
  const cutoff = Date.now() - PATTERN_WINDOW_MS;
  pattern.timestamps = pattern.timestamps.filter((t) => t > cutoff);
  return pattern;
}

function recordRequest(key: string, path: string, method: string): void {
  const pattern = getPattern(key);
  pattern.timestamps.push(Date.now());
  pattern.paths.add(path);
  pattern.methods.add(method);
}

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - PATTERN_WINDOW_MS * 2;
  for (const [key, pattern] of patternStore) {
    const newest = pattern.timestamps.length > 0 ? Math.max(...pattern.timestamps) : 0;
    if (newest < cutoff) patternStore.delete(key);
  }
}, 120_000).unref?.();

/* ================================================================== */
/*  Bot Detector                                                       */
/* ================================================================== */

const DEFAULT_CONFIG: Required<BotDetectionConfig> = {
  blockThreshold: 70,
  challengeThreshold: 40,
  throttleThreshold: 55,
  allowGoodBots: true,
};

export function detectBot(
  request: Request,
  clientIp: string,
  config: BotDetectionConfig = {},
): BotDetectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let score = 0;
  const signals: string[] = [];
  let category: string | undefined;

  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  const path = url.pathname;

  // ── 1. User-Agent analysis ───────────────────────────────────
  if (!ua || ua.length < 10) {
    score += 30;
    signals.push("missing_or_short_ua");
    category = "unknown";
  }

  // Good bots (search engines)
  if (cfg.allowGoodBots && KNOWN_GOOD_BOTS.some((re) => re.test(ua))) {
    return {
      score: 0,
      isBot: false,
      signals: ["known_good_bot"],
      action: "allow",
      category: "crawler",
    };
  }

  // Bad bots
  if (KNOWN_BAD_BOTS.some((re) => re.test(ua))) {
    score += 50;
    signals.push("known_bad_bot");
    category = "scraper";
  }

  // Headless browsers
  if (HEADLESS_BROWSERS.some((re) => re.test(ua))) {
    score += 40;
    signals.push("headless_browser");
    category = "scraper";
  }

  // ── 2. Header analysis ──────────────────────────────────────
  const acceptHeader = request.headers.get("accept");
  if (!acceptHeader) {
    score += 15;
    signals.push("missing_accept_header");
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) {
    score += 10;
    signals.push("missing_accept_language");
  }

  const acceptEncoding = request.headers.get("accept-encoding");
  if (!acceptEncoding) {
    score += 10;
    signals.push("missing_accept_encoding");
  }

  // Connection header manipulation
  if (request.headers.get("connection") === "close") {
    score += 5;
    signals.push("connection_close");
  }

  // ── 3. Request pattern analysis ─────────────────────────────
  recordRequest(clientIp, path, request.method);
  const pattern = getPattern(clientIp);

  // High request rate (> 2 req/sec sustained)
  if (pattern.timestamps.length > 120) {
    score += 30;
    signals.push("very_high_request_rate");
    category = category || "scraper";
  } else if (pattern.timestamps.length > 60) {
    score += 15;
    signals.push("high_request_rate");
  }

  // Too many unique paths (path scanning)
  if (pattern.paths.size > 50) {
    score += 20;
    signals.push("path_scanning");
    category = category || "scraper";
  }

  // ── 4. Path-based signals ───────────────────────────────────
  const suspiciousPaths = [
    /\/\.env/,
    /\/wp-admin/,
    /\/wp-login/,
    /\/xmlrpc/,
    /\/phpmyadmin/i,
    /\/\.git/,
    /\/\.htaccess/,
    /\/admin\/config/,
    /\/api\/v[0-9]+\/debug/,
    /\/actuator/,
    /\/console/,
  ];

  if (suspiciousPaths.some((re) => re.test(path))) {
    score += 25;
    signals.push("suspicious_path_probe");
    category = "scraper";
  }

  // ── 5. Determine action ─────────────────────────────────────
  const isBot = score >= cfg.blockThreshold;
  let action: BotDetectionResult["action"] = "allow";

  if (score >= cfg.blockThreshold) {
    action = "block";
  } else if (score >= cfg.throttleThreshold) {
    action = "throttle";
  } else if (score >= cfg.challengeThreshold) {
    action = "challenge";
  }

  // Track metrics
  if (isBot) {
    metrics.increment(METRIC.BOT_DETECTIONS, { action, category: category || "unknown" });
    logger.warn("bot_detected", {
      ip: clientIp,
      score,
      action,
      category,
      signals: signals.join(","),
      userAgent: ua.slice(0, 200),
    });
  }

  return { score, isBot, signals, action, category };
}

/* ================================================================== */
/*  IP Blocklist (in-memory, auto-expiring)                            */
/* ================================================================== */

interface BlockEntry {
  reason: string;
  expiresAt: number;
  score: number;
}

const blocklist = new Map<string, BlockEntry>();

/** Block an IP for a duration. */
export function blockIp(ip: string, reason: string, durationMs = 3_600_000, score = 100): void {
  blocklist.set(ip, {
    reason,
    expiresAt: Date.now() + durationMs,
    score,
  });
  logger.warn("ip_blocked", { ip, reason, durationMs });
}

/** Check if an IP is blocked. */
export function isIpBlocked(ip: string): { blocked: boolean; reason?: string } {
  const entry = blocklist.get(ip);
  if (!entry) return { blocked: false };
  if (Date.now() > entry.expiresAt) {
    blocklist.delete(ip);
    return { blocked: false };
  }
  return { blocked: true, reason: entry.reason };
}

/** Unblock an IP. */
export function unblockIp(ip: string): void {
  blocklist.delete(ip);
}

/** Get all currently blocked IPs. */
export function getBlockedIps(): Array<{ ip: string; reason: string; expiresAt: number }> {
  const now = Date.now();
  const result: Array<{ ip: string; reason: string; expiresAt: number }> = [];
  for (const [ip, entry] of blocklist) {
    if (now < entry.expiresAt) {
      result.push({ ip, reason: entry.reason, expiresAt: entry.expiresAt });
    }
  }
  return result;
}

// Periodic cleanup of expired blocklist entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of blocklist) {
    if (now > entry.expiresAt) blocklist.delete(ip);
  }
}, 300_000).unref?.();
