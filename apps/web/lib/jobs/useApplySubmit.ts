"use client";

/*
 * useApplySubmit — the React state machine around the shared apply pipeline
 * (applyForm.ts). Both apply UIs use it so submission behavior is identical:
 *
 *   - re-entry guard: a second submit while one is in flight is ignored
 *     (defends against double-click / double-Enter / programmatic resubmit)
 *   - per-attempt idempotency key so a retry/refresh can't create a duplicate
 *   - abort on unmount (no state updates after the component is gone)
 *   - inline field errors + the first invalid field for focus management
 *
 * The UI owns its own form values + layout; this hook owns the robust
 * submission/validation/state, returning everything the UI needs to render.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  submitApplication,
  validateApplyForm,
  type ApplyFormValues,
  type ApplyFieldErrors,
  type ApplyField,
} from "./applyForm";

export type ApplyStatus = "idle" | "submitting" | "success" | "error";

function makeIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `apply_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export interface UseApplySubmitOptions {
  /** When true, a resume URL satisfies the resume requirement (modal). */
  allowResumeUrl?: boolean;
}

export interface SubmitOutcome {
  ok: boolean;
  /** Present when validation failed — caller moves focus here. */
  firstErrorField?: ApplyField;
}

export function useApplySubmit(options: UseApplySubmitOptions = {}) {
  const { allowResumeUrl = false } = options;

  const [status, setStatus] = useState<ApplyStatus>("idle");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApplyFieldErrors>({});
  const [applicationId, setApplicationId] = useState("");

  const inFlight = useRef(false);
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const idempotencyKey = useRef<string>(makeIdempotencyKey());

  // Abort an in-flight request if the component unmounts, and stop updating
  // state afterwards.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const clearFieldError = useCallback((field: ApplyField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setFormError("");
    setFieldErrors({});
    setApplicationId("");
    idempotencyKey.current = makeIdempotencyKey();
    inFlight.current = false;
  }, []);

  const submit = useCallback(
    async (jobId: string, values: ApplyFormValues, resumeFile: File | null): Promise<SubmitOutcome> => {
      // Re-entry guard — the disabled button/fieldset is visual only.
      if (inFlight.current) return { ok: false };

      const validation = validateApplyForm(values, resumeFile, { allowResumeUrl });
      if (!validation.valid) {
        setFieldErrors(validation.errors);
        setFormError("");
        setStatus("error");
        return { ok: false, firstErrorField: validation.firstErrorField };
      }

      setFieldErrors({});
      setFormError("");
      inFlight.current = true;
      setStatus("submitting");

      const controller = new AbortController();
      abortRef.current = controller;

      const result = await submitApplication(values, resumeFile, jobId, {
        signal: controller.signal,
        idempotencyKey: idempotencyKey.current,
      });

      abortRef.current = null;
      inFlight.current = false;
      if (!mounted.current) return { ok: result.ok };

      if (result.ok) {
        setStatus("success");
        setApplicationId(result.applicationId);
        return { ok: true };
      }
      setStatus("error");
      setFormError(result.message);
      return { ok: false };
    },
    [allowResumeUrl],
  );

  return {
    status,
    formError,
    fieldErrors,
    applicationId,
    submit,
    reset,
    clearFieldError,
    setFieldErrors,
    isSubmitting: status === "submitting",
  };
}
