import { ButtonLink, EmptyState, SearchIcon } from "@/components/ui";

/**
 * Global 404 page for the career site.
 *
 * WHAT: The site-wide not-found UI shown for any unmatched route, or when a page
 * calls notFound() without a closer route-level not-found.tsx (e.g. unknown
 * tenant/page/job).
 * WHY: Gives candidates a branded dead end with a path back home instead of a
 * raw error.
 * HOW: Next App Router renders this automatically as the root fallback. Purely
 * presentational — no data fetching. More specific routes (e.g. jobs/[id]) can
 * override it with their own not-found.tsx.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        <p
          className="mb-2 text-center text-7xl font-bold tracking-tight text-gray-200"
          aria-hidden="true"
        >
          404
        </p>
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="Page not found"
          body="The page you're looking for doesn't exist or has been moved."
          action={
            <ButtonLink href="/" size="lg">
              Go home
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
