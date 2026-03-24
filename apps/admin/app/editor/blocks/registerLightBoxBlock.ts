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

function buildImageCards(images: any[]) {
  return images.map((img: any, idx: number) => ({
    tagName: "div" as const,
    style: {
      "text-align": "center",
    },
    components: [
      {
        tagName: "div" as const,
        style: {
          width: "100%",
          "aspect-ratio": "1",
          "border-radius": "0.75rem",
          overflow: "hidden",
          "margin-bottom": "0.5rem",
          cursor: "pointer",
          "background-color": "#f3f4f6",
        },
        components: [
          {
            tagName: "img" as const,
            type: "image",
            attributes: {
              src: img.url || dummyImg(idx),
              alt: img.caption || "",
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
        tagName: "p" as const,
        attributes: { "data-field": `img-${idx}-caption` },
        content: String(img.caption || ""),
        editable: true,
        style: { "font-size": "0.875rem", color: "#6b7280" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const images = Array.isArray(props.images) ? props.images : [];
  const cols = String(props.columns || "3");
  const colCount = cols === "2" ? 2 : cols === "4" ? 4 : 3;
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.5rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem", color: "#111827" },
    },
    {
      type: "text", tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "text-align": "center", color: "#6b7280", "margin-bottom": "2rem" },
    },
    {
      tagName: "div",
      style: {
        display: "grid",
        "grid-template-columns": `repeat(${colCount}, 1fr)`,
        gap: "1.5rem",
      },
      components: buildImageCards(images),
    },
  ];
}

export const registerLightBoxBlock = (editor: any) => {
  const d = getDefaultProps("light-box");

  registerBlock(editor, {
    type: "light-box",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
