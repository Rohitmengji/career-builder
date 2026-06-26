import Link from "next/link";

/**
 * 404 page for the admin (recruiter) app.
 *
 * WHAT: The fallback UI Next.js App Router renders for any unmatched route in
 * apps/admin (and when a route calls notFound()).
 *
 * WHY: Gives an unknown admin URL a branded, recruiter-facing dead end with a
 * way back to the dashboard, instead of Next's bare default.
 *
 * HOW: Special App Router file convention — the export must be named NotFound.
 * It is a server component (no "use client", no hooks/auth guard) and uses inline
 * styles rather than the app's UI kit so it renders correctly even outside the
 * normal authenticated layout chrome. "Back to Dashboard" links to "/".
 */
export default function NotFound() {
  return (
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
      <div style={{ maxWidth: "420px" }}>
        <p
          style={{
            fontSize: "5rem",
            fontWeight: 800,
            color: "#e5e7eb",
            lineHeight: 1,
            marginBottom: "1rem",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "0.75rem",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "#6b7280",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          This page doesn&apos;t exist in the admin panel.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: "10px",
            padding: "0.75rem 2rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
