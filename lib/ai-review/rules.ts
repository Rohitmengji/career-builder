/**
 * AI Code Reviewer — Review Rules
 *
 * Rule-based code review system that enforces the Career Builder architecture
 * and coding standards. Each rule checks for specific patterns that violate
 * the system's non-negotiable rules.
 *
 * Rules are organized by category:
 *   1. Architecture — schema changes, editor flow violations
 *   2. State Management — direct mutation, duplicated state
 *   3. AI Safety — unvalidated AI output
 *   4. Security — missing validation, exposed secrets
 *   5. Performance — unnecessary re-renders, missing memoization
 *   6. Error Handling — silent failures, missing fallbacks
 *   7. Multi-Tenant — missing tenantId, shared global state
 *   8. API Contract — inconsistent responses, missing validation
 *   9. Best Practices — general code quality
 */

import type { ReviewRule, ReviewComment, FileChangeContext, ReviewSeverity } from "./types";
import { matchesPattern } from "./diff-parser";

let commentCounter = 0;
function nextCommentId(): string {
  return `review-${++commentCounter}`;
}

export function resetCommentCounter(): void {
  commentCounter = 0;
}

/* ================================================================== */
/*  Helper: Check additions for a pattern                              */
/* ================================================================== */

function checkAdditionsForPattern(
  ctx: FileChangeContext,
  pattern: RegExp,
  rule: string,
  severity: ReviewSeverity,
  title: string,
  issue: string,
  impact: string,
  suggestion: string,
): ReviewComment[] {
  const comments: ReviewComment[] = [];
  for (const line of ctx.additions) {
    if (pattern.test(line.content)) {
      comments.push({
        id: nextCommentId(),
        file: ctx.file,
        line: line.lineNumber,
        severity,
        rule,
        title,
        issue,
        impact,
        suggestion,
      });
    }
  }
  return comments;
}

/* ================================================================== */
/*  1. Architecture Rules                                              */
/* ================================================================== */

const architectureRules: ReviewRule[] = [
  {
    id: "arch-schema-change",
    category: "architecture",
    name: "Block Schema Modification",
    severity: "critical",
    filePatterns: ["**/blockSchemas.ts"],
    check: (ctx) => {
      if (ctx.deletions.length === 0) return [];
      // Schema changes need to be coordinated across editor, renderer, and AI validator
      const hasFieldRemoval = ctx.deletions.some((d) =>
        /name:\s*["']/.test(d.content) || /fields:\s*\[/.test(d.content),
      );
      if (!hasFieldRemoval) return [];

      return [{
        id: nextCommentId(),
        file: ctx.file,
        severity: "critical",
        rule: "arch-schema-change",
        title: "⚠️ Block Schema Breaking Change Detected",
        issue: "Modifying block schema fields is a breaking change that affects the editor, renderer, and AI validator.",
        impact: "Can break existing pages, editor, and AI generation. Data stored in existing pages may become invalid.",
        suggestion: "Ensure you update ALL of: 1) blockSchemas.ts 2) editor/blocks/ registration 3) renderer.tsx 4) ai/validator.ts. Maintain backward compatibility by keeping old field names.",
      }];
    },
  },
  {
    id: "arch-direct-prisma",
    category: "architecture",
    name: "Direct Prisma Call",
    severity: "critical",
    filePatterns: ["**/app/**", "**/components/**"],
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /prisma\.\w+\.(find|create|update|delete|upsert|count|aggregate)/,
      "arch-direct-prisma",
      "critical",
      "❗ Direct Prisma Call in App Layer",
      "Direct Prisma calls in components/routes bypass the repository layer.",
      "Bypasses tenantId enforcement, retry logic (withDbRetry), and centralized data access patterns.",
      "Use the repository layer from @career-builder/database instead. Example: import { pageRepo } from '@career-builder/database'",
    ),
  },
  {
    id: "arch-editor-dom-mutation",
    category: "architecture",
    name: "Direct DOM Mutation in Editor",
    severity: "critical",
    filePatterns: ["**/editor/**"],
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /document\.(get|query)|innerHTML|\.style\./,
      "arch-editor-dom-mutation",
      "critical",
      "❗ Direct DOM Mutation in Editor",
      "Direct DOM manipulation bypasses the GrapesJS editor pipeline (Sidebar → Store → Renderer).",
      "Can cause editor state to become out of sync, leading to data loss or rendering bugs.",
      "Use the GrapesJS component model API instead. All updates must go through the editor's component model.",
    ),
  },
  {
    id: "arch-style-jsx",
    category: "architecture",
    name: "Style JSX Usage",
    severity: "warning",
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /style\s+jsx/,
      "arch-style-jsx",
      "warning",
      "⚠️ Style JSX Not Supported",
      "style jsx is incompatible with Turbopack + React Compiler.",
      "Styles won't apply correctly in production. May cause build failures.",
      "Use Tailwind CSS classes or CSS keyframes in globals.css instead.",
    ),
  },
];

