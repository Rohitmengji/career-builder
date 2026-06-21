"use client";

/*
 * ResumeDialog — recruiter view of an applicant's extracted résumé + AI-structured
 * profile (skills/titles/experience/education). Read-only. Under Blind Hiring the
 * raw text + summary are withheld server-side; the structured skills still show.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Spinner, XIcon } from "@/components/ui";

interface Education {
  credential: string;
  field?: string;
  institution?: string;
}
interface Insights {
  available: boolean;
  summary: string;
  skills: string[];
  titles: string[];
  totalYearsExperience: number | null;
  education: Education[];
}
interface ResumeData {
  available: boolean;
  blindHiring: boolean;
  resumeText: string | null;
  insights: Insights | null;
}

interface Props {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
}

export default function ResumeDialog({ applicationId, candidateName, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResumeData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}/resume`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setError("Résumé insights aren't enabled for this workspace.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't load the résumé. Please try again.");
        return;
      }
      setData((await res.json()) as ResumeData);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void load();
  }, [load]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const insights = data?.insights;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      aria-labelledby={headingId}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex open:items-center open:justify-center"
    >
      <div className="mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Résumé</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              {candidateName}
              {data?.blindHiring && " · blind hiring on — skills only"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close résumé"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-blue-600">
              <Spinner /><span className="sr-only">Loading résumé…</span>
            </div>
          ) : error ? (
            <p role="alert" className="py-8 text-center text-sm text-gray-600">{error}</p>
          ) : !data?.available ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No résumé text was extracted for this applicant (it may have been submitted as a link or
              an unsupported file type).
            </p>
          ) : (
            <div className="space-y-6">
              {insights && (insights.skills.length > 0 || insights.titles.length > 0 || insights.totalYearsExperience !== null) && (
                <div className="space-y-4 rounded-xl border border-gray-200/80 bg-gray-50 p-4">
                  {insights.summary && (
                    <p className="text-sm leading-relaxed text-gray-700">{insights.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {insights.totalYearsExperience !== null && (
                      <span className="text-gray-700">
                        <span className="font-semibold text-gray-900">{insights.totalYearsExperience}</span> yrs experience
                      </span>
                    )}
                    {insights.titles.length > 0 && (
                      <span className="text-gray-700">{insights.titles.join(" · ")}</span>
                    )}
                  </div>
                  {insights.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {insights.skills.map((s, i) => (
                        <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{s}</span>
                      ))}
                    </div>
                  )}
                  {insights.education.length > 0 && (
                    <ul className="text-sm text-gray-700">
                      {insights.education.map((e, i) => (
                        <li key={i}>
                          {e.credential}
                          {e.field ? `, ${e.field}` : ""}
                          {e.institution ? ` — ${e.institution}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {data.resumeText ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Extracted text</h3>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700">
                    {data.resumeText}
                  </pre>
                </div>
              ) : data.blindHiring ? (
                <p className="text-xs text-gray-500">
                  Full résumé text is hidden while blind hiring is on. Review the skills and experience above.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 p-4">
          <Button type="button" size="sm" variant="secondary" onClick={close}>Close</Button>
        </div>
      </div>
    </dialog>
  );
}
