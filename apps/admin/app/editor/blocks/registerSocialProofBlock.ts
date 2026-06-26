/*
 * Registers the "social-proof" GrapesJS editor block: a logo / brand strip.
 *
 * WHY: a drag-drop "trusted by" row (title + N customer logos) for career pages,
 * configured from the props sidebar.
 *
 * HOW: buildComponents() reads props from getDefaultProps("social-proof") and emits
 * the canvas tree; the shared registerBlock() helper handles palette, live rebuild
 * on prop change, and inline-RTE -> props sync. Notable details:
 *   - Each logo renders as an <img> when it has an imageUrl, otherwise falls back
 *     to a faded text <span> of its name — so a logo entry always shows something.
 *   - `variant` ("dark"/"light") drives both text colour (inside buildComponents)
 *     and the root <section> background. Since the background lives on the root
 *     style (not the child tree), this file adds its own component:update listeners
 *     (rebuildSp) to re-set the section background live when variant changes.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup, the img/text fallback, and the variant colours.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  const logos = Array.isArray(props.logos) ? props.logos : [];
  const isDark = props.variant === "dark";
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "600", "margin-bottom": "2rem", color: isDark ? "#ffffff" : "#111827", "text-align": "center" },
    },
    {
      tagName: "div",
      style: { display: "flex", "flex-wrap": "wrap", "align-items": "center", "justify-content": "center", gap: "3rem" },
      components: logos.map((logo: any) => logo.imageUrl ? ({
        tagName: "img" as const,
        type: "image",
        attributes: { src: logo.imageUrl, alt: logo.name || "Logo" },
        style: { height: "2.5rem", width: "auto", "object-fit": "contain", opacity: "0.6" },
      }) : ({
        tagName: "span",
        content: String(logo.name || "Logo"),
        style: { "font-size": "1.125rem", "font-weight": "600", "letter-spacing": "0.05em", opacity: "0.4", color: isDark ? "#ffffff" : "#111827" },
      })),
    },
  ];
}

export const registerSocialProofBlock = (editor: any) => {
  const d = getDefaultProps("social-proof");
  const isDark = d.variant === "dark";

  registerBlock(editor, {
    type: "social-proof",
    style: { padding: "3rem 1.5rem", "background-color": isDark ? "#111827" : "#f9fafb", "text-align": "center" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live-rebuild: apply variant background when props change */
  const rebuildSp = (model: any) => {
    if (model.get("type") !== "social-proof") return;
    const props = model.get("props") || {};
    const dark = props.variant === "dark";
    model.setStyle({ ...model.getStyle(), "background-color": dark ? "#111827" : "#f9fafb" });
  };
  editor.on("component:update", rebuildSp);
  editor.on("component:update:props", rebuildSp);
};
