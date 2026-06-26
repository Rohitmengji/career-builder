/*
 * Registers the "testimonial" GrapesJS editor block (quote + author + role).
 *
 * WHY: a drag-drop block for recruiter pages to show a single customer/candidate
 * quote, editable inline on the canvas and from the props sidebar.
 *
 * HOW: buildComponents() turns props (quote/author/role from
 * getDefaultProps("testimonial")) into the canvas tree; the shared registerBlock()
 * helper handles palette registration, live rebuild on prop change, and RTE sync.
 * Each text node carries a `data-field` so inline edits map back to the matching
 * prop key. The centred grey panel styling is applied as the root <section> style.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup/field shape so saved pages match the editor preview.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "blockquote",
      attributes: { "data-field": "quote" },
      content: String(props.quote || ""),
      editable: true,
      style: {
        "font-size": "1.25rem",
        "font-style": "italic",
        color: "#333",
        "max-width": "640px",
        margin: "0 auto 1.5rem auto",
        "line-height": "1.75",
      },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "author" },
      content: String(props.author || ""),
      editable: true,
      style: { "font-weight": "700", "margin-bottom": "0.25rem" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "role" },
      content: String(props.role || ""),
      editable: true,
      style: { color: "#666", "font-size": "0.875rem" },
    },
  ];
}

export const registerTestimonialBlock = (editor: any) => {
  const d = getDefaultProps("testimonial");

  registerBlock(editor, {
    type: "testimonial",
    style: { padding: "3rem 2rem", "background-color": "#f3f4f6", "text-align": "center" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
