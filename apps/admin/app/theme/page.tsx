"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  type TenantConfig,
  type TenantTheme,
  type TenantBranding,
  mergeTenantConfig,
  getGoogleFontsUrl,
  isLightColor,
} from "@career-builder/tenant-config";
import {
  Button,
  Alert,
  Skeleton,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@/components/ui";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

/* ─── Color Field ───────────────────────────────────────────────── */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const swatchId = React.useId();
  const textId = React.useId();
  return (
    <div className="flex items-center gap-3">
      <input
        id={swatchId}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color picker`}
        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={textId} className="block text-xs font-medium text-gray-700">{label}</label>
        <input
          id={textId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-transparent bg-transparent p-0 font-mono text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </div>
    </div>
  );
}

/* ─── Select Field ──────────────────────────────────────────────── */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Text Field ────────────────────────────────────────────────── */
function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 transition"
      />
    </div>
  );
}

/* ─── Toggle Field (switch) ─────────────────────────────────────── */
function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={id} className="text-xs font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={id}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${value ? "bg-blue-600" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

/* ─── Section Wrapper ───────────────────────────────────────────── */
function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ─── Preview Card ──────────────────────────────────────────────── */
function ThemePreview({ theme, branding }: { theme: TenantTheme; branding: TenantBranding }) {
  const isDark = theme.mode === "dark";
  const fontsUrl = getGoogleFontsUrl(theme);
  const primaryText = isLightColor(theme.colors.primary) ? "#111827" : "#ffffff";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg"
      style={{ fontFamily: `"${theme.typography.fontFamily}", system-ui, sans-serif` }}
    >
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      {/* Navbar */}
      <div
        className="flex items-center justify-between border-b px-6 py-3"
        style={{ backgroundColor: isDark ? "#030712" : theme.colors.background, borderColor: theme.colors.border }}
      >
        <span className="text-sm font-semibold" style={{ color: isDark ? "#ffffff" : theme.colors.text }}>
          {branding.companyName || "Company"}
        </span>
        <span
          className="px-3 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: theme.colors.primary,
            color: primaryText,
            borderRadius: `var(--btn-radius, 8px)`,
          }}
        >
          View Jobs
        </span>
      </div>
      {/* Hero */}
      <div
        className="px-8 py-12 text-center"
        style={{ background: isDark ? "linear-gradient(to bottom, #1f2937, #111827)" : `linear-gradient(to bottom, ${theme.colors.surface}, ${theme.colors.background})` }}
      >
        <h3
          className="mb-2 text-xl font-semibold"
          style={{
            color: isDark ? "#f9fafb" : theme.colors.text,
            fontFamily: theme.typography.headingFontFamily ? `"${theme.typography.headingFontFamily}", sans-serif` : undefined,
            fontWeight: theme.typography.headingWeight,
          }}
        >
          Build Your Career
        </h3>
        <p className="mb-4 text-xs" style={{ color: isDark ? "#9ca3af" : theme.colors.textMuted }}>
          Join our team and make an impact.
        </p>
        <span
          className="inline-block px-4 py-2 text-xs font-semibold"
          style={{ backgroundColor: theme.colors.primary, color: primaryText, borderRadius: "var(--btn-radius, 8px)" }}
        >
          Explore Roles
        </span>
      </div>
      {/* Card row */}
      <div
        className="grid grid-cols-3 gap-3 px-6 py-6"
        style={{ backgroundColor: isDark ? "#111827" : theme.colors.surface }}
      >
        {["Culture", "Growth", "Balance"].map((t) => (
          <div
            key={t}
            className="border p-3 text-center"
            style={{
              borderColor: theme.colors.border,
              borderRadius: "var(--card-radius, 12px)",
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
            }}
          >
            <p className="text-xs font-medium" style={{ color: isDark ? "#f9fafb" : theme.colors.text }}>{t}</p>
          </div>
        ))}
      </div>
      {/* Accent section */}
      <div
        className="px-6 py-6 text-center"
        style={{ backgroundColor: theme.colors.primary, color: primaryText }}
      >
        <p className="text-xs font-semibold">Get Job Alerts</p>
      </div>
      {/* Footer */}
      <div className="px-6 py-4 text-center" style={{ backgroundColor: "#030712" }}>
        <p className="text-[10px] text-gray-400">© 2026 {branding.companyName || "Company"}</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Page Component                                                */
/* ================================================================== */

export default function ThemeEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated: authReady, loading: authLoading, user } = useAuthGuard();
  const requestedTenant = searchParams.get("tenant");
  // The tenant is derived from the authenticated session — NOT trusted from the
  // query string. Only platform operators (super_admin) may switch tenants via
  // ?tenant=; everyone else is pinned to their own tenant. The /api/tenants
  // endpoint enforces the same rule server-side.
  const tenantId =
    user
      ? user.role === "super_admin" && requestedTenant
        ? requestedTenant
        : user.tenantId
      : "default";

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [config, setConfig] = useState<TenantConfig>(mergeTenantConfig({ id: tenantId }));
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [newTenantId, setNewTenantId] = useState("");

  const theme = config.theme;
  const branding = config.branding;

  const showToast = (tone: "success" | "error", message: string) => {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Auth ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && authReady) setAuthenticated(true);
  }, [authLoading, authReady]);

  /* ── Load tenant config ────────────────────────────────────────── */
  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/tenants?id=${tenantId}`).then((r) => r.json()),
      fetch("/api/tenants").then((r) => r.json()),
    ]).then(([tenantData, listData]) => {
      if (tenantData.tenant) setConfig(mergeTenantConfig(tenantData.tenant));
      if (listData.tenants) setTenants(listData.tenants);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authenticated, tenantId]);

  /* ── Update helpers ────────────────────────────────────────────── */
  const updateTheme = useCallback((path: string, value: any) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as TenantConfig;
      const parts = path.split(".");
      let obj: any = next.theme;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }, []);

  const updateBranding = useCallback((key: keyof TenantBranding, value: string) => {
    setConfig((prev) => ({ ...prev, branding: { ...prev.branding, [key]: value } }));
  }, []);

  /* ── Save ──────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("success", "Theme saved");
      // Refresh tenant list
      const listData = await fetch("/api/tenants").then((r) => r.json());
      if (listData.tenants) setTenants(listData.tenants);
    } catch {
      showToast("error", "Failed to save");
    }
    setSaving(false);
  }, [config]);

  /* ── Create new tenant ─────────────────────────────────────────── */
  const handleCreateTenant = useCallback(async () => {
    if (!newTenantId.trim()) return;
    const id = newTenantId.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) return;
    setSaving(true);
    try {
      const newConfig = mergeTenantConfig({ id, name: id.charAt(0).toUpperCase() + id.slice(1) });
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error("Create failed");
      setNewTenantId("");
      showToast("success", `Tenant "${id}" created`);
      router.push(`/theme?tenant=${id}`);
    } catch {
      showToast("error", "Failed to create tenant");
    }
    setSaving(false);
  }, [newTenantId, router]);

  if (authenticated === null || loading) {
    return (
      <main className="flex min-h-screen bg-gray-50">
        <div className="w-full max-w-sm space-y-4 border-r border-gray-200 bg-white p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex-1 p-10">
          <Skeleton className="h-96 w-full max-w-xl" />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
      {/* ── Left: Config Panel ──────────────────────────────────── */}
      <div className="flex w-full flex-col border-b border-gray-200 bg-white lg:max-h-screen lg:w-96 lg:border-b-0 lg:border-r lg:overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-bold text-gray-900">Theme Editor</h1>
              <p className="mt-0.5 text-xs text-gray-600">Configure branding &amp; theme for each tenant</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded px-1 text-xs text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Home
            </Link>
          </div>

          {/* Tenant selector */}
          <div className="flex gap-2">
            <label htmlFor="tenant-select" className="sr-only">Select tenant</label>
            <select
              id="tenant-select"
              value={tenantId}
              onChange={(e) => router.push(`/theme?tenant=${e.target.value}`)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.id}</option>
              ))}
            </select>
            <Button onClick={handleSave} loading={saving} size="sm">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {/* New tenant */}
          <div className="mt-2 flex gap-2">
            <label htmlFor="new-tenant" className="sr-only">New tenant ID</label>
            <input
              id="new-tenant"
              type="text"
              value={newTenantId}
              onChange={(e) => setNewTenantId(e.target.value)}
              placeholder="New tenant ID…"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            <Button onClick={handleCreateTenant} variant="secondary" size="sm">+ Create</Button>
          </div>
        </header>

        {/* Config fields — scrollable */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* BRANDING */}
          <ConfigSection title="Branding">
            <TextField label="Company Name" value={branding.companyName} onChange={(v) => updateBranding("companyName", v)} />
            <TextField label="Logo URL" value={branding.logoUrl} onChange={(v) => updateBranding("logoUrl", v)} placeholder="https://..." />
            <TextField label="Favicon URL" value={branding.faviconUrl} onChange={(v) => updateBranding("faviconUrl", v)} placeholder="https://..." />
            <TextField label="Meta Description" value={branding.metaDescription} onChange={(v) => updateBranding("metaDescription", v)} />
          </ConfigSection>

          {/* COLORS */}
          <ConfigSection title="Colors">
            <ColorField label="Primary" value={theme.colors.primary} onChange={(v) => updateTheme("colors.primary", v)} />
            <ColorField label="Secondary" value={theme.colors.secondary} onChange={(v) => updateTheme("colors.secondary", v)} />
            <ColorField label="Background" value={theme.colors.background} onChange={(v) => updateTheme("colors.background", v)} />
            <ColorField label="Surface" value={theme.colors.surface} onChange={(v) => updateTheme("colors.surface", v)} />
            <ColorField label="Text" value={theme.colors.text} onChange={(v) => updateTheme("colors.text", v)} />
            <ColorField label="Text Muted" value={theme.colors.textMuted} onChange={(v) => updateTheme("colors.textMuted", v)} />
            <ColorField label="Border" value={theme.colors.border} onChange={(v) => updateTheme("colors.border", v)} />
            <ColorField label="Accent" value={theme.colors.accent} onChange={(v) => updateTheme("colors.accent", v)} />
          </ConfigSection>

          {/* TYPOGRAPHY */}
          <ConfigSection title="Typography">
            <TextField label="Font Family" value={theme.typography.fontFamily} onChange={(v) => updateTheme("typography.fontFamily", v)} placeholder="Inter, Poppins, etc." />
            <TextField label="Heading Font" value={theme.typography.headingFontFamily} onChange={(v) => updateTheme("typography.headingFontFamily", v)} placeholder="Same as body if empty" />
            <SelectField
              label="Heading Weight"
              value={theme.typography.headingWeight}
              onChange={(v) => updateTheme("typography.headingWeight", v)}
              options={[
                { label: "Normal (400)", value: "400" },
                { label: "Medium (500)", value: "500" },
                { label: "Semibold (600)", value: "600" },
                { label: "Bold (700)", value: "700" },
                { label: "Extra Bold (800)", value: "800" },
              ]}
            />
            <SelectField
              label="Base Font Size"
              value={theme.typography.baseFontSize}
              onChange={(v) => updateTheme("typography.baseFontSize", v)}
              options={[
                { label: "14px", value: "14px" },
                { label: "15px", value: "15px" },
                { label: "16px", value: "16px" },
              ]}
            />
            <SelectField
              label="Line Height"
              value={theme.typography.lineHeight}
              onChange={(v) => updateTheme("typography.lineHeight", v)}
              options={[
                { label: "Tight (1.5)", value: "1.5" },
                { label: "Normal (1.6)", value: "1.6" },
                { label: "Relaxed (1.7)", value: "1.7" },
                { label: "Loose (1.8)", value: "1.8" },
              ]}
            />
          </ConfigSection>

          {/* LAYOUT */}
          <ConfigSection title="Layout">
            <SelectField
              label="Container Width"
              value={theme.layout.containerWidth}
              onChange={(v) => updateTheme("layout.containerWidth", v)}
              options={[
                { label: "Narrow (1024px)", value: "1024px" },
                { label: "Normal (1200px)", value: "1200px" },
                { label: "Wide (1440px)", value: "1440px" },
              ]}
            />
            <SelectField
              label="Section Spacing"
              value={theme.layout.sectionSpacing}
              onChange={(v) => updateTheme("layout.sectionSpacing", v)}
              options={[
                { label: "Compact", value: "compact" },
                { label: "Normal", value: "normal" },
                { label: "Spacious", value: "spacious" },
              ]}
            />
            <SelectField
              label="Layout Style"
              value={theme.layout.layoutStyle}
              onChange={(v) => updateTheme("layout.layoutStyle", v)}
              options={[
                { label: "Modern", value: "modern" },
                { label: "Corporate", value: "corporate" },
                { label: "Minimal", value: "minimal" },
              ]}
            />
          </ConfigSection>

          {/* COMPONENTS */}
          <ConfigSection title="Components">
            <SelectField
              label="Button Radius"
              value={theme.components.button.radius}
              onChange={(v) => updateTheme("components.button.radius", v)}
              options={[
                { label: "None", value: "none" },
                { label: "Small", value: "sm" },
                { label: "Medium", value: "md" },
                { label: "Large", value: "lg" },
                { label: "Full (Pill)", value: "full" },
              ]}
            />
            <SelectField
              label="Button Size"
              value={theme.components.button.size}
              onChange={(v) => updateTheme("components.button.size", v)}
              options={[
                { label: "Small", value: "sm" },
                { label: "Medium", value: "md" },
                { label: "Large", value: "lg" },
              ]}
            />
            <SelectField
              label="Card Shadow"
              value={theme.components.card.shadow}
              onChange={(v) => updateTheme("components.card.shadow", v)}
              options={[
                { label: "None", value: "none" },
                { label: "Small", value: "sm" },
                { label: "Medium", value: "md" },
                { label: "Large", value: "lg" },
              ]}
            />
            <SelectField
              label="Card Radius"
              value={theme.components.card.radius}
              onChange={(v) => updateTheme("components.card.radius", v)}
              options={[
                { label: "None", value: "none" },
                { label: "Small", value: "sm" },
                { label: "Medium", value: "md" },
                { label: "Large", value: "lg" },
                { label: "Extra Large", value: "xl" },
              ]}
            />
            <ToggleField label="Sticky Navbar" value={theme.components.navbar.sticky} onChange={(v) => updateTheme("components.navbar.sticky", v)} />
            <ToggleField label="Navbar Border" value={theme.components.navbar.bordered} onChange={(v) => updateTheme("components.navbar.bordered", v)} />
          </ConfigSection>

          {/* DARK MODE */}
          <ConfigSection title="Mode">
            <SelectField
              label="Color Mode"
              value={theme.mode}
              onChange={(v) => updateTheme("mode", v)}
              options={[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
            />
          </ConfigSection>

          {/* Tenant name */}
          <ConfigSection title="Tenant">
            <TextField label="Tenant Display Name" value={config.name} onChange={(v) => setConfig((prev) => ({ ...prev, name: v }))} />
          </ConfigSection>
        </div>
      </div>

      {/* ── Right: Live Preview ─────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <h2 className="text-sm font-medium text-gray-700">
            Live Preview — <span className="font-mono text-gray-600">{tenantId}</span>
          </h2>
          <a
            href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/${tenantId === "default" ? "careers" : tenantId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Open Full Preview <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>

        {/* Preview */}
        <div className="flex flex-1 items-start justify-center overflow-y-auto p-6 sm:p-10" style={{ backgroundColor: "#f3f4f6" }}>
          <div className="w-full max-w-xl">
            <ThemePreview theme={theme} branding={branding} />
          </div>
        </div>
      </main>

      {/* Toast / live region */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto w-full max-w-sm">
            <Alert tone={toast.tone}>{toast.message}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
