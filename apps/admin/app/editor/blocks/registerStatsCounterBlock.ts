/*
 * Registers the "stats-counter" GrapesJS editor block — a dark section showing a
 * heading/subtitle above a row of big value+label metric cells.
 *
 * WHY: a quick "by the numbers" credibility section (e.g. headcount, offices) for
 * career sites, editable without code.
 *
 * HOW: buildComponents seeds from getDefaultProps("stats-counter") (schema in
 * lib/blockSchemas.ts) and is registered via the shared registerBlock helper;
 * rebuildComponents repaints on prop change. The title/subtitle carry data-field
 * attrs for RTE->props sync; the metric values/labels are display-only here.
 * GOTCHA: the grid is capped at 4 columns (Math.min(items.length || 4, 4)) so
 * adding many stats won't blow out the layout. Mirror markup/fields in
 * apps/web/lib/renderer.tsx — the public site re-renders the same type+props.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  // GrapesJS may pass props with no items array (freshly dragged) — default to []
  const items = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "2rem", "font-weight": "700", "margin-bottom": "0.5rem", color: "#ffffff", "text-align": "center" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1rem", color: "#9ca3af", "margin-bottom": "2.5rem", "text-align": "center" },
    },
    {
      tagName: "div",
      style: { display: "grid", "grid-template-columns": `repeat(${Math.min(items.length || 4, 4)}, 1fr)`, gap: "2rem", "text-align": "center" },
      components: items.map((item: any) => ({
        tagName: "div",
        components: [
          { type: "text", tagName: "span", content: String(item.value || "0"), style: { "font-size": "2.5rem", "font-weight": "700", display: "block", color: "#ffffff" } },
          { type: "text", tagName: "span", content: String(item.label || "Metric"), style: { "font-size": "0.875rem", color: "#9ca3af", display: "block", "margin-top": "0.5rem" } },
        ],
      })),
    },
  ];
}

export const registerStatsCounterBlock = (editor: any) => {
  const d = getDefaultProps("stats-counter");

  registerBlock(editor, {
    type: "stats-counter",
    style: {
      padding: "4rem 1.5rem",
      "background-color": "#030712",
      color: "#ffffff",
      "text-align": "center",
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
