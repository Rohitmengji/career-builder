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
    // Initial async data fetch; setState runs after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-library-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 id="media-library-title" className="flex items-center gap-2 font-semibold text-gray-900">
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Media Library
          </h3>
          <button
            onClick={onClose}
            aria-label="Close media library"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Upload */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors focus-within:ring-2 focus-within:ring-blue-600">
            <span className="flex items-center gap-2 text-sm text-gray-600">
              {uploading ? (
                <><span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />Uploading…</>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
                  Click to upload image (max 5MB)
                </>
              )}
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
            <p className="text-center text-sm text-gray-600 py-8" role="status">Loading…</p>
          ) : media.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-8">
              No images yet. Upload one above!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map((item) => (
                <button
                  key={item.name}
                  onClick={() => onSelect(item.url)}
                  aria-label={`Select image ${item.name}`}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {/* User-uploaded media with arbitrary remote URLs — not a static asset. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
          {/* Arbitrary user-supplied image URL preview — not a static asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="w-full h-32 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={() => onChange(field.name, "")}
            aria-label="Remove image"
            className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title="Remove image"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ) : (
        <div className="w-full h-24 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <span className="text-xs text-gray-600">No image selected</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLibrary(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-md transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          Browse Library
        </button>
      </div>

      {/* URL input (for external images) */}
      <input
        className="w-full border border-gray-300 p-2 rounded-md text-xs text-gray-700
                   placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600"
        placeholder="…or paste image URL"
        aria-label="Image URL"
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
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
              Item {idx + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                aria-label={`Move item ${idx + 1} up`}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Move up"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
              </button>
              <button
                onClick={() => moveItem(idx, 1)}
                disabled={idx === items.length - 1}
                aria-label={`Move item ${idx + 1} down`}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Move down"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <button
                onClick={() => removeItem(idx)}
                aria-label={`Remove item ${idx + 1}`}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-red-600 hover:text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                title="Remove item"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          </div>

          {/* Sub-fields */}
          {subFields.map((sf) => (
            <div key={sf.name}>
              <label className="block mb-1 text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                {sf.label}
              </label>
              {sf.type === "textarea" ? (
                <textarea
                  className="w-full border border-gray-300 p-2 rounded-md text-xs min-h-14 resize-y
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600"
                  value={item[sf.name] || ""}
                  onChange={(e) => handleItemChange(idx, sf.name, e.target.value)}
                />
              ) : (
                <input
                  className="w-full border border-gray-300 p-2 rounded-md text-xs
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600"
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
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
          className="w-full border border-gray-300 p-2 rounded-md text-sm text-gray-900
                     placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600
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
          className="w-full border border-gray-300 p-2 rounded-md text-sm min-h-20 resize-y text-gray-900
                     placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600
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
          className="w-full border border-gray-300 p-2 rounded-md text-sm bg-white text-gray-900
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600
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
                       focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
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

  // ── Single source of truth: GrapesJS model props ──────────────
  // Use a counter to force re-reads from the model after updates.
  // The GrapesJS model IS the source of truth — we never cache in useState.
  const [, forceUpdate] = useState(0);
  const syncCounter = useCallback(() => forceUpdate((n) => n + 1), []);

  // Read props directly from the model on every render
  const props: Record<string, any> = block?.get("props") || {};

  // Listen to GrapesJS model changes so the sidebar re-renders when
  // the canvas is edited via inline RTE, AI updates, or other external sources.
  // Subscribe to BOTH model-level and editor-level events for full coverage.
  useEffect(() => {
    if (!block) return;
    const onPropsChange = () => syncCounter();
    block.on("change:props", onPropsChange);

    // Also subscribe to editor-level component:update for this specific block.
    // This catches updates triggered via editor.trigger("component:update")
    // which may not fire change:props (e.g. AI bulk updates, external sources).
    const em = block.em;
    const editorFacade = em?.get?.("Editor") || em?.getEditor?.() || null;
    const onEditorUpdate = (model: any) => {
      // Only react if this update is for OUR block
      if (model === block || model?.cid === block?.cid) {
        syncCounter();
      }
    };
    if (editorFacade?.on) {
      editorFacade.on("component:update:props", onEditorUpdate);
    }

    return () => {
      block.off("change:props", onPropsChange);
      if (editorFacade?.off) {
        editorFacade.off("component:update:props", onEditorUpdate);
      }
    };
  }, [block, syncCounter]);

  /* ── AI apply handler: replaces all props at once ────────────── */
  const handleAiApply = useCallback((newProps: Record<string, any>) => {
    if (!block) return;
    updateComponentProps(block, newProps);
    // Force sidebar re-read from model
    syncCounter();
  }, [block, syncCounter]);

  const handleChange = (name: string, value: string | boolean | Record<string, string>[]) => {
    if (!block) return;

    // Central update — fires model.set + change:props + component:update + view.render
    // This ensures the registerBlock rebuild listener ALWAYS fires for every field type.
    // The model is the single source of truth — no local state to update.
    updateComponentProps(block, { [name]: value });

    // Force sidebar to re-read from model
    syncCounter();

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
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600" aria-hidden="true">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" />
            <path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.5 1.8-1.5H16a6 6 0 0 0 6-6c0-4.4-4.5-8-10-8z" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Select a block on the canvas to edit its settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {schema.label} Settings
          </h2>
        </div>
        <span className="inline-block mt-1.5 ml-4 text-[10px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
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
