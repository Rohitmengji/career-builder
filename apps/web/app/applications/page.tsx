/*
 * /applications — Candidate's application tracker.
 *
 * Shows all jobs they've applied to with real-time status updates.
 * Requires candidate authentication.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Alert, EmptyState, ButtonLink, Button } from "@/components/ui";
import { isEnabled } from "@career-builder/shared/feature-flags";
import DecisionLedgerPanel from "./DecisionLedgerPanel";

interface TimelineEvent {
  type: string;
  status: string | null;
  at: string;
}

interface ApplicationEntry {
  id: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    department: string;
    location: string | null;
  };
  timeline?: TimelineEvent[];
  rejectionReason?: { category: string; message: string } | null;
  feedbackReleased?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  applied: { label: "Applied", color: "text-gray-700", bg: "bg-gray-100", icon: "📨" },
  screening: { label: "Under Review", color: "text-blue-700", bg: "bg-blue-50", icon: "🔍" },
  interview: { label: "Interview", color: "text-indigo-700", bg: "bg-indigo-50", icon: "🎯" },
  offer: { label: "Offer", color: "text-amber-700", bg: "bg-amber-50", icon: "🎉" },
  hired: { label: "Hired", color: "text-emerald-700", bg: "bg-emerald-50", icon: "✅" },
  rejected: { label: "Not Selected", color: "text-red-700", bg: "bg-red-50", icon: "—" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.applied;
}

const EVENT_LABELS: Record<string, string> = {
  interview_scheduled: "Interview scheduled",
  interview_confirmed: "Interview confirmed",
  interview_rescheduled: "Interview rescheduled",
  interview_cancelled: "Interview cancelled",
  interview_completed: "Interview completed",
  offer_extended: "Offer extended",
  offer_accepted: "Offer accepted",
  offer_declined: "Offer declined",
  offer_rescinded: "Offer withdrawn",
};

function timelineLabel(ev: TimelineEvent): string {
  if (ev.type === "status_change" && ev.status) return getStatusConfig(ev.status).label;
  return EVENT_LABELS[ev.type] ?? ev.type.replace(/_/g, " ");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string, tz: string) {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(iso));
  }
}

interface CandidateInterview {
  id: string;
  status: string;
  type: string;
  scheduledAt: string;
  durationMins: number;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  jobTitle: string | null;
}

const INTERVIEW_TYPE_LABEL: Record<string, string> = { phone: "Phone", video: "Video", onsite: "On-site" };

interface CandidateOffer {
  id: string;
  status: string; // sent | accepted | declined | expired | rescinded
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  startDate: string | null;
  expiresAt: string | null;
  terms: string | null;
  jobTitle: string | null;
}

const OFFER_PERIOD_SUFFIX: Record<string, string> = { yearly: "/yr", monthly: "/mo", hourly: "/hr" };

function formatOfferComp(o: CandidateOffer): string {
  if (o.salaryAmount == null) return "";
  let money: string;
  try {
    money = new Intl.NumberFormat("en-US", { style: "currency", currency: o.salaryCurrency, maximumFractionDigits: 0 }).format(o.salaryAmount);
  } catch {
    money = `${o.salaryAmount.toLocaleString()} ${o.salaryCurrency}`;
  }
  return `${money} ${OFFER_PERIOD_SUFFIX[o.salaryPeriod] || ""}`.trim();
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationEntry[]>([]);
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [offerBusy, setOfferBusy] = useState<string | null>(null);
  const [eeoEnabled, setEeoEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/applications");
      if (res.status === 401) {
        router.push("/login?redirect=/applications");
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApplications(data.applications || []);
      setEeoEnabled(!!data.eeoEnabled);
      // Interviews + offers are flag-gated server-side; a 404/!ok just means "none to show".
      try {
        const ivRes = await fetch("/api/interviews");
        if (ivRes.ok) setInterviews((await ivRes.json()).interviews || []);
        else setInterviews([]);
      } catch {
        setInterviews([]);
      }
      try {
        const ofRes = await fetch("/api/offers");
        if (ofRes.ok) setOffers((await ofRes.json()).offers || []);
        else setOffers([]);
      } catch {
        setOffers([]);
      }
    } catch {
      setError("Unable to load your applications. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const confirmInterview = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/interviews/${encodeURIComponent(id)}`, { method: "POST" });
      if (res.ok) setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, status: "confirmed" } : i)));
    } catch {
      /* keep as-is */
    }
  }, []);

  const decideOffer = useCallback(async (id: string, action: "accept" | "decline") => {
    if (offerBusy) return;
    if (action === "decline" && !confirm("Decline this offer? This can't be undone.")) return;
    setOfferBusy(id);
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      // The server returns the authoritative status (handles races/expiry).
      const next = res.ok ? (action === "accept" ? "accepted" : "declined") : data.status;
      if (next) setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
      if (res.ok) void load();
    } catch {
      /* keep as-is */
    } finally {
      setOfferBusy(null);
    }
  }, [offerBusy, load]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            My Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track the status of your job applications.
          </p>
        </div>

        {!loading && offers.filter((o) => o.status !== "rescinded").length > 0 && (
          <section className="mb-8" aria-label="Your offers">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Offers</h2>
            <div className="space-y-3">
              {offers
                .filter((o) => o.status !== "rescinded")
                .map((o) => {
                  const comp = formatOfferComp(o);
                  return (
                    <div key={o.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{o.jobTitle || "Offer"}</p>
                          {comp && <p className="mt-0.5 text-sm text-gray-800">{comp}</p>}
                          <p className="mt-0.5 text-xs text-gray-500">
                            {o.startDate ? `Starts ${formatDate(o.startDate)}` : "Start date TBD"}
                            {o.status === "sent" && o.expiresAt ? ` · Respond by ${formatDate(o.expiresAt)}` : ""}
                          </p>
                          {o.terms && <p className="mt-1.5 whitespace-pre-wrap text-xs text-gray-600">{o.terms}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {o.status === "sent" ? (
                            <>
                              <button type="button" disabled={offerBusy === o.id} onClick={() => decideOffer(o.id, "accept")}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600">
                                Accept offer
                              </button>
                              <button type="button" disabled={offerBusy === o.id} onClick={() => decideOffer(o.id, "decline")}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                                Decline
                              </button>
                            </>
                          ) : o.status === "accepted" ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Accepted ✓</span>
                          ) : o.status === "declined" ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Declined</span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Expired</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {!loading && interviews.filter((iv) => iv.status !== "cancelled").length > 0 && (
          <section className="mb-8" aria-label="Your interviews">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Interviews</h2>
            <div className="space-y-3">
              {interviews
                .filter((iv) => iv.status !== "cancelled")
                .map((iv) => (
                  <div key={iv.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{iv.jobTitle || "Interview"}</p>
                        <p className="mt-0.5 text-sm text-gray-700">{formatDateTime(iv.scheduledAt, iv.timezone)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {INTERVIEW_TYPE_LABEL[iv.type] || iv.type} · {iv.durationMins} min
                          {iv.location ? ` · ${iv.location}` : ""}
                        </p>
                        {iv.meetingUrl && (
                          <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                            Join link
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {iv.status === "confirmed" ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Confirmed</span>
                        ) : iv.status === "scheduled" ? (
                          <button type="button" onClick={() => confirmInterview(iv.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600">
                            Confirm
                          </button>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600">{iv.status.replace("_", " ")}</span>
                        )}
                        <a href={`/api/interviews/${encodeURIComponent(iv.id)}`}
                          className="text-xs font-medium text-gray-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                          Add to calendar
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading your applications">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert tone="error">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          </Alert>
        )}

        {!loading && !error && applications.length === 0 && (
          <EmptyState
            icon={<span className="text-2xl">📋</span>}
            title="No applications yet"
            body="Browse open positions and apply to get started — you'll track every application's status right here."
            action={<ButtonLink href="/jobs">Browse jobs</ButtonLink>}
          />
        )}

        {!loading && !error && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => {
              const status = getStatusConfig(app.status);
              return (
                <article
                  key={app.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/jobs/${app.job.id}`}
                        className="text-base font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                      >
                        {app.job.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                        <span>{app.job.department}</span>
                        {app.job.location && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{app.job.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.bg} ${status.color}`}
                    >
                      <span aria-hidden="true">{status.icon}</span>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                    <span>Applied {formatDate(app.submittedAt)}</span>
                    {app.updatedAt !== app.submittedAt && (
                      <span>Updated {formatDate(app.updatedAt)}</span>
                    )}
                  </div>
                  {app.rejectionReason && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700">Why we didn&apos;t move forward</p>
                      <p className="mt-1 text-sm text-gray-600">{app.rejectionReason.message}</p>
                    </div>
                  )}
                  {app.feedbackReleased && <InterviewFeedback applicationId={app.id} />}
                  {isEnabled("decision_ledger") && (app.status === "rejected" || app.status === "hired") && (
                    <DecisionLedgerPanel applicationId={app.id} />
                  )}
                  {app.timeline && app.timeline.length > 0 && (
                    <ol className="mt-3 space-y-2 border-t border-gray-100 pt-3" aria-label="Status history">
                      {app.timeline.map((ev, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                          <span className="font-medium text-gray-700">{timelineLabel(ev)}</span>
                          <span className="text-gray-300">·</span>
                          <span>{formatDate(ev.at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {!loading && eeoEnabled && applications.length > 0 && (
          <EeoSelfIdSection apps={applications.map((a) => ({ id: a.id, title: a.job.title }))} />
        )}
      </main>
    </div>
  );
}

/* ================================================================== */
/*  Interview feedback — anonymized scorecard summary (ADR-0012)        */
/* ================================================================== */

interface FeedbackData {
  criteria: { criterion: string; average: number }[];
  overallAverage: number | null;
  interviewerCount: number;
}

function InterviewFeedback({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/feedback`, { cache: "no-store" });
        if (!res.ok || !active) return;
        const json = await res.json();
        if (active) setData(json.feedback ?? null);
      } catch {
        /* leave empty */
      } finally {
        if (active) setLoaded(true);
      }
    };
    void run();
    return () => { active = false; };
  }, [applicationId]);

  if (!loaded || !data || (data.criteria.length === 0 && data.overallAverage === null)) return null;

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="text-xs font-semibold text-gray-700">Your interview feedback</p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Anonymized summary across {data.interviewerCount} interviewer{data.interviewerCount === 1 ? "" : "s"}.
      </p>
      {data.criteria.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.criteria.map((c) => (
            <li key={c.criterion} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{c.criterion}</span>
              <span className="font-medium text-gray-900">{c.average} / 5</span>
            </li>
          ))}
        </ul>
      )}
      {data.overallAverage !== null && (
        <p className="mt-2 text-xs text-gray-600">Overall: <span className="font-semibold text-gray-900">{data.overallAverage} / 5</span></p>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Voluntary EEO self-identification (ADR-0013) — optional, isolated   */
/* ================================================================== */

const EEO_FIELDS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  { key: "gender", label: "Gender", options: [
    { value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "nonbinary", label: "Non-binary" }, { value: "other", label: "Other" }, { value: "decline_to_state", label: "Decline to state" },
  ] },
  { key: "race", label: "Race", options: [
    { value: "american_indian", label: "American Indian / Alaska Native" }, { value: "asian", label: "Asian" }, { value: "black", label: "Black / African American" }, { value: "hispanic", label: "Hispanic / Latino" }, { value: "native_hawaiian", label: "Native Hawaiian / Pacific Islander" }, { value: "white", label: "White" }, { value: "two_or_more", label: "Two or more races" }, { value: "other", label: "Other" }, { value: "decline_to_state", label: "Decline to state" },
  ] },
  { key: "veteranStatus", label: "Veteran status", options: [
    { value: "veteran", label: "Veteran" }, { value: "not_veteran", label: "Not a veteran" }, { value: "decline_to_state", label: "Decline to state" },
  ] },
  { key: "disability", label: "Disability", options: [
    { value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "decline_to_state", label: "Decline to state" },
  ] },
];

function EeoSelfIdSection({ apps }: { apps: { id: string; title: string }[] }) {
  const [appId, setAppId] = useState(apps[0]?.id ?? "");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !appId) return;
    setBusy(true);
    try {
      const body: Record<string, string> = { applicationId: appId };
      for (const [k, v] of Object.entries(vals)) if (v) body[k] = v;
      const res = await fetch("/api/eeo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) setSaved(true);
    } catch {
      /* keep */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="eeo-heading" className="mt-12 border-t border-gray-200 pt-8">
      <h2 id="eeo-heading" className="text-xl font-semibold tracking-tight text-gray-900">Voluntary self-identification</h2>
      <p className="mt-1 text-sm text-gray-500">
        Optional and confidential. This is used only for aggregate, anonymized diversity reporting — it is
        <strong> never</strong> shown to the hiring team and does <strong>not</strong> affect your application.
      </p>
      {saved ? (
        <p className="mt-4 text-sm text-emerald-700">Thanks — your responses were recorded.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {apps.length > 1 && (
            <label className="block text-xs font-medium text-gray-600">Application
              <select value={appId} onChange={(e) => setAppId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                {apps.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
          )}
          {EEO_FIELDS.map((f) => (
            <label key={f.key} className="block text-xs font-medium text-gray-600">{f.label}
              <select value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Prefer not to answer</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <button type="submit" disabled={busy || !appId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600">
            {busy ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </section>
  );
}
