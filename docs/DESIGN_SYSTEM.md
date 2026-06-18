# Web Design System & Modernization Direction

> Generated from a full UI/UX + accessibility + contrast + responsive audit of apps/web (126 findings across 7 groups). This is the single source of truth for the modernization — all pages consume the shared tokens + primitives.

# Career-Site Design System & Implementation Direction

This is the single source of truth. Every implementer follows it verbatim. The goal: collapse the current patchwork (rounded-lg vs rounded-2xl, blue-500 vs blue-600, gray-400 muted text everywhere, two divergent home pages, dead token layer) into one cohesive, Linear/Stripe-grade system that is enforced by primitives and tokens — not re-typed per page.

---

## 1. Design Language

**Feel:** Restrained, confident, content-first. Generous whitespace, a calm neutral base, one decisive accent, soft elevation over heavy borders, and motion that is purposeful and quiet. No emoji as UI. One radius family. One shadow ramp. One focus color. Brand color is tenant-driven and always contrast-verified at token-generation time.

### 1.1 Color palette (light theme — all pairs WCAG-AA verified)

**Neutrals (slate/gray ramp):**

| Token | Hex | Use | Verified pair |
|---|---|---|---|
| `gray-900` | `#111827` | Primary text, headings | 16.1:1 on white ✅ |
| `gray-700` | `#374151` | Body text, interactive nav links | 10.3:1 on white ✅ |
| `gray-600` | `#4b5563` | **Default muted/secondary text** | 7.0:1 on white ✅ |
| `gray-500` | `#6b7280` | **Minimum** muted text / placeholder | 4.8:1 on white ✅ |
| `gray-400` | `#9ca3af` | **Decorative only** (never text on light) | 2.5:1 ❌ banned for text |
| `gray-300` | `#d1d5db` | Input borders, dividers | non-text |
| `gray-200` | `#e5e7eb` | Subtle dividers only | non-text |
| `gray-100` | `#f3f4f6` | Tinted panels, secondary button bg | — |
| `gray-50` | `#f9fafb` | Page background | — |

**Hard rule:** `text-gray-400` and `text-gray-300` are **forbidden for any text on light surfaces.** Muted body = `gray-600`. The lightest permissible text on white is `gray-500` (placeholders, fine print). On dark surfaces, muted text bottoms out at `#9ca3af` (8.9:1 on `#030712`).

**Accent (default brand = blue; overridable per tenant):**

| Token | Hex | Use | Verified pair |
|---|---|---|---|
| `primary` | `#2563eb` (blue-600) | Buttons, links, focus ring, accents | white text on it = 5.2:1 ✅; it on white = 5.2:1 ✅ |
| `primary-hover` | `#1d4ed8` (blue-700) | Hover state | — |
| `primary-tint` | `#eff6ff` (blue-50) | Badge bg, demo pill, soft fills | `blue-700 #1d4ed8` on it = 7.8:1 ✅ |
| `primary-tint-text` | `#1d4ed8` (blue-700) | Text on primary-tint | ✅ |

**Single focus color:** `#2563eb` at **full opacity**, 2px. Never `/20`, never `blue-500` (3.68:1 is too weak). This matches the existing global `:focus-visible`.

**Semantic:**

| Role | bg | text | icon |
|---|---|---|---|
| Success | `#ecfdf5` (emerald-50) | `#047857` (emerald-700, 4.9:1) | emerald-600 |
| Error | `#fef2f2` (red-50) | `#b91c1c` (red-700, 5.9:1) | red-600 |
| Warning | `#fffbeb` (amber-50) | `#b45309` (amber-700, 5.1:1) | amber-600 |
| Info | `#eff6ff` (blue-50) | `#1d4ed8` (blue-700) | blue-600 |

`::selection` uses `var(--cb-color-primary)` with a contrast-checked text color (not hardcoded blue).

