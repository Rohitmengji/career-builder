/*
 * Registers the "job-alert" GrapesJS editor block — a centered title/subtitle +
 * a "create a job alert" CTA, on an amber background.
 *
 * WHY: lets recruiters add a "get notified about new openings" sign-up section to a
 * career page without code.
 *
 * HOW: standard block pattern (see registerBlock.ts). buildComponents maps props to
 * the canvas tree; rebuildComponents drives live preview. Editable text (title,
 * subtitle, buttonText) carries a `data-field` so inline RTE edits sync back to props.
 * The CTA here is a static canvas preview; the working alert sign-up is the web
 * renderer's job. GOTCHA: keep in sync with apps/web/lib/renderer.tsx.
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
      style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "0.5rem" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { color: "#555", "margin-bottom": "1.5rem" },
    },
    {
      type: "text",
      tagName: "div",
      attributes: { "data-field": "buttonText" },
      content: String(props.buttonText || ""),
      editable: true,
      style: {
        display: "inline-block",
        padding: "0.75rem 2rem",
        "background-color": "#d97706",
        color: "#fff",
        "border-radius": "0.375rem",
        "font-weight": "600",
        cursor: "pointer",
      },
    },
  ];
}

export const registerJobAlertBlock = (editor: any) => {
  const d = getDefaultProps("job-alert");

  registerBlock(editor, {
    type: "job-alert",
    style: { padding: "3rem 2rem", "text-align": "center", "background-color": "#fef3c7" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
