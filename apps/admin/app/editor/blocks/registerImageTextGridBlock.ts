/*
 * Registers the "image-text-grid" GrapesJS editor block: image + title + blurb cards.
 *
 * WHY: a drag-drop responsive grid (heading + N feature cards) for career pages,
 * editable inline on the canvas and from the props sidebar.
 *
 * HOW: buildComponents() reads props from getDefaultProps("image-text-grid") and
 * builds the canvas tree; the shared registerBlock() helper handles palette, live
 * rebuild on prop change, and inline-RTE -> props sync. Notable details:
 *   - Cards wrap via flex (min-width 220px) rather than a fixed grid, so column
 *     count is responsive to container width.
 *   - Cards with no image fall back to a rotating Unsplash placeholder so the
 *     preview is never empty.
 *   - Title/desc use the `item-<idx>-title` / `item-<idx>-desc` data-field
 *     convention so RTE edits route into props.items[idx] via registerBlock.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup/field shape so saved pages match the editor preview.
 */
import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const DUMMY_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop&q=80",
];
const dummyImg = (i: number) => DUMMY_IMAGES[i % DUMMY_IMAGES.length];

function buildGridItems(items: any[]) {
  return items.map((item: any, idx: number) => ({
    tagName: "div" as const,
    style: {
      flex: "1",
      "min-width": "220px",
      "text-align": "center",
    },
    components: [
      {
        tagName: "div" as const,
        style: {
          width: "100%",
          height: "160px",
          "border-radius": "0.75rem",
          overflow: "hidden",
          "margin-bottom": "0.75rem",
          "background-color": "#f3f4f6",
        },
        components: [
          {
            tagName: "img" as const,
            type: "image",
            attributes: {
              src: item.image || dummyImg(idx),
              alt: item.title || "",
            },
            style: {
              width: "100%",
              height: "100%",
              "object-fit": "cover",
              display: "block",
            },
          },
        ],
      },
      {
        type: "text" as const,
        tagName: "h3" as const,
        attributes: { "data-field": `item-${idx}-title` },
        content: String(item.title || ""),
        editable: true,
        style: { "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
      },
      {
        type: "text" as const,
        tagName: "p" as const,
        attributes: { "data-field": `item-${idx}-desc` },
        content: String(item.desc || ""),
        editable: true,
        style: { "font-size": "0.875rem", color: "#6b7280", "line-height": "1.6" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const items = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "2rem", color: "#111827" },
    },
    {
      tagName: "div",
      style: { display: "flex", gap: "1.5rem", "flex-wrap": "wrap", "justify-content": "center" },
      components: buildGridItems(items),
    },
  ];
}

export const registerImageTextGridBlock = (editor: any) => {
  const d = getDefaultProps("image-text-grid");

  registerBlock(editor, {
    type: "image-text-grid",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
