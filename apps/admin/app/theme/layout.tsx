import { Suspense } from "react";

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-400">Loading theme editor…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
