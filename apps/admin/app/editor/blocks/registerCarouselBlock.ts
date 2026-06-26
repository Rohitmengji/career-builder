/*
 * Registers the "carousel" GrapesJS editor block: a horizontal slide strip.
 *
 * WHY: gives recruiters a drag-drop image carousel (title + N captioned slides)
 * for career pages, editable inline and from the props sidebar.
 *
 * HOW: buildComponents() reads props from getDefaultProps("carousel") and builds
 * the canvas tree; the shared registerBlock() helper wires palette, live rebuild
 * on prop change, and inline-RTE -> props sync. Notable details:
 *   - In the EDITOR this is a static flex strip (each slide fixed at ~1/3 width,
 *     overflow hidden) — there is no live sliding behaviour here; any real
 *     carousel interaction is the web renderer's responsibility.
 *   - Slides with no image fall back to a rotating Unsplash placeholder so the
 *     preview is never empty.
 *   - Captions use the `slide-<idx>-caption` data-field convention so RTE edits
 *     route back into props.slides[idx].caption via registerBlock.
 * GOTCHA: the public web renderer (apps/web/lib/renderer.tsx) must MIRROR this
 * markup/field shape (and implement the actual sliding behaviour).
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

function buildSlideItems(slides: any[]) {
  return slides.map((slide: any, idx: number) => ({
    tagName: "div" as const,
    style: { flex: "0 0 33.333%", padding: "0.5rem", "text-align": "center" },
    components: [
      {
        tagName: "div" as const,
        style: { width: "100%", height: "180px", "border-radius": "0.75rem", overflow: "hidden", "margin-bottom": "0.5rem", "background-color": "#f3f4f6" },
        components: [{
          tagName: "img" as const, type: "image",
          attributes: { src: slide.image || dummyImg(idx), alt: slide.caption || "" },
          style: { width: "100%", height: "100%", "object-fit": "cover", display: "block" },
        }],
      },
      {
        type: "text" as const, tagName: "p" as const,
        attributes: { "data-field": `slide-${idx}-caption` },
        content: String(slide.caption || ""),
        editable: true,
        style: { "font-size": "0.875rem", color: "#6b7280" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const slides = Array.isArray(props.slides) ? props.slides : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "1.5rem", color: "#111827" },
    },
    {
      tagName: "div",
      style: { display: "flex", overflow: "hidden" },
      components: buildSlideItems(slides),
    },
  ];
}

export const registerCarouselBlock = (editor: any) => {
  const d = getDefaultProps("carousel");

  registerBlock(editor, {
    type: "carousel",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
