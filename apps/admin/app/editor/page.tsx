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
import VersionHistory from "@/components/editor/VersionHistory";
import { Button, Spinner } from "@/components/ui";

const SiteGenerator = dynamic(() => import("@/components/ai/SiteGenerator"), { ssr: false });

/* ── Inline chrome icons (decorative — always aria-hidden) ──────────── */
const ICON = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};
function IconUndo({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>;
}
function IconRedo({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg>;
}
function IconHistory({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l3 2" /></svg>;
}
function IconDesktop({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
}
function IconTablet({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>;
}
function IconMobile({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></svg>;
}
function IconGlobe({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" /></svg>;
}
function IconSparkles({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M18 16l.7 1.8L20.5 18.5l-1.8.7L18 21l-.7-1.8L15.5 18.5l1.8-.7z" /></svg>;
}
function IconSave({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>;
}
function IconRocket({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z" /><path d="M12 15l-3-3a14 14 0 0 1 9-9c2 0 3 1 3 3a14 14 0 0 1-9 9z" /><circle cx="15" cy="9" r="1" /></svg>;
}
function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M5 13l4 4L19 7" /></svg>;
}
function IconX({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
function IconExternal({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>;
}
function IconLock({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
}
function IconTrash({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;
}
function IconAlert({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;
}
function IconBlocks({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>;
}
function IconPages({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} {...ICON}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error" | "expired" | "autosaving";
type DeviceType = "desktop" | "tablet" | "mobile";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer";
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
  const [pageVersion, setPageVersion] = useState(0); // Track current version for optimistic locking
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blockPanelRef = useRef<HTMLDivElement | null>(null);
  const editorInstance = useRef<any>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const handleSaveRef = useRef<(isAutoSave?: boolean) => Promise<void>>(null!);
  const scheduleAutoSaveRef = useRef<() => void>(null!);
  const loadSavedPageRef = useRef<(editor: any) => Promise<void>>(null!);
  const activePageRef = useRef("careers");
  const pageVersionRef = useRef(0); // Ref for use in callbacks
  const router = useRouter();

  /* ── Subscription (for AI page gen in toolbar) ─────────────────── */
  const { status: subscription, decrementCredit, refresh: refreshSubscription } = useSubscription();

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
    const checkoutStatus = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkoutStatus === "success") {
      // Always clean the URL immediately so the user doesn't see the params
      window.history.replaceState({}, "", "/editor");

      // Sync subscription from Stripe — this is the fallback path for when
      // the webhook didn't fire (wrong secret, unconfigured endpoint, etc.)
      if (sessionId) {
        fetch("/api/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        })
          .then(async (res) => {
            if (res.ok) {
              // Force all useSubscription instances to re-fetch from DB
              await refreshSubscription();
              console.log("[checkout] Subscription synced from Stripe ✅");
            } else {
              // Sync failed — still refresh the subscription state in case
              // the webhook already fired and the DB is up-to-date
              console.warn("[checkout] Sync endpoint returned", res.status, "— falling back to refresh");
              await refreshSubscription();
            }
          })
          .catch((err) => {
            console.error("[checkout] Stripe sync error:", err);
            // Even on network error, refresh in case webhook updated the DB
            refreshSubscription();
          });
      } else {
        // No session_id in URL — webhook may have already fired, just refresh
        refreshSubscription();
      }
    }

    if (params.get("openSiteGen") === "true") {
      setShowSiteGenerator(true);
      window.history.replaceState({}, "", "/editor");
    }
  }, [refreshSubscription]);

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
        body: JSON.stringify({
          slug: activePageRef.current,
          blocks,
          // Send current version for optimistic locking (skip for auto-save to avoid false conflicts)
          ...(isAutoSave ? {} : { expectedVersion: pageVersionRef.current || undefined }),
        }),
      });

      if (res.status === 401) {
        setSaveStatus("expired");
        setTimeout(() => router.push("/login"), 2500);
        return;
      }

      // Handle version conflict (409)
      if (res.status === 409) {
        const conflictData = await res.json();
        setSaveStatus("error");
        alert(
          `⚠️ Save conflict detected!\n\n` +
          `Another user has saved this page (version ${conflictData.currentVersion}).\n` +
          `Your changes were NOT saved.\n\n` +
          `Click OK to reload the latest version.`
        );
        // Reload the page from server to get latest version
        const wrapper = editor.DomComponents.getWrapper();
        wrapper.components([]);
        setSelected(null);
        await loadSavedPageRef.current(editor);
        setSaveStatus("idle");
        return;
      }

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();

      // Update version tracking from server response
      if (data.version) {
        setPageVersion(data.version);
        pageVersionRef.current = data.version;
      }

      // Track publish status — save always creates unpublished changes
      if (data.hasUnpublishedChanges !== undefined) {
        setHasUnpublishedChanges(data.hasUnpublishedChanges);
      } else {
        setHasUnpublishedChanges(true);
      }

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

  /* ── Delete handler (with locked region protection) ──────────── */
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
      // Locked regions: navbar and footer cannot be deleted
      const blockType = block.get("type");
      const LOCKED_TYPES = new Set(["navbar", "footer"]);
      if (LOCKED_TYPES.has(blockType)) {
        // Show a brief visual indicator instead of a disruptive alert
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
        return;
      }

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

      // Track version from server for optimistic locking
      if (typeof data.version === "number") {
        setPageVersion(data.version);
        pageVersionRef.current = data.version;
      }

      // Track publish status
      if (data.hasUnpublishedChanges !== undefined) {
        setHasUnpublishedChanges(data.hasUnpublishedChanges);
      }
      if (typeof data.publishedVersion === "number") {
        setPublishedVersion(data.publishedVersion);
      }

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
  pageVersionRef.current = pageVersion;

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
    setShowVersionHistory(false);

    // Update state + ref BEFORE loading so save handler uses new slug
    setActivePage(slug);
    activePageRef.current = slug;

    // Reset version tracking for the new page
    setPageVersion(0);
    pageVersionRef.current = 0;

    // Load the new page
    setPageLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pages?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        const blocks = data.blocks || [];

        // Track version from server
        if (typeof data.version === "number") {
          setPageVersion(data.version);
          pageVersionRef.current = data.version;
        }

        // Track publish status
        if (data.hasUnpublishedChanges !== undefined) {
          setHasUnpublishedChanges(data.hasUnpublishedChanges);
        }
        if (typeof data.publishedVersion === "number") {
          setPublishedVersion(data.publishedVersion);
        }

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

    const isTextEditingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      return (
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable === true
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
      // Undo / Redo — Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (advertised in the footer
      // but previously not wired). Skip when editing text so native undo works.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !isTextEditingTarget(e.target)) {
        e.preventDefault();
        const um = editor.UndoManager;
        // The editor's "undo"/"redo" events refresh the toolbar counts.
        if (e.shiftKey) um?.redo?.();
        else um?.undo?.();
      }
      // Delete/Backspace — delete selected block (unless focused on an input/textarea)
      // Protected: navbar and footer blocks cannot be deleted
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        const sel = editor.getSelected?.();
        if (sel) {
          e.preventDefault();
          const KNOWN = new Set(Object.keys(blockSchemas));
          const LOCKED_TYPES = new Set(["navbar", "footer"]);
          let block: any = sel;
          while (block) {
            const t = block.get?.("type");
            if (t && KNOWN.has(t)) break;
            block = block.parent?.() ?? null;
          }
          if (block) {
            const blockType = block.get?.("type");
            if (blockType && LOCKED_TYPES.has(blockType)) {
              // Cannot delete locked block — show brief indicator
              return;
            }
            block.remove();
            setSelected(null);
            scheduleAutoSaveRef.current();
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Track undo/redo availability for toolbar buttons
    const updateUndoRedo = () => {
      if (!mountedRef.current) return;
      const um = editor.UndoManager;
      if (um) {
        setUndoCount(um.hasUndo?.() ? um.getStack?.()?.length || 1 : 0);
        setRedoCount(um.hasRedo?.() ? 1 : 0);
      }
    };
    editor.on("component:add", updateUndoRedo);
    editor.on("component:remove", updateUndoRedo);
    editor.on("component:update", updateUndoRedo);
    editor.on("undo", updateUndoRedo);
    editor.on("redo", updateUndoRedo);

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
     
  }, [authenticated]);

  /* ── Version restore handler ─────────────────────────────────── */
  const handleVersionRestore = useCallback((newVersion: number, blocks: Array<{ type: string; props: Record<string, unknown> }>) => {
    const editor = editorInstance.current;
    if (!editor) return;

    // Clear canvas and apply restored blocks
    const wrapper = editor.DomComponents.getWrapper();
    wrapper.components([]);

    for (const block of blocks) {
      const schema = blockSchemas[block.type];
      if (!schema) continue;
      const defaults = getDefaultProps(block.type);
      const mergedProps = { ...defaults, ...block.props };
      editor.addComponents({ type: block.type, props: mergedProps });
    }

    // Force rebuild
    requestAnimationFrame(() => {
      const allComponents = editor.getComponents?.()?.toArray?.() ?? [];
      for (const comp of allComponents) {
        editor.trigger("component:update:props", comp);
      }
    });

    // Update version tracking
    setPageVersion(newVersion);
    pageVersionRef.current = newVersion;
    setSelected(null);
    setHasUnsaved(false);
    setShowVersionHistory(false);
  }, []);

  /* ── Publish handler — save draft then push live ────────────────── */
  const handlePublish = useCallback(async () => {
    if (user?.role === "viewer" || user?.role === "recruiter") return;

    setPublishStatus("publishing");

    try {
      // Always save current state first before publishing
      const editor = editorInstance.current;
      if (editor) {
        const blocks = editor
          .getComponents()
          .toArray()
          .map((comp: any) => {
            const type = comp.get("type");
            if (type === "text" || type === "textnode" || type === "default") return null;
            return { type, props: comp.get("props") || {} };
          })
          .filter(Boolean);

        const saveRes = await fetch("/api/pages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          body: JSON.stringify({
            slug: activePageRef.current,
            blocks,
          }),
        });

        if (saveRes.status === 401) {
          setSaveStatus("expired");
          setTimeout(() => router.push("/login"), 2500);
          setPublishStatus("idle");
          return;
        }

        if (!saveRes.ok) {
          throw new Error("Save before publish failed");
        }

        const saveData = await saveRes.json();
        if (saveData.version) {
          setPageVersion(saveData.version);
          pageVersionRef.current = saveData.version;
        }
        setHasUnsaved(false);
      }

      // Now publish — this copies draft → publishedBlocks and creates a version snapshot
      const res = await fetch("/api/pages/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({ slug: activePageRef.current }),
      });

      if (res.status === 401) {
        setSaveStatus("expired");
        setTimeout(() => router.push("/login"), 2500);
        setPublishStatus("idle");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Publish failed");
      }

      const data = await res.json();

      setHasUnpublishedChanges(false);
      setPublishedVersion(data.version);
      setPublishStatus("published");
      setTimeout(() => setPublishStatus("idle"), 3000);
    } catch (err: any) {
      console.error("[Publish] Error:", err);
      setPublishStatus("error");
      setTimeout(() => setPublishStatus("idle"), 3000);
    }
  }, [user, router]);

  /* ── Preview handler — save current draft, then open a token-gated
   *    draft preview of the public page in a new tab. ──────────────── */
  const handlePreview = useCallback(async () => {
    // Open the tab synchronously so popup blockers don't kill it after await.
    const win = window.open("", "_blank");
    try {
      // Persist the latest edits first so the preview reflects them.
      await handleSaveRef.current?.(true);
      const slug = activePageRef.current;
      const res = await fetch(`/api/preview/token?slug=${encodeURIComponent(slug)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.previewUrl) {
        if (win) win.location.href = data.previewUrl;
        else window.open(data.previewUrl, "_blank");
      } else {
        win?.close();
        console.error("[Preview] token error:", data?.error);
      }
    } catch (err) {
      win?.close();
      console.error("[Preview] error:", err);
    }
  }, []);

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
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-50" role="status" aria-live="polite">
        <span className="inline-block h-8 w-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-600">Loading editor…</p>
      </div>
    );
  }

  const isViewer = user?.role === "viewer";

  return (
    <>
    {/* ── Small screen blocker — editor requires tablet+ ──────── */}
    <div className="flex md:hidden h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <div className="text-4xl">🖥️</div>
      <h1 className="text-lg font-semibold text-gray-900">Larger screen required</h1>
      <p className="text-sm text-gray-500 max-w-xs">
        The visual editor requires a tablet or desktop screen (768px+) for the best experience. Please switch to a larger device.
      </p>
      <a href="/dashboard" className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">
        ← Back to Dashboard
      </a>
    </div>
    <div className="hidden md:flex h-screen bg-gray-50">
      {/* ── Left panel: Tabbed — Blocks / Pages ─────────────────── */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden" aria-label="Editor blocks and pages">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-md text-sm font-bold text-gray-900 tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              title="Back to Dashboard"
            >
              <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6" />
              </svg>
              Career Builder
            </a>
            <button
              onClick={handleLogout}
              className="rounded px-1 text-[11px] font-medium text-gray-600 hover:text-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
          {/* User info */}
          {user && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-800 font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-gray-600 truncate">{user.email} · <span className={`font-semibold ${user.role === 'super_admin' ? 'text-red-600' : user.role === 'admin' ? 'text-purple-600' : user.role === 'hiring_manager' ? 'text-blue-600' : user.role === 'recruiter' ? 'text-teal-700' : 'text-gray-600'}`}>{user.role === 'super_admin' ? 'Super Admin' : user.role === 'hiring_manager' ? 'Hiring Manager' : user.role}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {!isViewer && (
          <div className="flex border-b border-gray-200 bg-white shrink-0" role="tablist" aria-label="Left panel sections">
            <button
              role="tab"
              id="tab-blocks"
              aria-selected={leftTab === "blocks"}
              aria-controls="panel-blocks"
              onClick={() => setLeftTab("blocks")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 py-2 text-[11px] font-semibold transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                leftTab === "blocks"
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <IconBlocks className="h-3.5 w-3.5" />
              Blocks
              {leftTab === "blocks" && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" aria-hidden="true" />
              )}
            </button>
            <button
              role="tab"
              id="tab-pages"
              aria-selected={leftTab === "pages"}
              aria-controls="panel-pages"
              onClick={() => setLeftTab("pages")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 py-2 text-[11px] font-semibold transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                leftTab === "pages"
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <IconPages className="h-3.5 w-3.5" />
              Pages
              {pageCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-gray-200 text-[9px] font-bold text-gray-700" aria-hidden="true">{pageCount}</span>
              )}
              {leftTab === "pages" && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* Blocks tab */}
          <div
            id="panel-blocks"
            role={isViewer ? undefined : "tabpanel"}
            aria-labelledby={isViewer ? undefined : "tab-blocks"}
            className={leftTab === "blocks" ? "p-2" : "hidden"}
          >
            {isViewer ? (
              <div className="text-center py-8">
                <p className="text-xs font-medium text-gray-700">View-only mode</p>
                <p className="text-[11px] text-gray-500 mt-1">You can preview but not edit</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-1 mb-2">
                  Drag to canvas
                </p>
                <div ref={blockPanelRef} />
              </>
            )}
            {isViewer && <div ref={blockPanelRef} className="hidden" />}
          </div>

          {/* Pages tab */}
          {!isViewer && (
            <div
              id="panel-pages"
              role="tabpanel"
              aria-labelledby="tab-pages"
              className={leftTab === "pages" ? "" : "hidden"}
            >
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
        <div className="p-3 border-t border-gray-200 text-[10px] text-gray-600 space-y-0.5">
          {/* Active page pill */}
          {!isViewer && (
            <button
              onClick={() => setLeftTab("pages")}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 mb-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-medium truncate">Editing: /{activePage}</span>
            </button>
          )}
          {hasUnsaved && !isViewer && (
            <p className="flex items-center gap-1.5 text-amber-700 font-medium mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
              Unsaved changes
            </p>
          )}
          {!isViewer && (
            <>
              <p>⌘S — Save page</p>
              <p>⌘Z — Undo · ⇧⌘Z — Redo</p>
              <p>⌫ — Delete selected</p>
            </>
          )}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
              <a href="/settings" className="rounded text-blue-700 hover:text-blue-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Settings</a>
              <a href="/theme" className="rounded text-purple-700 hover:text-purple-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Theme</a>
              <a href="/analytics" className="rounded text-green-700 hover:text-green-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Analytics</a>
            </p>
          )}
        </div>
      </aside>

      {/* ── Center: Canvas ────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Device switcher toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
          {/* Left: Undo/Redo + Version History */}
          <div className="flex items-center gap-1 w-56">
            {!isViewer && (
              <>
                <button
                  onClick={() => editorInstance.current?.UndoManager?.undo?.()}
                  disabled={undoCount === 0}
                  aria-label="Undo (⌘Z)"
                  className={`inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    undoCount > 0
                      ? "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                  title="Undo (⌘Z)"
                >
                  <IconUndo />
                </button>
                <button
                  onClick={() => editorInstance.current?.UndoManager?.redo?.()}
                  disabled={redoCount === 0}
                  aria-label="Redo (⇧⌘Z)"
                  className={`inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    redoCount > 0
                      ? "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                  title="Redo (⇧⌘Z)"
                >
                  <IconRedo />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1" aria-hidden="true" />
                <button
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  aria-pressed={showVersionHistory}
                  className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    showVersionHistory
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  title="Version History"
                >
                  <IconHistory />
                  <span className="hidden sm:inline">History</span>
                  {pageVersion > 0 && (
                    <span className="text-[9px] bg-gray-200 text-gray-700 px-1 rounded-full">
                      v{pageVersion}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Device buttons — centered */}
          <div className="flex items-center gap-1" role="group" aria-label="Canvas device preview">
            {([
              { key: "desktop" as DeviceType, Icon: IconDesktop, label: "Desktop" },
              { key: "tablet" as DeviceType, Icon: IconTablet, label: "Tablet" },
              { key: "mobile" as DeviceType, Icon: IconMobile, label: "Mobile" },
            ]).map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => switchDevice(key)}
                aria-pressed={activeDevice === key}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  activeDevice === key
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
                title={label}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Generate Page / Site buttons — right */}
          {!isViewer && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSiteGenerator(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-500 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <IconGlobe />
                <span>Generate Site</span>
              </button>
              <button
                onClick={() => setShowGenPageModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold hover:from-purple-500 hover:to-indigo-500 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-1"
              >
                <IconSparkles />
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
            <div className="absolute inset-0 z-40 bg-white/80 flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span className="text-sm text-gray-700 font-medium">Loading /{activePage}…</span>
              </div>
            </div>
          )}

          {/* Save toast */}
          {saveStatus !== "idle" && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
              role={saveStatus === "error" || saveStatus === "expired" ? "alert" : "status"}
              aria-live={saveStatus === "error" || saveStatus === "expired" ? "assertive" : "polite"}
            >
              <div
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in
                  ${saveStatus === "saving" ? "bg-gray-800 text-white" : ""}
                  ${saveStatus === "autosaving" ? "bg-gray-700 text-gray-100" : ""}
                  ${saveStatus === "saved" ? "bg-green-600 text-white" : ""}
                  ${saveStatus === "error" ? "bg-red-600 text-white" : ""}
                  ${saveStatus === "expired" ? "bg-amber-600 text-white" : ""}
                `}
              >
                {saveStatus === "saving" && <><Spinner className="h-4 w-4" />Saving…</>}
                {saveStatus === "autosaving" && <><IconSave />Auto-saving…</>}
                {saveStatus === "saved" && <><IconCheck />{`Page saved (/${activePage}) — v${pageVersion}`}</>}
                {saveStatus === "error" && <><IconX />Failed to save — please try again</>}
                {saveStatus === "expired" && <><IconLock />Session expired — redirecting to login…</>}
              </div>
            </div>
          )}

          {/* Publish toast */}
          {publishStatus !== "idle" && saveStatus === "idle" && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
              role={publishStatus === "error" ? "alert" : "status"}
              aria-live={publishStatus === "error" ? "assertive" : "polite"}
            >
              <div
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all animate-fade-in
                  ${publishStatus === "publishing" ? "bg-emerald-800 text-white" : ""}
                  ${publishStatus === "published" ? "bg-emerald-600 text-white" : ""}
                  ${publishStatus === "error" ? "bg-red-600 text-white" : ""}
                `}
              >
                {publishStatus === "publishing" && <><Spinner className="h-4 w-4" />Publishing changes…</>}
                {publishStatus === "published" && <><IconCheck />{`Published! Changes are now live on /${activePage}`}</>}
                {publishStatus === "error" && <><IconX />Publish failed — please try again</>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Settings sidebar / Version History ────── */}
      <aside className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden" aria-label="Block settings and publishing">
        {/* Save + Publish + Preview buttons */}
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          {!isViewer && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave(false)}
                disabled={saveStatus === "saving" || saveStatus === "autosaving"}
                loading={saveStatus === "saving"}
                fullWidth
              >
                {saveStatus !== "saving" && <IconSave />}
                {saveStatus === "saving" ? "Saving…" : "Save Draft"}
              </Button>
              {/* Publish button — visible for admins/hiring managers */}
              {user?.role !== "recruiter" && (
                <Button
                  onClick={handlePublish}
                  disabled={publishStatus === "publishing"}
                  loading={publishStatus === "publishing"}
                  fullWidth
                  className={
                    publishStatus === "published"
                      ? "!bg-green-600 !text-white"
                      : publishStatus === "error"
                        ? "!bg-red-600 !text-white"
                        : "!bg-emerald-600 hover:!bg-emerald-500 !text-white"
                  }
                >
                  {publishStatus === "publishing" ? (
                    "Publishing…"
                  ) : publishStatus === "published" ? (
                    <><IconCheck />Published!</>
                  ) : publishStatus === "error" ? (
                    <><IconX />Failed</>
                  ) : (
                    <><IconRocket />Publish</>
                  )}
                </Button>
              )}
            </div>
          )}
          {/* Draft preview — opens the page as it will look, before publishing */}
          <button
            onClick={handlePreview}
            className="cb-btn flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Preview the current draft (saves first)"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
            </svg>
            Preview draft
          </button>
          {/* View the published live page (only meaningful once published) */}
          <a
            href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/${activePage}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-gray-600 text-[11px] font-medium rounded-lg transition-colors hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="View the published live page"
          >
            <IconExternal className="h-3.5 w-3.5" />
            View live site
          </a>
          {/* Unpublished changes indicator */}
          {!isViewer && hasUnpublishedChanges && publishStatus === "idle" && (
            <p className="flex items-center justify-center gap-1 text-[10px] text-amber-700 font-medium text-center">
              <IconAlert className="h-3 w-3" />
              Draft has unpublished changes{publishedVersion > 0 ? ` (live: v${publishedVersion})` : ""}
            </p>
          )}
        </div>

        {/* Version History panel */}
        {showVersionHistory && !isViewer ? (
          <VersionHistory
            slug={activePage}
            currentVersion={pageVersion}
            onRestore={handleVersionRestore}
            onClose={() => setShowVersionHistory(false)}
            csrfToken={getCsrfToken()}
          />
        ) : (
          /* Settings */
          <div className="flex-1 overflow-y-auto p-4">
            {selected ? (
              <>
                <Sidebar component={selected} onApplyPage={handleAiApplyPage} />
                {/* Delete block button — with locked region protection */}
                {!isViewer && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    {/* Locked indicator for navbar/footer */}
                    {selected && ["navbar", "footer"].includes(selected.get?.("type")) ? (
                      <div className="w-full text-center py-2 text-xs text-gray-600 flex items-center justify-center gap-1.5">
                        <IconLock className="h-3.5 w-3.5" />
                        <span>This block is locked and cannot be deleted</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleDeleteBlock}
                        className="cb-btn w-full inline-flex items-center justify-center gap-1.5 text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 py-2 rounded-lg transition-all font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-1"
                      >
                        <IconTrash className="h-4 w-4" />
                        Delete This Block
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600" aria-hidden="true">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" />
                    <path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.5 1.8-1.5H16a6 6 0 0 0 6-6c0-4.4-4.5-8-10-8z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {isViewer
                    ? "Click a block to view its settings."
                    : "Drag a block from the left panel,\nthen click it to edit settings."}
                </p>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Generate Page Modal ───────────────────────────────────── */}
      {showGenPageModal && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowGenPageModal(false); setGenPageError(null); } }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="genpage-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm text-white" aria-hidden="true">
                    <IconSparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 id="genpage-title" className="text-base font-bold text-gray-900">Generate Full Page</h3>
                    <p className="text-xs text-gray-600">AI builds a complete career page for you</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowGenPageModal(false); setGenPageError(null); }}
                  aria-label="Close dialog"
                  className="w-11 h-11 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200" role="status">
                <IconAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This will <strong>replace the entire /{activePage} page</strong> with a new AI-generated layout. Make sure to save your current work first.
                </p>
              </div>

              {/* Prompt */}
              <div>
                <label htmlFor="genpage-prompt" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Describe your career page
                </label>
                <textarea
                  id="genpage-prompt"
                  value={genPagePrompt}
                  onChange={(e) => setGenPagePrompt(e.target.value)}
                  placeholder="e.g. A modern tech startup focused on AI/ML, targeting senior engineers with a bold and innovative tone..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:border-purple-600 placeholder:text-gray-500"
                  rows={3}
                />
              </div>

              {/* Tone / Industry / Audience selectors */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="genpage-tone" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Tone</label>
                  <select
                    id="genpage-tone"
                    value={genPageTone}
                    onChange={(e) => setGenPageTone(e.target.value as AiTone)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="bold">Bold</option>
                    <option value="minimal">Minimal</option>
                    <option value="hiring-focused">Hiring-focused</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="genpage-industry" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Industry</label>
                  <select
                    id="genpage-industry"
                    value={genPageIndustry}
                    onChange={(e) => setGenPageIndustry(e.target.value as AiIndustry)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
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
                  <label htmlFor="genpage-audience" className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Audience</label>
                  <select
                    id="genpage-audience"
                    value={genPageAudience}
                    onChange={(e) => setGenPageAudience(e.target.value as AiAudience)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
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
                <p className="text-[10px] text-gray-600">
                  Credits: {subscription.aiCreditsRemaining.toLocaleString()}/{subscription.aiCreditsTotal.toLocaleString()} remaining
                </p>
              )}

              {/* Error */}
              {genPageError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200" role="alert">
                  <p className="text-xs text-red-700">{genPageError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowGenPageModal(false); setGenPageError(null); }}
                className="cb-btn h-10 px-4 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                disabled={genPageLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePage}
                disabled={genPageLoading || !subscription.aiEnabled || subscription.aiCreditsRemaining <= 0}
                aria-busy={genPageLoading || undefined}
                className="cb-btn h-10 px-5 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-purple-600"
              >
                {genPageLoading ? (
                  <><Spinner className="h-4 w-4" />Generating…</>
                ) : (
                  <><IconSparkles />Generate Page</>
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
    </>
  );
}
