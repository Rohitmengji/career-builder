"use client";

import { Button, ButtonLink, EmptyState } from "@/components/ui";

/**
 * Error boundary for the public web app.
 * Prevents blank screens when page rendering fails.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-16"
    >
      <div className="w-full max-w-md">
        <EmptyState
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          }
          title="Page failed to load"
          body="We couldn't load this page. The career site may be temporarily unavailable."
          action={
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
          }
          secondaryAction={
            <ButtonLink href="/" variant="secondary" size="lg">
              Go home
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
