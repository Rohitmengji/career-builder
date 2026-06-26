/*
 * Registers the "search-bar" GrapesJS editor block — a centred heading over a
 * job-search input (placeholder text) sitting beside a "Search" button.
 *
 * WHY: gives recruiters a drag-drop search section for the career site. One
 * register*Block file per block type.
 *
 * HOW: builds the canvas tree from the block's default props
 * (getDefaultProps("search-bar"), backed by lib/blockSchemas.ts) and hands it
 * to the shared registerBlock helper, which wires up the palette entry, live
 * prop->canvas rebuild (rebuildComponents), and inline-RTE->props sync. The
 * editable title and the placeholder text carry data-field attributes so RTE
 * edits route back to props. GOTCHA: this is a non-functional EDITOR PREVIEW
 * only — the "input" is a styled <div> and the button does nothing here; real
 * search behavior lives on the public site, which re-renders the same
 * type+props in apps/web/lib/renderer.tsx, so keep markup/fields in sync there.
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
      style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "1rem", "text-align": "center" },
    },
    {
      tagName: "div",
      style: {
        display: "flex",
        "flex-wrap": "wrap",
        gap: "0.5rem",
        "max-width": "600px",
        margin: "0 auto",
      },
      components: [
        {
          tagName: "div",
          style: {
            flex: "1",
            "min-width": "200px",
            padding: "0.75rem 1rem",
            border: "1px solid #d1d5db",
            "border-radius": "0.5rem",
            "background-color": "#fff",
            color: "#999",
            "font-size": "0.875rem",
          },
          components: [{ tagName: "span", attributes: { "data-field": "placeholder" }, content: String(props.placeholder || "") }],
        },
        {
          tagName: "div",
          style: {
            padding: "0.75rem 1.5rem",
            "background-color": "#2563eb",
            color: "#fff",
            "border-radius": "0.5rem",
            "font-weight": "600",
            "text-align": "center",
            "min-width": "100px",
            "font-size": "0.875rem",
          },
          components: [{ tagName: "span", content: "Search" }],
        },
      ],
    },
  ];
}

export const registerSearchBarBlock = (editor: any) => {
  const d = getDefaultProps("search-bar");

  registerBlock(editor, {
    type: "search-bar",
    style: { padding: "2rem", "background-color": "#f9fafb" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
