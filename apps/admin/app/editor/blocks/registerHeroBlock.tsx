import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

export const registerHeroBlock = (editor: any) => {
  const d = getDefaultProps("hero");

  registerBlock(editor, {
    type: "hero",
    style: {
      padding: "5rem 2rem",
      "text-align": String(d.textAlign || "center"),
      "background-color": "#f8fafc",
      "background-size": "cover",
      "background-position": "center",
      ...(d.backgroundImage ? { "background-image": `url(${d.backgroundImage})` } : {}),
    },
    components: [
      {
        type: "text",
        tagName: "h1",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "2.5rem", "font-weight": "800", "margin-bottom": "0.75rem", color: "#111827", "line-height": "1.2" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "subtitle" },
        content: String(d.subtitle || ""),
        editable: true,
        style: { "font-size": "1.125rem", color: "#6b7280", "margin-bottom": "2rem", "max-width": "36rem", "margin-left": "auto", "margin-right": "auto", "line-height": "1.6" },
      },
      {
        type: "text",
        tagName: "a",
        attributes: { "data-field": "ctaText", href: String(d.ctaLink || "#") },
        content: String(d.ctaText || ""),
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
    ],
  });

  /* Live-rebuild: apply background-image when props change */
  const rebuildHero = (model: any) => {
    if (model.get("type") !== "hero") return;
    const props = model.get("props") || {};
    if (props.backgroundImage) {
      model.setStyle({ ...model.getStyle(), "background-image": `url(${props.backgroundImage})` });
    } else {
      const s = { ...model.getStyle() };
      delete s["background-image"];
      model.setStyle(s);
    }
    if (props.textAlign) {
      model.setStyle({ ...model.getStyle(), "text-align": props.textAlign });
    }
  };
  editor.on("component:update", rebuildHero);
  editor.on("component:update:props", rebuildHero);
};
