import { RenderPage } from "@/lib/renderer";
import LiveReloader from "@/components/LiveReloader";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { SkipLink, AnnouncementProvider } from "@/lib/design-system-components";
import { Container, EmptyState, ButtonLink } from "@/components/ui";
import {
  type TenantConfig,
  DEFAULT_THEME,
  DEFAULT_BRANDING,
  mergeTenantConfig,
} from "@career-builder/tenant-config";

/**
 * Resolve the admin API base URL.
 * Priority: ADMIN_API_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost
 */
function getAdminApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");

  const publicUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (publicUrl?.trim()) return publicUrl.trim().replace(/\/$/, "");

  // Vercel auto-URL fallback (for single-project or preview)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("[page] ADMIN_API_URL not set in production — pages may not load");
  }

  return "http://localhost:3001";
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const apiUrl = getAdminApiUrl();

  let blocks: any[] = [];
  let tenantConfig: TenantConfig | null = null;

  // 5-second timeout to prevent SSR from hanging if admin API is down
  const fetchWithTimeout = (url: string, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { cache: "no-store", signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  try {
    // Fetch page blocks
    const res = await fetchWithTimeout(`${apiUrl}/api/pages?slug=${slug}`);
    if (res.ok) {
      const data = await res.json();
      blocks = data.blocks || [];
    }
  } catch {
    // Admin API may not be running or timed out
  }

  // Fetch tenant config — try slug as tenant ID, fall back to default
  try {
    const tenantRes = await fetchWithTimeout(`${apiUrl}/api/tenants?id=${slug}`);
    const tenantData = await tenantRes.json();
    tenantConfig = tenantData.tenant ? mergeTenantConfig(tenantData.tenant) : null;
  } catch {
    // Tenant API may not be running
  }

  // Fall back to default if no tenant-specific config
  if (!tenantConfig) {
    try {
      const defaultRes = await fetchWithTimeout(`${apiUrl}/api/tenants?id=default`);
      if (defaultRes.ok) {
        const defaultData = await defaultRes.json();
        tenantConfig = defaultData.tenant ? mergeTenantConfig(defaultData.tenant) : null;
      }
    } catch {
      // Use built-in defaults
    }
  }

  const theme = tenantConfig?.theme || DEFAULT_THEME;
  const branding = tenantConfig?.branding || DEFAULT_BRANDING;

  if (blocks.length === 0) {
    return (
      <ThemeProvider theme={theme} branding={branding}>
        <SkipLink />
        <main id="main-content" className="min-h-screen flex items-center justify-center bg-gray-50">
          <Container>
            <EmptyState
              icon={
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9M12 4h9M3 8h4M3 16h4M5 4v16" />
                </svg>
              }
              title="Page not published yet"
              body="This career page hasn't been built yet. Visit the admin editor to design and publish it."
              action={<ButtonLink href="/" variant="secondary">Back to home</ButtonLink>}
            />
          </Container>
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme} branding={branding}>
      <SkipLink />
      <AnnouncementProvider>
        <RenderPage blocks={blocks} />
      </AnnouncementProvider>
      <LiveReloader slug={slug} />
    </ThemeProvider>
  );
}
