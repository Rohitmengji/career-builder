import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

function buildComponents(props: any) {
  return [
    {
      tagName: "div",
      style: { "max-width": "720px" },
      components: [
        {
          tagName: "div",
          style: {
            padding: "1rem",
            "background-color": "#f9fafb",
            "border-radius": "0.5rem",
            "margin-bottom": "1rem",
          },
          components: [
            { tagName: "h2", content: "Job Title", style: { "font-size": "1.5rem", "font-weight": "700", "margin-bottom": "0.25rem" } },
            { tagName: "p", content: "Department · Location · Full-time", style: { color: "#666", "font-size": "0.875rem" } },
          ],
        },
        {
          tagName: "div",
          style: {
            padding: "1rem",
            border: "1px dashed #ccc",
            "border-radius": "0.375rem",
            color: "#999",
            "text-align": "center",
            "margin-bottom": "1rem",
          },
          components: [{ tagName: "span", content: "[ Job description renders at runtime ]" }],
        },
        {
          tagName: "div",
          style: {
            padding: "0.75rem 1.5rem",
            "background-color": "#2563eb",
            color: "#fff",
            "border-radius": "0.375rem",
            "font-weight": "600",
            "text-align": "center",
            display: "inline-block",
          },
          components: [
            {
              type: "text",
              tagName: "span",
              attributes: { "data-field": "applyButtonText" },
              content: String(props.applyButtonText || ""),
              editable: true,
            },
          ],
        },
      ],
    },
  ];
}

export const registerJobDetailsBlock = (editor: any) => {
  const d = getDefaultProps("job-details");

  registerBlock(editor, {
    type: "job-details",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
