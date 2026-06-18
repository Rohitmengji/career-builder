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
          </>
        )}
      </main>
    </div>
  );
}
