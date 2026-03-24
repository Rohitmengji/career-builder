/**
 * Central utility for updating GrapesJS component props.
 *
 * This is the SINGLE SOURCE OF TRUTH for prop updates.
 * It ensures the full GrapesJS update pipeline fires:
 *   1. model.set("props", ...) — updates the data model
 *   2. model.trigger("change:props") — fires component-level change
 *   3. editor.trigger("component:update") — fires editor-level event
 *      which registerBlock.ts listens on to rebuild the canvas tree
 *   4. view.render() — forces the view layer to re-paint
 *
 * IMPORTANT: GrapesJS has multiple event buses:
 *   - component.em (EditorModel / Backbone Model) — internal bus
 *   - editor (Editor facade) — the one used by editor.on()/editor.trigger()
 *   Both must be triggered for full reactivity.
 *
 * Usage:
 *   import { updateComponentProps } from "@/lib/editor/updateComponentProps";
 *   updateComponentProps(block, { title: "New title", body: "New body" });
 */

export function updateComponentProps(
  component: any,
  newProps: Record<string, any>,
): void {
  if (!component) return;

  // 1. Deep merge props (handles nested objects like list items)
  const current = component.get("props") || {};
  const merged = deepMerge(current, newProps);

  // 2. Set on model — triggers internal Backbone change events.
  //    Use { silent: true } first, then manually fire change:props
  //    to guarantee the event fires even if Backbone thinks nothing changed
  //    (Backbone does a === comparison, but our merged object is always new).
  component.set("props", merged, { silent: true });

  // 3. Fire component-level event — sidebar + model listeners pick this up
  component.trigger("change:props", component);

  // 4. Fire editor-level events on ALL available event buses.
  //    GrapesJS stores the EditorModel at component.em.
  //    The Editor facade is at component.em.get("Editor") or component.em.getEditor().
  //    registerBlock.ts listens via editor.on("component:update") — that's the facade.
  //    We fire on BOTH buses to guarantee delivery.
  const em = component.em; // EditorModel (Backbone Model)
  const editorFacade =
    em?.get?.("Editor") ||
    em?.getEditor?.() ||
    null;

  // Fire on the EditorModel bus (internal GrapesJS listeners)
  if (em?.trigger) {
    em.trigger("component:update", component);
    em.trigger("component:update:props", component);
  }

  // Fire on the Editor facade bus (our registerBlock.ts listeners)
  if (editorFacade && editorFacade !== em && editorFacade.trigger) {
    editorFacade.trigger("component:update", component);
    editorFacade.trigger("component:update:props", component);
  }

  // 5. Force view re-render as safety net
  try {
    component.view?.render();
  } catch {
    // noop — view may not be mounted yet
  }
}

/**
 * Deep merge utility — recursively merges source into target.
 * Arrays are replaced (not merged) to match user intent for list fields.
 */
function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const output: Record<string, any> = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], val);
    } else {
      output[key] = val;
    }
  }
  return output;
}
