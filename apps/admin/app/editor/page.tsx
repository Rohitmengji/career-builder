"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

import { registerHeroBlock } from "./blocks/registerHeroBlock";
import { registerJobListBlock } from "./blocks/registerJobListBlock";
import { registerContentBlock } from "./blocks/registerContentBlock";
import { registerFeaturesBlock } from "./blocks/registerFeaturesBlock";
import { registerTestimonialBlock } from "./blocks/registerTestimonialBlock";
import { registerCarouselBlock } from "./blocks/registerCarouselBlock";
import { registerAccordionBlock } from "./blocks/registerAccordionBlock";
import { registerCtaButtonBlock } from "./blocks/registerCtaButtonBlock";
import { registerSearchBarBlock } from "./blocks/registerSearchBarBlock";
import { registerJobDetailsBlock } from "./blocks/registerJobDetailsBlock";
import { registerJobCategoryBlock } from "./blocks/registerJobCategoryBlock";
import { registerJoinTalentNetworkBlock } from "./blocks/registerJoinTalentNetworkBlock";
import { registerVideoAndTextBlock } from "./blocks/registerVideoAndTextBlock";
import { registerPersonalizationBlock } from "./blocks/registerPersonalizationBlock";
import { registerShowHideTabBlock } from "./blocks/registerShowHideTabBlock";
import { registerImageTextGridBlock } from "./blocks/registerImageTextGridBlock";
import { registerLightBoxBlock } from "./blocks/registerLightBoxBlock";
import { registerJobAlertBlock } from "./blocks/registerJobAlertBlock";
import { registerNavigateBackBlock } from "./blocks/registerNavigateBackBlock";
import { registerBasicButtonBlock } from "./blocks/registerBasicButtonBlock";
import { registerBasicImageBlock } from "./blocks/registerBasicImageBlock";
import { registerSpacerBlock } from "./blocks/registerSpacerBlock";
import { registerDividerBlock } from "./blocks/registerDividerBlock";
import { registerNavbarBlock } from "./blocks/registerNavbarBlock";
import { registerFooterBlock } from "./blocks/registerFooterBlock";
import { registerNotificationBannerBlock } from "./blocks/registerNotificationBannerBlock";
import { registerStatsCounterBlock } from "./blocks/registerStatsCounterBlock";
import { registerTeamGridBlock } from "./blocks/registerTeamGridBlock";
import { registerSocialProofBlock } from "./blocks/registerSocialProofBlock";
import { registerApplicationStatusBlock } from "./blocks/registerApplicationStatusBlock";
import { blockSchemas, getDefaultProps } from "@/lib/blockSchemas";
import Sidebar from "@/components/editor/Sidebar";
import type { AiPageBlock, AiRequest, AiResponse, AiTone, AiIndustry, AiAudience } from "@/lib/ai/types";
import { useSubscription } from "@/lib/ai/useSubscription";
import type { GeneratedSite } from "@/lib/ai/site-generator/siteSchema";
import dynamic from "next/dynamic";
import SiteManager from "@/components/editor/SiteManager";

const SiteGenerator = dynamic(() => import("@/components/ai/SiteGenerator"), { ssr: false });

type SaveStatus = "idle" | "saving" | "saved" | "error" | "expired" | "autosaving";
type DeviceType = "desktop" | "tablet" | "mobile";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
}

/** Read the CSRF cookie value (it's not httpOnly so JS can read it) */
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