/* ================================================================== */
/*  2. State Management Rules                                          */
/* ================================================================== */

const stateRules: ReviewRule[] = [
  {
    id: "state-direct-mutation",
    category: "state-management",
    name: "Direct State Mutation",
    severity: "critical",
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        // Detect push/splice/sort on state arrays, or direct property assignment on state
        if (/\.push\(|\.splice\(|\.sort\(|\.reverse\(/.test(line.content) &&
            /state|store|blocks|items|data/.test(line.content)) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "critical",
            rule: "state-direct-mutation",
            title: "❗ Direct State Mutation Detected",
            issue: "Direct mutation of state arrays (push/splice/sort) violates immutability rules.",
            impact: "React won't detect the change, causing stale UI. Can corrupt editor state.",
            suggestion: "Use immutable patterns: [...array, newItem] instead of push(), array.filter() instead of splice(), [...array].sort() for sorting.",
          });
        }
      }
      return comments;
    },
  },
  {
    id: "state-duplicated",
    category: "state-management",
    name: "Duplicated State",
    severity: "warning",
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      // Detect useState that mirrors props or store values
      for (const line of ctx.additions) {
        if (/useState\(props\.|useState\(store\.|useState\(.*\.data/.test(line.content)) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "warning",
            rule: "state-duplicated",
            title: "⚠️ Potentially Duplicated State",
            issue: "useState initialized from props/store may create duplicated state.",
            impact: "State can become out of sync with the source of truth, causing bugs.",
            suggestion: "Use the centralized store directly. Derive values from the single source of truth instead of copying into local state.",
          });
        }
      }
      return comments;
    },
  },
];

/* ================================================================== */
/*  3. AI Safety Rules                                                 */
/* ================================================================== */

const aiSafetyRules: ReviewRule[] = [
  {
    id: "ai-unvalidated-output",
    category: "ai-safety",
    name: "Unvalidated AI Output",
    severity: "critical",
    filePatterns: ["**/ai/**", "**/api/ai/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      // Detect applying AI output without validation
      const hasAiCall = ctx.additions.some((l) =>
        /openai|completion|responses|generateContent/.test(l.content),
      );
      const hasValidation = ctx.additions.some((l) =>
        /validateAiOutput|validatePageOutput|validateJobOutput|blockSchemas/.test(l.content),
      );

      if (hasAiCall && !hasValidation) {
        comments.push({
          id: nextCommentId(),
          file: ctx.file,
          severity: "critical",
          rule: "ai-unvalidated-output",
          title: "❗ AI Output Applied Without Validation",
          issue: "AI-generated content is used without validating against blockSchemas.",
          impact: "Malformed AI output can crash the editor, corrupt page data, or produce invalid blocks.",
          suggestion: "Always validate AI output: parseAiJson() → validateAiOutput() / validatePageOutput() → apply or fallback. See lib/ai/validator.ts.",
        });
      }

      return comments;
    },
  },
  {
    id: "ai-missing-fallback",
    category: "ai-safety",
    name: "Missing AI Fallback",
    severity: "warning",
    filePatterns: ["**/ai/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      const hasAiCall = ctx.additions.some((l) =>
        /openai|completion|responses/.test(l.content),
      );
      const hasFallback = ctx.additions.some((l) =>
        /fallback|default|getDefaultProps|catch/.test(l.content),
      );

      if (hasAiCall && !hasFallback) {
        comments.push({
          id: nextCommentId(),
          file: ctx.file,
          severity: "warning",
          rule: "ai-missing-fallback",
          title: "⚠️ AI Call Without Fallback",
          issue: "AI API call lacks fallback behavior for failures.",
          impact: "If the AI call fails, the user gets no result and no explanation.",
          suggestion: "Add try/catch with meaningful fallback. Refund credits on failure. Show user-friendly error message.",
        });
      }

      return comments;
    },
  },
  {
    id: "ai-credit-skip",
    category: "ai-safety",
    name: "AI Credit Not Pre-Deducted",
    severity: "warning",
    filePatterns: ["**/ai/**", "**/api/ai/**"],
    check: (ctx) => {
      const hasAiCall = ctx.additions.some((l) =>
        /openai|completion|responses/.test(l.content),
      );
      const hasCreditCheck = ctx.additions.some((l) =>
        /credit|decrement|subscription|canUseAi/.test(l.content),
      );

      if (hasAiCall && !hasCreditCheck) {
        return [{
          id: nextCommentId(),
          file: ctx.file,
          severity: "warning",
          rule: "ai-credit-skip",
          title: "⚠️ AI Call Without Credit Check",
          issue: "AI API call doesn't check/deduct user credits.",
          impact: "Users could use AI features beyond their subscription limits.",
          suggestion: "Pre-deduct credits before API call, refund on failure. Check subscription.canUseAi() first.",
        }];
      }
      return [];
    },
  },
];

