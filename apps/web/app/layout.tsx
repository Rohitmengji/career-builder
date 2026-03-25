import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";
import { fetchTenantConfig } from "@/lib/tenant";

// Validate environment variables at startup (warns in dev, throws in prod)
validateEnv();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        {children}
      </body>
    </html>
  );
}
