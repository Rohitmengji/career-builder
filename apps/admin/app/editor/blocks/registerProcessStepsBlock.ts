import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

// Approximate hex for each accent color name, so the canvas preview reflects the
// chosen color. The published page applies the exact tenant accent via getAccent().
const COLOR_HEX: Record<string, string> = {
  blue: "#2563eb",
  teal: "#0d9488",
  green: "#16a34a",
  red: "#dc2626",
  pink: "#db2777",
  purple: "#7c3aed",
  orange: "#ea580c",
  yellow: "#ca8a04",
  gray: "#4b5563",
  white: "#111827",
};

function buildSteps(steps: any[], color: string) {
  const hex = COLOR_HEX[color] || COLOR_HEX.blue;
  return steps.map((step: any, idx: number) => ({
    tagName: "div" as const,
    style: { flex: "1", "min-width": "200px", "text-align": "center" },
    components: [
      {
        tagName: "div" as const,
        content: String(idx + 1),
        style: {
          width: "2.5rem",
          height: "2.5rem",
          "border-radius": "9999px",
          "background-color": hex,
          color: "#ffffff",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "font-weight": "700",
          margin: "0 auto 0.75rem",
        },
      },
      {
        type: "text" as const,
        tagName: "h3" as const,
        attributes: { "data-field": `item-${idx}-title` },
        content: String(step.title || ""),
        editable: true,
        style: { "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
      },
      {
        type: "text" as const,
        tagName: "p" as const,
        attributes: { "data-field": `item-${idx}-desc` },
        content: String(step.desc || ""),
        editable: true,
        style: { "font-size": "0.875rem", color: "#6b7280", "line-height": "1.6" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const steps = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.75rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem", color: "#111827" },
    },
    {
      type: "text", tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1rem", color: "#6b7280", "text-align": "center", "margin-bottom": "2rem" },
    },
    {
      tagName: "div",
      style: { display: "flex", gap: "1.5rem", "flex-wrap": "wrap", "justify-content": "center" },
      components: buildSteps(steps, String(props.color || "blue")),
    },
  ];
}

export const registerProcessStepsBlock = (editor: any) => {
  const d = getDefaultProps("process-steps");

  registerBlock(editor, {
    type: "process-steps",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
