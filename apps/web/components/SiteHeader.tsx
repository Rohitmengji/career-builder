/*
 * SiteHeader — shared, accessible top nav for app-chrome pages (jobs, auth-
 * adjacent, profile). Auth-aware: shows Sign in / Create account when logged
 * out, and My profile / Sign out when a candidate session exists.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui";

interface SessionCandidate {
  firstName: string;
  lastName: string;
}

export default function SiteHeader({ brand = "Careers" }: { brand?: string }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<SessionCandidate | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCandidate(d?.authenticated ? d.candidate : null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCandidate(null);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 backdrop-blur-lg">
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight text-gray-900">
          {brand}
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/jobs"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:inline-flex"
          >
            Browse jobs
          </Link>
          {/* Reserve space until session resolves to avoid layout shift */}
          <div className="flex items-center gap-2" style={{ minHeight: 40 }}>
            {ready && candidate && (
              <>
                <ButtonLink href="/applications" variant="ghost" size="sm">My applications</ButtonLink>
                <ButtonLink href="/profile" variant="ghost" size="sm">My profile</ButtonLink>
                <Button variant="secondary" size="sm" onClick={onLogout}>Sign out</Button>
              </>
            )}
            {ready && !candidate && (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
                <ButtonLink href="/register" variant="primary" size="sm">Create account</ButtonLink>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
