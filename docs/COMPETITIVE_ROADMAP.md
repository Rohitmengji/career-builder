# Career Builder — Copilot Enhancement Playbook

12 feature prompts to close the competitive gaps (vs Ashby, Greenhouse, Lever, Workable, Teamtailor, etc.), in priority order. Each one is **copy-paste-ready into Copilot Agent mode or Copilot Edits.**

---

## How to actually run this (read once)

1. **Put `.github/copilot-instructions.md` in the repo first.** Every prompt below assumes Copilot already knows your stack, conventions, and the tenant-isolation rule. Without it, you'll fight Copilot on the basics every single time.
2. **One feature per Agent session.** Don't paste two prompts at once. Copilot degrades fast when overloaded — you get half-finished, half-broken multi-file edits.
3. **Use Agent mode** (it can plan across files + run terminal commands like migrations) for features 1–5, 10, 11. **Copilot Edits** is fine for the smaller, mostly-UI ones (6, 7, 9, 12).
4. **Pick a strong model in the Copilot model picker** for these multi-file tasks (a Claude Sonnet/Opus-class or comparable frontier model handles the cross-file reasoning far better than the lightweight default). Switch back to the fast model for autocomplete.
5. **The loop, every time:** paste prompt → let it plan → **review the diff before accepting** → run `npx prisma migrate dev` if schema changed → `pnpm typecheck && pnpm lint && pnpm test` → commit → next feature.
6. **Fix the Prisma model names.** I've written plausible names (`Tenant`, `JobPosting`, `Application`, `Candidate`, `User`). Replace them with your real ones, or just tell Copilot in the prompt "use our actual model names from schema.prisma."

---

## The prompt pattern (reuse for anything not listed)

```
Goal: <one sentence — the user-facing outcome>
Reuse: <the existing feature/file to mirror>
Data model: <exact Prisma additions>
Steps: <schema → API → UI, numbered>
Acceptance: <observable "done when…" checklist>
Constraints: follow existing patterns, run prisma migrate, keep tenant
isolation + input validation, don't break <X>.
```

---

# Priority 1 — Custom domain support per tenant

> *Brands want `careers.company.com`. Teamtailor + Ashby have it.*

```
Goal: Each tenant can serve their career site on their own custom domain
(e.g. careers.acme.com), with DNS verification and status tracking.

Reuse: The Tenant model and the existing hostname→tenant resolution in the
apps/web middleware. Mirror an existing admin settings page for the UI.

Data model (add to schema.prisma — adapt names to ours):
  model Domain {
    id          String       @id @default(cuid())
    hostname    String       @unique
    tenantId    String
    tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    status      DomainStatus @default(PENDING)
    verifyToken String       // random token used in the TXT record
    isPrimary   Boolean      @default(false)
    createdAt   DateTime     @default(now())
    verifiedAt  DateTime?
    @@index([tenantId])
  }
  enum DomainStatus { PENDING VERIFIED ACTIVE FAILED }

Steps:
1. Migration for the Domain model.
2. Admin "Domains" settings page: add a domain; display the required DNS
   records (CNAME → our app host, and TXT `_cb-verify=<verifyToken>`); a
   "Verify" button; show current status per domain; set-primary toggle.
3. Verification route handler: do a DNS lookup (node 'dns/promises') for the
   TXT record; on match, set status PENDING→VERIFIED→ACTIVE and verifiedAt.
4. Update apps/web middleware: resolve tenant by request host against an
   ACTIVE Domain.hostname FIRST, then fall back to the existing subdomain
   logic. Set the tenant header/rewrite exactly as the current code does.
5. Add a clear code comment + a note in the PR about SSL: if on Vercel, call
   the Vercel Domains API to provision certs; otherwise document the
   reverse-proxy/SSL step for self-hosting.

Acceptance:
- A tenant adds a domain, sees DNS instructions, clicks Verify, and once DNS
  propagates the status flips to ACTIVE.
- Hitting the public site on that custom host renders the correct tenant.
- Unverified / FAILED domains do NOT resolve to any tenant.
- Subdomain routing still works. Tenant isolation preserved.

Constraints: follow existing middleware + settings patterns, run prisma
migrate, keep CSP/security headers on the new routes, don't break subdomains.
```