**Tenant color contract:** Replace the YIQ `isLightColor()` selection in `packages/tenant-config` with the WCAG `relativeLuminance`/`contrastRatio`/`ensureContrast`/`getReadableTextColor` helpers from `lib/design-system.ts` (move them into tenant-config or import them). Every emitted token — `primaryText`, badge text, subtitle/muted-on-accent — must pass `ensureContrast(text, bg) >= 4.5` (3:1 for ≥18.66px/bold) **before emission**. No themed surface ships failing text.

**Dark mode:** **Defer, but stop advertising it.** Remove `media.darkMode` and `theme.mode` from the token surface until implemented, OR scope it behind `[data-theme="dark"]` with a full token set and dynamic `<meta name="theme-color">`. Do not ship dangling dark-mode tokens. (Renderer dark-section logic stays — that is per-section bg, not app theme.)

### 1.2 Typography

**Font ownership — decide once:** Tenants own the font. Drop Geist as the primary; keep it only as the fallback literal. In `ThemeProvider`, inject the tenant Google Font with `font-display: swap` and `<link rel="preconnect">` to `fonts.googleapis.com` + `fonts.gstatic.com`. Every `--cb-font-family` usage ends with a system stack: `var(--cb-font-family), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

**Type scale** (wire `lib/design-system.ts` `fontSize`/`textPresets` into Tailwind v4 `@theme` as real utilities — see §1.8):

| Role | Size / weight / tracking | Tailwind |
|---|---|---|
| Display (hero h1) | 48–60px / 700 / -0.02em | `text-5xl sm:text-6xl font-bold tracking-tight` |
| Page h1 | 30–36px / 600 / -0.02em | `text-3xl sm:text-4xl font-semibold tracking-tight` |
| Section h2 | 24–30px / 600 / -0.01em | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Card/sub h3 | 18–20px / 600 | `text-lg font-semibold` |
| Body | 16px / 400 | `text-base` |
| Body-sm / meta | 14px / 400, color `gray-600` | `text-sm text-gray-600` |
| Eyebrow | 12px / 600 / 0.08em uppercase, `primary` | `text-xs font-semibold uppercase tracking-wider text-blue-600` |

Use `text-wrap: balance` on display/section headings; remove hardcoded `<br>` line breaks in Hero.

### 1.3 Spacing rhythm
8px base. Section vertical padding grows with viewport: `py-12 md:py-16 lg:py-20 xl:py-28`. **Fix the inverted `py-16 md:py-12`** in the job detail page. Card padding: standardize on `p-6` (use `p-5` only in dense contexts — but the hover-lift must not depend on padding; see §2 Card).

### 1.4 Radii (ONE family — pick and enforce)
- Inputs / buttons / badges: **`rounded-lg`** (8px)
- Cards / panels / modals: **`rounded-2xl`** (16px)
- Pills / avatars: `rounded-full`

Kill the `rounded-lg`/`rounded-xl`/`rounded-2xl` drift. Expose as `--radius-control` and `--radius-card` in `@theme`.

### 1.5 Shadow / elevation (use the existing `--shadow-*` ramp, currently unused)
- **Rest card:** `shadow-xs` + `border border-gray-200/70`
- **Hover (interactive cards only):** `shadow-md` + `-translate-y-0.5`
- **Sticky header:** `shadow-sm`
- **Modal/drawer:** `shadow-xl`
- **Inputs:** no shadow at rest; focus = ring, not shadow.

Borders are subtle (`gray-200`), used to define, not decorate. Prefer soft shadow over heavy borders for elevation.

### 1.6 Motion
Use the existing motion/easing tokens in `globals.css`.
- Durations: micro 120ms, standard 200ms, entrance 300ms.
- Easing: standard `cubic-bezier(.2,0,0,1)`; spring `--ease-spring` for button press only.
- Button press: `active:scale-[0.99]`. Interactive card hover: `-translate-y-0.5` + shadow step. **No global lift on every button.**
- Modal: `fadeIn` backdrop + `modalSlideUp` panel (keyframes already exist — wire them in).
- **Reduced motion:** the existing block must also neutralize `.fade-up`/`.fade-up-stagger` (force `opacity:1; transform:none`), and JS-driven effects (Hero mouse-glow, auto-cycling carousel) must check `matchMedia('(prefers-reduced-motion: reduce)')` and not attach/run.

### 1.7 Replace fragile global selectors
Delete the substring/attribute hacks: `a[class*="inline-flex"]`, `button:not([disabled]):hover`, `[class*="border"][class*="p-6"]:hover`, `main > div:not(.fixed)` entrance animation. Replace with explicit classes / data-attributes: `.cb-btn`, `[data-card="interactive"]`, `[data-elevation]`. Entrance animation runs **first load only** (data attribute gate), never on filter changes.

### 1.8 Token enforcement (root cause fix)
The `lib/design-system.ts` scales are currently dead code. **Wire them into Tailwind v4 `@theme`** in `globals.css` so they become real utilities (`--text-display`, `--radius-card`, `--shadow-md`, `--z-skip`, `--container-max`, `--focus-ring`). Delete any scale you don't wire (e.g. `gridCols`, `containerClasses` if unused) rather than leaving it dangling. Extend the existing tokens; do not fork a parallel system. After wiring, refactor pages to consume primitives, not raw utility strings.

---

## 2. Shared Primitives

Build these in one place (`lib/design-system-components.tsx` + an `apps/web/components/ui/` barrel). **Every page imports these — no hand-rolled inputs/buttons/cards.** Status: ✦ = exists (fix), ✚ = create.

### Button ✚
Variants: `primary` (blue-600 fill, white text), `secondary` (gray-100 bg, gray-900 text), `ghost` (transparent, gray-700), `danger`. Sizes: `sm` (h-9), `md` (h-10), `lg` (h-11, ≥44px touch). Also `ButtonLink` (renders `<a>`/`<Link>` with identical styles). Radius `rounded-lg`. Consumes `tokens.button` for tenant theming. Built-in `:focus-visible` ring (`--focus-ring`), `active:scale-[0.99]`, reduced-motion aware. Optional leading/trailing icon slot (icons `aria-hidden`). **Replaces:** every re-typed `bg-blue-600 ... rounded-xl` CTA, the gray-900 inline-styled buttons in not-found/global-error, the reset "done" CTA, profile Save.

### Field / Input ✦→✚
One primitive owning: `useId()` label↔input association (`htmlFor`/`id`), `required` → `aria-required` + visually-hidden " (required)" (asterisk `aria-hidden`), `error` → `aria-invalid` + `aria-describedby` to error text, helper text, **placeholder `text-gray-500`**, full-opacity focus ring (never `/20`). Baseline class baked once: `w-full border border-gray-300 rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 placeholder:text-gray-500`. **Replaces the verbatim-duplicated input string** across login/register/reset/profile/authUi/apply. Supports a `labelRight` slot (for "Forgot password?").

### PasswordField ✚
Field + trailing show/hide toggle (`type=button`, `aria-pressed`, `aria-label` "Show/Hide password"). Optional length/strength hint on register/reset. Replaces 4 hand-coded password inputs.

### Textarea ✚ / Select ✚
Same Field a11y contract (label assoc, focus ring, borders). Select gets a real `<label>`/`aria-label`.

### Card ✦→✚
`<Card>` static by default; `variant="interactive"` adds `data-card="interactive"` → hover `-translate-y-0.5 shadow-md`, and wraps/contains a real link so it's keyboard-focusable with an accessible name. Padding `p-6` independent of hover logic. **Static content cards never animate on hover.** Replaces all hand-rolled `bg-white rounded-xl border shadow-sm` surfaces and removes the need for the `[class*=border][class*=p-6]` hack.

### Badge / Pill ✚
`rounded-full`, semantic color variants (success/error/info/neutral) all AA-verified. Used for tags, Remote badge, suggestion chips, demo "DEMO" pill. Differentiate Remote from employment-type (distinct hue or icon — not emerald vs green).

### Container ✚ / Section ✚ / SectionHeader ✚
- **Container:** `mx-auto w-full px-4 sm:px-6 lg:px-8 max-w-7xl` (add the missing `max-w` + `--container-max` token; prose blocks cap at `max-w-[70ch]`).
- **Section:** owns vertical rhythm `py-12 md:py-16 lg:py-20 xl:py-28`.
- **SectionHeader:** `eyebrow + h2 + subtitle` — replaces the repeated marketing structure.

### Avatar ✚
Image or initials fallback with **tinted gradient** (accent.tint), `rounded-full`, sizes.

### Skeleton / SkeletonCard / SkeletonText ✚
React wrappers over the **existing** `.cb-skeleton(-text/-heading/-image)` + `.shimmer` CSS. Prefer over spinner for list/grid/profile/sidebar/demo loading. Add `loading.tsx` per route (start with `demo/[id]`).

### Spinner ✦
Keep, but only for inline button-busy states, not page loads.

### Alert / Banner ✦→✚
`ErrorBanner` → `role="alert"`; `SuccessBanner` → `role="status" aria-live="polite"`. Optional icon + auto-dismiss. Route the profile toast and all auth banners through these. Prefer the existing `useAnnounce()/AnnouncementProvider` for a single live region.

### EmptyState / StatusState ✚
Icon tile (rounded, brand-tint bg) + title + body + primary/optional-secondary action. **One component** for: jobs empty/error, error.tsx, global-error.tsx, not-found.tsx, demo empty jobs/pages, auth terminal states (forgot "sent", reset "done"/"invalid"). Kills the three-different-looking system pages.

### Modal/Dialog ✦→✚
One primitive: native `<dialog>` sync, `aria-labelledby` (heading id), initial focus to first field, focus **restore to trigger** on close, `onCancel`-based Escape (drop duplicate keydown listener), `fadeIn`+`modalSlideUp` animation. FocusTrap becomes pure focus management (no `role=dialog`/`aria-modal` of its own); consumer owns dialog semantics; background gets `inert`/`aria-hidden` while open.

### Tabs ✚
Real WAI-ARIA: roving `tabindex`, Arrow/Home/End, `aria-selected`, `tabpanel` with `tabIndex={0}` + `aria-labelledby`. Replaces DemoPreview's incomplete tabs and renamed/fixed renderer `ShowHideTab`.

### Icon ✚ + BrowserChrome ✚
`<Icon>` wrapper always sets `aria-hidden` + `focusable="false"` + consistent sizing. **Emoji as UI is banned** — replace all (🚀😕🔧🎉🔍✓•←✕→) with inline SVGs. `<BrowserChrome>` (traffic lights + URL bar, macOS hex `#ff5f57/#febc2e/#28c840`) shared by Hero + DemoPreview.

