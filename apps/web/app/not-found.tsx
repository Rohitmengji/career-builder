import { ButtonLink, EmptyState, SearchIcon } from "@/components/ui";

/**
 * Not Found page for the web app.
 * Shows when a tenant/page/job is not found.
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
