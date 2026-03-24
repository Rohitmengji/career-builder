import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
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
