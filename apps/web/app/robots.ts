/*
 * robots.txt generator for the public career site (Next.js Metadata Route).
 *
 * WHAT: Next serves the return value at /robots.txt. Allows crawlers on the
 * candidate-facing pages (/ and /jobs) while disallowing /api/ and /_next/.
 *
 * WHY: We want job listings indexed by search engines but must keep internal
 * API routes and Next build assets out of crawl results.
 *
 * HOW: The absolute site URL comes from getSiteUrl() (lib/env) rather than a
 * hardcoded host, so sitemap/host stay correct across environments/tenants.
 */
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jobs", "/jobs/"],
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
