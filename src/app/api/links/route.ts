import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { links } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { linkInput } from "@/lib/validation";
import { newCode, newId } from "@/lib/ids";
import { rateLimit, requestIp } from "@/lib/rate-limit";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(links).orderBy(desc(links.createdAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`create:${requestIp(request)}`, 20)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = linkInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid link." }, { status: 400 });
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    try {
      const [row] = await db.insert(links).values({ id: newId(), code, ...parsed.data }).returning();
      return NextResponse.json(row, { status: 201 });
    } catch (error) {
      if (attempt === 2) throw error;
      const [existing] = await db.select({ code: links.code }).from(links).where(eq(links.code, code)).limit(1);
      if (!existing && attempt < 2) continue;
    }
  }
  return NextResponse.json({ error: "Unable to allocate a unique link. Try again." }, { status: 503 });
}
