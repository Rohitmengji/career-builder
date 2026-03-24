import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

const DUMMY_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&q=80",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&q=80",
];

function buildTeamMembers(members: any[]) {
  return members.map((m: any, idx: number) => ({
    tagName: "div" as const,
    style: { "text-align": "center" },
    components: [
      {
        tagName: "div" as const,
        style: {
          width: "8rem", height: "8rem", "border-radius": "50%",
          overflow: "hidden", margin: "0 auto 1rem",
          "background-color": "#f3f4f6",
        },
        components: m.image ? [
          {
            tagName: "img" as const,
            type: "image",
            attributes: { src: m.image, alt: m.name || "Team member" },
            style: { width: "100%", height: "100%", "object-fit": "cover", display: "block" },
          },
        ] : [
          {
            tagName: "div" as const,
            style: {
              width: "100%", height: "100%", display: "flex",
              "align-items": "center", "justify-content": "center",
              "font-size": "2rem", "font-weight": "600", color: "#9ca3af",
            },
            content: ((m.name || "?")[0] || "?").toUpperCase(),
          },
        ],
      },
      {
        type: "text" as const, tagName: "h3" as const,
        content: String(m.name || "Team Member"),
        style: { "font-weight": "500", "font-size": "1rem", color: "#111827" },
      },
      {
        type: "text" as const, tagName: "p" as const,
        content: String(m.role || "Role"),
        style: { "font-size": "0.875rem", color: "#6b7280", "margin-top": "0.25rem" },
      },
    ],
  }));
}

function buildComponents(props: any) {
  const members = Array.isArray(props.members) ? props.members : [];
  return [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: { "font-size": "2rem", "font-weight": "700", "margin-bottom": "0.5rem", color: "#111827", "text-align": "center" },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "subtitle" },
      content: String(props.subtitle || ""),
      editable: true,
      style: { "font-size": "1rem", color: "#6b7280", "margin-bottom": "2.5rem", "text-align": "center" },
    },
    {
      tagName: "div",
      style: { display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "2rem" },
      components: buildTeamMembers(members),
    },
  ];
}

export const registerTeamGridBlock = (editor: any) => {
  const d = getDefaultProps("team-grid");

  registerBlock(editor, {
    type: "team-grid",
    style: { padding: "4rem 1.5rem", "text-align": "center" },
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
