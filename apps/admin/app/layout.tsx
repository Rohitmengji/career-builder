/*
 * Root layout for the admin (recruiter) app — wraps every route.
 *
 * WHAT: Sets the <html>/<body> shell, loads the Geist fonts and global CSS,
 * wires the app-wide ErrorBoundary, and mounts the dev-only plan switcher.
 *
 * WHY/HOW: This is the single entry layout for the Next.js App Router, so
 * cross-cutting concerns live here. validateEnv("admin") runs at module load
 * (server startup) to fail-fast on missing/invalid env — it warns in dev and
 * throws in prod. ErrorBoundary catches render errors below it; the route-level
 * error.tsx handles segment errors. DevPlanSwitcher is a development aid (gated
 * internally) and is intentionally always mounted here.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DevPlanSwitcher from "@/components/DevPlanSwitcher";
import ErrorBoundary from "@/components/ErrorBoundary";
import { validateEnv } from "@/lib/env";

// Validate environment variables at startup (warns in dev, throws in prod)
validateEnv("admin");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Career Site Builder — Admin",
  description: "Visual drag-and-drop career page editor powered by GrapesJS and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <DevPlanSwitcher />
      </body>
    </html>
  );
}
