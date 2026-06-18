"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading your profile…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900">Careers</Link>
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-900">Browse Jobs</Link>
            <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your profile</h1>
        <p className="text-sm text-gray-500 mb-8">Keep your details up to date — they pre-fill your job applications.</p>

        {toast && (
          <div className={`mb-6 rounded-lg border text-sm px-4 py-3 ${toast.type === "ok" ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"}`}>
            {toast.msg}
          </div>
        )}

        <form onSubmit={onSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input value={email} disabled className="w-full border border-gray-100 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-500" />
            <p className="text-xs text-gray-400 mt-1">Email can&apos;t be changed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First name" value={form.firstName} onChange={set("firstName")} required />
            <Input label="Last name" value={form.lastName} onChange={set("lastName")} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" type="tel" value={form.phone ?? ""} onChange={set("phone")} />
            <Input label="Location" value={form.location ?? ""} onChange={set("location")} placeholder="City, Country" />
          </div>
          <Input label="Headline" value={form.headline ?? ""} onChange={set("headline")} placeholder="Senior Frontend Engineer" />
          <Input label="LinkedIn URL" type="url" value={form.linkedinUrl ?? ""} onChange={set("linkedinUrl")} placeholder="https://linkedin.com/in/you" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">About you</label>
            <textarea
              rows={4} value={form.bio ?? ""} onChange={set("bio")}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition resize-none"
              placeholder="A short summary of your experience and what you're looking for."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={status === "saving"}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Saving…" : "Save changes"}
            </button>
            <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function Input({
  label, type = "text", value, onChange, required, placeholder,
}: {
  label: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && " *"}</label>
      <input
        type={type} value={value} onChange={onChange} required={required} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
      />
    </div>
  );
}
