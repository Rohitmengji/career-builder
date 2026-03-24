import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "a",
      attributes: { "data-field": "label", href: String(props.link || "/jobs") },
      content: String(props.label || ""),
      editable: true,
      style: {
        color: "#2563eb",
        "text-decoration": "none",
        "font-weight": "500",
        "font-size": "0.875rem",
      },
    },
  ];
}

export const registerNavigateBackBlock = (editor: any) => {
  const d = getDefaultProps("navigate-back");

  registerBlock(editor, {
    type: "navigate-back",
    style: { padding: "1rem 2rem" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
