import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { isSessionAvailable } from "@/lib/session-lifecycle";

type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, { params }: Context) {
  if (!rateLimit(`session-public:${requestIp(request)}`, 120)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { code } = await params;
  const now = new Date();
  const [session] = await db.select({ code: sessions.code, name: sessions.name, purpose: sessions.purpose, destination: sessions.destination, locale: sessions.locale, active: sessions.active, expiresAt: sessions.expiresAt, retentionDays: sessions.retentionDays }).from(sessions).where(eq(sessions.code, code)).limit(1);
  if (!session || !isSessionAvailable(session.active, session.expiresAt, now.getTime())) return NextResponse.json({ error: "Session unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  if (!rateLimit(`session-visit:${requestIp(request)}`, 90)) return NextResponse.json({ ok: true }, { status: 202 });
  const { code } = await params;
  const [session] = await db.select({ id: sessions.id, active: sessions.active, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.code, code)).limit(1);
  if (session && isSessionAvailable(session.active, session.expiresAt)) await db.update(sessions).set({ views: sql`${sessions.views} + 1` }).where(eq(sessions.id, session.id));
  return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
