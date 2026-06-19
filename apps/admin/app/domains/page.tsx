"use client";

/*
 * Custom Domains — tenant settings page.
 * Add a domain, follow DNS instructions, verify ownership, set primary, remove.
 * Plan-gated (Pro/Enterprise) with an upsell for lower plans.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { csrfHeaders } from "@/lib/csrf";
import {
  Container,
  Card,
  Button,
  ButtonLink,
  Field,
  Badge,
  Alert,
  Skeleton,
  ArrowLeftIcon,
} from "@/components/ui";

interface DomainRow {
  id: string;
  hostname: string;
  status: "pending" | "verified" | "active" | "failed";
  verifyToken: string;
  isPrimary: boolean;
  createdAt: string;
  verifiedAt: string | null;
}

interface DomainsResponse {
  domains: DomainRow[];
  cnameTarget: string;
  planAllowed: boolean;
  plan: string;
}

const STATUS_TONE = {
  pending: "warning",
  verified: "info",
  active: "success",
  failed: "danger",
} as const;

const STATUS_LABEL = {
  pending: "Pending verification",
  verified: "Verified",
  active: "Active",
  failed: "Verification failed",
} as const;

export default function DomainsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuthGuard();

  const [data, setData] = useState<DomainsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hostname, setHostname] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/domains", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setLoadError("Unable to load domains right now. Please try again in a few minutes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const addDomain = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (adding) return;
      setAddError("");
      setNotice("");
      const value = hostname.trim();
      if (!value) {
        setAddError("Enter a domain, e.g. careers.yourcompany.com.");
        return;
      }
      setAdding(true);
      try {
        const res = await fetch("/api/domains", {
          method: "POST",
          headers: csrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ hostname: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(body.error || "Couldn't add that domain. Please try again.");
          return;
        }
        setHostname("");
        setNotice("Domain added. Add the DNS records below, then click Verify.");
        await load();
      } catch {
        setAddError("Network error. Please check your connection and try again.");
      } finally {
        setAdding(false);
      }
    },
    [hostname, adding, load],
  );

  const act = useCallback(
    async (id: string, action: "verify" | "set-primary") => {
      setBusyId(id);
      setNotice("");
      try {
        const res = await fetch("/api/domains", {
          method: "PATCH",
          headers: csrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ id, action }),
        });
        const body = await res.json().catch(() => ({}));
        if (action === "verify") {
          setNotice(
            body.success
              ? "Domain verified and active. 🎉"
              : body.error || "Verification didn't succeed yet.",
          );
        } else if (!res.ok) {
          setNotice(body.error || "Couldn't update the domain.");
        }
        await load();
      } catch {
        setNotice("Network error. Please try again.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string, host: string) => {
      if (!window.confirm(`Remove ${host}? Its career site will stop resolving on this domain.`)) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/domains?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: csrfHeaders(),
        });
        if (res.ok) await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (authLoading || loading) {
    return (
      <Container className="max-w-3xl py-10">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </Container>
    );
  }

  const planAllowed = data?.planAllowed ?? false;
  const cnameTarget = data?.cnameTarget ?? "";
  const domains = data?.domains ?? [];

  return (
    <Container className="max-w-3xl py-10">
      <button
        type="button"
        onClick={() => router.push("/settings")}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to settings
      </button>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Custom domains</h1>
      <p className="mt-1 text-sm text-gray-600">
        Serve your career site on your own domain (e.g. <code className="rounded bg-gray-100 px-1">careers.yourcompany.com</code>).
      </p>

      {loadError && <Alert tone="error" className="mt-6">{loadError}</Alert>}
      {notice && <Alert tone="info" className="mt-6">{notice}</Alert>}

      {!planAllowed ? (
        <Card className="mt-6 p-6">
          <h2 className="text-base font-semibold text-gray-900">Available on Pro &amp; Enterprise</h2>
          <p className="mt-1 text-sm text-gray-600">
            Your current plan ({data?.plan ?? "free"}) doesn&apos;t include custom domains. Upgrade to connect your own domain.
          </p>
          <div className="mt-4">
            <ButtonLink href="/settings">View plans</ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          {/* Add domain */}
          <Card className="mt-6 p-6">
            <form onSubmit={addDomain} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
              <div className="flex-1">
                <Field
                  label="Add a domain"
                  name="hostname"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={hostname}
                  onChange={(e) => {
                    setHostname(e.target.value);
                    if (addError) setAddError("");
                  }}
                  error={addError}
                  placeholder="careers.yourcompany.com"
                />
              </div>
              <Button type="submit" loading={adding} disabled={adding} className="shrink-0">
                Add domain
              </Button>
            </form>
          </Card>

          {/* Domain list */}
          {domains.length === 0 ? (
            <Card className="mt-6 p-8 text-center">
              <p className="text-sm text-gray-600">No custom domains yet. Add one above to get started.</p>
            </Card>
          ) : (
            <ul className="mt-6 space-y-4">
              {domains.map((d) => (
                <li key={d.id}>
                  <DomainCard
                    domain={d}
                    cnameTarget={cnameTarget}
                    busy={busyId === d.id}
                    onVerify={() => act(d.id, "verify")}
                    onSetPrimary={() => act(d.id, "set-primary")}
                    onRemove={() => remove(d.id, d.hostname)}
                  />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-xs text-gray-500">
            After verification, SSL is provisioned automatically on managed hosting (Vercel Domains). For
            self-hosting, point the CNAME at your reverse proxy and issue a certificate for the verified host.
          </p>
        </>
      )}
    </Container>
  );
}

function DomainCard({
  domain,
  cnameTarget,
  busy,
  onVerify,
  onSetPrimary,
  onRemove,
}: {
  domain: DomainRow;
  cnameTarget: string;
  busy: boolean;
  onVerify: () => void;
  onSetPrimary: () => void;
  onRemove: () => void;
}) {
  const txtHost = `_cb-verify.${domain.hostname}`;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{domain.hostname}</span>
          {domain.isPrimary && <Badge tone="brand">Primary</Badge>}
          <Badge tone={STATUS_TONE[domain.status]}>{STATUS_LABEL[domain.status]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {domain.status !== "active" && (
            <Button size="sm" onClick={onVerify} loading={busy} disabled={busy}>
              Verify
            </Button>
          )}
          {domain.status === "active" && !domain.isPrimary && (
            <Button size="sm" variant="secondary" onClick={onSetPrimary} disabled={busy}>
              Set primary
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
            Remove
          </Button>
        </div>
      </div>

      {domain.status !== "active" && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium text-gray-700">Add these DNS records at your registrar:</p>
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="pr-4 font-medium">Type</th>
                <th className="pr-4 font-medium">Host / Name</th>
                <th className="font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="font-mono text-gray-800">
              <tr>
                <td className="pr-4 py-1">CNAME</td>
                <td className="pr-4 py-1 break-all">{domain.hostname}</td>
                <td className="py-1 break-all">{cnameTarget}</td>
              </tr>
              <tr>
                <td className="pr-4 py-1">TXT</td>
                <td className="pr-4 py-1 break-all">{txtHost}</td>
                <td className="py-1 break-all">{domain.verifyToken}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">DNS changes can take a few minutes to propagate before Verify succeeds.</p>
        </div>
      )}
    </Card>
  );
}
