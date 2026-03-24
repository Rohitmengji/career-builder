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
  //    Uses a serialized props snapshot to avoid unnecessary rebuilds
  //    (e.g. when GrapesJS fires component:update for selection changes).
  if (rebuildComponents) {
    let lastPropsJSON = "";
    const rebuild = (model: any) => {
      if (model.get("type") !== type) return;
      const props = { ...defaults, ...model.get("props") };
      const propsJSON = JSON.stringify(props);
      // Skip rebuild if props haven't actually changed
      if (propsJSON === lastPropsJSON) return;
      lastPropsJSON = propsJSON;
      try {
        const newTree = rebuildComponents(props);
        model.components(newTree);
      } catch (err) {
        console.warn(`[registerBlock] Rebuild failed for "${type}":`, err);
      }
    };
    editor.on("component:update", rebuild);
    editor.on("component:update:props", rebuild);
  }

  // 4. Inline RTE → props sync (fires once per rte:disable)
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

    ancestor.set("props", {
      ...ancestor.get("props"),
      [fieldName]: newValue,
    });

    editedModel.components(newValue);
  });
}
