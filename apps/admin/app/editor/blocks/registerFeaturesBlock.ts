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
