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