/* ================================================================== */
/*  4. Security Rules                                                  */
/* ================================================================== */

const securityRules: ReviewRule[] = [
  {
    id: "sec-exposed-secret",
    category: "security",
    name: "Exposed Secret in Client Code",
    severity: "critical",
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        if (/NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)/i.test(line.content) &&
            !line.content.trimStart().startsWith("//") &&
            !line.content.trimStart().startsWith("*")) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "critical",
            rule: "sec-exposed-secret",
            title: "🔥 Secret Exposed to Client Bundle",
            issue: "NEXT_PUBLIC_ prefixed env var contains a secret (KEY/SECRET/TOKEN).",
            impact: "Secret will be included in the client-side JavaScript bundle, visible to anyone.",
            suggestion: "Remove NEXT_PUBLIC_ prefix. Access this value only in server-side code (API routes, Server Components).",
          });
        }
      }
      return comments;
    },
  },
  {
    id: "sec-missing-validation",
    category: "security",
    name: "Missing Input Validation",
    severity: "critical",
    filePatterns: ["**/api/**"],
    check: (ctx) => {
      // Check if API route handles POST/PUT/DELETE without Zod validation
      const hasMutation = ctx.additions.some((l) =>
        /POST|PUT|DELETE|PATCH/.test(l.content) && /export/.test(l.content),
      );
      const hasValidation = ctx.additions.some((l) =>
        /safeParse|zodSchema|z\.object|validate|schema\.parse/.test(l.content),
      );

      if (hasMutation && !hasValidation) {
        return [{
          id: nextCommentId(),
          file: ctx.file,
          severity: "critical",
          rule: "sec-missing-validation",
          title: "❗ API Mutation Without Input Validation",
          issue: "API route handles mutations without Zod schema validation.",
          impact: "Unvalidated input can cause injection attacks, data corruption, or crashes.",
          suggestion: "Add Zod schema validation: import { safeParse } from '@career-builder/security/validate'. Validate request body before processing.",
        }];
      }
      return [];
    },
  },
  {
    id: "sec-missing-csrf",
    category: "security",
    name: "Missing CSRF Validation",
    severity: "warning",
    filePatterns: ["**/api/**"],
    check: (ctx) => {
      const hasMutation = ctx.additions.some((l) =>
        /POST|PUT|DELETE|PATCH/.test(l.content) && /export/.test(l.content),
      );
      const hasCsrf = ctx.additions.some((l) =>
        /validateCsrf|csrf/.test(l.content),
      );

      if (hasMutation && !hasCsrf) {
        return [{
          id: nextCommentId(),
          file: ctx.file,
          severity: "warning",
          rule: "sec-missing-csrf",
          title: "⚠️ API Mutation Without CSRF Validation",
          issue: "Mutation endpoint doesn't validate CSRF token.",
          impact: "Vulnerable to cross-site request forgery attacks.",
          suggestion: "Add validateCsrf(req) check at the start of mutation handlers.",
        }];
      }
      return [];
    },
  },
  {
    id: "sec-missing-auth",
    category: "security",
    name: "Missing Auth Check",
    severity: "critical",
    filePatterns: ["**/api/**"],
    check: (ctx) => {
      const hasHandler = ctx.additions.some((l) =>
        /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(l.content),
      );
      const hasAuth = ctx.additions.some((l) =>
        /getSession|getSessionReadOnly|session\.userId|session\.role/.test(l.content),
      );

      if (hasHandler && !hasAuth) {
        return [{
          id: nextCommentId(),
          file: ctx.file,
          severity: "critical",
          rule: "sec-missing-auth",
          title: "❗ API Route Without Auth Check",
          issue: "API route handler doesn't check session/authentication.",
          impact: "Route is accessible without authentication, potentially exposing sensitive data or actions.",
          suggestion: "Add session check: getSessionReadOnly() for GET, getSession() for mutations. Check session.role for authorization.",
        }];
      }
      return [];
    },
  },
  {
    id: "sec-hardcoded-url",
    category: "security",
    name: "Hardcoded URL",
    severity: "warning",
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /["'`](https?:\/\/localhost|http:\/\/127\.0\.0\.1|https?:\/\/[a-z]+\.(vercel|netlify)\.app)["'`]/,
      "sec-hardcoded-url",
      "warning",
      "⚠️ Hardcoded URL Detected",
      "Hardcoded URL found — this will break in different environments.",
      "URL won't work in production/preview environments. Violates 'No Hardcoding' rule.",
      "Use getAppUrl(), getSiteUrl(), or APP_URL from env helpers instead of hardcoded URLs.",
    ),
  },
];

