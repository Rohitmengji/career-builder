/*
 * Registers the "divider" GrapesJS editor block — a single horizontal rule
 * (<hr>) used as a visual separator between career-site sections.
 *
 * WHY: gives recruiters a drag-drop divider without writing markup. One
 * register*Block file per block type.
 *
 * HOW: buildComponents returns one void <hr> styled as a 1px top border;
 * it takes no props (the markup is static), so it's handed to the shared
 * registerBlock helper with default props only. GOTCHA: this defines only
 * the EDITOR preview — the public site re-renders the same type in
 * apps/web/lib/renderer.tsx, so any markup change here must be mirrored there.
 */
import { registerBlock } from "./registerBlock";

function buildComponents(_props: any) {
  return [
    {
      tagName: "hr",
      void: true,
      style: {
        border: "none",
        "border-top": "1px solid #e5e7eb",
        margin: "0",
      },
    },
  ];
}

export const registerDividerBlock = (editor: any) => {
  registerBlock(editor, {
    type: "divider",
    style: {
      padding: "1rem 1.5rem",
    },
    components: buildComponents({}),
    rebuildComponents: buildComponents,
  });
};
