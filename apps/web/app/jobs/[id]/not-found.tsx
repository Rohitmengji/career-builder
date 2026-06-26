/*
 * 404 view scoped to the job detail route (apps/web/app/jobs/[id]).
 *
 * WHAT: The route-level not-found UI rendered when a job page calls notFound()
 * (e.g. the job is filled, removed, or not visible to this tenant).
 * WHY: A job-specific dead end reads better than the generic site 404 and steers
 * the candidate back to the open-roles list.
 * HOW: Next App Router automatically renders this file for notFound() thrown
 * within this route segment. Purely presentational — no data fetching.
 */
import { Container, EmptyState, ButtonLink, SearchIcon, ArrowLeftIcon } from "@/components/ui";

export default function JobNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Container>
        <EmptyState
          icon={<SearchIcon className="h-7 w-7" />}
          title="Job not found"
          body="This position may have been filled or removed. Check out our other open roles."
          action={
            <ButtonLink href="/jobs" variant="primary" size="lg">
              <ArrowLeftIcon className="h-4 w-4" />
              View all open positions
            </ButtonLink>
          }
        />
      </Container>
    </div>
  );
}
