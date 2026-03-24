/*
 * Templates API — serves career page templates.
 *
 * GET /api/templates        → list all templates (id, name, description, thumbnail)
 * GET /api/templates?id=xxx → get single template with full blocks
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  blocks: any[];
}

function loadTemplates(): TemplateMeta[] {
  const dir = path.join(process.cwd(), "data", "templates");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const templates: TemplateMeta[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const data = JSON.parse(raw);
      templates.push(data);
    } catch {
      // skip malformed files
    }
  }

  return templates;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const templates = loadTemplates();

  if (id) {
    const template = templates.find((t) => t.id === id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  }

  // Return list without blocks (lighter payload)
  const list = templates.map(({ id, name, description, thumbnail, blocks }) => ({
    id,
    name,
    description,
    thumbnail,
    blockCount: blocks.length,
  }));

  return NextResponse.json({ templates: list });
}
