import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const COLOR_HEX: Record<string, string> = {
  blue: "#2563eb", green: "#16a34a", red: "#dc2626", orange: "#ea580c",
  purple: "#9333ea", indigo: "#4f46e5", teal: "#0d9488", yellow: "#ca8a04",
  gray: "#6b7280", white: "#ffffff",
};

function getButtonStyle(color: string, variant: string) {
  const hex = COLOR_HEX[color] || COLOR_HEX.blue;
  const base: Record<string, string> = {
    display: "inline-block",
    padding: "0.75rem 2rem",
    "border-radius": "0.5rem",
    "text-decoration": "none",
    "font-weight": "600",
    "font-size": "1rem",
    cursor: "pointer",
  };
  if (variant === "outline") {
    return { ...base, "background-color": "transparent", color: hex, border: `2px solid ${hex}` };
  }
  if (variant === "ghost") {
    return { ...base, "background-color": "transparent", color: hex, border: "none" };
  }
  return { ...base, "background-color": hex, color: "#fff", border: "none" };
}

function buildComponents(props: any) {
  return [
    {
      type: "text" as const,
      tagName: "a" as const,
      attributes: { "data-field": "text", href: String(props.link || "#") },
      content: String(props.text || "Click Me"),
      editable: true,
      style: getButtonStyle(props.color || "blue", props.variant || "solid"),
    },
  ];
}

export const registerBasicButtonBlock = (editor: any) => {
  const d = getDefaultProps("basic-button");

  registerBlock(editor, {
    type: "basic-button",
    style: {
      padding: "1rem 1.5rem",
      "text-align": "center",
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
