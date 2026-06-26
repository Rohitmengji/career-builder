"use client";

import { Button, ButtonLink, EmptyState } from "@/components/ui";

/**
 * Route-segment error boundary for the public career site (Next.js `error.tsx`
 * convention). Catches errors thrown while rendering a page below it and shows a
 * friendly fallback instead of a blank screen.
 *
 * WHY: Career-site visitors are candidates, not operators — a crash should degrade
 * gracefully with a retry, not expose a stack trace.
 *
 * HOW: Next requires error boundaries to be client components (hence "use client"),
 * and passes `error` plus a `reset()` callback that re-renders the failed segment.
 * The "Try again" button calls reset(); we don't surface error.message/digest to
 * the user.
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
