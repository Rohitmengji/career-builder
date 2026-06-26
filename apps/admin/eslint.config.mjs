/*
 * ESLint flat config for the admin app.
 *
 * WHAT: The lint gate for the recruiter Next.js app + GrapesJS editor.
 * WHY:  Centralizes the project's lint policy so CI/pre-commit stay green
 *       without papering over real issues — it extends Next.js's recommended
 *       sets and then deliberately tunes two TS rules (see inline rationale).
 * HOW:  Uses the ESLint v9 flat-config format (`defineConfig` array). Order
 *       matters: Next's core-web-vitals + typescript presets come first, then
 *       our rule overrides, then `globalIgnores`. Because flat config replaces
 *       (not merges with) eslint-config-next's built-in ignores, those defaults
 *       must be re-declared explicitly in `globalIgnores` below or they'd be lost.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Dynamic data (AI JSON responses, GrapesJS editor models, Prisma raw
      // rows) is pervasively typed as `any` in this codebase. Enforcing
      // no-explicit-any as an error would require a large `unknown`-based
      // typing pass (tracked as future work) and offers little correctness
      // value, so it's disabled to keep the rest of the gate strict & green.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow intentionally-unused identifiers when prefixed with `_`
      // (handler args, caught errors) — flag genuinely dead vars/imports.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
