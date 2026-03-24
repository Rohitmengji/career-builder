import { registerBlock } from "./registerBlock";

export const registerDividerBlock = (editor: any) => {
  registerBlock(editor, {
    type: "divider",
    style: {
      padding: "1rem 1.5rem",
    },
    components: [
      {
        tagName: "hr",
        void: true,
        style: {
          border: "none",
          "border-top": "1px solid #e5e7eb",
          margin: "0",
        },
      },
    ],
  });
};
