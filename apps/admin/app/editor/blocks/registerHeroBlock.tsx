/*
 * Registers the "hero" GrapesJS editor block — a large headline + subtitle + CTA
 * over a configurable background image/alignment.
 *
 * WHY: the top-of-page hero is the most-used career-site section; this gives
 * recruiters a drag-drop, fully editable hero without code.
 *
 * HOW: buildComponents builds the editable text/CTA tree (data-field attrs route
 * RTE edits back to props) and buildStyle computes the root <section> style from
 * props. Both seed from getDefaultProps("hero") (schema in lib/blockSchemas.ts)
 * and are passed to the shared registerBlock helper.
 *
 * GOTCHA: backgroundImage and textAlign are ROOT-level styles, not part of the
 * child component tree, so rebuildComponents alone won't repaint them. The extra
 * syncHeroStyle listener on component:update / :props patches the root style in
 * place (adding/removing background-image, updating text-align) so the canvas
 * reflects sidebar changes live. The public site mirrors this block in
 * apps/web/lib/renderer.tsx — keep markup, fields, and style derivation in sync.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "h1",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "2.5rem", "font-weight": "800", "margin-bottom": "0.75rem", color: "#111827", "line-height": "1.2" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1.125rem", color: "#6b7280", "margin-bottom": "2rem", "max-width": "36rem", "margin-left": "auto", "margin-right": "auto", "line-height": "1.6" },
    },
    {
      type: "text",
      tagName: "a",
      attributes: { "data-field": "ctaText", href: String(props.ctaLink || "#") },
      content: String(props.ctaText || ""),
      editable: true,
      style: {
        display: "inline-block",
        padding: "0.875rem 2rem",
        "background-color": "#2563eb",
        color: "#fff",
        "border-radius": "0.5rem",
        "text-decoration": "none",
        "font-weight": "600",
        "font-size": "1rem",
      },
    },
  ];
}

function buildStyle(props: any) {
  return {
    padding: "5rem 2rem",
    "text-align": String(props.textAlign || "center"),
    "background-color": "#f8fafc",
    "background-size": "cover",
    "background-position": "center",
    ...(props.backgroundImage ? { "background-image": `url(${props.backgroundImage})` } : {}),
  };
}

export const registerHeroBlock = (editor: any) => {
  const d = getDefaultProps("hero");

  registerBlock(editor, {
    type: "hero",
    style: buildStyle(d),
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live style sync: background-image + textAlign are root-level styles */
  const syncHeroStyle = (model: any) => {
    if (model.get("type") !== "hero") return;
    const props = model.get("props") || {};
    const style = { ...model.getStyle() };
    if (props.backgroundImage) {
      style["background-image"] = `url(${props.backgroundImage})`;
    } else {
      delete style["background-image"];
    }
    if (props.textAlign) {
      style["text-align"] = props.textAlign;
    }
    model.setStyle(style);
  };
  editor.on("component:update", syncHeroStyle);
  editor.on("component:update:props", syncHeroStyle);
};
