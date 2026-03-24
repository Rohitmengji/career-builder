import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(_props: any) {
  return [];
}

export const registerSpacerBlock = (editor: any) => {
  const d = getDefaultProps("spacer");

  registerBlock(editor, {
    type: "spacer",
    style: {
      padding: "0",
      height: String(d.height || "48px"),
      "min-height": "24px",
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });

  /* Live style sync: height */
  const syncSpacerStyle = (model: any) => {
    if (model.get("type") !== "spacer") return;
    const props = model.get("props") || {};
    if (props.height) {
      model.setStyle({ ...model.getStyle(), height: props.height });
    }
  };
  editor.on("component:update", syncSpacerStyle);
  editor.on("component:update:props", syncSpacerStyle);
};