/* ================================================================== */
/*  5. Performance Rules                                               */
/* ================================================================== */

const performanceRules: ReviewRule[] = [
  {
    id: "perf-full-rerender",
    category: "performance",
    name: "Full Store Subscription",
    severity: "warning",
    filePatterns: ["**/editor/**", "**/components/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        // Detect subscribing to the entire store instead of specific fields
        if (/useStore\(\)/.test(line.content) && !/useStore\(\s*\(/.test(line.content)) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "warning",
            rule: "perf-full-rerender",
            title: "🔥 Full Store Subscription",
            issue: "Subscribing to the entire store causes re-renders on any store change.",
            impact: "Performance degradation, especially in the editor page which is highly sensitive to re-renders.",
            suggestion: "Use selective subscriptions: useStore((s) => s.specificField) to subscribe only to the fields you need.",
          });
        }
      }
      return comments;
    },
  },
  {
    id: "perf-missing-memo",
    category: "performance",
    name: "Missing Memoization in Editor",
    severity: "suggestion",
    filePatterns: ["**/editor/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      // Check for components in editor that aren't wrapped in React.memo
      const hasComponent = ctx.additions.some((l) =>
        /export\s+(default\s+)?function\s+\w+/.test(l.content) ||
        /export\s+const\s+\w+\s*[=:]/.test(l.content),
      );
      const hasMemo = ctx.additions.some((l) =>
        /React\.memo|memo\(|useMemo|useCallback/.test(l.content),
      );

      if (hasComponent && !hasMemo && ctx.file.includes("editor")) {
        comments.push({
          id: nextCommentId(),
          file: ctx.file,
          severity: "suggestion",
          rule: "perf-missing-memo",
          title: "💡 Consider Memoization for Editor Component",
          issue: "Editor component doesn't use React.memo, useMemo, or useCallback.",
          impact: "The editor page is performance-sensitive. Unmemoized components may cause unnecessary re-renders.",
          suggestion: "Wrap with React.memo() and use useMemo/useCallback for expensive computations and callbacks.",
        });
      }
      return comments;
    },
  },
];

/* ================================================================== */
/*  6. Error Handling Rules                                            */
/* ================================================================== */

