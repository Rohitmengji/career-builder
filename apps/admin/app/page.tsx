/*
 * Admin home — the landing/navigation hub for the recruiter app.
 *
 * WHAT: A server-rendered grid of links to the main tools (Dashboard, Jobs,
 * Applications, Page Editor, Theme Editor; Settings for admins) plus a list of
 * the operator's tenants.
 *
 * WHY: First page after login; routes users to the right surface and gives
 * admins a quick jump into per-tenant theming.
 *
 * HOW: Async server component. It is a READ, so it uses getSessionReadOnly()
 * (not getSession()) per the auth convention — redirecting to /login when there
 * is no session. The Settings card is appended only for admin/super_admin roles
 * (UX gating; each target route re-checks authz server-side). listTenants()
 * supplies the tenant chips.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionReadOnly } from "@/lib/auth";
import { listTenants } from "@/lib/tenantStore";
import { Container } from "@/components/ui";

type CardSpec = {
  href: string;
  title: string;
  body: string;
  icon: React.ReactNode;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default async function AdminHome() {
  const session = await getSessionReadOnly();

  if (!session) {
    redirect("/login");
  }

  const tenantIds = await listTenants();

  const cards: CardSpec[] = [
    {
      href: "/dashboard",
      title: "Dashboard",
      body: "Overview of jobs, applications, and hiring metrics.",
      icon: <Icon><path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" /></Icon>,
    },
    {
      href: "/jobs",
      title: "Job Management",
      body: "Create, edit, publish, and manage job postings.",
      icon: <Icon><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></Icon>,
    },
    {
      href: "/applications",
      title: "Applications",
      body: "Review candidates, track pipeline, and manage hiring.",
      icon: <Icon><path d="M9 12l2 2 4-4" /><path d="M5 7h14M5 12h2M5 17h6" /><rect x="3" y="3" width="18" height="18" rx="2" /></Icon>,
    },
    {
      href: "/editor",
      title: "Page Editor",
      body: "Drag-and-drop blocks to build your career site pages.",
      icon: <Icon><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></Icon>,
    },
    {
      href: "/theme",
      title: "Theme Editor",
      body: "Configure branding, colors, fonts, and layout per tenant.",
      icon: <Icon><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></Icon>,
    },
  ];

  if (session.role === "admin" || session.role === "super_admin") {
    cards.push({
      href: "/settings",
      title: "Settings",
      body: "Manage users, roles, and view audit logs.",
      icon: <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>,
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 sm:py-16">
      <Container className="max-w-5xl">
        <header className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight text-gray-900">Career Builder</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Admin dashboard</h1>
          <p className="mt-2 text-base text-gray-600">Welcome back, {session.name}.</p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              data-card="interactive"
              className="group block rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span
                aria-hidden="true"
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
              >
                {card.icon}
              </span>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {card.title}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{card.body}</p>
            </Link>
          ))}
        </div>

        {/* Tenants */}
        {tenantIds.length > 0 && (
          <section className="mt-12" aria-labelledby="tenants-heading">
            <h2
              id="tenants-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600"
            >
              Tenants
            </h2>
            <div className="flex flex-wrap gap-2">
              {tenantIds.map((tid) => (
                <Link
                  key={tid}
                  href={`/theme?tenant=${tid}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-600" />
                  {tid}
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