---

# Priority 2 — Interview scheduling integration

> *A full ATS needs a calendar. Greenhouse + Ashby have it.*

```
Goal: Schedule interviews against an application, invite interviewers + the
candidate, and send calendar invites — starting with self-hosted .ics, with a
clean seam for Google/Microsoft calendar OAuth later.

Reuse: The Application model, the User model (interviewers), the existing
mailer, and the application-detail page in admin.

Data model:
  model Interview {
    id            String   @id @default(cuid())
    tenantId      String
    applicationId String
    application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
    title         String
    startsAt      DateTime
    endsAt        DateTime
    location      String?   // physical or video link
    stage         String?   // pipeline stage this interview belongs to
    status        InterviewStatus @default(SCHEDULED)
    interviewers  InterviewParticipant[]
    createdAt     DateTime @default(now())
    @@index([tenantId])
    @@index([applicationId])
  }
  model InterviewParticipant {
    id          String @id @default(cuid())
    interviewId String
    interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
    userId      String
    user        User   @relation(fields: [userId], references: [id])
    @@unique([interviewId, userId])
  }
  enum InterviewStatus { SCHEDULED COMPLETED CANCELLED NO_SHOW }

Steps:
1. Migration.
2. On the application-detail page, a "Schedule interview" panel: pick
   date/time/duration, location/video link, select interviewer(s) from team
   users, choose stage.
3. Server action to create the Interview + participants.
4. Generate a proper .ics file (VCALENDAR/VEVENT, correct timezone, ORGANIZER
   + ATTENDEEs) and email it to interviewers and the candidate via the
   existing mailer. Include an .ics attachment, not just a link.
5. List upcoming/past interviews on the application; allow cancel (status →
   CANCELLED, send cancellation .ics with METHOD:CANCEL).
6. Add a thin `CalendarProvider` interface with the .ics implementation as the
   default, so Google/MS OAuth can be added later without touching callers.

Acceptance:
- I can schedule an interview from an application, the right people get an
  .ics invite that opens correctly in Google/Apple/Outlook, and it shows on
  the application timeline. Cancel sends a working cancellation.

Constraints: tenant-scope every query, validate inputs (zod), reuse the
mailer, run prisma migrate, don't break the application pipeline.
```

---

# Priority 3 — Candidate assessment / scorecards

> *Beyond star ratings. Greenhouse + Lever have structured scorecards.*

```
Goal: Structured interview scorecards — reusable templates with weighted
criteria, multiple interviewers each submitting scores, and an aggregated
view on the application. Keep the existing star ratings working alongside.

Reuse: Application, User, and the application-detail page.

Data model:
  model ScorecardTemplate {
    id        String @id @default(cuid())
    tenantId  String
    name      String
    jobId     String?  // optional: scope a template to a job/role
    criteria  ScorecardCriterion[]
    createdAt DateTime @default(now())
    @@index([tenantId])
  }
  model ScorecardCriterion {
    id         String @id @default(cuid())
    templateId String
    template   ScorecardTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
    label      String
    weight     Int    @default(1)
    order      Int    @default(0)
  }
  model Evaluation {
    id            String @id @default(cuid())
    tenantId      String
    applicationId String
    application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
    evaluatorId   String
    evaluator     User   @relation(fields: [evaluatorId], references: [id])
    templateId    String
    overall       String?  // strong_yes | yes | no | strong_no
    notes         String?
    scores        EvaluationScore[]
    submittedAt   DateTime?
    @@index([applicationId])
  }
  model EvaluationScore {
    id           String @id @default(cuid())
    evaluationId String
    evaluation   Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
    criterionId  String
    value        Int      // e.g. 1–5
  }

Steps:
1. Migration.
2. Admin: a "Scorecard templates" CRUD page (name, optional job, add/reorder
   weighted criteria).
3. On an application, "Submit evaluation": choose a template, score each
   criterion (1–5), pick an overall recommendation, add notes. One evaluation
   per evaluator per application (allow editing until submitted).
4. Aggregated view on the application: weighted average per criterion + a
   recommendation tally across all evaluators, plus each evaluator's notes.

Acceptance:
- I can build a template, multiple interviewers each submit scores, and the
  application shows a clear weighted summary + recommendation breakdown. Star
  ratings still function.

Constraints: tenant-scope everything, zod validation, run prisma migrate,
don't remove the existing rating feature.
```

