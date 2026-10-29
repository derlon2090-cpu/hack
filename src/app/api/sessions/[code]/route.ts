import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, photos, videos } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { sessionStatusInput } from "@/lib/session-validation";
import { deletePhoto, deleteVideo, isStorageConfigured } from "@/lib/s3";

type Context = { params: Promise<{ code: string }> };
const OWNER = "admin";

export async function PATCH(request: Request, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = sessionStatusInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session status." }, { status: 400 });
  const { code } = await params;
  const [updated] = await db.update(sessions).set({ active: parsed.data.active }).where(and(eq(sessions.code, code), eq(sessions.ownerId, OWNER))).returning();
  if (!updated) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const [session] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.code, code), eq(sessions.ownerId, OWNER))).limit(1);
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const [photoRows, videoRows] = await Promise.all([
    db.select({ objectKey: photos.objectKey }).from(photos).where(eq(photos.sessionId, session.id)),
    db.select({ objectKey: videos.objectKey }).from(videos).where(eq(videos.sessionId, session.id))
  ]);
  if ((photoRows.length || videoRows.length) && !isStorageConfigured()) return NextResponse.json({ error: "Private file storage is not configured; session files were retained." }, { status: 503 });
  for (const row of videoRows) await deleteVideo(row.objectKey);
  for (const row of photoRows) await deletePhoto(row.objectKey);
  await db.delete(sessions).where(eq(sessions.id, session.id));
  return NextResponse.json({ ok: true });
}
