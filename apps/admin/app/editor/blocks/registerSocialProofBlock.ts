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
