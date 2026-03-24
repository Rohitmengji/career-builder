import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerCtaButtonBlock = (editor: any) => {
  const d = getDefaultProps("cta-button");

  registerBlock(editor, {
    type: "cta-button",
    style: { padding: "4rem 2rem", "text-align": "center", "background-color": "#eff6ff" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "0.5rem", color: "#111827" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "subtitle" },
        content: String(d.subtitle || ""),
        editable: true,
        style: { color: "#6b7280", "margin-bottom": "1.5rem" },
      },
      {
        type: "text",
        tagName: "a",
        attributes: { "data-field": "buttonText", href: String(d.buttonLink || "#") },
        content: String(d.buttonText || ""),
        editable: true,
        style: {
          display: "inline-block",
          padding: "0.75rem 2rem",
          "background-color": "#2563eb",
          color: "#fff",
          "border-radius": "0.375rem",
          "text-decoration": "none",
          "font-weight": "600",
        },
      },
    ],
  });
};
