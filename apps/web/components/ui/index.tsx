/*
 * Shared UI primitives for the public web app (app-chrome pages: marketing,
 * jobs, auth, job-detail, system). One source of truth for buttons, inputs,
 * cards, layout, badges, alerts, empty states — so every page is consistent,
 * accessible (WCAG-AA), and responsive. See docs/DESIGN_SYSTEM.md.
 *
 * Tenant-themed renderer blocks (lib/renderer.tsx) keep their own theme tokens;
 * these primitives use the fixed product brand (blue-600).
 */

"use client";

import * as React from "react";
import Link from "next/link";

/* ================================================================== */
/*  Button                                                             */
/* ================================================================== */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "cb-btn inline-flex items-center justify-center gap-2 font-semibold rounded-lg whitespace-nowrap " +
  "focus:outline-none disabled:opacity-60 disabled:pointer-events-none select-none";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-[15px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", full = false) {
  return `${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${full ? "w-full" : ""}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary", size = "md", fullWidth, loading, disabled, className = "", children, ...rest
}: ButtonProps) {
  return (
    <button
      className={`${buttonClasses(variant, size, fullWidth)} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Button-styled link. Uses next/link for internal routes, <a> for external/anchors. */
export function ButtonLink({
  href, variant = "primary", size = "md", fullWidth, className = "", children, ...rest
}: ButtonLinkProps) {
  const cls = `${buttonClasses(variant, size, fullWidth)} ${className}`;
  const external = /^https?:\/\//.test(href) || href.startsWith("#") || href.startsWith("mailto:");
  if (external) {
    return <a href={href} className={cls} {...rest}>{children}</a>;
  }
  return <Link href={href} className={cls} {...rest}>{children}</Link>;
}

/* ================================================================== */
/*  Form fields                                                        */
/* ================================================================== */

const INPUT_BASE =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 " +
  "placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 " +
  "focus-visible:border-blue-600 disabled:bg-gray-50 disabled:text-gray-500 transition";

const INPUT_ERROR = "border-red-400 focus-visible:ring-red-600 focus-visible:border-red-600";

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  labelRight?: React.ReactNode;
}

export function Field({ label, error, hint, labelRight, required, className = "", ...rest }: FieldProps) {
  const id = React.useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600" aria-hidden="true"> *</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {labelRight}
      </div>
      <input
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        className={`${INPUT_BASE} ${error ? INPUT_ERROR : ""} ${className}`}
        {...rest}
      />
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p id={errId} className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

interface TextareaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextareaField({ label, error, hint, required, className = "", ...rest }: TextareaFieldProps) {
  const id = React.useId();
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={`${INPUT_BASE} resize-none ${error ? INPUT_ERROR : ""} ${className}`}
        {...rest}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p id={errId} className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

type PasswordFieldProps = Omit<FieldProps, "type">;

export function PasswordField({ label, error, hint, labelRight, required, className = "", ...rest }: PasswordFieldProps) {
  const id = React.useId();
  const errId = `${id}-err`;
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600" aria-hidden="true"> *</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className={`${INPUT_BASE} pr-12 ${error ? INPUT_ERROR : ""} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-r-lg"
        >
          {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      {error && <p id={errId} className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/* ================================================================== */
/*  Layout                                                             */
/* ================================================================== */

export function Container({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function Section({
  className = "", muted, children, ...rest
}: { className?: string; muted?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`py-12 md:py-16 lg:py-20 xl:py-28 ${muted ? "bg-gray-50" : ""} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow, title, subtitle, center = true, id,
}: { eyebrow?: string; title: string; subtitle?: string; center?: boolean; id?: string }) {
  return (
    <div className={`${center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} mb-10 md:mb-14`}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-600">{eyebrow}</p>
      )}
      <h2 id={id} className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 text-balance">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed text-balance">{subtitle}</p>}
    </div>
  );
}

/* ================================================================== */
/*  Card                                                               */
/* ================================================================== */

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  interactive?: boolean;
  as?: "div" | "article" | "li";
}

export function Card({ interactive, as = "div", className = "", children, ...rest }: CardProps) {
  const Tag = as as React.ElementType;
  return (
    <Tag
      data-card={interactive ? "interactive" : undefined}
      className={`rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xs ${interactive ? "cursor-pointer" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ================================================================== */
/*  Badge / Pill                                                       */
/* ================================================================== */

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};

export function Badge({
  tone = "neutral", className = "", children,
}: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ================================================================== */
/*  Alert / Banner                                                     */
/* ================================================================== */

type AlertTone = "error" | "success" | "info" | "warning";

const ALERT_TONE: Record<AlertTone, string> = {
  error: "bg-red-50 border-red-100 text-red-700",
  success: "bg-emerald-50 border-emerald-100 text-emerald-700",
  info: "bg-blue-50 border-blue-100 text-blue-700",
  warning: "bg-amber-50 border-amber-100 text-amber-800",
};

export function Alert({
  tone = "info", className = "", children,
}: { tone?: AlertTone; className?: string; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-lg border px-4 py-3 text-sm ${ALERT_TONE[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/* ================================================================== */
/*  EmptyState / StatusState                                           */
/* ================================================================== */

export function EmptyState({
  icon, title, body, action, secondaryAction,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md text-center py-12">
      {icon && (
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {body && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{body}</p>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Skeleton                                                           */
/* ================================================================== */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`cb-skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="cb-skeleton cb-skeleton-text" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Spinner + Icons (inline SVG, always aria-hidden)                   */
/* ================================================================== */

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}

type IconProps = { className?: string };
const ICON_BASE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };

export function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M5 13l4 4L19 7" /></svg>;
}
export function ArrowRightIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
export function ArrowLeftIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
}
export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
}
export function XIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
export function ChevronDownIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M6 9l6 6 6-6" /></svg>;
}
export function MapPinIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
export function EyeIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}
export function EyeOffIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...ICON_BASE}><path d="M9.9 4.24A9.1 9.1 0 0112 4c6.5 0 10 7 10 7a13 13 0 01-2.16 2.92M6.6 6.6A13 13 0 002 11s3.5 7 10 7a9 9 0 004-.94M3 3l18 18M9.9 9.9a3 3 0 004.2 4.2" /></svg>;
}
