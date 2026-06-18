/*
 * Local SVG icon set for the admin ATS pages (jobs + applications).
 * The shared UI barrel only ships a handful of icons; these cover the
 * action/status glyphs the ATS screens need. All are decorative by
 * default (aria-hidden) — give the surrounding control an aria-label.
 */
import * as React from "react";

type IconProps = { className?: string };

const BASE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M12 5v14M5 12h14" /></svg>;
}
export function PencilIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}
export function TrashIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg>;
}
export function ExternalLinkIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>;
}
export function BriefcaseIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>;
}
export function UsersIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
export function DocumentIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>;
}
export function LinkedInIcon({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} {...BASE}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>;
}
export function StarIcon({ className = "h-5 w-5", filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} {...BASE} fill={filled ? "currentColor" : "none"}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
