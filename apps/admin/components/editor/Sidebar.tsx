"use client";

/*
Schema-driven sidebar for GrapesJS visual editor.
- Resolves blocks from any nested child click
- Dynamically renders form fields from blockSchemas
- Deep-searches canvas children by data-field for live updates
- Handles special fields: background images, link hrefs
- Image field with upload + media library picker
*/

import { useEffect, useState, useMemo, useRef, useCallback, type ChangeEvent } from "react";
import {
  blockSchemas,
  type BlockField,
  type BlockSchema,
  type ListItemField,
} from "@/lib/blockSchemas";
import AiAssistant from "./AiAssistant";
import type { AiPageBlock } from "@/lib/ai/types";
import { updateComponentProps } from "@/lib/editor/updateComponentProps";

/* ------------------------------------------------------------------ */
/*  Block resolution                                                   */
/* ------------------------------------------------------------------ */

const KNOWN_BLOCK_TYPES = new Set(Object.keys(blockSchemas));

function resolveBlock(component: any): any | null {
  // 1. Direct match: the selected component IS a known block
  const selfType = component?.get("type");
  if (selfType && KNOWN_BLOCK_TYPES.has(selfType)) return component;

  // 2. Walk up the parent chain
  let current = component?.parent?.();
  while (current) {
    const t = current.get("type");
    if (KNOWN_BLOCK_TYPES.has(t)) return current;
    // Also check data-type attribute at each level
    const dt = current.getAttributes?.()?.["data-type"];
    if (dt && KNOWN_BLOCK_TYPES.has(dt)) return current;
    current = current.parent?.();
  }

  // 3. Fallback: check data-type on the component itself
  const dataType = component?.getAttributes?.()?.["data-type"];
  if (dataType && KNOWN_BLOCK_TYPES.has(dataType)) return component;

  // 4. Last resort: search the closest ancestor by checking all
  //    top-level components and seeing if one contains this component's element
  try {
    const el = component?.getEl?.();
    if (el) {
      let parentEl = el.parentElement;
      while (parentEl) {
        const dt2 = parentEl.getAttribute?.("data-type");
        if (dt2 && KNOWN_BLOCK_TYPES.has(dt2)) {
          // Find the GrapesJS model for this DOM element
          const wrapper = component.em?.get?.("DomComponents")?.getWrapper?.();
          if (wrapper) {
            const found = findModelByDataType(wrapper, dt2, parentEl);
            if (found) return found;
          }
          break;
        }
        parentEl = parentEl.parentElement;
      }
    }
  } catch {
    // DOM fallback failed — that's OK
  }

  return null;
}

/** Recursively find a GrapesJS model that matches a data-type and DOM element */
function findModelByDataType(model: any, dataType: string, domEl: HTMLElement): any | null {
  if (model.get("type") === dataType || model.getAttributes?.()?.["data-type"] === dataType) {
    const modelEl = model.getEl?.();
    if (modelEl === domEl) return model;
  }
  const children = model.components?.()?.toArray?.() ?? [];
  for (const child of children) {
    const found = findModelByDataType(child, dataType, domEl);
    if (found) return found;
  }
  return null;
}

function findByDataField(root: any, fieldName: string): any | null {
  const children = root.components?.()?.toArray?.() ?? [];
  for (const child of children) {
    if (child.getAttributes?.()?.["data-field"] === fieldName) return child;
    const found = findByDataField(child, fieldName);
    if (found) return found;
  }
  return null;
}

const LINK_FIELDS: Record<string, string> = {
  ctaLink: "ctaText",
  buttonLink: "buttonText",
  link: "label",
};

/* ------------------------------------------------------------------ */
/*  Media library modal                                                */
/* ------------------------------------------------------------------ */

interface MediaItem {
  name: string;
  url: string;
  size: number;
  modified: string;
}