---

# Priority 4 — Workflow automation

> *Auto-advance stages + email triggers. All competitors have it.*

```
Goal: A simple rules engine — "when <trigger>, do <actions>" — so tenants can
automate the pipeline (e.g. when an application enters "Interview", send the
candidate an email; auto-reject after N days in "Screening").

Reuse: The application pipeline + stage-change logic, the mailer, and the
shared logger. Match the repo's existing background-job pattern (cron route /
queue / worker) — do NOT add new infra without flagging it.

Data model:
  model AutomationRule {
    id          String   @id @default(cuid())
    tenantId    String
    name        String
    enabled     Boolean  @default(true)
    triggerType String   // APPLICATION_RECEIVED | STAGE_CHANGED | TIME_IN_STAGE
    triggerConfig Json    // e.g. { stage: "Screening", days: 7 }
    actions     Json     // [{ type: "SEND_EMAIL", templateId }, { type: "ADVANCE_STAGE", to }]
    createdAt   DateTime @default(now())
    @@index([tenantId])
  }
  model AutomationRun {
    id        String   @id @default(cuid())
    ruleId    String
    applicationId String
    status    String   // SUCCESS | FAILED
    detail    String?
    ranAt     DateTime @default(now())
  }

Steps:
1. Migration.
2. Admin: rules CRUD UI — name, enable toggle, pick trigger + config, build
   an ordered action list (send email w/ template, advance to stage, assign
   to user, add note).
3. Event hooks: where applications are created and where stages change, call
   an `evaluateRules(event)` function that runs matching enabled rules
   synchronously and logs an AutomationRun per execution.
4. Time-based trigger (TIME_IN_STAGE): a scheduled job following the repo's
   existing cron/worker pattern that scans applications and fires due rules.
5. Make actions idempotent / guard against re-firing the same rule on the same
   application+event.

Acceptance:
- I can create "when application enters Interview → send email", move an
  application there, and the email goes out + an AutomationRun is logged.
  A time-based auto-reject fires on schedule. Disabling a rule stops it.

Constraints: tenant-scope, validate trigger/action JSON with zod, reuse mailer
+ logger, run prisma migrate, never let a rule touch another tenant's data.
```

---

# Priority 5 — Public analytics dashboard

> *Traffic, conversion funnels, source attribution. Teamtailor + SmartRecruiters have it.*

```
Goal: First-party analytics — track career-site traffic and the application
funnel per tenant, with source/UTM attribution, shown in an admin dashboard.

Reuse: apps/web rendering for the tracking hook; Recharts (already available)
for charts; an existing admin dashboard page for layout.

Data model:
  model AnalyticsEvent {
    id        String   @id @default(cuid())
    tenantId  String
    type      String   // PAGE_VIEW | JOB_VIEW | APPLY_START | APPLY_SUBMIT
    jobId     String?
    source    String?  // utm_source or referrer host
    medium    String?  // utm_medium
    campaign  String?
    sessionId String?  // anon cookie id
    createdAt DateTime @default(now())
    @@index([tenantId, type, createdAt])
    @@index([tenantId, jobId])
  }

Steps:
1. Migration.
2. A lightweight tracking endpoint (POST /api/track) + a small client helper
   on apps/web that fires PAGE_VIEW, JOB_VIEW, APPLY_START, APPLY_SUBMIT.
   Capture UTM params (persist to an anon session cookie) and referrer.
   Respect DNT; store no PII.
3. Aggregation queries (grouped, tenant-scoped) for: views over time,
   top jobs, source breakdown, and the funnel
   views → job views → apply start → apply submit (with conversion %).
4. Admin "Analytics" dashboard: date-range picker, KPI cards, a time-series
   line chart, a source/attribution table, and the funnel visual (Recharts).

Acceptance:
- Browsing the public site and applying generates events; the dashboard shows
  accurate traffic, top jobs, source attribution, and funnel conversion for
  the selected range. Data is strictly per-tenant.

Constraints: tenant-scope all reads, no PII stored, keep the tracking endpoint
rate-limited, run prisma migrate, don't slow down public page render
(fire-and-forget the beacon).
```

