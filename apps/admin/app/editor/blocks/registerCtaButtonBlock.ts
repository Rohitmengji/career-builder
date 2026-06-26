/*
 * Registers the "cta-button" GrapesJS editor block — a centered
 * title/subtitle + a single call-to-action link button.
 *
 * WHY: the generic "drive the visitor somewhere" section (apply now, view openings,
 * contact us), droppable anywhere on a career page.
 *
 * HOW: standard block pattern (see registerBlock.ts). buildComponents maps props to
 * the canvas tree; rebuildComponents drives live preview. Editable text (title,
 * subtitle, buttonText) carries a `data-field` so inline RTE edits sync back to props.
 * The button is an <a> whose href comes from props.buttonLink (defaults to "#").
 * GOTCHA: keep in sync with apps/web/lib/renderer.tsx.
 */

import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "0.5rem", color: "#111827" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { color: "#6b7280", "margin-bottom": "1.5rem" },
    },
    {
      type: "text",
      tagName: "a",
      attributes: { "data-field": "buttonText", href: String(props.buttonLink || "#") },
      content: String(props.buttonText || ""),
      editable: true,
      style: {
        display: "inline-block",
        padding: "0.75rem 2rem",
        "background-color": "#2563eb",
        color: "#fff",
        "border-radius": "0.375rem",
        "text-decoration": "none",
        "font-weight": "600",
      },
    },
  ];
}

export const registerCtaButtonBlock = (editor: any) => {
  const d = getDefaultProps("cta-button");

  registerBlock(editor, {
    type: "cta-button",
    style: { padding: "4rem 2rem", "text-align": "center", "background-color": "#eff6ff" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
