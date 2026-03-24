import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerPersonalizationBlock = (editor: any) => {
  const d = getDefaultProps("personalization");

  registerBlock(editor, {
    type: "personalization",
    style: { padding: "3rem 2rem", "background-color": "#fefce8" },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "1.5rem" },
      },
      {
        tagName: "div",
        style: { display: "flex", gap: "1rem", "flex-wrap": "wrap" },
        components: [
          {
            tagName: "div",
            style: { flex: "1", "min-width": "200px", padding: "1rem", "background-color": "#fff", "border-radius": "0.5rem", "box-shadow": "0 1px 3px rgba(0,0,0,0.1)" },
            components: [
              { tagName: "h3", content: "Recent Searches", style: { "font-weight": "600", "margin-bottom": "0.5rem", "font-size": "0.875rem" } },
              { tagName: "p", content: "[ Personalized at runtime ]", style: { color: "#999", "font-size": "0.8rem" } },
            ],
          },
          {
            tagName: "div",
            style: { flex: "1", "min-width": "200px", padding: "1rem", "background-color": "#fff", "border-radius": "0.5rem", "box-shadow": "0 1px 3px rgba(0,0,0,0.1)" },
            components: [
              { tagName: "h3", content: "Recommended Jobs", style: { "font-weight": "600", "margin-bottom": "0.5rem", "font-size": "0.875rem" } },
              { tagName: "p", content: "[ Personalized at runtime ]", style: { color: "#999", "font-size": "0.8rem" } },
            ],
          },
          {
            tagName: "div",
            style: { flex: "1", "min-width": "200px", padding: "1rem", "background-color": "#fff", "border-radius": "0.5rem", "box-shadow": "0 1px 3px rgba(0,0,0,0.1)" },
            components: [
              { tagName: "h3", content: "Trending Searches", style: { "font-weight": "600", "margin-bottom": "0.5rem", "font-size": "0.875rem" } },
              { tagName: "p", content: "[ Personalized at runtime ]", style: { color: "#999", "font-size": "0.8rem" } },
            ],
          },
        ],
      },
    ],
  });
};
