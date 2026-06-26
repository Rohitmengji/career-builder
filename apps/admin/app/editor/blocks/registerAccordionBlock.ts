/*
 * Registers the "accordion" GrapesJS editor block (FAQ-style collapse list).
 *
 * WHY: gives recruiters a drag-drop FAQ block in the GrapesJS page editor whose
 * questions/answers are editable inline on the canvas and via the props sidebar.
 *
 * HOW: builds the canvas component tree from props and hands it to the shared
 * registerBlock() helper, which wires up the palette entry, the live-rebuild on
 * prop changes, and the inline-RTE -> props sync. Props come from
 * getDefaultProps("accordion") (see lib/blockSchemas).
 *   - Uses native <details>/<summary> for collapse behaviour (no JS).
 *   - Each editable node carries a `data-field` attribute; list items use the
 *     `item-<idx>-<key>` convention that registerBlock routes back into
 *     props.items[idx][key] on RTE edits.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup/field shape, or saved pages render differently than the editor preview.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildAccordionItems(items: any[]) {
  return items.map((item: any, idx: number) => ({
    tagName: "details" as const,
    style: {
      border: "1px solid #e5e7eb",
      "border-radius": "0.5rem",
      padding: "1rem",
    },
    components: [
      {
        type: "text" as const,
        tagName: "summary" as const,
        attributes: { "data-field": `item-${idx}-question` },
        content: String(item.question || ""),
        editable: true,
        style: { "font-weight": "600", cursor: "pointer", "font-size": "0.9375rem" },
      },
      {
        type: "text" as const,
        tagName: "p" as const,
        attributes: { "data-field": `item-${idx}-answer` },
        content: String(item.answer || ""),
        editable: true,
        style: { "margin-top": "0.75rem", color: "#555", "line-height": "1.6", "font-size": "0.875rem" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const items = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "1.5rem", "text-align": "center" },
    },
    {
      tagName: "div",
      style: { display: "flex", "flex-direction": "column", gap: "0.75rem", "max-width": "48rem", "margin-left": "auto", "margin-right": "auto" },
      components: buildAccordionItems(items),
    },
  ];
}

export const registerAccordionBlock = (editor: any) => {
  const d = getDefaultProps("accordion");

  registerBlock(editor, {
    type: "accordion",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
