import { registerBlock } from "./registerBlock";

export const registerSpacerBlock = (editor: any) => {
  registerBlock(editor, {
    type: "spacer",
    style: {
      padding: "0",
      height: "48px",
      "min-height": "24px",
    },
    components: [],
  });

  /* Live-rebuild: apply height when props change */
  const rebuildSpacer = (model: any) => {
    if (model.get("type") !== "spacer") return;
    const props = model.get("props") || {};
    if (props.height) {
      model.setStyle({ ...model.getStyle(), height: props.height });
    }
  };
  editor.on("component:update", rebuildSpacer);
  editor.on("component:update:props", rebuildSpacer);
};
