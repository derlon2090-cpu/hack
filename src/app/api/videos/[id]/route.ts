import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, videos } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { deleteVideo, getPrivatePhoto } from "@/lib/s3";
import { newShareToken } from "@/lib/ids";

type Context = { params: Promise<{ id: string }> };
const shareSchema = z.object({ durationDays: z.union([z.literal(1), z.literal(7), z.literal(30)]) });

export async function GET(request: Request, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [video] = await db.select({ key: videos.objectKey, size: videos.size, title: videos.title }).from(videos).innerJoin(sessions, eq(videos.sessionId, sessions.id)).where(eq(videos.id, id)).limit(1);
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const object = await getPrivatePhoto(video.key);
  if (!object.Body) return NextResponse.json({ error: "Video file unavailable." }, { status: 404 });
  const body = Readable.toWeb(object.Body as Readable) as ReadableStream<Uint8Array>;
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(body, { headers: { "Content-Type": "video/mp4", "Content-Length": String(video.size), "Content-Disposition": `${disposition}; filename="frameflow-${id.slice(0, 8)}.mp4"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = shareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid share duration." }, { status: 400 });
  const { id } = await params;
  const shareExpiresAt = new Date(Date.now() + parsed.data.durationDays * 24 * 60 * 60 * 1000);
  const shareToken = newShareToken();
  const [video] = await db.update(videos).set({ shareToken, shareExpiresAt }).where(eq(videos.id, id)).returning({ id: videos.id, shareToken: videos.shareToken, shareExpiresAt: videos.shareExpiresAt });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({ ...video, url: `${origin.replace(/\/$/, "")}/v/${shareToken}` }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (new URL(request.url).origin !== request.headers.get("origin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [video] = await db.select({ id: videos.id, key: videos.objectKey }).from(videos).where(eq(videos.id, id)).limit(1);
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  await deleteVideo(video.key);
  await db.delete(videos).where(eq(videos.id, video.id));
  return NextResponse.json({ ok: true });
}
