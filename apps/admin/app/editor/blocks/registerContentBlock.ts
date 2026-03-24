import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const COLOR_MAP: Record<string, string> = {
  white: "#ffffff",
  gray: "#f9fafb",
  blue: "#eff6ff",
  green: "#f0fdf4",
  red: "#fef2f2",
  orange: "#fff7ed",
  purple: "#faf5ff",
  indigo: "#eef2ff",
  teal: "#f0fdfa",
  yellow: "#fefce8",
};

export const registerContentBlock = (editor: any) => {
  const d = getDefaultProps("content");

  registerBlock(editor, {
    type: "content",
    style: {
      "text-align": String(d.textAlign || "left"),
      "background-color": COLOR_MAP[d.color] || "#ffffff",
    },
    components: [
      {
        type: "text",
        tagName: "h2",
        attributes: { "data-field": "title" },
        content: String(d.title || ""),
        editable: true,
        style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "1rem", color: "#111827" },
      },
      {
        type: "text",
        tagName: "p",
        attributes: { "data-field": "body" },
        content: String(d.body || ""),
        editable: true,
        style: { "font-size": "1rem", "line-height": "1.75", color: "#4b5563" },
      },
    ],
  });

  /* Live-rebuild: apply textAlign and background color when props change */
  const rebuildContent = (model: any) => {
    if (model.get("type") !== "content") return;
    const props = model.get("props") || {};
    const updates: Record<string, string> = {};
    if (props.textAlign) updates["text-align"] = props.textAlign;
    if (props.color) updates["background-color"] = COLOR_MAP[props.color] || "#ffffff";
    if (Object.keys(updates).length > 0) {
      model.setStyle({ ...model.getStyle(), ...updates });
    }
  };
  editor.on("component:update", rebuildContent);
  editor.on("component:update:props", rebuildContent);
};
