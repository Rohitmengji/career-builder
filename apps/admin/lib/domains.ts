/*
 * Custom-domain helpers (SERVER-ONLY): plan gating, DNS instructions, and DNS
 * TXT ownership verification.
 *
 * SSL note: DNS verification proves ownership + routing. Certificate
 * provisioning is an infra step — on Vercel call the Domains API to add the
 * hostname (auto-provisions a cert); self-hosting needs the reverse proxy
 * (Caddy/Traefik/nginx + ACME) to issue a cert for the verified host. This
 * module intentionally does not couple to a specific provider.
 */

import { resolveTxt } from "node:dns/promises";
import { normalizeHostname } from "@career-builder/database/host";

/** Plans allowed to use custom domains. Free tenants get an upsell. */
export const CUSTOM_DOMAIN_PLANS = ["pro", "enterprise"] as const;

export function planAllowsCustomDomain(plan: string | null | undefined): boolean {
  return CUSTOM_DOMAIN_PLANS.includes(String(plan) as (typeof CUSTOM_DOMAIN_PLANS)[number]);
}

/**
 * Validate a user-entered hostname as a plausible public FQDN. Rejects
 * localhost, IPs, bare TLDs, and anything with a port/scheme/path (callers
 * normalize first). Defensive — the DB also has a unique constraint.
 */
export function isValidPublicHostname(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  if (!h || h.length > 253) return false;
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  // reject bare IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  // at least two labels (has a dot), valid label charset, a real TLD
  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  const labels = h.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => labelRe.test(l))) return false;
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1]!)) return false;
  return true;
}

/** The DNS record host where the ownership TXT must be placed. */
export function verifyTxtHost(hostname: string): string {
  return `_cb-verify.${normalizeHostname(hostname)}`;
}

/** The CNAME target tenants point their host at (env-driven). */
export function customDomainCnameTarget(): string {
  const explicit = process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim();
  if (explicit) return explicit.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      return new URL(site).host;
    } catch {
      /* fall through */
    }
  }
  return "cname.your-platform.example"; // documented placeholder
}

/** DNS records to show the tenant. */
export function dnsInstructions(hostname: string, verifyToken: string) {
  const host = normalizeHostname(hostname);
  return {
    cname: { type: "CNAME", host, value: customDomainCnameTarget() },
    txt: { type: "TXT", host: verifyTxtHost(host), value: verifyToken },
  };
}

/**
 * Verify domain ownership by looking up the TXT record and matching the token.
 * Bounded by a timeout so a slow/hostile resolver can't hang the request.
 * Never throws — returns false on any failure.
 */
export async function verifyDomainTxt(
  hostname: string,
  verifyToken: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const recordHost = verifyTxtHost(hostname);
  try {
    const lookup = resolveTxt(recordHost);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS timeout")), timeoutMs),
    );
    const records = (await Promise.race([lookup, timeout])) as string[][];
    // resolveTxt returns chunked records; join chunks then compare.
    return records.some((chunks) => chunks.join("").trim() === verifyToken.trim());
  } catch {
    return false;
  }
}
