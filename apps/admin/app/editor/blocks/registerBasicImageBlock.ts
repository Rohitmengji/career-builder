import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop&q=80";

function buildComponents(props: any) {
  const src = props.src || PLACEHOLDER_IMG;
  const w = props.width || "full";
  const maxWidth = w === "full" ? "100%" : w;
  return [
    {
      tagName: "div",
      style: {
        width: "100%",
        "max-width": maxWidth,
        margin: "0 auto",
        "border-radius": "0.75rem",
        overflow: "hidden",
        "background-color": "#f3f4f6",
      },
      components: [
        {
          tagName: "img",
          type: "image",
          attributes: { src, alt: props.alt || "Image" },
          style: {
            width: "100%",
            height: "auto",
            "max-height": "400px",
            "object-fit": "cover",
            display: "block",
          },
        },
      ],
    },
  ];
}

export const registerBasicImageBlock = (editor: any) => {
  const d = getDefaultProps("basic-image");

  registerBlock(editor, {
    type: "basic-image",
    style: {
      padding: "1rem 1.5rem",
      "text-align": "center",
    },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
