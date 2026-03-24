#!/usr/bin/env tsx
/*
 * Production Seed — creates the initial admin user in Turso/production DB.
 *
 * Usage:
 *   # Set your Turso URL
 *   export DATABASE_URL="libsql://career-builder-xxx.turso.io?authToken=YOUR_TOKEN"
 *
 *   # Run from packages/database
 *   cd packages/database && npx tsx seed-production.ts
 *
 * This is a MINIMAL seed — only creates what's needed to log in.
 * Use the full seed.ts for demo data.
 */

import { prisma } from "./client";

async function hashPassword(password: string): Promise<string> {
  try {
    const bcrypt = await import("bcrypt") as { hash: (data: string, rounds: number) => Promise<string> };
    return bcrypt.hash(password, 12);
  } catch {
    // bcrypt may not be in this package's deps — install if needed
    console.error("❌ bcrypt not found. Run: npm install bcrypt");
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 Production seed — creating minimal data...\n");

  const dbUrl = process.env.DATABASE_URL || "";
  console.log(`  Database: ${dbUrl.startsWith("libsql://") ? "Turso" : dbUrl.startsWith("file:") ? "SQLite" : "Unknown"}`);

  // 1. Default tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "My Company",
      domain: null,
      theme: JSON.stringify({
        colors: { primary: "#2563eb", secondary: "#7c3aed", accent: "#f59e0b", background: "#ffffff", text: "#111827" },
        fonts: { heading: "Inter", body: "Inter" },
        borderRadius: "rounded",
        cardShadow: "md",
      }),
      branding: JSON.stringify({
        companyName: "My Company",
        logo: "",
        tagline: "Building the future, together.",
      }),
      plan: "free",
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Admin user
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email_tenantId: { email: "admin@company.com", tenantId: tenant.id } },
    update: { passwordHash: adminHash }, // Always update password on re-seed
    create: {
      email: "admin@company.com",
      name: "Admin",
      passwordHash: adminHash,
      role: "admin",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ Admin: ${admin.email} (password: ${adminPassword === "admin123" ? "admin123" : "***"})`);

  // 3. Super Admin user
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "superadmin123";
  const superAdminHash = await hashPassword(superAdminPassword);

  const superAdmin = await prisma.user.upsert({
    where: { email_tenantId: { email: "superadmin@company.com", tenantId: tenant.id } },
    update: { passwordHash: superAdminHash },
    create: {
      email: "superadmin@company.com",
      name: "Super Admin",
      passwordHash: superAdminHash,
      role: "super_admin",
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ Super Admin: ${superAdmin.email} (password: ${superAdminPassword === "superadmin123" ? "superadmin123" : "***"})`);

  console.log("\n✅ Production seed complete!");
  console.log("   You can now log in at /login with admin@company.com or superadmin@company.com\n");

  if (adminPassword === "admin123") {
    console.log("⚠️  WARNING: Using default password 'admin123'. Change it after first login!");
    console.log("   Or re-run with: ADMIN_PASSWORD=your-secure-password npx tsx seed-production.ts\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
