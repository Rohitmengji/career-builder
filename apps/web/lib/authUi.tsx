"use client";

/*
 * Shared UI for the candidate auth pages (login / register / reset / forgot).
 * These delegate to the shared design-system primitives in "@/components/ui"
 * so every auth surface stays consistent, accessible (WCAG-AA) and responsive.
 * Exported names/signatures are preserved so the pages keep working.
 */

import * as React from "react";
import Link from "next/link";
import {
  Field as UiField,
  Alert,
  Button,
} from "@/components/ui";

/** A small brand mark used at the top of the auth card. */
function BrandMark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg text-lg font-semibold tracking-tight text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white"
      >
        C
      </span>
      Careers
    </Link>
  );
}

/** Centered, polished auth shell. Owns the <main> landmark + page heading. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandMark />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900 text-balance sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * Controlled text Field — wraps the shared Field primitive but keeps the
 * value/onChange(string) signature the auth pages were written against.
 */
export function Field({
  label,
  type = "text",
  value,
  onChange,
  required,
  autoComplete,
  placeholder,
  ...rest
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "required">) {
  return (
    <UiField
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      autoComplete={autoComplete}
      placeholder={placeholder}
      {...rest}
    />
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return <Alert tone="error">{children}</Alert>;
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return <Alert tone="success">{children}</Alert>;
}

export function SubmitButton({
  submitting,
  children,
}: {
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" size="lg" fullWidth loading={submitting}>
      {submitting ? "Please wait…" : children}
    </Button>
  );
}
