/*
 * /api/ai/demo-site — Generate a demo career site for sales outreach.
 *
 * POST { companyName, industry }
 * Returns: { pages: [...], jobs: [...], previewUrl }
 *
 * This is a public endpoint (no auth) — generates a preview site
 * for the sales team to share with prospects.
 */

import { NextResponse, type NextRequest } from "next/server";

/* ------------------------------------------------------------------ */
/*  Simple in-memory rate limiter (per IP, 10 req / 60s)               */
/* ------------------------------------------------------------------ */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

interface DemoRequest {
  companyName: string;
  industry: string;
}

interface DemoPage {
  slug: string;
  title: string;
  description: string;
  sections: string[];
}

interface DemoJob {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
}

const INDUSTRY_TEMPLATES: Record<string, { departments: string[]; roles: string[]; locations: string[] }> = {
  technology: {
    departments: ["Engineering", "Product", "Design", "Data Science"],
    roles: ["Senior Frontend Engineer", "Backend Developer", "Product Manager", "UX Designer", "ML Engineer", "DevOps Engineer"],
    locations: ["San Francisco, CA", "New York, NY", "Remote", "Austin, TX"],
  },
  fintech: {
    departments: ["Engineering", "Risk & Compliance", "Product", "Operations"],
    roles: ["Full Stack Engineer", "Compliance Analyst", "Product Manager", "Risk Engineer", "Data Analyst", "QA Engineer"],
    locations: ["New York, NY", "London, UK", "Remote", "Singapore"],
  },
  healthcare: {
    departments: ["Engineering", "Clinical", "Product", "Research"],
    roles: ["Software Engineer", "Clinical Data Scientist", "Product Designer", "Research Associate", "DevOps Engineer", "QA Lead"],
    locations: ["Boston, MA", "San Diego, CA", "Remote", "Chicago, IL"],
  },
  ecommerce: {
    departments: ["Engineering", "Marketing", "Product", "Supply Chain"],
    roles: ["Frontend Developer", "Growth Marketing Manager", "Product Manager", "Supply Chain Analyst", "Data Engineer", "UX Researcher"],
    locations: ["Seattle, WA", "Los Angeles, CA", "Remote", "New York, NY"],
  },
  saas: {
    departments: ["Engineering", "Sales", "Product", "Customer Success"],
    roles: ["Senior Engineer", "Account Executive", "Product Manager", "Customer Success Manager", "Solutions Architect", "Technical Writer"],
    locations: ["San Francisco, CA", "Remote", "Denver, CO", "Austin, TX"],
  },
  default: {
    departments: ["Engineering", "Marketing", "Operations", "Design"],
    roles: ["Software Engineer", "Marketing Manager", "Operations Lead", "Product Designer", "Data Analyst", "Project Manager"],
    locations: ["New York, NY", "Remote", "Chicago, IL", "Los Angeles, CA"],
  },
};

function generateDemoSite(companyName: string, industry: string): { pages: DemoPage[]; jobs: DemoJob[] } {
  const template = INDUSTRY_TEMPLATES[industry] || INDUSTRY_TEMPLATES.default;

  const pages: DemoPage[] = [
    {
      slug: "home",
      title: `${companyName} — Join Our Team`,
      description: `Explore open positions at ${companyName} and help us shape the future of ${industry}.`,
      sections: [
        "Hero — We're hiring across all teams",
        `Stats — ${template.roles.length} open roles, ${template.departments.length} teams, ${template.locations.length} offices`,
        "Featured Jobs — Top 3 positions",
        "Culture Highlights — What makes us different",
        "CTA — Apply now",
      ],
    },
    {
      slug: "about",
      title: `About ${companyName}`,
      description: `Learn about ${companyName}'s mission, values, and the team behind our products.`,
      sections: [
        "Company Mission",
        "Our Values — 4 core pillars",
        "Leadership Team",
        "Office Locations",
        "Join Us CTA",
      ],
    },
    {
      slug: "jobs",
      title: `Open Positions at ${companyName}`,
      description: `Browse all ${template.roles.length} open positions across ${template.departments.length} departments.`,
      sections: [
        "Search & Filter Bar",
        "Department Facets",
        "Job Cards Grid",
        "Pagination",
      ],
    },
    {
      slug: "culture",
      title: `Life at ${companyName}`,
      description: `Discover our culture, benefits, and what it's like to work at ${companyName}.`,
      sections: [
        "Culture Hero",
        "Benefits Grid — 6 perks",
        "Team Photos Gallery",
        "Employee Testimonials",
        "Diversity & Inclusion",
      ],
    },
  ];

  const jobs: DemoJob[] = template.roles.map((role, i) => ({
    title: role,
    department: template.departments[i % template.departments.length],
    location: template.locations[i % template.locations.length],
    type: i % 5 === 4 ? "Contract" : "Full-time",
    description: `Join ${companyName} as a ${role}. Work with a world-class team building products that impact millions of users. We offer competitive compensation, flexible work arrangements, and a collaborative environment.`,
  }));

  return { pages, jobs };
}

/*
 * In-memory demo store.
 * In production, replace with a database/KV store.
 * Entries auto-expire after 24 hours, max 500 entries.
 */
const MAX_DEMOS = 500;
const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface StoredDemo {
  demoId: string;
  companyName: string;
  industry: string;
  pages: DemoPage[];
  jobs: DemoJob[];
  generatedAt: string;
}

const demoStore = new Map<string, StoredDemo>();

function pruneStore() {
  const now = Date.now();
  for (const [id, demo] of demoStore) {
    if (now - new Date(demo.generatedAt).getTime() > DEMO_TTL_MS) {
      demoStore.delete(id);
    }
  }
  // Hard cap
  if (demoStore.size > MAX_DEMOS) {
    const oldest = [...demoStore.keys()].slice(0, demoStore.size - MAX_DEMOS);
    oldest.forEach((id) => demoStore.delete(id));
  }
}

/** GET /api/ai/demo-site?id=xxx — Retrieve a stored demo */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing demo id" }, { status: 400 });
  }

  const demo = demoStore.get(id);
  if (!demo) {
    return NextResponse.json({ error: "Demo not found or expired" }, { status: 404 });
  }

  return NextResponse.json(demo);
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body: DemoRequest = await request.json();

    if (!body.companyName || body.companyName.length < 2) {
      return NextResponse.json({ error: "Company name is required (min 2 characters)" }, { status: 400 });
    }

    const companyName = body.companyName.trim().slice(0, 100);
    const industry = body.industry?.trim().toLowerCase() || "default";

    const { pages, jobs } = generateDemoSite(companyName, industry);

    const demoId = Buffer.from(`${companyName}-${Date.now()}`).toString("base64url").slice(0, 12);
    const previewUrl = `/demo/${demoId}`;

    // Store for later retrieval
    pruneStore();
    demoStore.set(demoId, {
      demoId,
      companyName,
      industry,
      pages,
      jobs,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      demoId,
      companyName,
      industry,
      pages,
      jobs,
      previewUrl,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /api/ai/demo-site] Error:", error);
    return NextResponse.json({ error: "Failed to generate demo site" }, { status: 500 });
  }
}
