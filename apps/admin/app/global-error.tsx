"use client";

/**
 * Global error boundary for the admin app.
 *
 * Next.js App Router calls this component when an unhandled error
 * occurs in a server or client component. Provides:
 *   - User-friendly error message
 *   - Retry button (resets the error boundary)
 *   - Error details in dev mode
 *   - No crash rendering — always shows a safe UI
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
    // Log to observability system
    console.error("[global-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
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
            backgroundColor: "#fafafa",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              padding: "2.5rem",
              backgroundColor: "white",
              borderRadius: "16px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#fef2f2",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
                fontSize: "24px",
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#6b7280",
                lineHeight: 1.6,
                marginBottom: "1.5rem",
              }}
            >
              An unexpected error occurred. Our team has been notified.
              Please try again.
            </p>

            {process.env.NODE_ENV !== "production" && (
              <pre
                style={{
                  fontSize: "0.75rem",
                  color: "#dc2626",
                  backgroundColor: "#fef2f2",
                  padding: "1rem",
                  borderRadius: "8px",
                  textAlign: "left",
                  overflow: "auto",
                  maxHeight: "200px",
                  marginBottom: "1.5rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            )}

            <button
              onClick={reset}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
