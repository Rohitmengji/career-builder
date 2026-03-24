"use client";

import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  type TenantConfig,
  type TenantTheme,
  type TenantBranding,
  DEFAULT_THEME,
  DEFAULT_BRANDING,
  mergeTenantConfig,
  getGoogleFontsUrl,
  lightenHex,
  isLightColor,
} from "@career-builder/tenant-config";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

/* ─── Color Swatch ──────────────────────────────────────────────── */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium text-gray-600 block">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs text-gray-900 bg-transparent border-none p-0 outline-none w-full font-mono"
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
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}

/* ─── Toggle Field ──────────────────────────────────────────────── */
function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors ${value ? "bg-blue-600" : "bg-gray-300"}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

/* ─── Section Wrapper ───────────────────────────────────────────── */
function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* ─── Preview Card ──────────────────────────────────────────────── */
function ThemePreview({ theme, branding }: { theme: TenantTheme; branding: TenantBranding }) {
  const isDark = theme.mode === "dark";
  const fontsUrl = getGoogleFontsUrl(theme);
  const primaryText = isLightColor(theme.colors.primary) ? "#111827" : "#ffffff";

  return (
    <div
      className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg"
      style={{ fontFamily: `"${theme.typography.fontFamily}", system-ui, sans-serif` }}
    >
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      {/* Navbar */}
      <div
        className="px-6 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: isDark ? "#030712" : theme.colors.background, borderColor: theme.colors.border }}
      >
        <span className="text-sm font-semibold" style={{ color: isDark ? "#ffffff" : theme.colors.text }}>
          {branding.companyName || "Company"}
        </span>
        <span
          className="text-xs font-semibold px-3 py-1.5"
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
        <h2
          className="text-xl font-semibold mb-2"
          style={{
            color: isDark ? "#f9fafb" : theme.colors.text,
            fontFamily: theme.typography.headingFontFamily ? `"${theme.typography.headingFontFamily}", sans-serif` : undefined,
            fontWeight: theme.typography.headingWeight,
          }}
        >
          Build Your Career
        </h2>
        <p className="text-xs mb-4" style={{ color: isDark ? "#9ca3af" : theme.colors.textMuted }}>
          Join our team and make an impact.
        </p>
        <span
          className="inline-block text-xs font-semibold px-4 py-2"
          style={{ backgroundColor: theme.colors.primary, color: primaryText, borderRadius: "var(--btn-radius, 8px)" }}
        >
          Explore Roles
        </span>
      </div>
      {/* Card row */}
      <div
        className="px-6 py-6 grid grid-cols-3 gap-3"
        style={{ backgroundColor: isDark ? "#111827" : theme.colors.surface }}
      >
        {["Culture", "Growth", "Balance"].map((t) => (
          <div
            key={t}
            className="p-3 border text-center"
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
        <p className="text-[10px] text-gray-500">© 2026 {branding.companyName || "Company"}</p>
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
  const tenantId = searchParams.get("tenant") || "default";

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [config, setConfig] = useState<TenantConfig>(mergeTenantConfig({ id: tenantId }));
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [newTenantId, setNewTenantId] = useState("");

  const theme = config.theme;
  const branding = config.branding;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  /* ── Auth ──────────────────────────────────────────────────────── */
  const { authenticated: authReady, loading: authLoading } = useAuthGuard();

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
      showToast("✅ Theme saved");
      // Refresh tenant list
      const listData = await fetch("/api/tenants").then((r) => r.json());
      if (listData.tenants) setTenants(listData.tenants);
    } catch {
      showToast("❌ Failed to save");
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
      showToast(`✅ Tenant "${id}" created`);
      router.push(`/theme?tenant=${id}`);
    } catch {
      showToast("❌ Failed to create tenant");
    }
    setSaving(false);
  }, [newTenantId, router]);

  if (authenticated === null || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading theme editor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Left: Config Panel ──────────────────────────────────── */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-bold text-gray-900">🎨 Theme Editor</h1>
              <p className="text-[10px] text-gray-400 mt-0.5">Configure branding & theme for each tenant</p>
            </div>
            <a href="/" className="text-xs text-gray-400 hover:text-gray-600">← Home</a>
          </div>

          {/* Tenant selector */}
          <div className="flex gap-2">
            <select
              value={tenantId}
              onChange={(e) => router.push(`/theme?tenant=${e.target.value}`)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.id}</option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "💾 Save"}
            </button>
          </div>

          {/* New tenant */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newTenantId}
              onChange={(e) => setNewTenantId(e.target.value)}
              placeholder="New tenant ID…"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5"
            />
            <button
              onClick={handleCreateTenant}
              className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              + Create
            </button>
          </div>
        </div>

        {/* Config fields — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">Live Preview — <span className="font-mono text-gray-400">{tenantId}</span></h2>
          <div className="flex gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/${tenantId === "default" ? "careers" : tenantId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:text-blue-500 font-medium"
            >
              ↗ Open Full Preview
            </a>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-10 flex items-start justify-center" style={{ backgroundColor: "#f3f4f6" }}>
          <div className="w-full max-w-xl">
            <ThemePreview theme={theme} branding={branding} />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-5 py-2.5 rounded-lg shadow-lg font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
