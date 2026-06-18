/*
 * Jobs section layout — wraps /jobs and /jobs/[id] with the tenant ThemeProvider.
 *
 * This is a Server Component. It fetches the tenant config once per request
 * and provides theme/branding via context to all client components below.
 */

import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { fetchTenantConfig } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchTenantConfig();
  const company = config.branding?.companyName || "Our Company";
  return {
    title: `Open Positions — ${company} Careers`,
    description: `Browse open jobs at ${company}. Find your next role and apply today.`,
  };
}

export default async function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await fetchTenantConfig();

  return (
    <ThemeProvider theme={config.theme} branding={config.branding}>
      {children}
    </ThemeProvider>
  );
}
