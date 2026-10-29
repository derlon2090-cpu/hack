import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, videos } from "@/lib/schema";
import { isShareAvailable } from "@/lib/session-lifecycle";

type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const [video] = await db.select({ id: videos.id, title: videos.title, durationSeconds: videos.durationSeconds, sessionName: sessions.name, shareToken: videos.shareToken, shareExpiresAt: videos.shareExpiresAt }).from(videos).innerJoin(sessions, eq(videos.sessionId, sessions.id)).where(eq(videos.shareToken, token)).limit(1);
  if (!video || !isShareAvailable(video.shareToken, video.shareExpiresAt)) return NextResponse.json({ error: "This share link has expired or is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(video, { headers: { "Cache-Control": "no-store" } });
}
