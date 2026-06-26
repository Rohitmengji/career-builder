/*
 * Candidate profile page (client component).
 *
 * WHAT: Lets a signed-in candidate view/edit their profile, plus two trust-feature
 * sections defined below in this file: PrivacyAndData (GDPR export + account
 * deletion, ADR-0011) and WhoViewedMe (application-view transparency).
 *
 * WHY: Self-service profile management for the candidate side of the ATS. The
 * profile data pre-fills job applications, so keeping it current matters.
 *
 * HOW: All persistence goes through tenant-scoped API routes (/api/profile,
 * /api/profile/{export,delete,views}); this component never touches the DB. The
 * candidate is identified server-side by session (lowercased email + tenantId,
 * ADR-0001) — note Email is rendered disabled/readOnly because it is the identity
 * anchor and cannot be changed. A 401 from /api/profile redirects to /login with
 * a returnTo. Fetches use a `cancelled` flag to avoid setState after unmount.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import {
  Alert,
  Button,
  ButtonLink,
  Field,
  TextareaField,
  Skeleton,
  SkeletonText,
} from "@/components/ui";

interface Profile {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; location: string | null; linkedinUrl: string | null;
  resumeUrl: string | null; headline: string | null; bio: string | null;
}

type Editable = Pick<Profile, "firstName" | "lastName" | "phone" | "location" | "headline" | "bio" | "linkedinUrl">;

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<Editable>({
    firstName: "", lastName: "", phone: "", location: "", headline: "", bio: "", linkedinUrl: "",
  });
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          router.push("/login?returnTo=/profile");
          return;
        }
        const data = await res.json();
        if (cancelled || !data.profile) return;
        const p: Profile = data.profile;
        setEmail(p.email);
        setForm({
          firstName: p.firstName || "", lastName: p.lastName || "", phone: p.phone || "",
          location: p.location || "", headline: p.headline || "", bio: p.bio || "", linkedinUrl: p.linkedinUrl || "",
        });
      } catch {
        /* leave loading state for retry */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const set = (k: keyof Editable) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setToast(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setToast({ type: "ok", msg: "Profile saved." });
      else setToast({ type: "err", msg: data.error || "Could not save. Please try again." });
    } catch {
      setToast({ type: "err", msg: "Network error. Please try again." });
    } finally {
      setStatus("idle");
    }
  }, [form]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <nav aria-label="Account" className="mb-6">
          <ButtonLink href="/jobs" variant="ghost" size="sm" className="-ml-3">
            Browse jobs
          </ButtonLink>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">Your profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Keep your details up to date — they pre-fill your job applications.
        </p>

        {loading ? (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8" aria-busy="true">
            <span className="sr-only" role="status" aria-live="polite">Loading your profile…</span>
            <div className="space-y-6">
              <Skeleton className="h-12 w-full" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <SkeletonText lines={4} className="space-y-2" />
              <Skeleton className="h-11 w-40" />
            </div>
          </div>
        ) : (
          <>
            {toast && (
              <div className="mt-8">
                <Alert tone={toast.type === "ok" ? "success" : "error"}>{toast.msg}</Alert>
              </div>
            )}

            <form onSubmit={onSave} className="mt-8 space-y-6 rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8" noValidate>
              <Field
                label="Email"
                type="email"
                value={email}
                disabled
                readOnly
                hint="Email can't be changed."
                autoComplete="email"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" />
                <Field label="Last name" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phone" type="tel" value={form.phone ?? ""} onChange={set("phone")} autoComplete="tel" />
                <Field label="Location" value={form.location ?? ""} onChange={set("location")} placeholder="City, Country" autoComplete="address-level2" />
              </div>
              <Field label="Headline" value={form.headline ?? ""} onChange={set("headline")} placeholder="Senior Frontend Engineer" />
              <Field label="LinkedIn URL" type="url" value={form.linkedinUrl ?? ""} onChange={set("linkedinUrl")} placeholder="https://linkedin.com/in/you" autoComplete="url" />
              <TextareaField
                label="About you"
                rows={4}
                value={form.bio ?? ""}
                onChange={set("bio")}
                placeholder="A short summary of your experience and what you're looking for."
              />

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" size="lg" loading={status === "saving"}>
                  {status === "saving" ? "Saving…" : "Save changes"}
                </Button>
                <ButtonLink href="/jobs" variant="ghost" size="lg">Cancel</ButtonLink>
              </div>
            </form>

            <WhoViewedMe />
            <PrivacyAndData />
          </>
        )}
      </main>
    </div>
  );
}

/* ================================================================== */
/*  Privacy & your data — GDPR §15 export + §17 deletion (ADR-0011)     */
/* ================================================================== */

function PrivacyAndData() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm("Permanently delete your account and personal data? This cannot be undone.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      // 404 = deletion feature flag-gated off (default-off, see feature-flags.ts).
      if (res.status === 404) { setMsg("Account deletion isn't available right now."); return; }
      if (!res.ok) { setMsg(data.error || "We couldn't process your request."); return; }
      // `deferred` = erasure can't run immediately (e.g. legal hold / pending app);
      // the server queued it, so we stay logged in and just inform the user.
      if (data.deferred) { setMsg(data.message || "Your request is on hold and will be completed soon."); return; }
      // Erased — log out and return home.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/";
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="privacy-heading" className="mt-12 border-t border-gray-200 pt-8">
      <h2 id="privacy-heading" className="text-xl font-semibold tracking-tight text-gray-900">Privacy &amp; your data</h2>
      <p className="mt-1 text-sm text-gray-600">You own your data. Download a copy anytime, or delete your account.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          // Navigate (not fetch) so the browser handles the JSON file download directly.
          onClick={() => { window.location.href = "/api/profile/export"; }}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Download my data (JSON)
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          {busy ? "Working…" : "Delete my account"}
        </button>
      </div>
      {msg && <p role="status" className="mt-3 text-sm text-gray-700">{msg}</p>}
    </section>
  );
}

/* ================================================================== */
/*  Who viewed your application — the blind-hiring trust proof point    */
/* ================================================================== */

interface ProfileView {
  viewerName: string;
  viewedAt: string;
}

function WhoViewedMe() {
  const [views, setViews] = useState<ProfileView[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/views", { cache: "no-store" });
        if (res.ok && !cancelled) setViews((await res.json()).views ?? []);
        else if (!cancelled) setViews([]);
      } catch {
        if (!cancelled) setViews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-labelledby="views-heading" className="mt-12 border-t border-gray-200 pt-8">
      <h2 id="views-heading" className="text-xl font-semibold tracking-tight text-gray-900">
        Who viewed your application
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Transparency by default — see when a hiring-team member opened your application.
      </p>

      <div className="mt-4">
        {loading ? (
          <SkeletonText lines={3} />
        ) : !views || views.length === 0 ? (
          <p className="text-sm text-gray-500">No views yet. We&apos;ll show them here as your applications are reviewed.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-live="polite">
            {views.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-gray-900">{v.viewerName}</span>
                <time className="text-sm text-gray-500" dateTime={v.viewedAt}>
                  {new Date(v.viewedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
