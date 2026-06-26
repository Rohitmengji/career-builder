/*
 * Registers the "spacer" GrapesJS editor block — an empty, fixed-height
 * section used purely to add vertical whitespace between other blocks.
 *
 * WHY: gives recruiters a drag-drop way to control spacing on the career
 * site without editing CSS. One register*Block file per block type.
 *
 * HOW: has no child markup (buildComponents returns []); the visible gap is
 * the section's own `height` style. Default height comes from the block's
 * schema (getDefaultProps("spacer"), backed by lib/blockSchemas.ts) and is
 * handed to the shared registerBlock helper. GOTCHA: because the only thing
 * that changes is a single style (not the child tree), the generic
 * rebuildComponents path can't show live height changes — so we attach our
 * own listeners below to mirror props.height onto the canvas style. This
 * only defines the EDITOR preview; the public site re-renders the same
 * type+props in apps/web/lib/renderer.tsx, so keep the two in sync.
 */
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

  /* Live style sync: height. The spacer has no child components, so the
   * shared rebuildComponents loop has nothing to re-render — instead we
   * copy props.height straight onto the section's inline style whenever
   * props change, so resizing in the sidebar updates the canvas immediately. */
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
