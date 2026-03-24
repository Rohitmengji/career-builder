/**
 * Loading state for the editor page.
 * Prevents blank screen while the heavy GrapesJS editor loads.
 */
export default function EditorLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm font-medium">Loading editor…</p>
      </div>
    </div>
  );
}
