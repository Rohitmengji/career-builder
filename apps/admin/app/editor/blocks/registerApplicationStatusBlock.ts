import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  const steps = Array.isArray(props.steps) ? props.steps : [];
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "2rem", "font-weight": "700", "margin-bottom": "0.5rem", color: "#111827", "text-align": "center" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1rem", color: "#6b7280", "margin-bottom": "2rem", "text-align": "center" },
    },
    {
      tagName: "div",
      style: { display: "flex", gap: "1rem", "align-items": "center", "justify-content": "center", "margin-bottom": "2rem" },
      components: [
        {
          tagName: "input",
          attributes: { type: "email", placeholder: "Enter your email" },
          style: { flex: "1", "max-width": "20rem", padding: "0.75rem 1rem", "border-radius": "0.5rem", border: "1px solid #d1d5db", "font-size": "0.875rem" },
        },
        {
          tagName: "button",
          content: "Check Status",
          style: { padding: "0.75rem 1.5rem", "border-radius": "0.5rem", "background-color": "#2563eb", color: "#fff", "font-weight": "600", "font-size": "0.875rem", border: "none" },
        },
      ],
    },
    ...(steps.length > 0 ? [{
      tagName: "div" as const,
      style: { display: "flex", gap: "0.5rem", "align-items": "center", "justify-content": "center" },
      components: steps.map((step: any, i: number) => ({
        tagName: "div" as const,
        style: { display: "flex", "align-items": "center", gap: "0.5rem" },
        components: [
          {
            tagName: "div" as const,
            style: {
              width: "2rem", height: "2rem", "border-radius": "50%", display: "flex",
              "align-items": "center", "justify-content": "center", "font-size": "0.75rem", "font-weight": "600",
              "background-color": i === 0 ? "#2563eb" : "#f3f4f6", color: i === 0 ? "#ffffff" : "#6b7280",
            },
            content: String(i + 1),
          },
          { tagName: "span" as const, content: String(step.label || `Step ${i + 1}`), style: { "font-size": "0.875rem", color: "#374151" } },
          ...(i < steps.length - 1 ? [{
            tagName: "div" as const,
            style: { width: "2rem", height: "2px", "background-color": "#e5e7eb" },
          }] : []),
        ],
      })),
    }] : []),
  ];
}

export const registerApplicationStatusBlock = (editor: any) => {
  const d = getDefaultProps("application-status");

  registerBlock(editor, {
    type: "application-status",
    style: { padding: "4rem 1.5rem", "background-color": "#f9fafb", "text-align": "center" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
