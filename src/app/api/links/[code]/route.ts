import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { links } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { rateLimit, requestIp } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ code: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const body = await request.json().catch(() => null) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const [row] = await db.update(links).set({ active: body.active }).where(eq(links.code, code)).returning();
  if (!row) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function POST(request: Request, { params }: Ctx) {
  if (!rateLimit(`visit:${requestIp(request)}`, 90)) return NextResponse.json({ ok: true }, { status: 202 });
  const { code } = await params;
  await db.update(links).set({ clicks: sql`${links.clicks} + 1` }).where(eq(links.code, code));
  return NextResponse.json({ ok: true }, { status: 202 });
}
