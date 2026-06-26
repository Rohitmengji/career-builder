/*
 * Registers the "join-talent-network" GrapesJS editor block — a centered
 * title/subtitle + email-capture form to sign candidates up for a talent pool.
 *
 * WHY: lets recruiters add a "stay in touch / join our talent network" CTA to a
 * career page without code.
 *
 * HOW: standard block pattern (see registerBlock.ts). buildComponents maps props to
 * the canvas tree; rebuildComponents drives live preview. Editable text (title,
 * subtitle, buttonText) carries a `data-field` so inline RTE edits sync back to props.
 * The email input shown here is a STATIC canvas placeholder; the working submit
 * (which writes the candidate by lowercased email + tenantId, per ADR-0001) is the
 * web renderer's responsibility. GOTCHA: keep in sync with apps/web/lib/renderer.tsx.
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
      style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "0.5rem" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
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
          content: String(props.buttonText || ""),
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
  ];
}

export const registerJoinTalentNetworkBlock = (editor: any) => {
  const d = getDefaultProps("join-talent-network");

  registerBlock(editor, {
    type: "join-talent-network",
    style: { padding: "3rem 2rem", "text-align": "center", "background-color": "#f0f9ff" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
