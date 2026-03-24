import Link from "next/link";

/**
 * Not Found page for the admin app.
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
