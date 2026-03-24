/*
 * Design System Components — Production-grade React primitives.
 *
 * These components extend the existing Section/Container/Card/Btn
 * in renderer.tsx via composition. They do NOT replace them.
 *
 * Provides:
 *   1. SkipLink — keyboard skip-to-content navigation
 *   2. VisuallyHidden — screen reader only text
 *   3. FocusTrap — trap focus within modals/drawers
 *   4. ResponsiveDrawer — mobile nav drawer with a11y
 *   5. LoadingState / ErrorState — consistent state UI
 *   6. LazyImage — optimized image with srcset, loading, alt enforcement
 *   7. JsonLd — safe JSON-LD script injection
 *   8. Heading — semantic heading with auto-level management
 *   9. IconButton — accessible icon-only button
 *  10. AnnouncementRegion — aria-live announcements
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  keys,
  zIndex,
  srText,
  generateSrcSet,
  defaultImageSizes,
  optimizeImageUrl,
  uniqueId,
} from "./design-system";

/* ================================================================== */
/*  1. SkipLink — Keyboard skip-to-content                            */
/* ================================================================== */

export function SkipLink({
  targetId = "main-content",
  children = srText.skipToContent,
}: {
  targetId?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-9999 focus:bg-white focus:text-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      {children}
    </a>
  );
}

/* ================================================================== */
/*  2. VisuallyHidden — Screen reader only text                        */
/* ================================================================== */

export function VisuallyHidden({
  children,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  as?: "span" | "div" | "p" | "label";
}) {
  return <Tag className="sr-only">{children}</Tag>;
}

/* ================================================================== */
/*  3. FocusTrap — Trap focus within a container                       */
/* ================================================================== */

export function FocusTrap({
  active,
  children,
  onEscape,
  restoreFocus = true,
}: {
  active: boolean;
  children: React.ReactNode;
  onEscape?: () => void;
  restoreFocus?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store currently focused element to restore later
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === keys.Escape && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key !== keys.Tab) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, onEscape, restoreFocus]);

  return (
    <div ref={containerRef} role="dialog" aria-modal={active ? "true" : undefined}>
      {children}
    </div>
  );
}

/* ================================================================== */
/*  4. ResponsiveDrawer — Mobile navigation drawer                     */
/* ================================================================== */

export function ResponsiveDrawer({
  isOpen,
  onClose,
  children,
  side = "right",
  label = "Navigation menu",
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  label?: string;
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sideClass = side === "left" ? "left-0" : "right-0";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        style={{ zIndex: zIndex.overlay }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <FocusTrap active={isOpen} onEscape={onClose}>
        <div
          className={`fixed top-0 ${sideClass} h-full w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform`}
          style={{ zIndex: zIndex.modal }}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <span className="font-semibold text-gray-900">{label}</span>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={srText.collapseMenu}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 65px)" }}>
            {children}
          </div>
        </div>
      </FocusTrap>
    </>
  );
}

/* ================================================================== */
/*  5. Loading / Error / Empty States                                  */
/* ================================================================== */

export function LoadingState({
  message = srText.loading,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className}`} role="status" aria-live="polite">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm text-gray-500">{message}</p>
      <VisuallyHidden>{message}</VisuallyHidden>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this section. Please try refreshing.",
  onRetry,
  className = "",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`} role="alert">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4" aria-hidden="true">
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  6. LazyImage — Optimized, accessible image                         */
/* ================================================================== */

export function LazyImage({
  src,
  alt,
  className = "",
  width,
  height,
  loading = "lazy",
  priority = false,
  sizes = defaultImageSizes,
  fallbackSrc,
  aspectRatio,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  priority?: boolean;
  sizes?: string;
  fallbackSrc?: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
}) {
  const [error, setError] = useState(false);
  const imgSrc = error && fallbackSrc ? fallbackSrc : src;

  // Warn in dev if alt is missing
  if (process.env.NODE_ENV === "development" && !alt) {
    console.warn("[LazyImage] Missing alt text for image:", src);
  }

  const srcSet = !error ? generateSrcSet(src) : undefined;

  return (
    <img
      src={optimizeImageUrl(imgSrc)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={priority ? "eager" : loading}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      onError={() => setError(true)}
      style={{
        ...style,
        ...(aspectRatio ? { aspectRatio } : {}),
      }}
    />
  );
}

/* ================================================================== */
/*  7. JsonLd — Safe structured data injection                         */
/* ================================================================== */

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = useMemo(() => {
    try {
      // Escape </script> and <!-- to prevent XSS via script breakout
      return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
    } catch {
      return null;
    }
  }, [data]);

  if (!json) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

/* ================================================================== */
/*  8. HeadingLevel — Semantic heading hierarchy                       */
/* ================================================================== */

const HeadingLevelContext = createContext<number>(1);

/**
 * HeadingLevelProvider — automatically manages heading hierarchy.
 * Nest these to increment heading levels automatically.
 *
 * Usage:
 *   <HeadingLevelProvider>
 *     <Heading>This is h2</Heading>
 *     <HeadingLevelProvider>
 *       <Heading>This is h3</Heading>
 *     </HeadingLevelProvider>
 *   </HeadingLevelProvider>
 */
export function HeadingLevelProvider({
  children,
  level,
}: {
  children: React.ReactNode;
  level?: number;
}) {
  const parentLevel = useContext(HeadingLevelContext);
  const nextLevel = level ?? Math.min(parentLevel + 1, 6);

  return (
    <HeadingLevelContext.Provider value={nextLevel}>
      {children}
    </HeadingLevelContext.Provider>
  );
}

/**
 * Heading — renders the correct heading tag based on context.
 */
export function Heading({
  children,
  className = "",
  style,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  const level = useContext(HeadingLevelContext);
  const Tag = `h${Math.min(Math.max(level, 1), 6)}` as keyof React.JSX.IntrinsicElements;
  return <Tag className={className} style={style} id={id}>{children}</Tag>;
}

/* ================================================================== */
/*  9. IconButton — Accessible icon-only button                        */
/* ================================================================== */

export function IconButton({
  label,
  onClick,
  children,
  className = "",
  disabled = false,
  size = "md",
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ================================================================== */
/*  10. AnnouncementRegion — aria-live for dynamic content             */
/* ================================================================== */

const AnnouncementContext = createContext<(message: string) => void>(() => {});

export function useAnnounce() {
  return useContext(AnnouncementContext);
}

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");

  const announce = useCallback((msg: string) => {
    // Clear first to ensure screen readers pick up repeated messages
    setMessage("");
    requestAnimationFrame(() => setMessage(msg));
  }, []);

  return (
    <AnnouncementContext.Provider value={announce}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </AnnouncementContext.Provider>
  );
}

/* ================================================================== */
/*  11. ExternalLink — Accessible external link                        */
/* ================================================================== */

export function ExternalLink({
  href,
  children,
  className = "",
  style,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <a
      href={href}
      className={className}
      style={style}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <VisuallyHidden>{srText.externalLink}</VisuallyHidden>
    </a>
  );
}

/* ================================================================== */
/*  12. useReducedMotion — respect user preference                     */
/* ================================================================== */

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

/* ================================================================== */
/*  13. useMobileDetect — responsive hook                              */
/* ================================================================== */

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