const errorHandlingRules: ReviewRule[] = [
  {
    id: "err-silent-catch",
    category: "error-handling",
    name: "Silent Error Catch",
    severity: "warning",
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (let i = 0; i < ctx.additions.length; i++) {
        const line = ctx.additions[i];
        if (/catch\s*\(/.test(line.content)) {
          // Look ahead for console.error or log.error in the next few lines
          const nextLines = ctx.additions
            .slice(i + 1, i + 6)
            .map((l) => l.content);
          const hasLogging = nextLines.some((l) =>
            /console\.(error|warn|log)|log\.(error|warn|info)|logger/.test(l),
          );

          if (!hasLogging) {
            comments.push({
              id: nextCommentId(),
              file: ctx.file,
              line: line.lineNumber,
              severity: "warning",
              rule: "err-silent-catch",
              title: "⚠️ Silent Error Catch",
              issue: "Catch block doesn't log the error.",
              impact: "Silent failures make debugging extremely difficult. Errors will be swallowed invisibly.",
              suggestion: "Add error logging: console.error('context:', error) or use @career-builder/observability/logger.",
            });
          }
        }
      }
      return comments;
    },
  },
  {
    id: "err-missing-fallback-ui",
    category: "error-handling",
    name: "Missing Fallback for Block Props",
    severity: "suggestion",
    filePatterns: ["**/renderer.tsx", "**/blocks/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        // Detect accessing block props without fallback
        if (/props\.\w+(?!\?)/.test(line.content) &&
            !/props\.\w+\s*\?\?/.test(line.content) &&
            !/props\.\w+\s*\|\|/.test(line.content) &&
            !line.content.includes("typeof") &&
            !line.content.trim().startsWith("//")) {
          // Only flag if it looks like it's being rendered
          if (/return|<|className|href|src/.test(line.content)) {
            comments.push({
              id: nextCommentId(),
              file: ctx.file,
              line: line.lineNumber,
              severity: "suggestion",
              rule: "err-missing-fallback-ui",
              title: "💡 Block Prop Without Fallback",
              issue: "Block prop is accessed without a fallback/default value.",
              impact: "If the prop is undefined (missing from block data), the component may crash.",
              suggestion: "Add fallback: {props.title ?? 'Default Title'} or use optional chaining with nullish coalescing.",
            });
            break; // One comment per file is enough
          }
        }
      }
      return comments;
    },
  },
];

/* ================================================================== */
/*  7. Multi-Tenant Rules                                              */
/* ================================================================== */

const multiTenantRules: ReviewRule[] = [
  {
    id: "tenant-missing",
    category: "multi-tenant",
    name: "Missing tenantId in Query",
    severity: "critical",
    filePatterns: ["**/repositories/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        // Detect Prisma queries without tenantId
        if (/\.(findMany|findFirst|findUnique|create|update|delete)\s*\(/.test(line.content)) {
          // Look for tenantId in nearby lines
          const lineIdx = ctx.additions.indexOf(line);
          const nearbyLines = ctx.additions
            .slice(Math.max(0, lineIdx - 3), lineIdx + 5)
            .map((l) => l.content);
          const hasTenantId = nearbyLines.some((l) => /tenantId/.test(l));

          if (!hasTenantId) {
            comments.push({
              id: nextCommentId(),
              file: ctx.file,
              line: line.lineNumber,
              severity: "critical",
              rule: "tenant-missing",
              title: "❗ Database Query Without tenantId",
              issue: "Database query doesn't include tenantId filter.",
              impact: "Critical multi-tenant isolation violation. Users could access other tenants' data.",
              suggestion: "Add tenantId to the where clause. Every query MUST include tenantId for multi-tenant safety.",
            });
          }
        }
      }
      return comments;
    },
  },
  {
    id: "tenant-global-state",
    category: "multi-tenant",
    name: "Shared Global Mutable State",
    severity: "warning",
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /(?:let|var)\s+\w+\s*=\s*(?:new Map|new Set|\[\]|\{\})/,
      "tenant-global-state",
      "warning",
      "⚠️ Potential Shared Global Mutable State",
      "Module-level mutable variable detected. Could be shared across tenants in serverless environments.",
      "If this state holds tenant-specific data, it can leak between requests.",
      "Use request-scoped state or tenant-keyed Map with TTL. See packages/shared/tenant-resolver.ts for the pattern.",
    ),
  },
];

/* ================================================================== */
/*  8. API Contract Rules                                              */
/* ================================================================== */

const apiContractRules: ReviewRule[] = [
  {
    id: "api-inconsistent-response",
    category: "api-contract",
    name: "Inconsistent API Response",
    severity: "suggestion",
    filePatterns: ["**/api/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        // Check for non-standard error response shapes
        if (/NextResponse\.json\s*\(/.test(line.content) &&
            /message|msg|err\b/.test(line.content) &&
            !/error/.test(line.content)) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "suggestion",
            rule: "api-inconsistent-response",
            title: "💡 Inconsistent API Error Response",
            issue: "API error response uses non-standard key (should be { error: string }).",
            impact: "Client-side error handling may miss this error. Inconsistent API contract.",
            suggestion: "Use { error: string } format for all error responses. Example: NextResponse.json({ error: 'Not found' }, { status: 404 })",
          });
        }
      }
      return comments;
    },
  },
  {
    id: "api-session-mutation",
    category: "api-contract",
    name: "Wrong Session Function for GET",
    severity: "warning",
    filePatterns: ["**/api/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      const hasGet = ctx.additions.some((l) =>
        /export\s+(async\s+)?function\s+GET/.test(l.content),
      );
      const hasGetSession = ctx.additions.some((l) =>
        /getSession\(\)/.test(l.content) && !/getSessionReadOnly/.test(l.content),
      );

      if (hasGet && hasGetSession) {
        comments.push({
          id: nextCommentId(),
          file: ctx.file,
          severity: "warning",
          rule: "api-session-mutation",
          title: "⚠️ getSession() Used in GET Handler",
          issue: "GET handler uses getSession() which writes cookies (sliding renewal).",
          impact: "Can cause concurrent cookie write races. GET handlers should be read-only.",
          suggestion: "Use getSessionReadOnly() for GET handlers. Reserve getSession() for POST/PUT/DELETE only.",
        });
      }
      return comments;
    },
  },
];