### AppShell / SiteHeader ✚ + SkipLink ✦
Implement the 0-byte `SiteHeader` as `<header><nav aria-label="Primary">` (logo/home + links). Render `SkipLink` + `<main id="main-content">` + header/footer landmarks **once in a shared layout** so auth/profile/job-detail/demo all inherit them. Fix `SkipLink` `focus:z-9999` → `focus:z-[9999]` (or `--z-skip` token).

---

## 3. Global a11y & Responsive Standards

**Every page must meet these. Non-negotiable.**

- **Landmarks:** exactly one `<header>`/`banner`, one `<main id="main-content">`, one `<footer>`/`contentinfo`, primary `<nav aria-label="Primary">`. Provided by shared layout.
- **Skip link:** first body child, `sr-only focus:not-sr-only`, target `#main-content`, z-index above sticky header — on every route.
- **Heading order:** exactly one `<h1>` per route, ordered descent, no skips. Adopt the existing `HeadingLevelProvider`/`Heading` context in the renderer and content pages. Jobs board, job detail, demo all need a real `<h1>`.
- **Labels:** every input programmatically associated (`useId`). No placeholder-as-label. Required communicated non-visually.
- **Live regions:** async result counts/loading → `role="status" aria-live="polite"`; errors → `role="alert"`. No duplicate announcements (drop the duplicated VisuallyHidden in LoadingState).
- **Contrast:** text ≥ 4.5:1 (≥3:1 for ≥18.66px/bold); UI components/borders/focus ≥ 3:1. Disabled state never opacity-only — use a token + the `disabled` attribute. Don't convey state by color alone (add underline/icon/`aria-pressed`).
- **Decorative graphics:** all decorative SVGs/emoji `aria-hidden="true"`; icons-as-meaning get labels. Facet/toggle buttons get `aria-pressed`; pagination gets `aria-label`, `aria-current="page"`, labeled nav.
- **Tap targets:** ≥44×44px on touch — IconButton md = `w-11 h-11`, drawer/modal close ≥44px, facet rows/pagination/checkboxes get expanded hit area (`min-h-[44px]`, padded labels), footer social/text links padded.
- **Reduced motion:** honored globally including `.fade-up*` and all JS-driven effects.
- **Off-screen content:** closed drawer panel = `inert`/`aria-hidden` so its links aren't tabbable/announced.
- **Lang/dir:** `<html lang>` tenant-configurable; `global-error.tsx` must set `lang="en"` and use `<h1>`.

