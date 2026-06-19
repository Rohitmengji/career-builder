import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const DUMMY_IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop&q=80",
];
const dummyImg = (i: number) => DUMMY_IMAGES[i % DUMMY_IMAGES.length];

function buildLocations(locations: any[]) {
  return locations.map((loc: any, idx: number) => ({
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
        style: { width: "100%", height: "140px", overflow: "hidden", "background-color": "#f3f4f6" },
        components: [
          {
            tagName: "img" as const,
            type: "image",
            attributes: { src: (typeof loc.image === "string" && loc.image.trim()) ? loc.image : dummyImg(idx), alt: loc.city || "" },
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
            attributes: { "data-field": `item-${idx}-city` },
            content: String(loc.city || ""),
            editable: true,
            style: { "font-weight": "600", "margin-bottom": "0.5rem", color: "#111827" },
          },
          {
            type: "text" as const,
            tagName: "p" as const,
            attributes: { "data-field": `item-${idx}-address` },
            content: String(loc.address || ""),
            editable: true,
            style: { "font-size": "0.875rem", color: "#6b7280", "line-height": "1.6" },
          },
        ],
      },
    ],
  }));
}

function buildComponents(props: any) {
  const locations = Array.isArray(props.items) ? props.items : [];
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
      components: buildLocations(locations),
    },
  ];
}

export const registerLocationsBlock = (editor: any) => {
  const d = getDefaultProps("locations");

  registerBlock(editor, {
    type: "locations",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
