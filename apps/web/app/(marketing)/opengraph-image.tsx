import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HireBase — AI Career Site Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "60px 80px",
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e1b4b 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "48px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#3b82f6",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>
            HireBase
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: "24px",
          }}
        >
          Build your career site
          <br />
          in minutes. Not weeks.
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: "24px",
            color: "rgba(147, 197, 253, 0.85)",
            lineHeight: 1.5,
            maxWidth: "700px",
          }}
        >
          AI-powered career pages, job listings, and hiring workflows — all in
          one platform.
        </div>

        {/* CTA badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "40px",
            background: "#3b82f6",
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 700,
            padding: "14px 32px",
            borderRadius: "12px",
            width: "fit-content",
          }}
        >
          Start Free →
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            right: "60px",
            fontSize: "18px",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          hirebase.dev
        </div>
      </div>
    ),
    { ...size }
  );
}