**Breakpoints & container:**
- Mobile (375–639): single column; filters in a drawer/disclosure with active-count badge (not a sticky sidebar pushing results down); name fields `grid-cols-1`.
- Tablet/iPad (640–1023): `sm:`/`md:` two-up grids; name fields `sm:grid-cols-2`.
- Desktop (1024–1439): sidebar + content; `max-w-7xl`.
- Big (1440–1920+): keep `max-w-7xl` (auth `max-w-md`, prose `max-w-[70ch]`); section padding + hero type scale up (`xl:py-28`, `xl:text-7xl`); no edge-to-edge sprawl, no premature truncation.
- `scroll-padding-top` on `<html>` equal to sticky header height so anchor targets clear the bar.
- **Never template-interpolate Tailwind class names** (`grid-cols-${n}` purges in prod) — static lookup maps only.

---

## 4. Prioritized Implementation Plan

Ordered by leverage. Phase 0–1 unblock everything else (one fix → many pages).

### Phase 0 — Foundation (do first; highest leverage)
**Files:** `globals.css`, `lib/design-system.ts`, `lib/design-system-components.tsx`, `layout.tsx`, `ThemeProvider.tsx`, `packages/tenant-config/{index,tokens}.ts`
1. Wire `design-system.ts` scales into Tailwind `@theme` (text/radius/shadow/z/container/focus tokens); delete unwired dead scales (`gridCols`, unused `containerClasses`).
2. Delete fragile global selectors (§1.7); add explicit `.cb-btn`/`[data-card]` rules and first-load-only entrance gate.
3. Fix `SkipLink` `focus:z-[9999]`; render `SkipLink` + `<main id=main-content>` + landmarks in shared layout.
4. Reduced-motion: add `.fade-up*` reset to the block.
5. Replace tenant `isLightColor` with WCAG `ensureContrast`/`getReadableTextColor`; verify all emitted token text pairs.
6. Font ownership: drop/relegate Geist, add preconnect + `font-display:swap` + system fallback in ThemeProvider.
7. Remove dangling dark-mode tokens (or implement fully).
8. Build core primitives: Button/ButtonLink, Field, PasswordField, Textarea, Select, Card, Badge, Container, Section, SectionHeader, Avatar, Skeleton, Alert, EmptyState, Modal, Tabs, Icon, BrowserChrome, SiteHeader.

### Phase 1 — Renderer (tenant career sites; highest-traffic surface)
**File:** `lib/renderer.tsx`, `app/[slug]/jobs/[jobId]/{page,apply}.tsx`, `tokens.ts`
1. Fix JobAlert subtitle contrast (derive from `getReadableTextColor`, not `lightenHex(bg,0.5)`); fix footer copyright on dark (`#6b7280`+).
2. Route **job detail + apply pages through ThemeProvider + Section/Container/Btn/Card/Field** (currently hardcoded gray/blue — biggest cohesion lever). Fix inverted `py-16 md:py-12`. Add SkipLink/landmarks/decorative `aria-hidden`. Associate apply-form labels (`htmlFor`/`id`), `role=alert` on error, `aria-required`.
3. Move hover/active from inline JS mutation to CSS `:hover`/`:focus-visible` (keyboard parity).
4. Accordion: drop `role=list/listitem` on `<details>`. `ShowHideTab`: real Tabs or honest content list. Decorative emoji `aria-hidden` (Features icons — drop duplicate label). LightBox/Carousel/JobCategory: real links/buttons or remove fake hover affordance.
5. Adopt `HeadingLevelProvider` for single-h1 guarantee. Wire `cb-skeleton`/LoadingState into async blocks. Bump small tap targets to 44px. Add xl/2xl padding + hero type steps. Persist NotificationBanner dismissal; drop its `aria-live`.

