/*
 * Root layout for the public career site (apps/web).
 *
 * WHAT: The top-level <html>/<body> shell wrapping every public page. Loads fonts,
 * global CSS, the a11y SkipLink, and derives per-tenant SEO metadata.
 *
 * WHY: The career site is tenant-branded — title/OG come from the resolved tenant's
 * branding, not a fixed product name (contrast app/(marketing)/layout.tsx, which is
 * the HireBase product site with static metadata).
 *
 * HOW: generateMetadata calls fetchTenantConfig() (lib/tenant resolves the tenant
 * from the request host/headers) and falls back to "Our Company" if branding is
 * absent. validateEnv() runs once at module load to fail fast on misconfiguration
 * (warns in dev, throws in prod). Note: this layout is a server component with no
 * tenant data leaking client-side beyond the rendered metadata.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";
import { fetchTenantConfig } from "@/lib/tenant";
import { SkipLink } from "@/lib/design-system-components";

// Validate environment variables at startup (warns in dev, throws in prod)
validateEnv();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchTenantConfig();
  const companyName = config.branding?.companyName || "Our Company";
  const logoUrl = config.branding?.logoUrl;

  const title = `Careers at ${companyName}`;
  const description = `Explore open positions and join the team at ${companyName}.`;

  return {
    title: {
      default: title,
      template: `%s | ${companyName} Careers`,
    },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(logoUrl ? { images: [{ url: logoUrl, alt: companyName }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-gray-900`}
      >
        <SkipLink />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
