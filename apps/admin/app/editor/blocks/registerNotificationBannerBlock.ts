/*
 * Registers the "notification-banner" GrapesJS editor block — a full-width
 * single-line banner (info / success / warning / error variant) with optional
 * inline link.
 *
 * WHY: lets recruiters post a site-wide notice (e.g. "We're hiring!", "Applications
 * close Friday") on a career page without code.
 *
 * HOW: standard block pattern (see registerBlock.ts). buildComponents builds the
 * editable text (`data-field="text"`); when props.linkText is set it appends a raw
 * <a> built into the content string (so the link rides along inside one RTE-editable
 * text node rather than as a separate component).
 *
 * GOTCHA — unlike the other blocks, the root background/border comes from VARIANT_STYLES
 * keyed by props.variant, NOT from rebuildComponents (which only rebuilds children).
 * So this file adds its OWN extra listener (rebuildVariant) on component:update /
 * component:update:props to re-apply the variant style on the root model when the
 * variant prop changes. Keep VARIANT_STYLES and link markup in sync with apps/web/lib/renderer.tsx.
 */

import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const VARIANT_STYLES: Record<string, Record<string, string>> = {
  info: { "background-color": "#eff6ff", color: "#1e40af", "border-bottom": "1px solid #bfdbfe" },
  success: { "background-color": "#f0fdf4", color: "#166534", "border-bottom": "1px solid #bbf7d0" },
  warning: { "background-color": "#fffbeb", color: "#92400e", "border-bottom": "1px solid #fde68a" },
  error: { "background-color": "#fef2f2", color: "#991b1b", "border-bottom": "1px solid #fecaca" },
};

function buildComponents(props: any) {
  const text = String(props.text || "");
  const linkText = String(props.linkText || "");
  const linkUrl = String(props.linkUrl || "#");
  // Embed the optional link as raw HTML inside the single text node so the whole
  // banner stays one RTE-editable component (rather than a text node + separate link).
  const content = linkText
    ? `${text} <a href="${linkUrl}" style="margin-left:0.5rem;text-decoration:underline;font-weight:600;">${linkText}</a>`
    : text;

  return [
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "text" },
      content,
      editable: true,
      style: { "font-size": "0.875rem", "font-weight": "500" },
    },
  ];
}

export const registerNotificationBannerBlock = (editor: any) => {
  const d = getDefaultProps("notification-banner");
  const variantStyle = VARIANT_STYLES[d.variant] || VARIANT_STYLES.info;

  registerBlock(editor, {
    type: "notification-banner",
    style: { padding: "0.75rem 1.5rem", ...variantStyle },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live-rebuild: apply variant background when props change */
  const rebuildVariant = (model: any) => {
    if (model.get("type") !== "notification-banner") return;
    const props = model.get("props") || {};
    const vs = VARIANT_STYLES[props.variant] || VARIANT_STYLES.info;
    model.setStyle({ ...model.getStyle(), ...vs });
  };
  editor.on("component:update", rebuildVariant);
  editor.on("component:update:props", rebuildVariant);
};