### Phase 2 — Marketing landing (first impression)
**Files:** `app/page.tsx`, `components/marketing/*`
1. **Resolve duplicate home:** make `/landing` canonical; redirect `/` to it or refactor `app/page.tsx` to compose Navbar/Hero/Footer. Remove emoji icons → SVG. Add `scroll-padding-top`.
2. Replace all `text-gray-300/400` text with `gray-600`/`gray-500` (Hero, Comparison, SocialProof, Pricing, Footer); "Not weeks." → `gray-500`. Comparison cross icon: add `sr-only` "Not available".
3. Gate Hero mouse-glow + auto-carousel behind reduced-motion; announce/pause carousel; add `aria-hidden` to decorative preview.
4. DemoPreview tabs → shared Tabs primitive. Features "Learn more" cards → real `<a>` or drop the cue. Add `aria-hidden` to Features/ProblemSolution/HowItWorks SVGs.
5. Extract SectionHeader, BrowserChrome, CTA Button across all sections. Reconcile rating/usage claims to one source. Footer social: real URLs or omit; `gray-500` resting. Wire real logos or remove strip.

### Phase 3 — Jobs board
**Files:** `app/jobs/page.tsx`, `components/PersonalizedSuggestions.tsx`, `app/jobs/layout.tsx`
1. Add `<h1>` "Open positions"; fix heading order. Label search input + sort select; SearchIcon `aria-hidden`.
2. `role=status aria-live=polite` on result count/status; `role=alert` on error; announce empty state; `aria-busy` on results, `aria-hidden` on skeletons.
3. `aria-pressed` on facet buttons; replace `✕`/🔍/`←`/`→` with SVG Icons + labels; pagination `aria-label`/`aria-current`. Add "Skip to results".
4. Contrast: facet counts/dates/badges → `gray-500`+, card subtitle → `gray-600`. Disabled pagination → token, not `opacity-40`.
5. Mobile: filters → drawer/disclosure with active-count badge, drop sticky on mobile. Tap targets ≥44px. Adopt Card/Badge/EmptyState/Skeleton primitives; remove per-button hover-lift.

### Phase 4 — Job detail + apply (non-renderer `app/jobs/[id]`)
**Files:** `app/jobs/[id]/{page,ApplyModal,not-found}.tsx`, `components/{SiteHeader,PersonalizedSidebar}.tsx`
1. ApplyModal → shared Modal + Field primitives (label assoc, `aria-labelledby`, focus restore, `role=alert`/`status`, animation). Name row `grid-cols-1 sm:grid-cols-2`.
2. Implement SiteHeader; render in layout. Decorative SVGs/emoji `aria-hidden`. Replace ✓/•/← glyphs with SVG.
3. Contrast: helper/OR/meta text → `gray-500`/`gray-600`. Sidebar hint → `gray-500`+, use shared Skeleton. H1 → `text-3xl sm:text-4xl`. Description `max-w-[70ch]`.