export default function EditorPage() {
  const [selected, setSelected] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DeviceType>("desktop");
  const [activePage, setActivePage] = useState("careers");
  const [pageLoading, setPageLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blockPanelRef = useRef<HTMLDivElement | null>(null);
  const editorInstance = useRef<any>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const handleSaveRef = useRef<(isAutoSave?: boolean) => Promise<void>>(null!);
  const scheduleAutoSaveRef = useRef<() => void>(null!);
  const loadSavedPageRef = useRef<(editor: any) => Promise<void>>(null!);
  const activePageRef = useRef("careers");
  const router = useRouter();

  /* ── Subscription (for AI page gen in toolbar) ─────────────────── */
  const { status: subscription, decrementCredit } = useSubscription();

  /* ── Generate Page modal state ─────────────────────────────────── */
  const [showGenPageModal, setShowGenPageModal] = useState(false);
  const [genPagePrompt, setGenPagePrompt] = useState("");
  const [genPageTone, setGenPageTone] = useState<AiTone>("professional");
  const [genPageIndustry, setGenPageIndustry] = useState<AiIndustry>("technology");
  const [genPageAudience, setGenPageAudience] = useState<AiAudience>("general");
  const [genPageLoading, setGenPageLoading] = useState(false);
  const [genPageError, setGenPageError] = useState<string | null>(null);
  const genPageAbort = useRef<AbortController | null>(null);

  /* ── Site Generator modal state ────────────────────────────────── */
  const [showSiteGenerator, setShowSiteGenerator] = useState(false);
  const [siteManagerRefreshKey, setSiteManagerRefreshKey] = useState(0);
  const [leftTab, setLeftTab] = useState<"blocks" | "pages">("blocks");
  const [pageCount, setPageCount] = useState(1);

  /* ── Auth check on mount ───────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => {
        // If rate-limited or server error, don't force logout — just retry
        if (r.status === 429 || r.status >= 500) {
          console.warn(`[auth] Got ${r.status}, will retry in 3s`);
          setTimeout(() => {
            fetch("/api/auth")
              .then((r2) => r2.json())
              .then((d2) => {
                if (d2.authenticated) {
                  setAuthenticated(true);
                  setUser(d2.user);
                } else {
                  router.push("/login");
                }
              })
              .catch(() => router.push("/login"));
          }, 3000);
          return;
        }
        return r.json().then((d) => {
          if (!d.authenticated) {
            router.push("/login");
          } else {
            setAuthenticated(true);
            setUser(d.user);
          }
        });
      })
      .catch(() => router.push("/login"));
  }, [router]);

  /* ── Handle Stripe Checkout redirect + deep links ───────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Clean URL without reload
      window.history.replaceState({}, "", "/editor");
    }
    if (params.get("openSiteGen") === "true") {
      setShowSiteGenerator(true);
      window.history.replaceState({}, "", "/editor");
    }
  }, []);

  /* ── Unsaved changes guard ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  /* ── Global Escape key to close modals ─────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showGenPageModal) {
          setShowGenPageModal(false);
          setGenPageError(null);
        } else if (showSiteGenerator) {
          setShowSiteGenerator(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showGenPageModal, showSiteGenerator]);

  /* ── Logout ────────────────────────────────────────────────────── */
  const handleLogout = useCallback(async () => {
    if (hasUnsaved && !confirm("You have unsaved changes. Are you sure you want to sign out?")) {
      return;
    }
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }, [router, hasUnsaved]);

  /* ── Save handler ──────────────────────────────────────────────── */
  const handleSave = useCallback(async (isAutoSave = false) => {
    const editor = editorInstance.current;
    if (!editor) return;

    // Viewers cannot save
    if (user?.role === "viewer") return;

    setSaveStatus(isAutoSave ? "autosaving" : "saving");

    try {
      const blocks = editor
        .getComponents()
        .toArray()
        .map((comp: any) => {
          const type = comp.get("type");
          if (type === "text" || type === "textnode" || type === "default") {
            return null;
          }
          return { type, props: comp.get("props") || {} };
        })
        .filter(Boolean);

      const res = await fetch("/api/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ slug: activePageRef.current, blocks }),
      });

      if (res.status === 401) {
        setSaveStatus("expired");
        setTimeout(() => router.push("/login"), 2500);
        return;
      }

      if (!res.ok) throw new Error("Save failed");

      setHasUnsaved(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [router, user]);

  /* ── Auto-save (debounced 5 seconds after any change) ──────────── */
  const scheduleAutoSave = useCallback(() => {
    if (user?.role === "viewer") return;
    setHasUnsaved(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave(true);
    }, 5000);
  }, [handleSave, user]);

  /* ── Delete handler ────────────────────────────────────────────── */
  const handleDeleteBlock = useCallback(() => {
    const editor = editorInstance.current;
    if (!editor || !selected || user?.role === "viewer") return;

    let block = selected;
    const KNOWN = new Set(Object.keys(blockSchemas));
    while (block) {
      if (KNOWN.has(block.get("type"))) break;
      block = block.parent?.();
    }
    if (block) {
      block.remove();
      setSelected(null);
      scheduleAutoSave();
    }
  }, [selected, scheduleAutoSave, user]);

  /* ── AI full-page generation handler ───────────────────────────── */
  const handleAiApplyPage = useCallback((blocks: AiPageBlock[]) => {
    const editor = editorInstance.current;
    if (!editor || user?.role === "viewer") return;

    // Clear existing canvas
    const wrapper = editor.DomComponents.getWrapper();
    wrapper.components([]);

    // Add each block
    for (const block of blocks) {
      const schema = blockSchemas[block.type];
      if (!schema) continue;
      const defaults = getDefaultProps(block.type);
      const mergedProps = { ...defaults, ...block.props };
      editor.addComponents({ type: block.type, props: mergedProps });
    }

    // Force rebuild so AI-generated props render immediately on canvas
    requestAnimationFrame(() => {
      const allComponents = editor.getComponents?.()?.toArray?.() ?? [];
      for (const comp of allComponents) {
        editor.trigger("component:update:props", comp);
      }
    });

    setSelected(null);
    scheduleAutoSave();
  }, [scheduleAutoSave, user]);

  /* ── Site Generator: applied full site ─────────────────────────── */
  const handleSiteApplied = useCallback((site: GeneratedSite) => {
    // Find the "careers" page (or first page) and load it into the editor
    const careersPage = site.pages.find((p) => p.slug === "careers") || site.pages[0];
    if (careersPage) {
      // Update active page state to match what we're loading
      setActivePage(careersPage.slug);
      activePageRef.current = careersPage.slug;
      handleAiApplyPage(careersPage.blocks);
    }
    setShowSiteGenerator(false);

    // Refresh the SiteManager page list
    setSiteManagerRefreshKey((k) => k + 1);

    // Auto-save immediately after site apply
    handleSaveRef.current?.(false);
  }, [handleAiApplyPage]);

  /* ── Toolbar: Generate Full Page via AI ────────────────────────── */
  const handleGeneratePage = useCallback(async () => {
    if (!subscription.aiEnabled) {
      setGenPageError("Upgrade to Pro or Enterprise to use AI page generation.");
      return;
    }
    if (subscription.aiCreditsRemaining <= 0) {
      setGenPageError("No AI credits remaining. Please wait for credits to reset or upgrade.");
      return;
    }

    setGenPageLoading(true);
    setGenPageError(null);

    genPageAbort.current?.abort();
    genPageAbort.current = new AbortController();

    const request: AiRequest = {
      action: "generate-page",
      blockType: "hero",
      prompt: genPagePrompt || undefined,
      tone: genPageTone,
      context: {
        industry: genPageIndustry,
        audience: genPageAudience,
      },
    };

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(request),
        signal: genPageAbort.current.signal,
      });

      const data: AiResponse = await res.json();

      if (!data.success || !data.blocks?.length) {
        setGenPageError(data.error || "AI returned empty response. Please try again.");
        return;
      }

      decrementCredit();

      // Apply the generated page
      handleAiApplyPage(data.blocks);

      // Close modal & reset
      setShowGenPageModal(false);
      setGenPagePrompt("");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setGenPageError(err.message || "Network error. Please try again.");
      }
    } finally {
      setGenPageLoading(false);
    }
  }, [genPagePrompt, genPageTone, genPageIndustry, genPageAudience, subscription, decrementCredit, handleAiApplyPage]);

  /* ── Load saved page into editor ───────────────────────────────── */
  const loadSavedPage = useCallback(async (editor: any) => {
    try {
      const res = await fetch(`/api/pages?slug=${encodeURIComponent(activePageRef.current)}`);
      const data = await res.json();
      const blocks = data.blocks || [];
      if (blocks.length === 0) return;

      blocks.forEach((b: { type: string; props: Record<string, any> }) => {
        const schema = blockSchemas[b.type];
        if (!schema) return;
        const defaults = getDefaultProps(b.type);
        const mergedProps = { ...defaults, ...b.props };
        editor.addComponents({ type: b.type, props: mergedProps });
      });

      // Force a rebuild pass on every block so saved props render immediately.
      // component:add fires during addComponents but GrapesJS may not have the
      // view mounted yet. This deferred pass guarantees the canvas shows the
      // actual saved content, not stale defaults.
      requestAnimationFrame(() => {
        const allComponents = editor.getComponents?.()?.toArray?.() ?? [];
        for (const comp of allComponents) {
          editor.trigger("component:update:props", comp);
        }
      });
    } catch {
      // API might not have data yet
    }
  }, []);

  // Keep refs in sync with latest callback versions
  handleSaveRef.current = handleSave;
  scheduleAutoSaveRef.current = scheduleAutoSave;
  loadSavedPageRef.current = loadSavedPage;
  activePageRef.current = activePage;

  /* ── Multi-page management handlers ────────────────────────────── */
  const handleSwitchPage = useCallback((slug: string) => {
    const editor = editorInstance.current;
    if (!editor) return;

    // Cancel any pending auto-save to prevent saving empty canvas to the OLD page
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    // Clear canvas
    const wrapper = editor.DomComponents.getWrapper();
    wrapper.components([]);
    setSelected(null);
    setHasUnsaved(false);

    // Update state + ref BEFORE loading so save handler uses new slug
    setActivePage(slug);
    activePageRef.current = slug;

    // Load the new page
    setPageLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pages?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        const blocks = data.blocks || [];
        for (const b of blocks) {
          const schema = blockSchemas[b.type];
          if (!schema) continue;
          const defaults = getDefaultProps(b.type);
          const mergedProps = { ...defaults, ...b.props };
          editor.addComponents({ type: b.type, props: mergedProps });
        }

        // Force rebuild so saved props render immediately on canvas
        requestAnimationFrame(() => {
          const allComponents = editor.getComponents?.()?.toArray?.() ?? [];
          for (const comp of allComponents) {
            editor.trigger("component:update:props", comp);
          }
        });
      } catch {
        // New blank page — nothing to load
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  const handleCreatePage = useCallback((slug: string) => {
    // Switch to the new blank page
    handleSwitchPage(slug);
  }, [handleSwitchPage]);

  const handleDeletePage = useCallback(async (slug: string) => {
    try {
      // Use proper DELETE endpoint to remove the page from DB
      await fetch(`/api/pages?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": getCsrfToken(),
        },
      });
    } catch {
      // Best-effort delete
    }
    // Refresh site manager
    setSiteManagerRefreshKey((k) => k + 1);
    // If we deleted the active page, switch to careers
    if (slug === activePage) {
      handleSwitchPage("careers");
    }
  }, [activePage, handleSwitchPage]);

  /* ── Initialize GrapesJS ───────────────────────────────────────── */
  useEffect(() => {
    if (!authenticated || !editorRef.current || !blockPanelRef.current) return;

    // Guard: if a previous instance exists, destroy it first
    if (editorInstance.current) {
      try { editorInstance.current.destroy(); } catch { /* noop */ }
      editorInstance.current = null;
    }

    mountedRef.current = true;

    const editor = grapesjs.init({
      container: editorRef.current,
      height: "100vh",
      storageManager: false,
      blockManager: { appendTo: blockPanelRef.current },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "768px" },
        ],
      },
      canvas: {
        styles: [
          "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
        ],
      },
    });

    editorInstance.current = editor;

    // Track last canvas click coordinates for fallback block resolution.
    // GrapesJS sometimes selects the wrapper when clicking on the edge
    // of full-width blocks (navbar, footer). We use these coordinates
    // to find which block the user actually meant to click.
    editor.on("canvas:click", (e: MouseEvent) => {
      (editor as any).__lastCanvasClick = { x: e.clientX, y: e.clientY };
    });

    // Helper: walk up from any component to find the nearest registered block.
    // Uses both GrapesJS model parent chain AND DOM fallback.
    const KNOWN = new Set(Object.keys(blockSchemas));
    const findParentBlock = (comp: any): any | null => {
      // 1. Walk GrapesJS model parents
      let cur = comp;
      while (cur) {
        if (KNOWN.has(cur.get("type"))) return cur;
        const dt = cur.getAttributes?.()?.["data-type"];
        if (dt && KNOWN.has(dt)) return cur;
        cur = cur.parent?.();
      }
      // 2. DOM fallback: walk up the real DOM tree to find [data-type]
      try {
        const el = comp?.getEl?.();
        if (!el) return null;
        let pe: HTMLElement | null = el;
        while (pe) {
          const dt = pe.getAttribute?.("data-type");
          if (dt && KNOWN.has(dt)) {
            // Find the GrapesJS model that owns this DOM element
            const wrapper = editor.DomComponents.getWrapper();
            const findModel = (m: any): any | null => {
              if ((m.get("type") === dt || m.getAttributes?.()?.["data-type"] === dt) && m.getEl?.() === pe) return m;
              const kids = m.components?.()?.toArray?.() ?? [];
              for (const k of kids) { const f = findModel(k); if (f) return f; }
              return null;
            };
            return findModel(wrapper);
          }
          pe = pe.parentElement;
        }
      } catch { /* ignore */ }
      return null;
    };

    editor.on("component:selected", (component: any) => {
      if (!mountedRef.current) return;
      // Resolve to the block-level component (don't call editor.select()
      // to avoid triggering rebuild loops — just pass the block to React state)
      const block = findParentBlock(component);
      if (block) {
        setSelected(block);
        return;
      }

      // Extra fallback: if the component IS the wrapper or body, check if
      // only one top-level block exists at the click point. This handles
      // cases where GrapesJS selects the canvas wrapper when clicking on
      // the edge/border of full-width blocks like navbar or footer.
      try {
        const compType = component?.get?.("type");
        if (compType === "wrapper" || compType === "body" || !compType) {
          const el = component?.getEl?.();
          const iframe = editor.Canvas?.getFrameEl?.();
          const doc = iframe?.contentDocument || el?.ownerDocument;
          if (doc) {
            // Walk all top-level children and find the first whose bounding
            // rect contains the current selection indicator or the last click.
            const wrapper = editor.DomComponents.getWrapper();
            const topKids = wrapper?.components?.()?.toArray?.() ?? [];
            for (const kid of topKids) {
              const kidType = kid.get("type");
              if (!kidType || !KNOWN.has(kidType)) continue;
              const kidEl = kid.getEl?.();
              if (!kidEl) continue;
              const rect = kidEl.getBoundingClientRect();
              // Check if the selected wrapper's element overlaps with this block
              // Use the iframe's last click coordinates if available
              const lastClick = (editor as any).__lastCanvasClick;
              if (lastClick && rect.top <= lastClick.y && lastClick.y <= rect.bottom && rect.left <= lastClick.x && lastClick.x <= rect.right) {
                setSelected(kid);
                return;
              }
            }
          }
        }
      } catch { /* fallback failed */ }

      setSelected(component);
    });

    editor.on("component:deselected", () => {
      if (mountedRef.current) setSelected(null);
    });

    // Track changes for auto-save
    editor.on("component:add", () => { if (mountedRef.current) scheduleAutoSaveRef.current(); });
    editor.on("component:remove", () => { if (mountedRef.current) scheduleAutoSaveRef.current(); });
    editor.on("component:update", () => { if (mountedRef.current) scheduleAutoSaveRef.current(); });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
      // Delete/Backspace — delete selected block (unless focused on an input/textarea)
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        const sel = editor.getSelected?.();
        if (sel) {
          e.preventDefault();
          const KNOWN = new Set(Object.keys(blockSchemas));
          let block: any = sel;
          while (block) {
            const t = block.get?.("type");
            if (t && KNOWN.has(t)) break;
            block = block.parent?.() ?? null;
          }
          if (block) {
            block.remove();
            setSelected(null);
            scheduleAutoSaveRef.current();
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Register all blocks
    registerHeroBlock(editor);
    registerContentBlock(editor);
    registerFeaturesBlock(editor);
    registerTestimonialBlock(editor);
    registerCarouselBlock(editor);
    registerAccordionBlock(editor);
    registerCtaButtonBlock(editor);
    registerSearchBarBlock(editor);
    registerJobListBlock(editor);
    registerJobDetailsBlock(editor);
    registerJobCategoryBlock(editor);
    registerJoinTalentNetworkBlock(editor);
    registerVideoAndTextBlock(editor);
    registerPersonalizationBlock(editor);
    registerShowHideTabBlock(editor);
    registerImageTextGridBlock(editor);
    registerLightBoxBlock(editor);
    registerJobAlertBlock(editor);
    registerNavigateBackBlock(editor);

    // Basic elements
    registerBasicButtonBlock(editor);
    registerBasicImageBlock(editor);
    registerSpacerBlock(editor);
    registerDividerBlock(editor);

    // Navigation
    registerNavbarBlock(editor);
    registerFooterBlock(editor);

    // New blocks
    registerNotificationBannerBlock(editor);
    registerStatsCounterBlock(editor);
    registerTeamGridBlock(editor);
    registerSocialProofBlock(editor);
    registerApplicationStatusBlock(editor);

    // Inject tenant theme + base typography into canvas iframe
    editor.on("load", async () => {
      const frame = editor.Canvas.getFrameEl();
      if (!frame?.contentDocument) return;

      // Fetch tenant theme for editor parity
      let themeCSS = "";
      let fontsUrl = "";
      try {
        const res = await fetch("/api/tenants?id=default");
        const data = await res.json();
        if (data.tenant?.theme) {
          const t = data.tenant.theme;
          const fontFamily = t.typography?.fontFamily || "Inter";
          const headingFont = t.typography?.headingFontFamily || fontFamily;
          const headingWeight = t.typography?.headingWeight || "600";
          const primary = t.colors?.primary || "#2563eb";
          const text = t.colors?.text || "#111827";
          const textMuted = t.colors?.textMuted || "#6b7280";

          // Build Google Fonts URL
          const families = [fontFamily];
          if (headingFont && headingFont !== fontFamily) families.push(headingFont);
          fontsUrl = `https://fonts.googleapis.com/css2?${families.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join("&")}&display=swap`;

          themeCSS = `
            :root {
              --cb-color-primary: ${primary};
              --cb-color-text: ${text};
              --cb-color-text-muted: ${textMuted};
              --cb-font-family: "${fontFamily}", system-ui, -apple-system, sans-serif;
              --cb-font-heading: "${headingFont}", "${fontFamily}", system-ui, sans-serif;
              --cb-font-weight-heading: ${headingWeight};
            }
            body {
              font-family: var(--cb-font-family);
              color: var(--cb-color-text);
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: var(--cb-font-heading);
              font-weight: var(--cb-font-weight-heading);
              color: var(--cb-color-text);
            }
          `;
        }
      } catch {
        // Tenant API may not be available — fall back to system fonts
      }

      // Load Google Fonts in canvas
      if (fontsUrl) {
        const link = frame.contentDocument.createElement("link");
        link.rel = "stylesheet";
        link.href = fontsUrl;
        frame.contentDocument.head.appendChild(link);
      }

      const style = frame.contentDocument.createElement("style");
      style.textContent = `
        ${themeCSS}
        body {
          font-family: var(--cb-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
          color: var(--cb-color-text, #1f2937);
          margin: 0;
          line-height: 1.6;
        }
        h1, h2, h3, h4, h5, h6 { color: var(--cb-color-text, #111827); }
        a { color: inherit; }
        img { max-width: 100%; height: auto; }
        * { box-sizing: border-box; }
      `;
      frame.contentDocument.head.appendChild(style);
    });

    loadSavedPageRef.current(editor);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("keydown", onKeyDown);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

      // Remove all event listeners before destroying to prevent
      // debounced callbacks from firing after destruction
      try {
        (editor as any).off?.();
        (editor as any).stopListening?.();
      } catch { /* noop */ }
      try {
        editor.destroy();
      } catch { /* noop */ }
      editorInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  /* ── Device switching ────────────────────────────────────────────── */
  const switchDevice = useCallback((device: DeviceType) => {
    const editor = editorInstance.current;
    if (!editor) return;
    setActiveDevice(device);
    const deviceMap: Record<DeviceType, string> = {
      desktop: "Desktop",
      tablet: "Tablet",
      mobile: "Mobile",
    };
    editor.setDevice(deviceMap[device]);
  }, []);

  /* ── Loading state ─────────────────────────────────────────────── */
  if (authenticated === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading editor…</p>
      </div>
    );
  }

  const isViewer = user?.role === "viewer";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Left panel: Tabbed — Blocks / Pages ─────────────────── */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <a href="/dashboard" className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5" title="Back to Dashboard">
              🏗️ Career Builder
            </a>
            <button
              onClick={handleLogout}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
          {/* User info */}
          {user && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-700 font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email} · <span className={`font-semibold ${user.role === 'admin' ? 'text-purple-500' : user.role === 'editor' ? 'text-blue-500' : 'text-gray-500'}`}>{user.role}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {!isViewer && (
          <div className="flex border-b border-gray-200 bg-white shrink-0">
            <button
              onClick={() => setLeftTab("blocks")}
              className={`flex-1 py-2 text-[11px] font-semibold text-center transition-colors relative ${
                leftTab === "blocks"
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              🧱 Blocks
              {leftTab === "blocks" && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setLeftTab("pages")}
              className={`flex-1 py-2 text-[11px] font-semibold text-center transition-colors relative ${
                leftTab === "pages"
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              📄 Pages
              {pageCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-[9px] font-bold text-gray-600">{pageCount}</span>
              )}
              {leftTab === "pages" && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* Blocks tab */}
          <div className={leftTab === "blocks" ? "p-2" : "hidden"}>
            {isViewer ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-400">👁 View-only mode</p>
                <p className="text-[10px] text-gray-300 mt-1">You can preview but not edit</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-1 mb-2">
                  Drag to canvas
                </p>
                <div ref={blockPanelRef} />
              </>
            )}
            {isViewer && <div ref={blockPanelRef} className="hidden" />}
          </div>

          {/* Pages tab */}
          {!isViewer && (
            <div className={leftTab === "pages" ? "" : "hidden"}>
              <SiteManager
                activePage={activePage}
                onSwitchPage={(slug) => { handleSwitchPage(slug); setLeftTab("blocks"); }}
                onCreatePage={(slug) => { handleCreatePage(slug); setLeftTab("blocks"); }}
                onDeletePage={handleDeletePage}
                hasUnsaved={hasUnsaved}
                refreshKey={siteManagerRefreshKey}
                onPageCountChange={setPageCount}
              />
            </div>
          )}
        </div>

        {/* Footer — current page indicator + shortcuts */}
        <div className="p-3 border-t border-gray-100 text-[10px] text-gray-400 space-y-0.5">
          {/* Active page pill */}
          {!isViewer && (
            <button
              onClick={() => setLeftTab("pages")}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 mb-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-left"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[10px] font-medium truncate">Editing: /{activePage}</span>
            </button>
          )}
          {hasUnsaved && !isViewer && (
            <p className="text-amber-500 font-medium mb-1">● Unsaved changes</p>
          )}
          {!isViewer && (
            <>
              <p>⌘S — Save page</p>
              <p>⌘Z — Undo · ⇧⌘Z — Redo</p>
              <p>⌫ — Delete selected</p>
            </>
          )}
          {user?.role === "admin" && (
            <p className="mt-1">
              <a href="/settings" className="text-blue-500 hover:text-blue-400 underline">⚙ Settings</a>
              {" · "}
              <a href="/theme" className="text-purple-500 hover:text-purple-400 underline">🎨 Theme</a>
            </p>
          )}
        </div>
      </div>

      {/* ── Center: Canvas ────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Device switcher toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
          {/* Left spacer */}
          <div className="w-36" />

          {/* Device buttons — centered */}
          <div className="flex items-center gap-1">
            {([
              { key: "desktop" as DeviceType, icon: "🖥", label: "Desktop" },
              { key: "tablet" as DeviceType, icon: "📱", label: "Tablet" },
              { key: "mobile" as DeviceType, icon: "📲", label: "Mobile" },
            ]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => switchDevice(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeDevice === key
                    ? "bg-blue-100 text-blue-700 shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
                title={label}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Generate Page / Site buttons — right */}
          {!isViewer && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSiteGenerator(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-500 shadow-sm transition-all"
              >
                <span>🌐</span>
                <span>Generate Site</span>
              </button>
              <button
                onClick={() => setShowGenPageModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold hover:from-purple-500 hover:to-indigo-500 shadow-sm transition-all"
              >
                <span>✨</span>
                <span>Generate Page</span>
              </button>
            </div>
          )}
          {isViewer && <div className="w-36" />}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div ref={editorRef} />

          {/* Page loading overlay */}
          {pageLoading && (
            <div className="absolute inset-0 z-40 bg-white/80 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500 font-medium">Loading /{activePage}…</span>
              </div>
            </div>
          )}

          {/* Save toast */}
          {saveStatus !== "idle" && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div
                className={`px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in
                  ${saveStatus === "saving" ? "bg-gray-800 text-white" : ""}
                  ${saveStatus === "autosaving" ? "bg-gray-700 text-gray-300" : ""}
                  ${saveStatus === "saved" ? "bg-green-600 text-white" : ""}
                  ${saveStatus === "error" ? "bg-red-600 text-white" : ""}
                  ${saveStatus === "expired" ? "bg-amber-600 text-white" : ""}
                `}
              >
                {saveStatus === "saving" && "⏳ Saving…"}
                {saveStatus === "autosaving" && "💾 Auto-saving…"}
                {saveStatus === "saved" && `✅ Page saved (/${activePage})`}
                {saveStatus === "error" && "❌ Failed to save — please try again"}
                {saveStatus === "expired" && "🔒 Session expired — redirecting to login…"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Settings sidebar ─────────────────────────── */}
      <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Save + Preview buttons */}
        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
          {!isViewer && (
            <button
              onClick={() => handleSave(false)}
              disabled={saveStatus === "saving" || saveStatus === "autosaving"}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {saveStatus === "saving" ? "Saving…" : `💾 Save /${activePage}`}
            </button>
          )}
          <a
            href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/${activePage}`}
            target="_blank"
            rel="noreferrer"
            className={`${isViewer ? 'flex-1 text-center' : ''} px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors`}
            title="Preview live site"
          >
            {isViewer ? "↗ Preview Live" : "↗"}
          </a>
        </div>

        {/* Settings */}
        <div className="flex-1 overflow-y-auto p-4">
          {selected ? (
            <>
              <Sidebar component={selected} onApplyPage={handleAiApplyPage} />
              {/* Delete block button */}
              {!isViewer && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleDeleteBlock}
                    className="w-full text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 py-2 rounded-lg transition-all font-medium"
                  >
                    🗑 Delete This Block
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-4xl mb-3">🎨</div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {isViewer
                  ? "Click a block to view its settings."
                  : "Drag a block from the left panel,\nthen click it to edit settings."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Generate Page Modal ───────────────────────────────────── */}
      {showGenPageModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <span className="text-white text-lg">✨</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Generate Full Page</h3>
                    <p className="text-xs text-gray-500">AI builds a complete career page for you</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowGenPageModal(false); setGenPageError(null); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This will <strong>replace the entire /{activePage} page</strong> with a new AI-generated layout. Make sure to save your current work first.
                </p>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Describe your career page
                </label>
                <textarea
                  value={genPagePrompt}
                  onChange={(e) => setGenPagePrompt(e.target.value)}
                  placeholder="e.g. A modern tech startup focused on AI/ML, targeting senior engineers with a bold and innovative tone..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                  rows={3}
                />
              </div>

              {/* Tone / Industry / Audience selectors */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tone</label>
                  <select
                    value={genPageTone}
                    onChange={(e) => setGenPageTone(e.target.value as AiTone)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="bold">Bold</option>
                    <option value="minimal">Minimal</option>
                    <option value="hiring-focused">Hiring-focused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Industry</label>
                  <select
                    value={genPageIndustry}
                    onChange={(e) => setGenPageIndustry(e.target.value as AiIndustry)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="technology">Technology</option>
                    <option value="fintech">Fintech</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="education">Education</option>
                    <option value="ecommerce">E-Commerce</option>
                    <option value="saas">SaaS</option>
                    <option value="consulting">Consulting</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="media">Media</option>
                    <option value="nonprofit">Nonprofit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Audience</label>
                  <select
                    value={genPageAudience}
                    onChange={(e) => setGenPageAudience(e.target.value as AiAudience)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="general">General</option>
                    <option value="engineers">Engineers</option>
                    <option value="designers">Designers</option>
                    <option value="sales">Sales</option>
                    <option value="marketing">Marketing</option>
                    <option value="operations">Operations</option>
                    <option value="executives">Executives</option>
                  </select>
                </div>
              </div>

              {/* Credits info */}
              {subscription.aiEnabled && (
                <p className="text-[10px] text-gray-400">
                  Credits: {subscription.aiCreditsRemaining.toLocaleString()}/{subscription.aiCreditsTotal.toLocaleString()} remaining
                </p>
              )}

              {/* Error */}
              {genPageError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700">{genPageError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowGenPageModal(false); setGenPageError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                disabled={genPageLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePage}
                disabled={genPageLoading || !subscription.aiEnabled || subscription.aiCreditsRemaining <= 0}
                className="px-5 py-2 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-2"
              >
                {genPageLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>✨ Generate Page</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Site Generator Modal ─────────────────────────────────── */}
      {showSiteGenerator && (
        <SiteGenerator
          onSiteApplied={handleSiteApplied}
          onClose={() => setShowSiteGenerator(false)}
        />
      )}
    </div>
  );
}
