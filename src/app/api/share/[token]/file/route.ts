import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videos } from "@/lib/schema";
import { getPrivatePhoto } from "@/lib/s3";
import { isShareAvailable } from "@/lib/session-lifecycle";

type Context = { params: Promise<{ token: string }> };
export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  const [video] = await db.select({ key: videos.objectKey, size: videos.size, shareToken: videos.shareToken, shareExpiresAt: videos.shareExpiresAt }).from(videos).where(eq(videos.shareToken, token)).limit(1);
  if (!video || !isShareAvailable(video.shareToken, video.shareExpiresAt)) return NextResponse.json({ error: "This share link has expired or is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const object = await getPrivatePhoto(video.key);
  if (!object.Body) return NextResponse.json({ error: "Video file unavailable." }, { status: 404 });
  const body = Readable.toWeb(object.Body as Readable) as ReadableStream<Uint8Array>;
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(body, { headers: { "Content-Type": "video/mp4", "Content-Length": String(video.size), "Content-Disposition": `${disposition}; filename="frameflow-share.mp4"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
