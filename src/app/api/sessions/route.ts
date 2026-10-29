import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, photos, videos } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { createSessionInput } from "@/lib/session-validation";
import { newCode, newId } from "@/lib/ids";
import { rateLimit, requestIp } from "@/lib/rate-limit";

const OWNER = "admin";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [rows, photoRows, videoRows] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.ownerId, OWNER)).orderBy(desc(sessions.createdAt)),
    db.select({ id: photos.id, sessionId: photos.sessionId }).from(photos),
    db.select({ id: videos.id, sessionId: videos.sessionId }).from(videos)
  ]);
  const result = rows.map((row) => ({ ...row, photoCount: photoRows.filter((item) => item.sessionId === row.id).length, videoCount: videoRows.filter((item) => item.sessionId === row.id).length }));
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`sessions:${requestIp(request)}`, 20)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = createSessionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid session." }, { status: 400 });
  const input = parsed.data;
  const expiresAt = input.durationDays ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000) : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    try {
      const [session] = await db.insert(sessions).values({ id: newId(), code, name: input.name, purpose: input.purpose || null, locale: input.locale, expiresAt, retentionDays: input.retentionDays, ownerId: OWNER }).returning();
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      return NextResponse.json({ ...session, url: `${origin.replace(/\/$/, "")}/s/${session.code}`, photoCount: 0, videoCount: 0 }, { status: 201 });
    } catch (error) {
      if ((error as { code?: string }).code === "23505" && attempt < 2) continue;
      throw error;
    }
  }
  return NextResponse.json({ error: "Unable to create this session. Please try again." }, { status: 503 });
}
