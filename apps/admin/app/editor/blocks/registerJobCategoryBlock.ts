/*
 * Registers the "job-category" GrapesJS editor block — a centred heading +
 * subtitle over a responsive flex-wrap row of category tiles, each showing a
 * category name and an open-role count.
 *
 * WHY: gives recruiters a drag-drop "browse by category" section for the
 * career site. One register*Block file per block type.
 *
 * HOW: builds the canvas tree from the block's default props
 * (getDefaultProps("job-category"), backed by lib/blockSchemas.ts) and hands
 * it to the shared registerBlock helper, which wires up the palette entry,
 * live prop->canvas rebuild (rebuildComponents), and inline-RTE->props sync.
 * Heading/subtitle carry data-field attributes so RTE edits route back to
 * props; the tiles render from props.categories. GOTCHA: this is a STATIC
 * editor preview — the tile name/count are author-typed copy and the hardcoded
 * fallback list is placeholder only; live open-role counts are resolved by the
 * public site, which re-renders the same type+props in apps/web/lib/renderer.tsx,
 * so keep markup/fields in sync there.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildCategoryTiles(items: any[]) {
  return items.map((item: any) => ({
    tagName: "div" as const,
    style: {
      flex: "1",
      "min-width": "140px",
      padding: "1.5rem",
      "background-color": "#fff",
      "border-radius": "0.5rem",
      "box-shadow": "0 1px 3px rgba(0,0,0,0.1)",
      "text-align": "center",
    },
    components: [
      { tagName: "h3" as const, content: String(item.name || ""), style: { "font-weight": "600", "margin-bottom": "0.25rem" } },
      { tagName: "span" as const, content: `${item.count || "0"} open roles`, style: { "font-size": "0.875rem", color: "#666" } },
    ],
  }));
}

function buildComponents(props: any) {
  // Fall back to a sample category list when none are configured, so a freshly
  // dragged block isn't empty in the editor.
  const items = Array.isArray(props.categories)
    ? props.categories
    : [
        { name: "Engineering", count: "12" },
        { name: "Design", count: "5" },
        { name: "Marketing", count: "8" },
        { name: "Sales", count: "6" },
      ];
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "text-align": "center", color: "#666", "margin-bottom": "2rem" },
    },
    {
      tagName: "div",
      style: { display: "flex", gap: "1rem", "flex-wrap": "wrap", "justify-content": "center" },
      components: buildCategoryTiles(items),
    },
  ];
}

export const registerJobCategoryBlock = (editor: any) => {
  const d = getDefaultProps("job-category");

  registerBlock(editor, {
    type: "job-category",
    style: { padding: "3rem 2rem", "background-color": "#f9fafb" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
