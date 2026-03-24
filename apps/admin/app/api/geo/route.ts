/**
 * GET /api/geo
 *
 * Server-side IP geolocation endpoint.
 * Detects country from the incoming request IP using external APIs.
 * Returns { country: "NL" } or { country: "IN" } etc.
 *
 * This avoids CSP issues since external API calls happen server-side.
 */

import { NextRequest, NextResponse } from "next/server";

/* Country detection APIs — tried in order */
const GEO_APIS: { url: (ip: string) => string; extract: (d: any) => string }[] = [
  {
    url: (ip) => `https://api.country.is/${ip}`,
    extract: (d) => d.country,
  },
  {
    url: (ip) => `https://ipwho.is/${ip}`,
    extract: (d) => d.country_code,
  },
  {
    url: () => "https://ipapi.co/json/",
    extract: (d) => d.country_code,
  },
];

async function fetchCountry(url: string, extract: (d: any) => string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const code = extract(data);
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // Extract client IP from headers (works behind proxies, Vercel, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "";

  // Try each geo API
  for (const api of GEO_APIS) {
    const url = api.url(ip);
    const code = await fetchCountry(url, api.extract);
    if (code && code.length === 2) {
      return NextResponse.json({ country: code }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    }
  }

  // All APIs failed — return empty
  return NextResponse.json({ country: null }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
