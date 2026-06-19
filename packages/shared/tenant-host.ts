/*
 * @career-builder/shared/tenant-host — EDGE-SAFE host → tenant parsing.
 *
 * Pure string logic only: NO database, NO Node APIs. This is the one module
 * that edge middleware may import to derive a tenant candidate from the request
 * host without pulling Prisma (tenant-resolver) or node:async_hooks
 * (tenant-context) into the edge bundle.
 *
 * Resolution shape:
 *   - subdomain of the platform root  → `acme.hirebase.dev`  → candidate "acme"
 *   - dev subdomain                   → `acme.localhost`     → candidate "acme"
 *   - apex / reserved / www           → no candidate
 *   - a host that is NOT under the root domain → treated as a CUSTOM DOMAIN
 *     (candidate=null, isCustomDomain=true) so the Node layer resolves it by
 *     exact Tenant.domain match instead of guessing a subdomain.
 *
 * Set PLATFORM_ROOT_DOMAIN (e.g. "hirebase.dev") for precise subdomain vs
 * custom-domain disambiguation. Without it, a heuristic (>=3 labels → first
 * label is the subdomain) is used.
 */

/** Subdomains that are never tenants (platform/system surfaces). */
export const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin", "app"]);

export interface ParsedHost {
  /** Normalized host: lowercased, port stripped. */
  host: string;
  /** The subdomain label, when the host is under the platform root. */
  subdomain: string | null;
  /** Tenant slug guess (currently === subdomain), or null. */
  candidate: string | null;
  /** True when the host is not under the platform root → resolve by domain. */
  isCustomDomain: boolean;
}

function normalizeHost(rawHost: string | null | undefined): string {
  return (rawHost || "").split(":")[0]!.trim().toLowerCase();
}

/** A valid single subdomain label (no dots, not reserved, non-empty). */
function asCandidate(label: string): string | null {
  if (!label || label.includes(".") || RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

/**
 * Parse a request host into a tenant candidate. Pure + edge-safe.
 *
 * @param rawHost   the `Host` header value (may include port)
 * @param rootDomain optional platform root (defaults to PLATFORM_ROOT_DOMAIN)
 */
export function parseHostTenant(
  rawHost: string | null | undefined,
  rootDomain: string | undefined = process.env.PLATFORM_ROOT_DOMAIN,
): ParsedHost {
  const host = normalizeHost(rawHost);
  if (!host) return { host: "", subdomain: null, candidate: null, isCustomDomain: false };

  // Dev convenience: <sub>.localhost always behaves like a subdomain.
  if (host === "localhost" || host.endsWith(".localhost")) {
    if (host === "localhost") return { host, subdomain: null, candidate: null, isCustomDomain: false };
    const sub = asCandidate(host.slice(0, -".localhost".length));
    return { host, subdomain: sub, candidate: sub, isCustomDomain: false };
  }

  const root = (rootDomain || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");

  if (root) {
    if (host === root) {
      // apex of the platform itself → no tenant
      return { host, subdomain: null, candidate: null, isCustomDomain: false };
    }
    if (host.endsWith("." + root)) {
      const sub = asCandidate(host.slice(0, -(root.length + 1)));
      return { host, subdomain: sub, candidate: sub, isCustomDomain: false };
    }
    // Under no known root → a customer's custom domain.
    return { host, subdomain: null, candidate: null, isCustomDomain: true };
  }

  // No root configured: heuristic — 3+ labels means the first is a subdomain.
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = asCandidate(parts[0]!);
    return { host, subdomain: sub, candidate: sub, isCustomDomain: false };
  }
  // 2-label apex (example.com) with no root configured → can't tell; treat as
  // a potential custom domain so the Node layer can try an exact domain match.
  return { host, subdomain: null, candidate: null, isCustomDomain: parts.length === 2 };
}
