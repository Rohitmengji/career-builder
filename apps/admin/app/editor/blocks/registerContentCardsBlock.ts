import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const DUMMY_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop&q=80",
];
const dummyImg = (i: number) => DUMMY_IMAGES[i % DUMMY_IMAGES.length];

function buildCards(cards: any[]) {
  return cards.map((card: any, idx: number) => ({
    tagName: "div" as const,
    style: {
      flex: "1",
      "min-width": "240px",
      "border-radius": "0.75rem",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      "background-color": "#ffffff",
    },
    components: [
      {
        tagName: "div" as const,
        style: { width: "100%", height: "160px", overflow: "hidden", "background-color": "#f3f4f6" },
        components: [
          {
            tagName: "img" as const,
            type: "image",
            attributes: { src: (typeof card.image === "string" && card.image.trim()) ? card.image : dummyImg(idx), alt: card.title || "" },
            style: { width: "100%", height: "100%", "object-fit": "cover", display: "block" },
          },
        ],
      },
      {
        tagName: "div" as const,
        style: { padding: "1.25rem" },
        components: [
          {
            type: "text" as const,
            tagName: "h3" as const,
            attributes: { "data-field": `item-${idx}-title` },
            content: String(card.title || ""),
            editable: true,
            style: { "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
          },
          {
            type: "text" as const,
            tagName: "p" as const,
            attributes: { "data-field": `item-${idx}-desc` },
            content: String(card.desc || ""),
            editable: true,
            style: { "font-size": "0.875rem", color: "#6b7280", "line-height": "1.6", "margin-bottom": "0.75rem" },
          },
          {
            type: "text" as const,
            tagName: "span" as const,
            attributes: { "data-field": `item-${idx}-linkText` },
            content: String(card.linkText || ""),
            editable: true,
            style: { "font-size": "0.875rem", "font-weight": "600", color: "#2563eb" },
          },
        ],
      },
    ],
  }));
}

function buildComponents(props: any) {
  const cards = Array.isArray(props.items) ? props.items : [];
  return [
    {
      type: "text", tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "1.75rem", "font-weight": "700", "text-align": "center", "margin-bottom": "0.5rem", color: "#111827" },
    },
    {
      type: "text", tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1rem", color: "#6b7280", "text-align": "center", "margin-bottom": "2rem" },
    },
    {
      tagName: "div",
      style: { display: "flex", gap: "1.5rem", "flex-wrap": "wrap", "justify-content": "center" },
      components: buildCards(cards),
    },
  ];
}

export const registerContentCardsBlock = (editor: any) => {
  const d = getDefaultProps("content-cards");

  registerBlock(editor, {
    type: "content-cards",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
