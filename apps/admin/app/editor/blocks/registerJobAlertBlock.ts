import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerJobAlertBlock = (editor: any) => {
  const d = getDefaultProps("job-alert");

  registerBlock(editor, {
    type: "job-alert",
    style: { padding: "3rem 2rem", "text-align": "center", "background-color": "#fef3c7" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "0.5rem" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "subtitle" },
        content: String(d.subtitle || ""),
        editable: true,
        style: { color: "#555", "margin-bottom": "1.5rem" },
      },
      {
        type: "text",
        tagName: "div",
        attributes: { "data-field": "buttonText" },
        content: String(d.buttonText || ""),
        editable: true,
        style: {
          display: "inline-block",
          padding: "0.75rem 2rem",
          "background-color": "#d97706",
          color: "#fff",
          "border-radius": "0.375rem",
          "font-weight": "600",
          cursor: "pointer",
        },
      },
    ],
  });
};
