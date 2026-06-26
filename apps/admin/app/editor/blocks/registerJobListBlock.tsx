/*
 * Registers the "search-results" GrapesJS editor block (the job-listings list).
 *
 * WHY: lets recruiters place a job-listings section on a page. The actual jobs
 * are tenant-scoped data fetched at request time, so they cannot be shown in the
 * editor — only a heading/subtitle and a non-droppable placeholder are rendered.
 *
 * HOW: builds the canvas tree from getDefaultProps("search-results") (schema in
 * lib/blockSchemas.ts) and delegates wiring to the shared registerBlock helper.
 * The "[ Job listings render here at runtime ]" box is purely a design-time
 * stand-in: the public site (apps/web/lib/renderer.tsx) replaces this block with
 * real, tenant-scoped listings. Keep the type/props contract in sync with that
 * renderer. NOTE: the placeholder is droppable:false so editors can't nest
 * content inside the runtime-managed region.
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
      style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "0.25rem" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { color: "#666", "margin-bottom": "1.5rem" },
    },
    {
      tagName: "div",
      attributes: { "data-field": "placeholder" },
      droppable: false,
      style: {
        padding: "1rem",
        border: "1px dashed #ccc",
        "border-radius": "0.375rem",
        color: "#999",
        "text-align": "center",
      },
      components: [{ tagName: "span", content: "[ Job listings render here at runtime ]" }],
    },
  ];
}

export const registerJobListBlock = (editor: any) => {
  const d = getDefaultProps("search-results");

  registerBlock(editor, {
    type: "search-results",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
