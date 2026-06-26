/*
 * Theme route layout — wraps the theme editor in a Suspense boundary.
 *
 * WHAT/WHY: The theme page (page.tsx) reads the ?tenant query param via
 * useSearchParams(). In the Next.js App Router that hook must sit under a
 * Suspense boundary or the build fails (it would otherwise opt the whole route
 * into client-side bailout). This layout provides that boundary + a loading
 * fallback. Keep it; it exists for that constraint, not for visual reasons.
 */
import { Suspense } from "react";

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-400">Loading theme editor…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
