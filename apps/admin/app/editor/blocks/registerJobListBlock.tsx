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
