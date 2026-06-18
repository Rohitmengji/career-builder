/*
 * /preview/[slug]?token=… — token-gated DRAFT preview of a page, for the admin
 * editor's "Preview" button. Renders the unpublished draft exactly as the public
 * page will look once published, with a PREVIEW banner + live reload.
 *
 * Security: unpublished drafts are NOT public. Access requires a valid, short-
 * lived signed token (createPreviewToken) bound to {tenantId, slug}.
 */

import { RenderPage } from "@/lib/renderer";
import LiveReloader from "@/components/LiveReloader";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { SkipLink, AnnouncementProvider } from "@/lib/design-system-components";
import { Container, EmptyState, ButtonLink } from "@/components/ui";
import { verifyPreviewToken } from "@career-builder/shared/preview-token";
import { pageRepo, tenantRepo } from "@career-builder/database";
import {
  DEFAULT_THEME,
  DEFAULT_BRANDING,
  mergeTenantConfig,
} from "@career-builder/tenant-config";

export const dynamic = "force-dynamic";

function safeJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

function InvalidPreview() {
  return (
    <ThemeProvider theme={DEFAULT_THEME} branding={DEFAULT_BRANDING}>
      <SkipLink />
      <main id="main-content" className="min-h-screen flex items-center justify-center bg-gray-50">
        <Container>
          <EmptyState
            icon={
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" />
              </svg>
            }
            title="Preview link expired"
            body="This preview link is invalid or has expired. Open it again from the editor's Preview button."
            action={<ButtonLink href="/" variant="secondary">Back to home</ButtonLink>}
          />
        </Container>
      </main>
    </ThemeProvider>
  );
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  const claims = verifyPreviewToken(token);
  if (!claims || claims.slug !== slug) {
    return <InvalidPreview />;
  }

  // Token verified → safe to read the unpublished draft straight from the DB.
  const page = await pageRepo.findBySlug(slug, claims.tenantId).catch(() => null);
  const blocks = safeJson<any[]>(page?.blocks, []);

  const tenant = await tenantRepo.findById(claims.tenantId).catch(() => null);
  const config = tenant
    ? mergeTenantConfig({
        id: tenant.id,
        name: tenant.name,
        theme: safeJson<any>(tenant.theme, {}),
        branding: safeJson<any>(tenant.branding, {}),
      })
    : null;
  const theme = config?.theme || DEFAULT_THEME;
  const branding = config?.branding || DEFAULT_BRANDING;

  return (
    <ThemeProvider theme={theme} branding={branding}>
      <SkipLink />
      {/* Preview banner — clearly marks this as an unpublished draft. */}
      <div
        role="status"
        className="sticky top-0 z-60 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
        </svg>
        <span>Preview — this is an unpublished draft. {blocks.length === 0 && "This page has no content yet."}</span>
      </div>
      <AnnouncementProvider>
        {blocks.length > 0 ? (
          <RenderPage blocks={blocks} />
        ) : (
          <main id="main-content" className="flex min-h-[60vh] items-center justify-center bg-gray-50">
            <Container>
              <EmptyState
                title="Nothing to preview yet"
                body="Add some blocks in the editor and save, then refresh this preview."
              />
            </Container>
          </main>
        )}
      </AnnouncementProvider>
      <LiveReloader slug={slug} />
    </ThemeProvider>
  );
}