function MediaLibrary({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setMedia(data.media || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append("file", file);

    // Read CSRF token from cookie
    const csrfMatch = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        body: form,
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      });
      if (res.ok) {
        const data = await res.json();
        onSelect(data.url);
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed — check connection");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-9999 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">📁 Media Library</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Upload */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <span className="text-sm text-gray-500">
              {uploading ? "⏳ Uploading…" : "📤 Click to upload image (max 5MB)"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Library grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Loading…</p>
          ) : media.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              No images yet. Upload one above!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map((item) => (
                <button
                  key={item.name}
                  onClick={() => onSelect(item.url)}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Image field with upload + library + URL input                      */
/* ------------------------------------------------------------------ */

function ImageField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const [showLibrary, setShowLibrary] = useState(false);

  return (
    <div className="space-y-2">
      {/* Preview */}
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt=""
            className="w-full h-32 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={() => onChange(field.name, "")}
            className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="w-full h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-xs text-gray-400">No image selected</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLibrary(true)}
          className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 rounded-md transition-colors font-medium"
        >
          📁 Browse Library
        </button>
      </div>

      {/* URL input (for external images) */}
      <input
        className="w-full border border-gray-200 p-1.5 rounded-md text-xs text-gray-500
                   focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        placeholder="…or paste image URL"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      />

      {/* Media library modal */}
      {showLibrary && (
        <MediaLibrary
          onSelect={(url) => {
            onChange(field.name, url);
            setShowLibrary(false);
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  List field (dynamic add/remove/reorder)                            */
/* ------------------------------------------------------------------ */

function ListField({
  field,
  value,
  onChange,
}: {
  field: BlockField;
  value: Record<string, string>[];
  onChange: (name: string, value: Record<string, string>[]) => void;
}) {
  const items: Record<string, string>[] = Array.isArray(value) ? value : [];
  const subFields: ListItemField[] = field.listFields || [];

  const handleItemChange = (idx: number, key: string, val: string) => {
    const updated = items.map((item, i) => (i === idx ? { ...item, [key]: val } : item));
    onChange(field.name, updated);
  };

  const addItem = () => {
    const newItem: Record<string, string> = {};
    for (const sf of subFields) {
      newItem[sf.name] = sf.default || "";
    }
    onChange(field.name, [...items, newItem]);
  };

  const removeItem = (idx: number) => {
    onChange(field.name, items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(field.name, updated);
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          {/* Item header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Item {idx + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                title="Move up"
              >▲</button>
              <button
                onClick={() => moveItem(idx, 1)}
                disabled={idx === items.length - 1}
                className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                title="Move down"
              >▼</button>
              <button
                onClick={() => removeItem(idx)}
                className="text-[10px] text-red-400 hover:text-red-600 px-1 font-bold"
                title="Remove item"
              >✕</button>
            </div>
          </div>

          {/* Sub-fields */}
          {subFields.map((sf) => (
            <div key={sf.name}>
              <label className="block mb-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {sf.label}
              </label>
              {sf.type === "textarea" ? (
                <textarea
                  className="w-full border border-gray-200 p-2 rounded-md text-xs min-h-14 resize-y
                             focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={item[sf.name] || ""}
                  onChange={(e) => handleItemChange(idx, sf.name, e.target.value)}
                />
              ) : (
                <input
                  className="w-full border border-gray-200 p-2 rounded-md text-xs
                             focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={item[sf.name] || ""}
                  onChange={(e) => handleItemChange(idx, sf.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        + Add {field.label?.replace(/s$/, "") || "Item"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field renderers                                                    */
/* ------------------------------------------------------------------ */

interface FieldProps {
  field: BlockField;
  value: string | boolean;
  onChange: (name: string, value: string | boolean) => void;
}

function FieldRenderer({ field, value, onChange }: FieldProps) {
  switch (field.type) {
    case "text":
      return (
        <input
          className="w-full border border-gray-300 p-2 rounded-md text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors"
          placeholder={`Enter ${field.label.toLowerCase()}…`}
          value={String(value ?? "")}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(field.name, e.target.value)
          }
        />
      );

    case "textarea":
      return (
        <textarea
          className="w-full border border-gray-300 p-2 rounded-md text-sm min-h-20 resize-y
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors"
          placeholder={`Enter ${field.label.toLowerCase()}…`}
          value={String(value ?? "")}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange(field.name, e.target.value)
          }
        />
      );

    case "select":
      return (
        <select
          className="w-full border border-gray-300 p-2 rounded-md text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors"
          value={String(value ?? "")}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange(field.name, e.target.value)
          }
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600
                       focus:ring-blue-500 transition-colors"
            checked={Boolean(value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange(field.name, e.target.checked)
            }
          />
          <span className="text-sm text-gray-700">{field.label}</span>
        </label>
      );

    case "image":
      return (
        <ImageField
          field={field}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );

    case "list":
      return null; // Handled separately in the Sidebar component

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  component: any;
  /** Called when AI generates a full page — editor page.tsx handles adding blocks */
  onApplyPage?: (blocks: AiPageBlock[]) => void;
}

export default function Sidebar({ component, onApplyPage }: SidebarProps) {
  const block = useMemo(() => resolveBlock(component), [component]);
  const type = block?.get("type") as string | undefined;
  const schema: BlockSchema | undefined = type ? blockSchemas[type] : undefined;

  const [props, setProps] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    setProps(block?.get("props") || {});
  }, [block]);

  /* ── AI apply handler: replaces all props at once ────────────── */
  const handleAiApply = useCallback((newProps: Record<string, any>) => {
    if (!block) return;
    const merged = { ...block.get("props"), ...newProps };
    setProps(merged);
    updateComponentProps(block, newProps);
  }, [block]);

  const handleChange = (name: string, value: string | boolean | Record<string, string>[]) => {
    if (!block) return;

    const newProps = { ...block.get("props"), [name]: value };
    setProps(newProps);

    // Central update — fires model.set + change:props + component:update + view.render
    // This ensures the registerBlock rebuild listener ALWAYS fires for every field type.
    updateComponentProps(block, { [name]: value });

    // ── Additional direct DOM updates for instant visual feedback ──
    // These run alongside the full rebuild but give immediate canvas response.

    // Background image → CSS on block root
    if (name === "backgroundImage" && typeof value === "string") {
      if (value.trim()) {
        block.addStyle({
          "background-image": `url(${value})`,
          "background-size": "cover",
          "background-position": "center",
        });
      } else {
        block.addStyle({ "background-image": "" });
      }
      return;
    }

    // Link fields → update href on the paired element
    if (name in LINK_FIELDS && typeof value === "string") {
      const targetFieldName = LINK_FIELDS[name];
      const targetChild = findByDataField(block, targetFieldName);
      if (targetChild) {
        targetChild.addAttributes({ href: value });
      }
      return;
    }

    // Image fields → also update img src directly for instant preview
    const fieldDef = schema?.fields.find((f) => f.name === name);
    if (fieldDef?.type === "image" && typeof value === "string") {
      const imgChild = findByDataField(block, name);
      if (imgChild) {
        imgChild.addAttributes({ src: value });
      }
      return;
    }

    // Text / textarea fields → also update child content directly
    if (typeof value === "string" && fieldDef?.type !== "list" && fieldDef?.type !== "select") {
      const targetChild = findByDataField(block, name);
      if (targetChild) {
        targetChild.components(value);
      }
    }
  };

  if (!schema) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="text-4xl mb-3">🎨</div>
        <p className="text-sm text-gray-500 leading-relaxed">
          Select a block on the canvas to edit its settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {schema.label} Settings
          </h2>
        </div>
        <span className="inline-block mt-1.5 ml-4 text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
          {schema.category}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {schema.fields.map((field) => (
          <div key={field.name}>
            {field.type !== "boolean" && (
              <label className="block mb-1.5 text-xs font-medium text-gray-600 uppercase tracking-wider">
                {field.label}
              </label>
            )}
            {field.type === "list" ? (
              <ListField
                field={field}
                value={Array.isArray(props[field.name]) ? (props[field.name] as unknown as Record<string, string>[]) : (field.defaultItems || [])}
                onChange={handleChange as any}
              />
            ) : (
              <FieldRenderer
                field={field}
                value={props[field.name] ?? field.default ?? ""}
                onChange={handleChange}
              />
            )}
          </div>
        ))}
      </div>

      {/* AI Assistant */}
      {type && (
        <AiAssistant
          blockType={type}
          currentProps={props}
          onApply={handleAiApply}
          onApplyPage={onApplyPage}
        />
      )}
    </div>
  );
}
