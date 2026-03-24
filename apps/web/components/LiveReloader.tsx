"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin API URL for SSE live preview.
 * In production, set NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_APP_URL.
 */
const ADMIN_API_URL = (() => {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return window.location.origin;
  }
  return "http://localhost:3001";
})();

/**
 * Connects to the admin SSE endpoint and reloads the page
 * whenever the editor saves changes. Gives true live preview.
 */
export default function LiveReloader({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource(`${ADMIN_API_URL}/api/preview`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Reload if the saved slug matches this page
          if (data.slug === slug) {
            router.refresh();
          }
        } catch {
          // Ignore heartbeats / parse errors
        }
      };

      es.onerror = () => {
        // SSE will auto-reconnect
      };
    } catch {
      // Admin not running — graceful degradation
    }

    return () => {
      es?.close();
    };
  }, [slug, router]);

  // Render nothing — just a side-effect hook
  return null;
}