---

# Priority 6 — Team collaboration (comments on applications)

> *Hiring-team discussion threads. All competitors have it.*

```
Goal: Threaded internal comments on an application, with @mentions and a
notification to mentioned teammates. Internal-only — never visible to candidates.

Reuse: Application, User, the existing mailer/notification mechanism, and the
application-detail page.

Data model:
  model ApplicationComment {
    id            String   @id @default(cuid())
    tenantId      String
    applicationId String
    application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
    authorId      String
    author        User     @relation(fields: [authorId], references: [id])
    body          String
    mentions      String[] // userIds (or a join table if your DB needs it)
    createdAt     DateTime @default(now())
    @@index([applicationId])
  }

Steps:
1. Migration.
2. Comment thread on the application-detail page: list newest activity, a
   composer with @mention autocomplete over team users.
3. Server action to post a comment; parse @mentions; notify mentioned users
   via the existing mailer/notification path.
4. Allow author to delete their own comment.

Acceptance:
- Team members can comment on an application, @mention each other, mentioned
  users get notified, and candidates never see any of it. Tenant-scoped.

Constraints: internal-only access control, tenant-scope, zod-validate body,
run prisma migrate.
```

---

# Priority 7 — Bulk actions (mass status change + export)

> *ATS table productivity. All competitors have it.*

```
Goal: Multi-select rows in the applications table and act on them in bulk —
change stage, reject (with templated email), and export to CSV.

Reuse: The existing applications table + the stage-change server action.

Steps (no schema change needed):
1. Add row checkboxes + a "select all on page" header checkbox to the
   applications table, tracking selected ids in component state.
2. A bulk-action bar that appears when ≥1 row is selected: "Move to stage…",
   "Reject", "Export CSV", with a selected-count and a confirm step for
   destructive actions.
3. Server action accepting an array of application ids: wrap updates in a
   prisma transaction; re-verify every id belongs to the current tenant before
   mutating (reject any that don't).
4. Bulk reject: optionally send a templated rejection email to each via the
   existing mailer.
5. CSV export: stream a tenant-scoped CSV of the selected applications
   (candidate name, job, stage, applied date, rating) with correct
   Content-Disposition.

Acceptance:
- I can select 20 applications, move them all to "Screening" in one click,
  bulk-reject with an email, or export them to CSV. No action can ever touch
  another tenant's rows.

Constraints: tenant-verify the id array server-side, transaction for bulk
writes, reuse mailer, don't break single-row actions.
```

---

# Priority 8 — SEO toolkit (JobPosting schema + per-tenant sitemap)

> *Google Jobs visibility. Teamtailor has it.*

```
Goal: Make every public job page eligible for Google Jobs and make each
tenant's site fully crawlable — JobPosting structured data, a per-tenant
sitemap, robots.txt, and proper meta/OG tags.

Reuse: apps/web job-detail page, the tenant-from-hostname resolution.

Steps (no schema change needed; may add a couple optional fields like
employmentType / salary if not present):
1. On each job-detail page, emit valid schema.org JobPosting JSON-LD
   (title, description, datePosted, validThrough, hiringOrganization,
   jobLocation, employmentType, and baseSalary when available). Follow
   Google's JobPosting requirements exactly.
2. Dynamic per-tenant sitemap at /sitemap.xml: list the tenant's public pages
   + all live job URLs, resolved from the request host. Add <lastmod>.
3. robots.txt that references the sitemap and allows crawling of public pages.
4. Per-page <title>, meta description, and Open Graph / Twitter tags driven by
   job + tenant data (use Next.js generateMetadata).
5. Ensure validThrough is set from the job's close date so stale postings drop.

Acceptance:
- A job page passes Google's Rich Results test for JobPosting; /sitemap.xml on
  any tenant host lists only that tenant's pages + jobs; robots.txt is valid;
  pages have correct titles + OG tags. No cross-tenant leakage in sitemaps.

Constraints: resolve tenant strictly from host, valid JSON-LD only, don't
break existing routing or themed rendering.
```

