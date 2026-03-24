import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerSearchBarBlock = (editor: any) => {
  const d = getDefaultProps("search-bar");

  registerBlock(editor, {
    type: "search-bar",
    style: { padding: "2rem", "background-color": "#f9fafb" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "1rem", "text-align": "center" },
      },
      {
        tagName: "div",
        style: {
          display: "flex",
          "flex-wrap": "wrap",
          gap: "0.5rem",
          "max-width": "600px",
          margin: "0 auto",
        },
        components: [
          {
            tagName: "div",
            style: {
              flex: "1",
              "min-width": "200px",
              padding: "0.75rem 1rem",
              border: "1px solid #d1d5db",
              "border-radius": "0.5rem",
              "background-color": "#fff",
              color: "#999",
              "font-size": "0.875rem",
            },
            components: [{ tagName: "span", content: String(d.placeholder || "") }],
          },
          {
            tagName: "div",
            style: {
              padding: "0.75rem 1.5rem",
              "background-color": "#2563eb",
              color: "#fff",
              "border-radius": "0.5rem",
              "font-weight": "600",
              "text-align": "center",
              "min-width": "100px",
              "font-size": "0.875rem",
            },
            components: [{ tagName: "span", content: "Search" }],
          },
        ],
      },
    ],
  });
};
