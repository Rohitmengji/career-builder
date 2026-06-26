/*
 * Registers the "navbar" GrapesJS editor block: top site navigation bar.
 *
 * WHY: a drag-drop header (company name + nav links + optional CTA) for career
 * pages, configured from the props sidebar with inline-editable text.
 *
 * HOW: buildComponents() reads props from getDefaultProps("navbar") and emits the
 * canvas tree; the shared registerBlock() helper handles palette, live rebuild on
 * prop change, and inline-RTE -> props sync. Notable details:
 *   - `showCta` defaults to true: only an explicit `false` hides the CTA button
 *     (so undefined/legacy props still render it).
 *   - `variant` ("light"/"dark"/"transparent") selects a NAVBAR_VARIANTS bg/border
 *     palette applied to the root <section>, defaulting to light.
 *   - Variant styling lives on the root <section> (not the child tree), so this
 *     file adds its own component:update listeners (rebuildNavbar) to re-apply the
 *     bg/border live AND to re-tint the company-name child's text colour for the
 *     dark variant — registerBlock's rebuild alone wouldn't touch the root style.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup, the showCta default, and the variant palette/text colours.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildNavLinks(links: any[], ctaText: string, showCta: boolean) {
  const linkComps = links.map((link: any) => ({
    tagName: "span" as const,
    style: { color: "#6b7280", "font-size": "0.875rem", cursor: "pointer" },
    content: link.label || "Link",
  }));

  if (!showCta) return linkComps;

  return [
    ...linkComps,
    {
      type: "text" as const,
      tagName: "span" as const,
      attributes: { "data-field": "ctaText" },
      content: String(ctaText || "View Jobs"),
      editable: true,
      style: {
        "background-color": "#111827",
        color: "#fff",
        padding: "0.5rem 1rem",
        "border-radius": "0.5rem",
        "font-size": "0.8125rem",
        "font-weight": "600",
      },
    },
  ];
}

function buildComponents(props: any) {
  const links = Array.isArray(props.links) ? props.links : [];
  // Default-on: CTA is hidden only when showCta is explicitly false.
  const showCta = props.showCta !== false;
  return [
    {
      tagName: "div",
      style: {
        "max-width": "75rem",
        "margin-left": "auto",
        "margin-right": "auto",
        padding: "0 1.5rem",
        height: "4rem",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
      },
      components: [
        {
          type: "text",
          tagName: "span",
          attributes: { "data-field": "companyName" },
          content: String(props.companyName || "Acme Inc."),
          editable: true,
          style: { "font-weight": "600", "font-size": "1rem", color: "#111827" },
        },
        {
          tagName: "div",
          style: { display: "flex", "align-items": "center", gap: "1.5rem" },
          components: buildNavLinks(links, props.ctaText, showCta),
        },
      ],
    },
  ];
}

const NAVBAR_VARIANTS: Record<string, Record<string, string>> = {
  light: { "background-color": "#ffffff", "border-bottom": "1px solid #e5e7eb" },
  dark: { "background-color": "#111827", "border-bottom": "1px solid #1f2937" },
  transparent: { "background-color": "transparent", "border-bottom": "none" },
};

export const registerNavbarBlock = (editor: any) => {
  const d = getDefaultProps("navbar");
  const vs = NAVBAR_VARIANTS[d.variant] || NAVBAR_VARIANTS.light;

  registerBlock(editor, {
    type: "navbar",
    style: {
      padding: "0",
      "min-height": "4rem",
      "max-width": "100%",
      cursor: "default",
      ...vs,
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live-rebuild: apply variant style when props change */
  const rebuildNavbar = (model: any) => {
    if (model.get("type") !== "navbar") return;
    const props = model.get("props") || {};
    const nv = NAVBAR_VARIANTS[props.variant] || NAVBAR_VARIANTS.light;
    const textColor = props.variant === "dark" ? "#ffffff" : "#111827";
    model.setStyle({ ...model.getStyle(), ...nv });
    // Update text colors for dark/light variants
    const companyLabel = model.find?.("[data-field=companyName]")?.[0];
    if (companyLabel) {
      companyLabel.setStyle({ ...companyLabel.getStyle(), color: textColor });
    }
  };
  editor.on("component:update", rebuildNavbar);
  editor.on("component:update:props", rebuildNavbar);
};