---

# Priority 9 — White-label (remove Career Builder branding)

> *Enterprise requirement. Most competitors charge extra for it.*

```
Goal: Let enterprise-plan tenants remove all "Career Builder" branding from
their public site and emails, and set their own email sender identity.

Reuse: Tenant model, the plan/billing gating logic, the public site footer,
and the mailer.

Data model (extend Tenant — adapt):
  // add to Tenant:
  removeBranding   Boolean @default(false)
  emailFromName    String?
  emailReplyTo     String?

Steps:
1. Migration for the new Tenant fields.
2. Gate `removeBranding` behind the enterprise plan (reuse existing plan
   checks). Expose a toggle on the tenant's branding/settings page, disabled
   with an upsell hint on lower plans.
3. Public site: when removeBranding is true, hide the "Powered by Career
   Builder" footer/badge and any product-name references.
4. Emails: when set, use emailFromName / emailReplyTo and strip Career Builder
   branding from templates for that tenant.

Acceptance:
- An enterprise tenant toggles white-label on and their public site + emails
  show zero Career Builder branding with their own sender name. Free/pro
  tenants can't enable it and see an upgrade prompt.

Constraints: enforce the plan gate server-side (not just UI), tenant-scope,
run prisma migrate, don't change branding for tenants who haven't opted in.
```

---

# Priority 10 — A/B testing for career pages

> *Optimize conversion. Teamtailor has it (limited).*

```
Goal: Run simple A/B tests on a career page — define variants, split traffic,
track a conversion goal (e.g. apply-submit), and show results with a clear
winner indication.

Reuse: The page/version system, the AnalyticsEvent model from Priority 5
(build that first — this depends on it), and the public rendering path.

Data model:
  model Experiment {
    id         String   @id @default(cuid())
    tenantId   String
    pageId     String
    name       String
    status     String   // DRAFT | RUNNING | STOPPED
    goal       String   // e.g. APPLY_SUBMIT
    variants   ExperimentVariant[]
    createdAt  DateTime @default(now())
    @@index([tenantId])
  }
  model ExperimentVariant {
    id           String @id @default(cuid())
    experimentId String
    experiment   Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
    name         String  // "A" / "B"
    weight       Int     @default(50)
    pageVersionId String // which page version this variant renders
  }

Steps:
1. Migration.
2. Admin: create an experiment on a page, define 2+ variants (each pointing at
   a page version) with weights, set the conversion goal, start/stop.
3. Public render: on first visit, assign a variant by weight, persist the
   assignment in a cookie, and render that variant's version. Emit an
   analytics event tagged with experimentId + variant on view and on goal.
4. Results page: per variant, show visitors, conversions, conversion rate, and
   a basic significance / "leading variant" indicator.

Acceptance:
- I can run an A/B test on a career page, returning visitors stay in their
  assigned variant, and the results page shows per-variant conversion with a
  leading variant. Tenant-scoped.

Constraints: depends on Priority 5 analytics; stable cookie-based assignment;
tenant-scope; run prisma migrate; don't disrupt non-experiment pages.
```

---

# Priority 11 — Careers API (public REST + API keys)

> *Headless / developer integrations. Ashby + Greenhouse have it.*

