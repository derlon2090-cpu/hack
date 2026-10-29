import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos, videos } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { deletePhoto, getPrivatePhoto } from "@/lib/s3";
import { Readable } from "node:stream";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [photo] = await db.select({ key: photos.objectKey, mimeType: photos.mimeType, size: photos.size }).from(photos).where(eq(photos.id, id)).limit(1);
  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const object = await getPrivatePhoto(photo.key);
  if (!object.Body) return NextResponse.json({ error: "Photo data unavailable." }, { status: 404 });
  const body = Readable.toWeb(object.Body as Readable) as ReadableStream<Uint8Array>;
  return new Response(body, { headers: { "Content-Type": photo.mimeType, "Content-Length": String(photo.size), "Content-Disposition": "inline", "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}

export async function DELETE(request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (new URL(request.url).origin !== request.headers.get("origin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [photo] = await db.select({ id: photos.id, key: photos.objectKey }).from(photos).where(eq(photos.id, id)).limit(1);
  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const associatedVideos = await db.select({ id: videos.id, key: videos.objectKey }).from(videos).where(eq(videos.photoId, id));
  for (const video of associatedVideos) await deletePhoto(video.key);
  await deletePhoto(photo.key);
  await db.delete(photos).where(eq(photos.id, id));
  return NextResponse.json({ ok: true });
}
