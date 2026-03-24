"use client";

/**
 * Global error boundary for the web (public) app.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ maxWidth: "420px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: "#eff6ff",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
                fontSize: "28px",
              }}
            >
              🔧
            </div>

            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "0.75rem",
              }}
            >
              We&apos;ll be right back
            </h2>

            <p
              style={{
                fontSize: "1rem",
                color: "#6b7280",
                lineHeight: 1.6,
                marginBottom: "2rem",
              }}
            >
              Something unexpected happened. Please try refreshing the page.
            </p>

            <button
              onClick={reset}
              style={{
                backgroundColor: "#111827",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "0.875rem 2.5rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