```
Goal: A public, key-authenticated REST API so tenants can build headless
career sites or integrations — list jobs, get a job, submit an application.

Reuse: JobPosting + Application models, the existing rate-limiter + input
validation, and the candidate apply flow logic.

Data model:
  model ApiKey {
    id        String   @id @default(cuid())
    tenantId  String
    name      String
    hashedKey String   @unique  // store a hash, show the raw key once
    lastUsedAt DateTime?
    revokedAt DateTime?
    createdAt DateTime @default(now())
    @@index([tenantId])
  }

Steps:
1. Migration.
2. Admin "API keys" page: create a key (show the raw value ONCE, store only a
   hash), list keys, revoke.
3. Auth middleware for /api/v1/* : read the key from an Authorization header,
   hash + look it up, resolve the tenant, reject revoked/invalid keys, update
   lastUsedAt. Apply rate limiting per key.
4. Endpoints (all auto-scoped to the key's tenant):
   - GET  /api/v1/jobs            (paginated, filterable: dept, location, q)
   - GET  /api/v1/jobs/:id
   - POST /api/v1/applications    (validated body; reuse the apply logic;
                                    enforce file/security validation)
5. Proper CORS for public consumption, consistent JSON error shapes, and a
   short OpenAPI spec / README documenting the endpoints.

Acceptance:
- A tenant creates a key, fetches their jobs and a single job, and submits an
  application via the API. Requests are tenant-scoped to the key, revoked keys
  are rejected, and rate limits apply. A wrong/missing key returns 401.

Constraints: never expose another tenant's data via a key, hash keys at rest,
keep apply-flow security validation, run prisma migrate.
```

---

# Priority 12 — Referral tracking

> *Employee referral programs. Greenhouse + Lever have it.*

```
Goal: Track employee/source referrals on applications via a referral link or
code, attribute applications to the referrer, and report on it.

Reuse: The AnalyticsEvent source attribution from Priority 5, JobPosting +
Application, and the public apply flow.

Data model:
  model ReferralLink {
    id         String   @id @default(cuid())
    tenantId   String
    code       String   @unique
    referrerName  String
    referrerEmail String?
    jobId      String?  // optional: scope to a job
    createdAt  DateTime @default(now())
    @@index([tenantId])
  }
  // add to Application:
  referralCode String?

Steps:
1. Migration.
2. Admin: create referral links (generate a unique code, optional job,
   referrer name/email) and list them.
3. Public: a ?ref=<code> param on job/apply URLs persists the code to a cookie
   and stamps the Application.referralCode on submit. Tag the AnalyticsEvent
   source = "referral:<code>".
4. Reporting: a table of referrals → applications generated → how many
   advanced past screening / were hired, per referrer.

Acceptance:
- Applying through a ?ref= link attributes the application to the right
  referrer, and the referral report shows counts and outcomes per referrer.
  Tenant-scoped.

Constraints: tenant-scope, validate the code, run prisma migrate, don't break
the normal (no-referral) apply path.
```

---

## Suggested build order (dependencies matter)

1. **Custom domains** (1) — highest brand value, self-contained.
2. **SEO toolkit** (8) — quick win, big visibility payoff, no dependencies.
3. **Analytics** (5) — foundational; **A/B testing (10)** and **referral tracking (12)** both build on it, so do it before them.
4. **Bulk actions** (7) + **comments** (6) — fast ATS-productivity wins.
5. **Scorecards** (3) + **interview scheduling** (2) — core ATS depth.
6. **Workflow automation** (4) — pairs well after scheduling + scorecards exist to act on.
7. **White-label** (9) — small, plan-gated, do whenever enterprise asks.
8. **A/B testing (10)** and **referral tracking (12)** — after analytics is live.
9. **Careers API** (11) — last; lets everyone build headless on top of the finished feature set.

---

## After each feature, before you commit

- [ ] Reviewed the actual diff (didn't blind-accept)
- [ ] `npx prisma migrate dev` ran cleanly (if schema changed)
- [ ] `pnpm typecheck && pnpm lint` pass
- [ ] Every new query is tenant-scoped — spot-checked
- [ ] Existing editor / billing / auth / preview still work
- [ ] Noted any new env var or third-party setup in the PR description
