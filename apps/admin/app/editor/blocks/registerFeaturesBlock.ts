/*
 * Registers the "features" GrapesJS editor block — a centred heading/subtitle
 * over a responsive flex-wrap row of feature cards (icon + title + desc).
 *
 * WHY: gives recruiters a drag-drop "feature grid" section for the career site
 * without touching code. One register*Block file per block type.
 *
 * HOW: builds the canvas component tree from the block's default props
 * (getDefaultProps("features"), backed by lib/blockSchemas.ts) and hands it to
 * the shared registerBlock helper, which wires up the palette entry, live
 * prop->canvas rebuild, and inline-RTE->props sync. `rebuildComponents` lets
 * GrapesJS re-render the whole tree when sidebar props change. Editable text
 * nodes carry data-field attributes so RTE edits route back to props; list
 * items use the `item-<idx>-<key>` convention (see registerBlock) so edits land
 * in props.items[idx]. GOTCHA: this only defines the EDITOR preview — the public
 * site re-renders the same type+props in apps/web/lib/renderer.tsx, so any
 * markup/field change here must be mirrored there.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildFeatureCards(items: any[]) {
  return items.map((item: any, idx: number) => ({
    tagName: "div" as const,
    style: {
      flex: "1",
      "min-width": "220px",
      padding: "1.5rem",
      "background-color": "#fff",
      "border-radius": "0.75rem",
      "box-shadow": "0 1px 3px rgba(0,0,0,0.08)",
      "text-align": "center",
    },
    components: [
      {
        type: "text" as const,
        tagName: "span" as const,
        attributes: { "data-field": `item-${idx}-icon` },
        content: String(item.icon || ""),
        editable: true,
        style: { "font-size": "2rem", display: "block", "margin-bottom": "0.75rem" },
      },
      {
        type: "text" as const,
        tagName: "h3" as const,
        attributes: { "data-field": `item-${idx}-title` },
        content: String(item.title || ""),
        editable: true,
        style: { "font-size": "1.125rem", "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
      },
      {
        type: "text" as const,
        tagName: "p" as const,
        attributes: { "data-field": `item-${idx}-desc` },
        content: String(item.desc || ""),
        editable: true,
        style: { "font-size": "0.875rem", color: "#6b7280", "line-height": "1.5" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const items = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem", color: "#111827" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "text-align": "center", color: "#6b7280", "margin-bottom": "2.5rem" },
    },
    {
      tagName: "div",
      attributes: { "data-features-list": "true" },
      style: { display: "flex", gap: "1.5rem", "flex-wrap": "wrap", "justify-content": "center" },
      components: buildFeatureCards(items),
    },
  ];
}

export const registerFeaturesBlock = (editor: any) => {
  const d = getDefaultProps("features");

  registerBlock(editor, {
    type: "features",
    style: { padding: "3rem 1.5rem", "background-color": "#f9fafb" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
