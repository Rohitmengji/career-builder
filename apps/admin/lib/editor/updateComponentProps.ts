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

  // 2. Set on model — triggers internal Backbone change events
  component.set("props", merged, { silent: false });

  // 3. Fire component-level event (legacy handlers + model listeners)
  component.trigger("change:props", component);

  // 4. Fire editor-level events — this is what registerBlock.ts
  //    actually listens on via editor.on("component:update")
  //    Try multiple paths to find the editor reference
  const editor =
    component.em?.get?.("Editor") ||
    component.em?.getEditor?.() ||
    component.em;
  if (editor?.trigger) {
    editor.trigger("component:update", component);
    editor.trigger("component:update:props", component);
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
