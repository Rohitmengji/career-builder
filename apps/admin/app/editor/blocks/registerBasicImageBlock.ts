/*
 * Registers the "basic-image" GrapesJS editor block — a single centred image
 * (rounded, object-fit cover) wrapped in a max-width container.
 *
 * WHY: gives recruiters a drag-drop image section for the career site. One
 * register*Block file per block type.
 *
 * HOW: builds the canvas tree from the block's default props
 * (getDefaultProps("basic-image"), backed by lib/blockSchemas.ts) and hands
 * it to the shared registerBlock helper, which wires up the palette entry and
 * live prop->canvas rebuild (rebuildComponents). The inner node is
 * type:"image" so GrapesJS opens its asset/upload picker on double-click.
 * props.width === "full" means 100% width, otherwise it's used verbatim as
 * max-width. GOTCHA: PLACEHOLDER_IMG is an external Unsplash URL shown only
 * until a real src is set. This defines only the EDITOR preview — the public
 * site re-renders the same type+props in apps/web/lib/renderer.tsx, so any
 * markup/field change here must be mirrored there.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop&q=80";

function buildComponents(props: any) {
  const src = props.src || PLACEHOLDER_IMG;
  const w = props.width || "full";
  // "full" is a sentinel meaning span the container; any other value is a
  // literal CSS length used directly as the wrapper's max-width.
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
