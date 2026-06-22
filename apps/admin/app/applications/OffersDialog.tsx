"use client";

/*
 * OffersDialog — extend + manage offers for one application (ADR-0008).
 * Recruiter-facing: a create-draft form + each offer with its lifecycle actions,
 * gated by status (the state machine) and role (Approve/Rescind = manager+).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Spinner, XIcon } from "@/components/ui";

type OfferStatus =
  | "draft" | "pending_approval" | "approved" | "sent"
  | "accepted" | "declined" | "expired" | "rescinded";
type OfferAction =
  | "submit_for_approval" | "approve" | "request_changes" | "send" | "accept" | "decline" | "rescind";

interface Offer {
  id: string;
  status: OfferStatus;
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  startDate: string | null;
  expiresAt: string | null;
  terms: string | null;
  notes: string | null;
  createdBy?: { name: string | null } | null;
  approver?: { name: string | null } | null;
}

interface Props {
  applicationId: string;
  candidateName: string;
  csrf: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Draft", pending_approval: "Pending approval", approved: "Approved", sent: "Sent",
  accepted: "Accepted", declined: "Declined", expired: "Expired", rescinded: "Rescinded",
};
const STATUS_CLASS: Record<OfferStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  sent: "bg-indigo-50 text-indigo-700",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-500",
  rescinded: "bg-gray-100 text-gray-500",
};

const PERIODS = ["yearly", "monthly", "hourly"];
const PERIOD_SUFFIX: Record<string, string> = { yearly: "/yr", monthly: "/mo", hourly: "/hr" };

function fmtComp(o: Offer): string {
  if (o.salaryAmount == null) return "No amount set";
  let money: string;
  try {
    money = new Intl.NumberFormat("en-US", { style: "currency", currency: o.salaryCurrency, maximumFractionDigits: 0 }).format(o.salaryAmount);
  } catch {
    money = `${o.salaryAmount.toLocaleString()} ${o.salaryCurrency}`;
  }
  return `${money} ${PERIOD_SUFFIX[o.salaryPeriod] || ""}`.trim();
}
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)); }
  catch { return null; }
}

/** Lifecycle actions available from a status (role gating applied separately). */
function actionsFor(status: OfferStatus): { action: OfferAction; label: string; danger?: boolean; approveGated?: boolean }[] {
  switch (status) {
    case "draft": return [{ action: "submit_for_approval", label: "Submit for approval" }, { action: "rescind", label: "Discard", danger: true, approveGated: true }];
    case "pending_approval": return [{ action: "approve", label: "Approve", approveGated: true }, { action: "request_changes", label: "Request changes", approveGated: true }, { action: "rescind", label: "Discard", danger: true, approveGated: true }];
    case "approved": return [{ action: "send", label: "Send to candidate" }, { action: "request_changes", label: "Edit (back to draft)", approveGated: true }, { action: "rescind", label: "Discard", danger: true, approveGated: true }];
    case "sent": return [{ action: "accept", label: "Mark accepted" }, { action: "decline", label: "Mark declined" }, { action: "rescind", label: "Rescind", danger: true, approveGated: true }];
    default: return [];
  }
}

export default function OffersDialog({ applicationId, candidateName, csrf, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Draft form
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [period, setPeriod] = useState("yearly");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [terms, setTerms] = useState("");

  const base = "/api/admin/offers";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${base}?applicationId=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
      if (res.status === 404) { setError("Offer management isn't enabled for this workspace."); return; }
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setOffers(data.offers || []);
      setCanApprove(!!data.canApprove);
    } catch {
      setError("Unable to load offers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void load();
  }, [load]);

  const close = useCallback(() => { dialogRef.current?.close(); onClose(); }, [onClose]);

  const createDraft = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setError("");
      try {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            applicationId,
            ...(amount.trim() ? { salaryAmount: parseInt(amount, 10) } : {}),
            salaryCurrency: currency.trim().toUpperCase() || "USD",
            salaryPeriod: period,
            ...(startDate ? { startDate: new Date(startDate).toISOString() } : {}),
            ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
            ...(terms.trim() ? { terms: terms.trim() } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || "Couldn't create the offer."); return; }
        setAmount(""); setStartDate(""); setExpiresAt(""); setTerms("");
        await load();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, base, csrf, applicationId, amount, currency, period, startDate, expiresAt, terms, load],
  );

  const act = useCallback(
    async (id: string, action: OfferAction) => {
      if (busyId) return;
      if (action === "rescind" && !confirm("Discard / rescind this offer? This can't be undone.")) return;
      setBusyId(id);
      setError("");
      try {
        const res = await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ id, action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || "Couldn't update the offer."); return; }
        await load();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, base, csrf, load],
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      aria-labelledby={headingId}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex open:items-center open:justify-center"
    >
      <div className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Offers</h2>
            <p className="mt-0.5 text-sm text-gray-600">{candidateName}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close offers"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-blue-600"><Spinner /><span className="sr-only">Loading…</span></div>
          ) : error && offers.length === 0 ? (
            <p role="alert" className="py-6 text-center text-sm text-gray-600">{error}</p>
          ) : (
            <>
              {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

              {offers.length === 0 ? (
                <p className="mb-5 text-sm text-gray-500">No offers yet.</p>
              ) : (
                <ul className="mb-5 space-y-3">
                  {offers.map((o) => {
                    const actions = actionsFor(o.status).filter((a) => !a.approveGated || canApprove);
                    return (
                      <li key={o.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{fmtComp(o)}</p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {fmtDate(o.startDate) ? `Starts ${fmtDate(o.startDate)}` : "No start date"}
                              {o.expiresAt ? ` · Expires ${fmtDate(o.expiresAt)}` : ""}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[o.status]}`}>
                            {STATUS_LABEL[o.status]}
                          </span>
                        </div>
                        {o.terms && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{o.terms}</p>}
                        {o.status === "pending_approval" && !canApprove && (
                          <p className="mt-2 text-xs text-amber-700">Awaiting approval from a hiring manager.</p>
                        )}
                        {actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            {actions.map((a) => (
                              <button
                                key={a.action}
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => act(o.id, a.action)}
                                className={`font-medium hover:underline disabled:opacity-50 ${a.danger ? "text-red-600" : "text-blue-600"}`}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Create draft */}
              <form onSubmit={createDraft} className="space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900">New offer (draft)</p>
                <div className="flex gap-2">
                  <label className="flex-1 text-xs font-medium text-gray-600">Amount
                    <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="145000"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                  </label>
                  <label className="w-20 text-xs font-medium text-gray-600">Currency
                    <input type="text" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm uppercase" />
                  </label>
                  <label className="w-24 text-xs font-medium text-gray-600">Period
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
                      {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 text-xs font-medium text-gray-600">Start date
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="flex-1 text-xs font-medium text-gray-600">Expires
                    <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                </div>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} maxLength={10_000}
                  placeholder="Additional terms (candidate-visible, optional)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                <Button type="submit" size="sm" loading={saving} disabled={saving}>Create draft</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
