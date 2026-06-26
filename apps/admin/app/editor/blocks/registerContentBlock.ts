/*
 * Registers the "content" GrapesJS editor block — a simple heading + rich-text
 * body section with configurable alignment and named background color.
 *
 * WHY: the workhorse "text section" recruiters reach for on career pages; named
 * colors keep editor choices on-brand rather than free-form hex pickers.
 *
 * HOW: buildComponents builds the editable title/body (data-field attrs route
 * RTE edits to props); the root <section> style derives text-align and a
 * background color looked up from COLOR_MAP (a friendly-name -> hex palette).
 * Seeds from getDefaultProps("content") (schema in lib/blockSchemas.ts) and uses
 * the shared registerBlock helper.
 *
 * GOTCHA: textAlign and color are ROOT-level styles, not child components, so
 * rebuildComponents won't repaint them. The extra rebuildContent listener patches
 * the root style on prop change (unknown colors fall back to white). Mirror this
 * block's markup/fields/color map in apps/web/lib/renderer.tsx.
 */
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

function buildComponents(props: any) {
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.75rem", "font-weight": "700", "margin-bottom": "1rem", color: "#111827" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "body" },
      content: String(props.body || ""),
      editable: true,
      style: { "font-size": "1rem", "line-height": "1.75", color: "#4b5563" },
    },
  ];
}

export const registerContentBlock = (editor: any) => {
  const d = getDefaultProps("content");

  registerBlock(editor, {
    type: "content",
    style: {
      "text-align": String(d.textAlign || "left"),
      "background-color": COLOR_MAP[d.color] || "#ffffff",
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
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
