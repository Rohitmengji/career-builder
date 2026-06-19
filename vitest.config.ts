import { defineConfig } from "vitest/config";

/**
 * Root Vitest config for the monorepo. Unit tests live next to the code they
 * cover (packages/**, apps/**) as *.test.ts. Browser/e2e flows stay in
 * ui-audit (Playwright) and are excluded here.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.{test,spec}.ts", "apps/**/*.{test,spec}.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "ui-audit/**",
      "**/*.e2e.*",
    ],
  },
});
