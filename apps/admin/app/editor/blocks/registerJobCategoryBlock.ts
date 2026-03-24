import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerJobCategoryBlock = (editor: any) => {
  const d = getDefaultProps("job-category");

  const categoryTile = (name: string, count: string) => ({
    tagName: "div" as const,
    style: {
      flex: "1",
      "min-width": "140px",
      padding: "1.5rem",
      "background-color": "#fff",
      "border-radius": "0.5rem",
      "box-shadow": "0 1px 3px rgba(0,0,0,0.1)",
      "text-align": "center",
    },
    components: [
      { tagName: "h3" as const, content: name, style: { "font-weight": "600", "margin-bottom": "0.25rem" } },
      { tagName: "span" as const, content: `${count} open roles`, style: { "font-size": "0.875rem", color: "#666" } },
    ],
  });

  registerBlock(editor, {
    type: "job-category",
    style: { padding: "3rem 2rem", "background-color": "#f9fafb" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "subtitle" },
        content: String(d.subtitle || ""),
        editable: true,
        style: { "text-align": "center", color: "#666", "margin-bottom": "2rem" },
      },
      {
        tagName: "div",
        style: { display: "flex", gap: "1rem", "flex-wrap": "wrap", "justify-content": "center" },
        components: [
          categoryTile("Engineering", "12"),
          categoryTile("Design", "5"),
          categoryTile("Marketing", "8"),
          categoryTile("Sales", "6"),
        ],
      },
    ],
  });
};
