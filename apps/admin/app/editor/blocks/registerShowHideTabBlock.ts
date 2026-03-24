import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildTabItems(tabs: any[]) {
  return tabs.map((tab: any, idx: number) => ({
    tagName: "div" as const,
    style: {
      padding: "1.25rem",
      "background-color": idx === 0 ? "#fff" : "#f9fafb",
      "border-radius": "0.5rem",
      border: idx === 0 ? "2px solid #2563eb" : "1px solid #e5e7eb",
    },
    components: [
      {
        type: "text" as const,
        tagName: "h3" as const,
        attributes: { "data-field": `tab-${idx}-label` },
        content: String(tab.label || ""),
        editable: true,
        style: { "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
      },
      {
        type: "text" as const,
        tagName: "p" as const,
        attributes: { "data-field": `tab-${idx}-content` },
        content: String(tab.content || ""),
        editable: true,
        style: { color: "#6b7280", "font-size": "0.875rem", "line-height": "1.6" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const tabs = Array.isArray(props.tabs) ? props.tabs : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "1.5rem", "text-align": "center", color: "#111827" },
    },
    {
      tagName: "div",
      style: { display: "flex", "flex-direction": "column", gap: "0.75rem", "max-width": "40rem", "margin-left": "auto", "margin-right": "auto" },
      components: buildTabItems(tabs),
    },
  ];
}

export const registerShowHideTabBlock = (editor: any) => {
  const d = getDefaultProps("show-hide-tab");

  registerBlock(editor, {
    type: "show-hide-tab",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
