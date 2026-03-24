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
