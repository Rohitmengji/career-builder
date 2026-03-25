/**
 * Client-side analytics tracker for the career site.
 *
 * Privacy-safe, cookie-free. Uses a random UUID stored in sessionStorage
 * as a session ID — never tied to any personal identity.
 *
 * Events are fired-and-forgotten (no retry, acceptable for analytics).
 */

const ENDPOINT = "/api/analytics/events";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("_cb_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("_cb_sid", sid);
  }
  return sid;
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  if (p.get("utm_source")) result.utmSource = p.get("utm_source")!;
  if (p.get("utm_medium")) result.utmMedium = p.get("utm_medium")!;
  if (p.get("utm_campaign")) result.utmCampaign = p.get("utm_campaign")!;
  return result;
}

function getReferrer(): string {
  if (typeof window === "undefined") return "";
  return document.referrer || "";
}

export interface AnalyticsPayload {
  type: string;
  jobId?: string;
  pageSlug?: string;
  metadata?: Record<string, unknown>;
}

export function trackEvent(payload: AnalyticsPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    sessionId: getSessionId(),
    referrer: getReferrer(),
    ...getUtmParams(),
  });

  // Use sendBeacon when available (survives page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(ENDPOINT, blob);
  } else {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow analytics errors */
    });
  }
}

export function trackPageView(pageSlug?: string): void {
  trackEvent({ type: "page_view", pageSlug });
}

export function trackJobListView(): void {
  trackEvent({ type: "job_list_view", pageSlug: "jobs" });
}

export function trackJobView(jobId: string): void {
  trackEvent({ type: "job_view", jobId });
}

export function trackApplyStart(jobId: string): void {
  trackEvent({ type: "apply_start", jobId });
}

export function trackApplyComplete(jobId: string): void {
  trackEvent({ type: "apply_complete", jobId });
}

export function trackSearch(query: string): void {
  trackEvent({ type: "search", metadata: { query } });
}
