import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "HireBase — AI-Powered Career Site + Hiring Platform",
  description:
    "Build your career site in minutes with AI. Job listings, hiring workflows, visual editor — all in one platform. Trusted by modern teams.",
  keywords: [
    "career site builder",
    "AI hiring platform",
    "job listing software",
    "career page generator",
    "ATS alternative",
    "visual career site editor",
  ],
  openGraph: {
    title: "HireBase — Build Your Career Site in Minutes",
    description:
      "AI-powered career pages, job listings, and hiring workflows — all in one platform.",
    type: "website",
    siteName: "HireBase",
    locale: "en_US",
    url: "https://hirebase.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "HireBase — AI-Powered Career Site + Hiring Platform",
    description:
      "Build your career site in minutes. AI-powered job listings and hiring workflows.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
