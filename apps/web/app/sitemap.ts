/*
 * Dynamic sitemap — Next.js App Router convention.
 * Generates a sitemap with all published jobs + static pages.
 */

import type { MetadataRoute } from "next";
import { jobRepo, pageRepo } from "@career-builder/database";
import { getSiteUrl } from "@/lib/env";

export const revalidate = 3600; // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const tenantId = process.env.TENANT_ID || "default";
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
  ];

  // Published jobs
  let jobEntries: MetadataRoute.Sitemap = [];
  try {
    const result = await jobRepo.search({ tenantId, isPublished: true }, 1, 1000);
    jobEntries = result.data.map((job) => ({
      url: `${siteUrl}/jobs/${job.id}`,
      lastModified: new Date(job.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unavailable — skip job entries
  }

  // Published pages (from visual editor)
  let pageEntries: MetadataRoute.Sitemap = [];
  try {
    const pages = await pageRepo.findByTenant(tenantId);
    pageEntries = pages
      .filter((p) => p.isPublished && p.slug !== "home" && p.slug !== "index")
      .map((p) => ({
        url: `${siteUrl}/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch {
    // DB unavailable — skip page entries
  }

  return [...staticPages, ...jobEntries, ...pageEntries];
}
