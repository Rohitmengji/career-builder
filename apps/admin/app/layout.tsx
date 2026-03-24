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
