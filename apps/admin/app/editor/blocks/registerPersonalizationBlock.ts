/*
 * Registers the "personalization" GrapesJS editor block — a heading over three
 * placeholder cards (Recent Searches / Recommended Jobs / Trending Searches).
 *
 * WHY: reserves a section where the public site shows per-visitor personalized
 * content. That content is computed at request time from visitor signals, so it
 * cannot exist in the editor — the cards are static "[ Personalized at runtime ]"
 * stand-ins for layout only.
 *
 * HOW: buildComponents seeds from getDefaultProps("personalization") (schema in
 * lib/blockSchemas.ts) and registers via the shared registerBlock helper. Only
 * the title carries a data-field for RTE->props sync; the card bodies are fixed
 * placeholders. The real personalization is rendered by apps/web/lib/renderer.tsx,
 * which must stay in sync with this block's type+props contract.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
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
  ];
}

export const registerPersonalizationBlock = (editor: any) => {
  const d = getDefaultProps("personalization");

  registerBlock(editor, {
    type: "personalization",
    style: { padding: "3rem 2rem", "background-color": "#fefce8" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
