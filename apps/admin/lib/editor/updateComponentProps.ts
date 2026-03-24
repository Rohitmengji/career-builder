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

  // 1. Merge props
  const current = component.get("props") || {};
  const merged = { ...current, ...newProps };

  // 2. Set on model (this alone does NOT trigger canvas rebuild)
  component.set("props", merged);

  // 3. Fire component-level event (legacy handlers)
  component.trigger("change:props", component);

  // 4. Fire editor-level events — this is what registerBlock.ts
  //    actually listens on via editor.on("component:update")
  const editor = component.em?.get?.("Editor") || component.em;
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
