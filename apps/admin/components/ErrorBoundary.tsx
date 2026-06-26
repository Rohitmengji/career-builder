/*
 * ErrorBoundary — top-level React error boundary for the admin app.
 *
 * WHAT: Wraps a subtree and, when a render/lifecycle error bubbles up from any
 * descendant, swaps the broken UI for a recovery panel ("Try Again" / "Reload")
 * instead of letting React unmount the whole tree into a blank screen.
 *
 * WHY: Recruiter workflows are long-lived and stateful; an uncaught render error
 * shouldn't dump the user to a white page with no path forward. A boundary keeps
 * the app shell alive and gives a way to recover or reload.
 *
 * HOW: Error boundaries are a class-only React feature — there is no hooks
 * equivalent for getDerivedStateFromError / componentDidCatch, so this must stay
 * a class component. getDerivedStateFromError flips state to render the fallback;
 * componentDidCatch logs the error. Callers can pass a custom `fallback`; absent
 * that, the default panel renders. Note: it catches errors thrown during render,
 * not async/event-handler errors (those never reach a boundary). Place high in the
 * tree (layout) to cover the most surface.
 */
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Global error boundary — catches unhandled React errors.
 * Prevents blank screen by showing a recovery UI.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log-only side effect; the actual fallback render is driven by state set in
    // getDerivedStateFromError. componentStack gives the React tree path, which a
    // raw JS stack does not.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  // Clears the error state to re-attempt rendering the original children. This
  // only recovers transient errors (e.g. a fixed-since fetch) — a deterministic
  // render bug will simply re-throw and trip the boundary again.
  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-500 mb-6 text-sm">
              An unexpected error occurred. Your data is safe.
            </p>
            {process.env.NODE_ENV !== "production" && this.state.error && (
              <pre className="text-left text-xs bg-red-50 text-red-700 p-3 rounded mb-4 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
