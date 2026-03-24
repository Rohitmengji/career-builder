"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared auth guard hook for all admin client pages.
 *
 * Handles:
 *   - 429 (rate-limited) → retry after 3s instead of logout
 *   - 500+ (server error) → retry after 3s instead of logout
 *   - Normal auth flow → redirect to /login if not authenticated
 *
 * Returns { authenticated, user, loading }
 */

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface UseAuthGuardResult {
  authenticated: boolean | null;
  user: SessionUser | null;
  loading: boolean;
}

export function useAuthGuard(): UseAuthGuardResult {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const retryRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth(isRetry = false) {
      try {
        const r = await fetch("/api/auth");

        // Rate-limited or server error — retry once after delay, don't force logout
        if ((r.status === 429 || r.status >= 500) && !isRetry) {
          console.warn(`[auth] Got ${r.status}, will retry in 3s`);
          retryRef.current = true;
          setTimeout(() => {
            if (!cancelled) checkAuth(true);
          }, 3000);
          return;
        }

        // If still failing on retry, stay on page rather than loop
        if ((r.status === 429 || r.status >= 500) && isRetry) {
          console.error(`[auth] Still failing after retry (${r.status})`);
          if (!cancelled) setLoading(false);
          return;
        }

        const d = await r.json();
        if (cancelled) return;

        if (d.authenticated && d.user) {
          setAuthenticated(true);
          setUser(d.user);
        } else {
          setAuthenticated(false);
          router.push("/login");
        }
      } catch {
        if (!cancelled) {
          if (!isRetry) {
            setTimeout(() => {
              if (!cancelled) checkAuth(true);
            }, 3000);
          } else {
            router.push("/login");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, [router]);

  return { authenticated, user, loading };
}