/* ================================================================== */
/*  9. Best Practices Rules                                            */
/* ================================================================== */

const bestPracticeRules: ReviewRule[] = [
  {
    id: "bp-any-type",
    category: "best-practices",
    name: "TypeScript 'any' Usage",
    severity: "suggestion",
    filePatterns: ["**/*.ts", "**/*.tsx"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      let anyCount = 0;
      for (const line of ctx.additions) {
        if (/:\s*any\b/.test(line.content) && !line.content.trim().startsWith("//")) {
          anyCount++;
          if (anyCount <= 3) {
            comments.push({
              id: nextCommentId(),
              file: ctx.file,
              line: line.lineNumber,
              severity: "suggestion",
              rule: "bp-any-type",
              title: "💡 TypeScript `any` Usage",
              issue: "Using `any` type bypasses TypeScript's safety checks.",
              impact: "Reduces type safety. Bugs may slip through that TypeScript would normally catch.",
              suggestion: "Replace with a proper type or use `unknown` and narrow with type guards.",
            });
          }
        }
      }
      return comments;
    },
  },
  {
    id: "bp-console-log",
    category: "best-practices",
    name: "Console.log in Production Code",
    severity: "suggestion",
    filePatterns: ["**/app/**", "**/lib/**", "**/components/**"],
    check: (ctx) => {
      const comments: ReviewComment[] = [];
      for (const line of ctx.additions) {
        if (/console\.log\(/.test(line.content) && !line.content.trim().startsWith("//")) {
          comments.push({
            id: nextCommentId(),
            file: ctx.file,
            line: line.lineNumber,
            severity: "suggestion",
            rule: "bp-console-log",
            title: "💡 console.log in Production Code",
            issue: "console.log found in production code.",
            impact: "Clutters production logs. May leak sensitive data.",
            suggestion: "Use @career-builder/observability/logger for structured logging, or remove the console.log.",
          });
          break; // One comment per file is enough
        }
      }
      return comments;
    },
  },
  {
    id: "bp-client-stripe",
    category: "best-practices",
    name: "Client-Side Stripe Import",
    severity: "critical",
    filePatterns: ["**/components/**", "**/app/**/page.tsx"],
    check: (ctx) => checkAdditionsForPattern(
      ctx,
      /import.*from\s+['"]stripe['"]/,
      "bp-client-stripe",
      "critical",
      "🔥 Stripe Imported in Client Code",
      "Stripe SDK is imported in a client-side file.",
      "Stripe secret key would be exposed to the browser. Critical security vulnerability.",
      "Only import Stripe in server-side code (API routes, Server Components, lib/stripe/). Never in components or client pages.",
    ),
  },
];

/* ================================================================== */
/*  Rule Registry                                                      */
/* ================================================================== */

export const ALL_RULES: ReviewRule[] = [
  ...architectureRules,
  ...stateRules,
  ...aiSafetyRules,
  ...securityRules,
  ...performanceRules,
  ...errorHandlingRules,
  ...multiTenantRules,
  ...apiContractRules,
  ...bestPracticeRules,
];

/**
 * Run all applicable rules against a file change.
 */
export function reviewFileChange(ctx: FileChangeContext): ReviewComment[] {
  const comments: ReviewComment[] = [];

  for (const rule of ALL_RULES) {
    // Check file patterns
    if (rule.filePatterns && !matchesPattern(ctx.file, rule.filePatterns)) {
      continue;
    }

    try {
      const ruleComments = rule.check(ctx);
      comments.push(...ruleComments);
    } catch (err) {
      console.error(`[ai-review] Rule "${rule.id}" failed on ${ctx.file}:`, err);
    }
  }

  return comments;
}