### Phase 5 — Auth pages
**Files:** `lib/authUi.tsx`, `app/{login,register,forgot-password,reset-password,profile}/page.tsx`
1. Field owns label assoc + AA placeholder (`gray-500`) + full-opacity ring — fixes a11y/contrast everywhere at once. Route all banners through Alert (`role`/`aria-live`); profile toast through SuccessBanner/ErrorBanner.
2. PasswordField (show/hide) on login/register/reset. Register name row → `grid-cols-1 sm:grid-cols-2`. Suspense fallbacks → Skeleton, not `null`.
3. Profile: loading → Skeleton, `<nav aria-label="Account">`, email `aria-describedby` helper, consolidate parallel Input into Field. StatusState for forgot/reset terminal screens. Add logo/mark, card `shadow-md ring-1 ring-black/5`, button micro-interaction (reduced-motion aware).

### Phase 6 — System/edge pages
**Files:** `app/{not-found,global-error,error,demo/[id]}.tsx`
1. Rebuild not-found/global-error with Tailwind (no inline styles; global-error keeps minimal inline since it replaces `<html>` — mirror token values) + shared EmptyState/Button. global-error: `<h1>`, `lang="en"`.
2. error.tsx: `role=alert`, emoji → SVG `aria-hidden`, use shared primitives. All three system pages → one EmptyState look.
3. demo: `<main>` landmark, emoji → "DEMO" pill/SVG, `text-gray-400` → `gray-600`, job rows → real `<Link>` (≥44px) or drop fake hover, empty states for 0 jobs/pages, add `loading.tsx`, remove redundant type pill, wrap `·` separators `aria-hidden`, fix `hover:text-blue-100`.

---

## 5. Top 10 Must-Fix Issues

1. **Dead token layer → wire `design-system.ts` into Tailwind `@theme`.** Root cause of all cross-page inconsistency (radius/shadow/type drift). One radius family, one shadow ramp, one focus color, enforced.
2. **`text-gray-400`/`gray-300` as body/muted text fails AA everywhere** (jobs, marketing, apply, auth, demo, renderer). Global swap to `gray-600` (muted) / `gray-500` (min/placeholder); ban 400/300 for text on light.
3. **No label↔input association in any auth/apply form.** One Field primitive with `useId` fixes every form at once.
4. **Two divergent home pages.** Pick `/landing` canonical; redirect or refactor `app/page.tsx` to shared primitives.
5. **Job detail + apply bypass the theme system** (hardcoded gray/blue) — tenant brand dies on the highest-intent pages. Route through ThemeProvider + primitives.
6. **No live regions / silent async + no `role=alert` on errors** across jobs, apply, auth, profile. Add `role=status`/`alert`; adopt `useAnnounce`.
7. **Fragile global selectors** (`[class*=border][class*=p-6]`, `button:not([disabled]):hover`, `a[class*=inline-flex]`) cause jittery/false-positive motion and break silently. Replace with explicit primitive classes.
8. **Missing `<h1>` + broken heading order** on jobs board and others. One `<h1>` per route; adopt `HeadingLevelProvider`.
9. **SkipLink broken (`focus:z-9999` invalid) + missing landmarks/skip link on non-renderer routes.** Fix to `z-[9999]`, render SkipLink + `<main id>` + SiteHeader in shared layout.
10. **Emoji-as-UI + raw glyphs (😕🔧🚀🎉🔍✓•←✕→) + tenant text contrast via non-WCAG YIQ.** Replace emoji with the SVG Icon set (all `aria-hidden`); replace `isLightColor` with WCAG `ensureContrast` so themed text is guaranteed AA at token-generation time.