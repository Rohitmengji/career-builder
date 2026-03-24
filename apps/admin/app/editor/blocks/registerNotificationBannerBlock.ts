import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const VARIANT_STYLES: Record<string, Record<string, string>> = {
  info: { "background-color": "#eff6ff", color: "#1e40af", "border-bottom": "1px solid #bfdbfe" },
  success: { "background-color": "#f0fdf4", color: "#166534", "border-bottom": "1px solid #bbf7d0" },
  warning: { "background-color": "#fffbeb", color: "#92400e", "border-bottom": "1px solid #fde68a" },
  error: { "background-color": "#fef2f2", color: "#991b1b", "border-bottom": "1px solid #fecaca" },
};

function buildComponents(props: any) {
  const text = String(props.text || "");
  const linkText = String(props.linkText || "");
  const linkUrl = String(props.linkUrl || "#");
  const content = linkText
    ? `${text} <a href="${linkUrl}" style="margin-left:0.5rem;text-decoration:underline;font-weight:600;">${linkText}</a>`
    : text;

  return [
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "text" },
      content,
      editable: true,
      style: { "font-size": "0.875rem", "font-weight": "500" },
    },
  ];
}

export const registerNotificationBannerBlock = (editor: any) => {
  const d = getDefaultProps("notification-banner");
  const variantStyle = VARIANT_STYLES[d.variant] || VARIANT_STYLES.info;

  registerBlock(editor, {
    type: "notification-banner",
    style: { padding: "0.75rem 1.5rem", ...variantStyle },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live-rebuild: apply variant background when props change */
  const rebuildVariant = (model: any) => {
    if (model.get("type") !== "notification-banner") return;
    const props = model.get("props") || {};
    const vs = VARIANT_STYLES[props.variant] || VARIANT_STYLES.info;
    model.setStyle({ ...model.getStyle(), ...vs });
  };
  editor.on("component:update", rebuildVariant);
  editor.on("component:update:props", rebuildVariant);
};
