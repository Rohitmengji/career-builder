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
