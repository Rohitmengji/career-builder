/*
 * Registers the "navigate-back" GrapesJS editor block — a single styled
 * "back" link (e.g. "← Back to all jobs").
 *
 * WHY: gives a one-click way to drop a contextual back-link onto a career page,
 * typically above job detail content.
 *
 * HOW: standard block pattern (see registerBlock.ts). The label is editable via the
 * `data-field="label"` attribute (inline RTE edits sync back to props); the link
 * target comes from props.link, defaulting to "/jobs". rebuildComponents drives live
 * preview. GOTCHA: keep in sync with apps/web/lib/renderer.tsx.
 */

import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "a",
      attributes: { "data-field": "label", href: String(props.link || "/jobs") },
      content: String(props.label || ""),
      editable: true,
      style: {
        color: "#2563eb",
        "text-decoration": "none",
        "font-weight": "500",
        "font-size": "0.875rem",
      },
    },
  ];
}

export const registerNavigateBackBlock = (editor: any) => {
  const d = getDefaultProps("navigate-back");

  registerBlock(editor, {
    type: "navigate-back",
    style: { padding: "1rem 2rem" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
