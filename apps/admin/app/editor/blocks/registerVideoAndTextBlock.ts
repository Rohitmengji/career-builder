    import { getDefaultProps } from "@/lib/blockSchemas";
import { registerBlock } from "./registerBlock";

/**
 * Convert a YouTube or Vimeo watch/share URL into an embeddable URL.
 * Returns the original string if the format is unrecognised.
 */
function toEmbedUrl(url: string): string {
  if (!url) return "";
  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
  const vmMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;

  return url; // fallback — use as-is (user may have pasted an embed URL)
}

function buildComponents(props: any) {
  const embedUrl = toEmbedUrl(String(props.videoUrl || ""));

  const videoPlaceholder = {
    tagName: "div",
    attributes: { "data-field": "videoUrl" },
    style: {
      flex: "1",
      "min-width": "280px",
      height: "315px",
      "background-color": "#1f2937",
      "border-radius": "0.5rem",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: "#fff",
      "font-size": "2rem",
      overflow: "hidden",
    },
    components: embedUrl
      ? [
          {
            tagName: "iframe",
            void: false,
            attributes: {
              src: embedUrl,
              width: "100%",
              height: "100%",
              frameborder: "0",
              allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
              allowfullscreen: "true",
            },
            style: { border: "none", width: "100%", height: "100%" },
          },
        ]
      : [{ tagName: "span", content: "▶ Paste a video URL in the sidebar" }],
  };

  const textChildren: any[] = [
    {
      type: "text",
      tagName: "h2",
      attributes: { "data-field": "title" },
      content: String(props.title || ""),
      editable: true,
      style: {
        "font-size": "1.5rem",
        "font-weight": "700",
        "margin-bottom": "0.75rem",
      },
    },
    {
      type: "text",
      tagName: "p",
      attributes: { "data-field": "body" },
      content: String(props.body || ""),
      editable: true,
      style: { color: "#555", "line-height": "1.75", "margin-bottom": "1.25rem" },
    },
  ];

  if (props.ctaText) {
    textChildren.push({
      type: "text" as const,
      tagName: "a" as const,
      attributes: { "data-field": "ctaText", href: String(props.ctaLink || "#") },
      content: String(props.ctaText),
      editable: true,
      style: {
        display: "inline-block",
        padding: "0.75rem 1.5rem",
        "background-color": "#2563eb",
        color: "#fff",
        "border-radius": "0.5rem",
        "text-decoration": "none",
        "font-weight": "600",
        "font-size": "0.875rem",
      },
    });
  }

  const isRight = String(props.videoPosition || "left") === "right";

  return [
    {
      tagName: "div",
      style: {
        display: "flex",
        gap: "2rem",
        "flex-wrap": "wrap",
        "align-items": "center",
        ...(isRight ? { "flex-direction": "row-reverse" } : {}),
      },
      components: [
        videoPlaceholder,
        {
          tagName: "div",
          style: { flex: "1", "min-width": "280px" },
          components: textChildren,
        },
      ],
    },
  ];
}

export const registerVideoAndTextBlock = (editor: any) => {
  const d = getDefaultProps("video-and-text");

  registerBlock(editor, {
    type: "video-and-text",
    components: buildComponents(d),
    rebuildComponents: buildComponents,
  });
};
