/*
 * PostCSS config for the admin app (recruiter Next.js app + GrapesJS editor).
 *
 * WHAT: Wires Tailwind CSS into the build via its PostCSS plugin.
 * WHY:  Tailwind v4 runs as a single PostCSS plugin (`@tailwindcss/postcss`)
 *       rather than the v3 `tailwindcss` + `autoprefixer` pair — config and
 *       prefixing now live inside that one plugin.
 * HOW:  Next.js auto-discovers this file during its build/dev CSS pipeline;
 *       no options needed since Tailwind config is resolved from the CSS
 *       entrypoint (`@import "tailwindcss"`), not from here.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
