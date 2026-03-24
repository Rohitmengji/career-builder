import Link from "next/link";
import {
  type TenantConfig,
  DEFAULT_BRANDING,
  mergeTenantConfig,
} from "@career-builder/tenant-config";

function getAdminApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");

  const publicUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (publicUrl?.trim()) return publicUrl.trim().replace(/\/$/, "");

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3001";
}

export default async function Home() {
  const apiUrl = getAdminApiUrl();

  // Fetch tenant branding for dynamic company name
  let companyName = "Your Company";
  let pages: string[] = [];

  try {
    const res = await fetch(`${apiUrl}/api/tenants?id=default`, { cache: "no-store" });
    const data = await res.json();
    if (data.tenant) {
      const config = mergeTenantConfig(data.tenant);
      companyName = config.branding?.companyName || companyName;
    }
  } catch {
    // Admin API may not be running
  }

  // Fetch available pages to build dynamic navigation
  try {
    const res = await fetch(`${apiUrl}/api/pages`, { cache: "no-store" });
    const data = await res.json();
    pages = data.pages || [];
  } catch {
    // Admin API may not be running
  }

  const hasAbout = pages.includes("about");
  const hasCulture = pages.includes("culture");
  const hasBenefits = pages.includes("benefits");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-300 mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900 tracking-tight">
            {companyName}
          </span>
          <nav className="flex items-center gap-8 text-sm">
            {hasAbout && (
              <Link href="/about" className="text-gray-500 hover:text-gray-900 transition-colors">About</Link>
            )}
            {hasCulture && (
              <Link href="/culture" className="text-gray-500 hover:text-gray-900 transition-colors">Culture</Link>
            )}
            {hasBenefits && (
              <Link href="/benefits" className="text-gray-500 hover:text-gray-900 transition-colors">Benefits</Link>
            )}
            <Link
              href="/careers"
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Careers
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 pt-16">
        <div className="max-w-2xl text-center flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            We&apos;re hiring across all teams
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold text-gray-900 tracking-tight leading-[1.1]">
            Build what matters.
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-lg">
            Join {companyName} and help us build the future.
            Explore our open roles and find your next chapter.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Link
              href="/careers"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 text-sm"
            >
              View Open Positions →
            </Link>
            {hasCulture && (
              <Link
                href="/culture"
                className="border border-gray-200 text-gray-700 font-medium px-6 py-3 rounded-lg hover:bg-gray-50 transition-all text-sm"
              >
                Our Culture
              </Link>
            )}
            {!hasCulture && hasAbout && (
              <Link
                href="/about"
                className="border border-gray-200 text-gray-700 font-medium px-6 py-3 rounded-lg hover:bg-gray-50 transition-all text-sm"
              >
                About Us
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {companyName}. All rights reserved.
      </footer>
    </div>
  );
}