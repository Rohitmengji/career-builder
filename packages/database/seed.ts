/*
 * Database Seed — populates the database with realistic starter data.
 *
 * Run: cd packages/database && npx tsx seed.ts
 */

import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const AUTH_SECRET = process.env.AUTH_SECRET || "career-builder-secret-key";

/**
 * Hash password with bcrypt (cost 12) for new seeds.
 * Uses dynamic import since bcrypt may not be installed in the database package.
 * Falls back to SHA-256 if bcrypt is not available.
 */
async function hashPasswordBcrypt(password: string): Promise<string> {
  try {
    const bcrypt = await import("bcrypt") as { hash: (data: string, rounds: number) => Promise<string> };
    return bcrypt.hash(password, 12);
  } catch {
    // Fallback to legacy SHA-256 if bcrypt not installed in this package
    console.warn("⚠️  bcrypt not found, using legacy SHA-256 for seed. Run: npm install bcrypt");
    return crypto.createHash("sha256").update(AUTH_SECRET + password).digest("hex");
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Tenant ────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Acme Inc.",
      domain: "localhost",
      theme: JSON.stringify({
        colors: { primary: "#2563eb", secondary: "#7c3aed", accent: "#f59e0b", background: "#ffffff", text: "#111827" },
        fonts: { heading: "Inter", body: "Inter" },
        borderRadius: "rounded",
        cardShadow: "md",
      }),
      branding: JSON.stringify({
        companyName: "Acme Inc.",
        logo: "",
        tagline: "Building the future, together.",
      }),
      plan: "pro",
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── Admin User ────────────────────────────────────────────
  const adminHash = await hashPasswordBcrypt("admin123");
  const admin = await prisma.user.upsert({
    where: { email_tenantId: { email: "admin@company.com", tenantId: tenant.id } },
    update: {},
    create: {
      email: "admin@company.com",
      name: "Admin User",
      passwordHash: adminHash,
      role: "admin",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ User: ${admin.email} (${admin.role})`);

  // ─── Hiring Manager ───────────────────────────────────────
  const hmHash = await hashPasswordBcrypt("hiring123");
  const hm = await prisma.user.upsert({
    where: { email_tenantId: { email: "hiring@company.com", tenantId: tenant.id } },
    update: {},
    create: {
      email: "hiring@company.com",
      name: "Sarah Chen",
      passwordHash: hmHash,
      role: "hiring_manager",
      department: "Engineering",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ User: ${hm.email} (${hm.role})`);

  // ─── Recruiter ─────────────────────────────────────────────
  const recruiterHash = await hashPasswordBcrypt("recruiter123");
  const recruiter = await prisma.user.upsert({
    where: { email_tenantId: { email: "recruiter@company.com", tenantId: tenant.id } },
    update: {},
    create: {
      email: "recruiter@company.com",
      name: "Mike Johnson",
      passwordHash: recruiterHash,
      role: "recruiter",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ User: ${recruiter.email} (${recruiter.role})`);

  // ─── Jobs ──────────────────────────────────────────────────
  const jobs = [
    { title: "Senior Frontend Engineer", slug: "senior-frontend-engineer", department: "Engineering", location: "San Francisco, CA", employmentType: "full-time", experienceLevel: "senior", salaryMin: 160000, salaryMax: 220000, isRemote: true, isPublished: true, description: "Join our frontend team to build the next generation of our career platform. You'll work with React, TypeScript, and Next.js to create beautiful, performant user experiences.", requirements: ["5+ years of frontend development", "Expert in React and TypeScript", "Experience with Next.js App Router", "Strong CSS/Tailwind skills", "Experience with testing frameworks"], niceToHave: ["GrapesJS or similar visual editors", "Design system experience", "Performance optimization background"], benefits: ["Competitive salary + equity", "Remote-first culture", "Unlimited PTO", "Health, dental, vision", "$2,000 learning budget"], tags: ["react", "typescript", "next.js", "frontend", "senior"], postedAt: daysAgo(3) },
    { title: "Backend Engineer", slug: "backend-engineer", department: "Engineering", location: "San Francisco, CA", employmentType: "full-time", experienceLevel: "mid", salaryMin: 140000, salaryMax: 190000, isRemote: true, isPublished: true, description: "Build and scale our backend services. Work with Node.js, PostgreSQL, and cloud infrastructure to power our career platform.", requirements: ["3+ years backend development", "Strong Node.js/TypeScript", "SQL database experience", "REST API design", "Cloud infrastructure (AWS/GCP)"], niceToHave: ["Prisma experience", "GraphQL", "Kubernetes"], benefits: ["Competitive salary + equity", "Remote-first culture", "Unlimited PTO", "Health, dental, vision"], tags: ["node.js", "typescript", "postgresql", "backend"], postedAt: daysAgo(5) },
    { title: "Product Designer", slug: "product-designer", department: "Design", location: "New York, NY", employmentType: "full-time", experienceLevel: "senior", salaryMin: 150000, salaryMax: 200000, isRemote: false, isPublished: true, description: "Shape the user experience of our career platform. Work closely with engineering and product to design intuitive, beautiful interfaces.", requirements: ["5+ years of product design", "Expert in Figma", "Strong portfolio", "User research skills", "Design system experience"], niceToHave: ["B2B SaaS experience", "Frontend development skills", "Motion design"], benefits: ["Competitive salary", "NYC office with free lunch", "Health benefits", "Conference budget"], tags: ["design", "figma", "ux", "ui", "product"], postedAt: daysAgo(7) },
    { title: "DevOps Engineer", slug: "devops-engineer", department: "Engineering", location: "Remote", employmentType: "full-time", experienceLevel: "senior", salaryMin: 155000, salaryMax: 210000, isRemote: true, isPublished: true, description: "Own our infrastructure and CI/CD pipeline. Build reliable, scalable systems that our engineering team depends on.", requirements: ["5+ years DevOps/SRE experience", "AWS or GCP expertise", "Terraform/IaC", "Docker and Kubernetes", "CI/CD pipeline design"], niceToHave: ["Monitoring/observability tools", "Security background", "Cost optimization"], benefits: ["Competitive salary + equity", "Remote-first", "Unlimited PTO", "Home office stipend"], tags: ["devops", "aws", "kubernetes", "terraform", "ci/cd"], postedAt: daysAgo(10) },
    { title: "Marketing Manager", slug: "marketing-manager", department: "Marketing", location: "New York, NY", employmentType: "full-time", experienceLevel: "mid", salaryMin: 110000, salaryMax: 150000, isRemote: false, isPublished: true, description: "Lead our marketing efforts to grow awareness and drive signups. You'll own content strategy, campaigns, and analytics.", requirements: ["4+ years of B2B marketing", "Content marketing experience", "Analytics proficiency", "Campaign management", "SEO knowledge"], niceToHave: ["HR tech industry experience", "Video content creation", "Community building"], benefits: ["Competitive salary", "NYC office", "Health benefits", "Marketing conference budget"], tags: ["marketing", "content", "seo", "b2b"], postedAt: daysAgo(14) },
    { title: "Sales Development Rep", slug: "sales-development-rep", department: "Sales", location: "Austin, TX", employmentType: "full-time", experienceLevel: "entry", salaryMin: 60000, salaryMax: 80000, isRemote: false, isPublished: true, description: "Join our growing sales team as an SDR. You'll be the first point of contact for potential customers, qualifying leads and setting up demos.", requirements: ["1+ year in sales or customer-facing role", "Excellent communication skills", "Self-motivated", "CRM experience"], niceToHave: ["SaaS sales experience", "HR tech knowledge"], benefits: ["Base salary + commission", "Austin office", "Health benefits", "Career growth path"], tags: ["sales", "sdr", "entry-level"], postedAt: daysAgo(2) },
    { title: "Engineering Intern", slug: "engineering-intern", department: "Engineering", location: "San Francisco, CA", employmentType: "internship", experienceLevel: "entry", salaryMin: 50000, salaryMax: 65000, isRemote: true, isPublished: true, description: "12-week summer internship working on real features. You'll be paired with a senior engineer and ship code to production.", requirements: ["Currently pursuing CS degree", "Basic programming skills", "Familiarity with web technologies", "Eagerness to learn"], niceToHave: ["React/TypeScript experience", "Open source contributions"], benefits: ["Paid internship", "Mentorship program", "Possible full-time offer", "Housing stipend"], tags: ["internship", "engineering", "entry-level", "summer"], postedAt: daysAgo(1) },
    { title: "Head of People", slug: "head-of-people", department: "People", location: "Remote", employmentType: "full-time", experienceLevel: "executive", salaryMin: 180000, salaryMax: 250000, isRemote: true, isPublished: false, description: "Lead our People team as we scale from 50 to 200+. Own recruiting, culture, compensation, and employee experience.", requirements: ["10+ years in HR/People leadership", "Scaling startups experience", "Compensation & benefits expertise", "Strong people skills"], niceToHave: ["Tech industry background", "DEI program experience"], benefits: ["Competitive salary + equity", "Executive benefits", "Remote-first"], tags: ["people", "hr", "executive", "leadership"], postedAt: daysAgo(20) },
  ];

  for (const job of jobs) {
    const created = await prisma.job.upsert({
      where: { slug_tenantId: { slug: job.slug, tenantId: tenant.id } },
      update: {},
      create: {
        ...job,
        salaryCurrency: "USD",
        salaryPeriod: "yearly",
        requirements: JSON.stringify(job.requirements),
        niceToHave: JSON.stringify(job.niceToHave),
        benefits: JSON.stringify(job.benefits),
        tags: JSON.stringify(job.tags),
        tenantId: tenant.id,
      },
    });
    console.log(`  ✓ Job: ${created.title} (${created.isPublished ? "published" : "draft"})`);
  }

  // ─── Sample Applications ───────────────────────────────────
  const publishedJobs = await prisma.job.findMany({
    where: { tenantId: tenant.id, isPublished: true },
    take: 3,
  });

  const applicants = [
    { firstName: "Alice", lastName: "Wang", email: "alice.wang@email.com", status: "interview" },
    { firstName: "Bob", lastName: "Smith", email: "bob.smith@email.com", status: "screening" },
    { firstName: "Carol", lastName: "Davis", email: "carol.davis@email.com", status: "applied" },
    { firstName: "David", lastName: "Kim", email: "david.kim@email.com", status: "offer" },
    { firstName: "Eve", lastName: "Martinez", email: "eve.martinez@email.com", status: "applied" },
  ];

  for (let i = 0; i < applicants.length; i++) {
    const job = publishedJobs[i % publishedJobs.length];
    const app = applicants[i];
    const created = await prisma.application.create({
      data: {
        firstName: app.firstName,
        lastName: app.lastName,
        email: app.email,
        status: app.status,
        source: "direct",
        jobId: job.id,
        tenantId: tenant.id,
        submittedAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    });
    console.log(`  ✓ Application: ${created.firstName} ${created.lastName} → ${job.title} (${created.status})`);
  }

  // ─── Sample Page ───────────────────────────────────────────
  await prisma.page.upsert({
    where: { slug_tenantId: { slug: "home", tenantId: tenant.id } },
    update: {},
    create: {
      slug: "home",
      title: "Home",
      blocks: JSON.stringify([
        { type: "hero", props: { heading: "Join Our Team", subheading: "Explore open positions at Acme Inc.", ctaText: "View Jobs", ctaLink: "/jobs" } },
        { type: "job-list", props: { heading: "Open Positions", showFilters: true } },
      ]),
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ Page: home`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });