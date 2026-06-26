/*
 * PostCSS config for the public career site (apps/web).
 *
 * WHAT: Wires Tailwind CSS v4 into the build via its PostCSS plugin.
 * WHY:  Next.js runs the project's PostCSS pipeline over global/component CSS;
 *       this is where Tailwind's utility generation hooks in.
 * HOW:  Tailwind v4 ships its PostCSS integration as a dedicated package
 *       (@tailwindcss/postcss) rather than the v3 `tailwindcss` plugin — the
 *       empty object is the default (zero-config) plugin invocation. apps/admin
 *       carries its own equivalent config; keep the two in sync if the toolchain
 *       changes.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
