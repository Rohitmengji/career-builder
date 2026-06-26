/*
 * ESLint flat config for the public career site (apps/web).
 *
 * WHAT: Composes Next.js's core-web-vitals + TypeScript rule sets, then layers
 *       this app's lint policy on top.
 * WHY:  This is the lint gate for apps/web (CI + local). It encodes two
 *       deliberate, codebase-wide decisions so the rest of the gate can stay
 *       strict and green — see the inline rationale on each rule.
 * HOW:  Flat config (ESLint 9 `defineConfig`): spread the shared Next presets,
 *       add a rules override block, then re-declare the build-output ignores
 *       (globalIgnores REPLACES eslint-config-next's defaults, so they must be
 *       restated here or they'd be lost). apps/admin has a parallel config.
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
