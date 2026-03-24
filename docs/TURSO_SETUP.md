# Turso Database Setup for Vercel Deployment

Your Vercel deployment requires **Turso** (free tier, 8GB) because Vercel has an ephemeral filesystem — SQLite `file:` URLs don't persist between requests.

## Quick Setup (5 minutes)

### 1. Install Turso CLI

```bash
# macOS
brew install tursodatabase/tap/turso

# Or with curl
curl -sSfL https://get.tur.so/install.sh | bash
```

### 2. Sign up & create database

```bash
turso auth signup          # or: turso auth login
turso db create career-builder
turso db show career-builder --url     # Copy the libsql:// URL
turso db tokens create career-builder  # Copy the auth token
```

### 3. Set Vercel environment variables

Go to: **Vercel Dashboard → career-builder-admin → Settings → Environment Variables**

Add these for **Production** and **Preview**:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | `libsql://your-db-name-your-username.turso.io?authToken=YOUR_TOKEN` | `libsql://career-builder-rohitmengji.turso.io?authToken=eyJ...` |
| `TURSO_AUTH_TOKEN` | Your token (optional if in URL) | `eyJ...` |

### 4. Push your schema to Turso

```bash
# From packages/database directory
cd packages/database

# Set the Turso URL temporarily
export DATABASE_URL="libsql://career-builder-YOUR_USERNAME.turso.io"
export TURSO_AUTH_TOKEN="YOUR_TOKEN"

# Push schema
npx prisma db push

# Seed initial data (admin user etc.)
npx tsx seed.ts
```

### 5. Redeploy

```bash
# From project root — push to trigger Vercel rebuild
git add -A && git commit -m "fix: turso db for vercel" && git push
```

### 6. Verify

Visit: `https://career-builder-admin.vercel.app/api/health`

You should see:
```json
{
  "status": "ok",
  "database": {
    "healthy": true,
    "provider": "libsql",
    "urlType": "turso"
  }
}
```

## How It Works

The `client.ts` in `packages/database` **already supports Turso**:

- If `DATABASE_URL` starts with `libsql://` → uses `@prisma/adapter-libsql`
- If `DATABASE_URL` starts with `file:` → uses local SQLite (development)
- The driver adapter is already installed (`@libsql/client`, `@prisma/adapter-libsql`)

## Local Development

Keep using SQLite locally — no changes needed:

```
# packages/database/.env
DATABASE_URL="file:/Users/rohitmengji/Desktop/career-builder/packages/database/prisma/dev.db"
```

## Cost

**Turso Free Tier:**
- 8 GB storage
- 500 databases  
- 1 billion row reads/month
- 25 million row writes/month
- **$0/month** — more than enough for your SaaS

## Troubleshooting

### "URL undefined" error
- Make sure `DATABASE_URL` is set in Vercel env vars (not just `.env.local`)
- URL must start with `libsql://` for Turso

### "Table not found" error  
- You forgot to push the schema: `npx prisma db push`
- Or forgot to seed: `npx tsx seed.ts`

### Works locally but not on Vercel
- Local uses `file:` (SQLite), Vercel needs `libsql://` (Turso)
- They're separate databases — you need to seed Turso too
