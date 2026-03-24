import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildFooterLinks(links: any[]) {
  if (!links.length) {
    return [
      { tagName: "span" as const, content: "Privacy Policy" },
      { tagName: "span" as const, content: "Terms of Service" },
      { tagName: "span" as const, content: "Contact Us" },
    ];
  }
  return links.map((link: any) => ({
    tagName: "span" as const,
    style: { cursor: "pointer" },
    content: link.label || "Link",
  }));
}

function buildComponents(props: any) {
  const links = Array.isArray(props.links) ? props.links : [];
  return [
    {
      tagName: "div",
      style: {
        "max-width": "75rem",
        "margin-left": "auto",
        "margin-right": "auto",
        display: "flex",
        "flex-wrap": "wrap",
        "justify-content": "space-between",
        "align-items": "flex-start",
        gap: "2rem",
      },
      components: [
        {
          tagName: "div",
          style: { "min-width": "200px" },
          components: [
            {
              type: "text",
              tagName: "span",
              attributes: { "data-field": "companyName" },
              content: String(props.companyName || "Acme Inc."),
              editable: true,
              style: { "font-weight": "700", "font-size": "1rem", display: "block", "margin-bottom": "0.5rem" },
            },
            {
              type: "text",
              tagName: "p",
              attributes: { "data-field": "description" },
              content: String(props.description || "Building the future of work."),
              editable: true,
              style: { "font-size": "0.875rem", color: "#9ca3af", "line-height": "1.5" },
            },
          ],
        },
        {
          tagName: "div",
          style: { display: "flex", gap: "2rem", "font-size": "0.875rem", color: "#9ca3af" },
          components: buildFooterLinks(links),
        },
      ],
    },
    {
      tagName: "div",
      style: {
        "max-width": "75rem",
        "margin-left": "auto",
        "margin-right": "auto",
        "margin-top": "2rem",
        "padding-top": "1.5rem",
        "border-top": "1px solid #1f2937",
      },
      components: [
        {
          type: "text",
          tagName: "p",
          attributes: { "data-field": "copyright" },
          content: String(props.copyright || "© 2026 Acme Inc. All rights reserved."),
          editable: true,
          style: { "font-size": "0.75rem", color: "#6b7280", "text-align": "center" },
        },
      ],
    },
  ];
}

const FOOTER_VARIANTS: Record<string, Record<string, string>> = {
  dark: { "background-color": "#0a0a0a", color: "#fff" },
  light: { "background-color": "#f9fafb", color: "#111827" },
};

export const registerFooterBlock = (editor: any) => {
  const d = getDefaultProps("footer");
  const vs = FOOTER_VARIANTS[d.variant] || FOOTER_VARIANTS.dark;

  registerBlock(editor, {
    type: "footer",
    style: {
      padding: "3rem 1.5rem",
      "max-width": "100%",
      ...vs,
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live-rebuild: apply variant background when props change */
  const rebuildFooter = (model: any) => {
    if (model.get("type") !== "footer") return;
    const props = model.get("props") || {};
    const fv = FOOTER_VARIANTS[props.variant] || FOOTER_VARIANTS.dark;
    model.setStyle({ ...model.getStyle(), ...fv });
  };
  editor.on("component:update", rebuildFooter);
  editor.on("component:update:props", rebuildFooter);
};
