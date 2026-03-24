import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerJoinTalentNetworkBlock = (editor: any) => {
  const d = getDefaultProps("join-talent-network");

  registerBlock(editor, {
    type: "join-talent-network",
    style: { padding: "3rem 2rem", "text-align": "center", "background-color": "#f0f9ff" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "0.5rem" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "subtitle" },
        content: String(d.subtitle || ""),
        editable: true,
        style: { color: "#555", "margin-bottom": "1.5rem", "max-width": "500px", margin: "0 auto 1.5rem auto" },
      },
      {
        tagName: "div",
        style: { "max-width": "400px", margin: "0 auto" },
        components: [
          {
            tagName: "div",
            style: { padding: "0.75rem 1rem", border: "1px solid #d1d5db", "border-radius": "0.375rem", "background-color": "#fff", "margin-bottom": "0.75rem", color: "#999" },
            components: [{ tagName: "span", content: "Enter your email" }],
          },
          {
            type: "text",
            tagName: "div",
            attributes: { "data-field": "buttonText" },
            content: String(d.buttonText || ""),
            editable: true,
            style: {
              padding: "0.75rem",
              "background-color": "#2563eb",
              color: "#fff",
              "border-radius": "0.375rem",
              "font-weight": "600",
              "text-align": "center",
              cursor: "pointer",
            },
          },
        ],
      },
    ],
  });
};
