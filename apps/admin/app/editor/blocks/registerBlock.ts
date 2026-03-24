/*
 * Generic GrapesJS block registration helper.
 *
 * Every block follows the same pattern:
 *   1. Register with BlockManager (palette)
 *   2. Register with DomComponents (model + canvas preview)
 *   3. Sync inline RTE edits back to parent props via data-field
 *   4. Auto-rebuild canvas children when props change (live preview)
 *
 * Individual register*Block files provide the canvas component
 * tree (what the block looks like in the editor) and delegate
 * the boilerplate to this helper.
 */

import { getDefaultProps, blockSchemas } from "@/lib/blockSchemas";

/** GrapesJS component definition — loosely typed since GrapesJS itself is untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CanvasComponent = Record<string, any>;

export interface BlockRegistration {
  /** Must match a key in blockSchemas */
  type: string;
  /** GrapesJS canvas children */
  components: CanvasComponent[];
  /** Styles applied to the root <section> */
  style?: Record<string, string>;
  /** Whether the block can accept dropped children */
  droppable?: boolean;
  /**
   * Optional: a function that takes current props and returns
   * new canvas component tree. When provided, the canvas auto-rebuilds
   * whenever sidebar props change — enabling live preview for all fields
   * (images, list items, text, selects, etc.).
   */
  rebuildComponents?: (props: Record<string, any>) => CanvasComponent[];
}

export function registerBlock(editor: any, reg: BlockRegistration) {
  const { type, components, style, droppable, rebuildComponents } = reg;
  const schema = blockSchemas[type];
  if (!schema) {
    console.warn(`[registerBlock] No schema found for "${type}"`);
    return;
  }

  const defaults = getDefaultProps(type);

  // 1. Block palette entry
  editor.BlockManager.add(type, {
    label: schema.label,
    category: schema.category,
    content: { type, props: defaults },
  });

  // 2. Component type
  editor.DomComponents.addType(type, {
    model: {
      defaults: {
        tagName: "section",
        type,
        droppable: droppable ?? false,
        attributes: { "data-type": type },
        props: defaults,
        components,
        style: {
          "max-width": "72rem",
          "margin-left": "auto",
          "margin-right": "auto",
          "padding": "2rem 1.5rem",
          ...style,
        },
      },
    },
  });

  // 3. Auto-rebuild: when a rebuildComponents function is provided,
  //    re-render the entire canvas component tree on any prop change.
  //    Uses a per-model props snapshot cache (WeakMap) to avoid unnecessary
  //    rebuilds and support multiple instances of the same block type.
  //
  //    CRITICAL: We listen on:
  //    - component:update / component:update:props — for sidebar & AI prop edits
  //    - component:add — for initial page load & page switch
  //
  //    When a block is added via editor.addComponents({ type, props }),
  //    GrapesJS creates children from model.defaults.components (built with
  //    default props), then sets the actual props. Without a component:add
  //    listener the canvas shows stale default content until the block is
  //    selected. The component:add rebuild fixes this.
  if (rebuildComponents) {
    const lastPropsCache = new WeakMap<object, string>();

    const rebuild = (model: any) => {
      // Accept both direct model arg and {model} wrapper from some GrapesJS events
      if (model && typeof model.get !== "function" && model.model) {
        model = model.model;
      }
      if (!model || typeof model.get !== "function") return;
      if (model.get("type") !== type) return;
      const props = { ...defaults, ...model.get("props") };
      const propsJSON = JSON.stringify(props);
      // Skip rebuild if props haven't actually changed for THIS model
      if (lastPropsCache.get(model) === propsJSON) return;
      lastPropsCache.set(model, propsJSON);
      try {
        const newTree = rebuildComponents(props);
        model.components(newTree);
        // Force view re-render as safety net
        try { model.view?.render(); } catch { /* noop */ }
      } catch (err) {
        console.warn(`[registerBlock] Rebuild failed for "${type}":`, err);
      }
    };

    // Invalidate cache on every prop set so the rebuild always runs
    const invalidateAndRebuild = (model: any) => {
      if (model && typeof model.get !== "function" && model.model) {
        model = model.model;
      }
      if (!model || typeof model.get !== "function") return;
      if (model.get("type") !== type) return;
      // Clear cache entry to force rebuild even if JSON matches
      lastPropsCache.delete(model);
      rebuild(model);
    };

    // component:add — rebuild immediately so saved/AI props render
    // on first paint without requiring a click/selection.
    // Use requestAnimationFrame to let GrapesJS finish its internal
    // component initialisation before we swap the child tree.
    const rebuildOnAdd = (model: any) => {
      if (model && typeof model.get !== "function" && model.model) {
        model = model.model;
      }
      if (!model || typeof model.get !== "function") return;
      if (model.get("type") !== type) return;

      // Only rebuild if the model carries non-default props
      // (avoids an unnecessary double-render for freshly dragged blocks)
      const currentProps = model.get("props");
      if (!currentProps) return;
      const currentJSON = JSON.stringify({ ...defaults, ...currentProps });
      const defaultJSON = JSON.stringify(defaults);
      if (currentJSON === defaultJSON) return;

      // Defer to next frame so the GrapesJS view is mounted
      requestAnimationFrame(() => {
        invalidateAndRebuild(model);
      });
    };

    editor.on("component:update", rebuild);
    editor.on("component:update:props", invalidateAndRebuild);
    editor.on("component:add", rebuildOnAdd);
  }

  // 4. Inline RTE → props sync (fires once per rte:disable)
  //    Uses the same dual-bus event pipeline as updateComponentProps
  //    to ensure canvas rebuild + sidebar re-render happen immediately.
  editor.on("rte:disable", (view: any) => {
    const editedModel = view?.model;
    if (!editedModel) return;

    const fieldName = editedModel.getAttributes()?.["data-field"];
    if (!fieldName) return;

    let ancestor = editedModel.parent();
    while (ancestor) {
      if (ancestor.get("type") === type) break;
      ancestor = ancestor.parent?.();
    }
    if (!ancestor) return;

    const el = editedModel.getEl();
    const newValue = el?.innerText?.trim() || "";

    const merged = {
      ...ancestor.get("props"),
      [fieldName]: newValue,
    };

    // Use silent set + manual trigger to guarantee event fires
    ancestor.set("props", merged, { silent: true });
    ancestor.trigger("change:props", ancestor);

    // Fire on both event buses (EditorModel + Editor facade)
    const em = ancestor.em;
    const editorFacade = em?.get?.("Editor") || em?.getEditor?.() || null;
    if (em?.trigger) {
      em.trigger("component:update", ancestor);
      em.trigger("component:update:props", ancestor);
    }
    if (editorFacade && editorFacade !== em && editorFacade.trigger) {
      editorFacade.trigger("component:update", ancestor);
      editorFacade.trigger("component:update:props", ancestor);
    }

    editedModel.components(newValue);
  });
}
