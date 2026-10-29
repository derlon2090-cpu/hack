import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { db } from "@/lib/db";
import { consents, photos, sessions, videos } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { isStorageConfigured, saveVideo, getPrivatePhoto, deleteVideo } from "@/lib/s3";
import { newId } from "@/lib/ids";
import { z } from "zod";
import { videoArguments } from "@/lib/video-render";

export const runtime = "nodejs";
export const maxDuration = 120;

const inputSchema = z.object({ photoId: z.string().uuid(), durationSeconds: z.union([z.literal(3), z.literal(5), z.literal(10)]), background: z.string().regex(/^[0-9A-Fa-f]{6}$/), title: z.string().max(70).trim().default("") });

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select({ id: videos.id, sessionId: videos.sessionId, sessionName: sessions.name, photoId: videos.photoId, objectKey: videos.objectKey, title: videos.title, background: videos.background, durationSeconds: videos.durationSeconds, size: videos.size, shareToken: videos.shareToken, shareExpiresAt: videos.shareExpiresAt, createdAt: videos.createdAt }).from(videos).innerJoin(sessions, eq(videos.sessionId, sessions.id)).orderBy(desc(videos.createdAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}

function render(args: string[]) {
  const executable = process.env.FFMPEG_PATH || "ffmpeg";
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 90_000);
    child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-2000); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(code === null ? "FFmpeg timed out." : `FFmpeg exited with code ${code}. ${stderr.slice(-240)}`)));
    child.once("close", () => clearTimeout(timeout));
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`render:${requestIp(request)}`, 5, 60_000)) return NextResponse.json({ error: "Video creation is rate limited. Please wait and try again." }, { status: 429 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Private file storage is not configured." }, { status: 503 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid video settings." }, { status: 400 });
  const [source] = await db.select({ photoId: photos.id, sessionId: photos.sessionId, objectKey: photos.objectKey, mimeType: photos.mimeType, name: sessions.name }).from(photos).innerJoin(sessions, eq(photos.sessionId, sessions.id)).innerJoin(consents, eq(photos.consentId, consents.id)).where(eq(photos.id, parsed.data.photoId)).limit(1);
  if (!source?.sessionId || !source.objectKey) return NextResponse.json({ error: "This photo is unavailable." }, { status: 404 });
  const [session] = await db.select({ id: sessions.id, ownerId: sessions.ownerId }).from(sessions).where(eq(sessions.id, source.sessionId)).limit(1);
  if (!session || session.ownerId !== "admin") return NextResponse.json({ error: "This photo is not available to this workspace." }, { status: 403 });

  const workingDirectory = await mkdtemp(join(tmpdir(), "frameflow-render-"));
  const sourcePath = join(workingDirectory, `input${extname(source.objectKey) || ".jpg"}`);
  const outputPath = join(workingDirectory, "output.mp4");
  try {
    const object = await getPrivatePhoto(source.objectKey);
    if (!object.Body) return NextResponse.json({ error: "The selected image could not be read." }, { status: 404 });
    await writeFile(sourcePath, Buffer.from(await object.Body.transformToByteArray()));
    let args: string[];
    try { args = videoArguments(sourcePath, outputPath, parsed.data.durationSeconds, parsed.data.background.toUpperCase(), parsed.data.title, process.env.FFMPEG_FONT_FILE); }
    catch { return NextResponse.json({ error: parsed.data.title ? "Configure FFMPEG_FONT_FILE to add text captions." : "Invalid video settings." }, { status: 400 }); }
    try { await render(args); }
    catch (error) {
      const message = error instanceof Error ? error.message : "FFmpeg unavailable.";
      if (/ENOENT|not recognized|spawn/i.test(message)) return NextResponse.json({ error: "FFmpeg is not installed or FFMPEG_PATH is incorrect." }, { status: 503 });
      return NextResponse.json({ error: "FFmpeg could not produce this MP4. Check the server codec support and font settings." }, { status: 422 });
    }
    const output = await readFile(outputPath);
    if (output.length < 256 || output.subarray(4, 8).toString("ascii") !== "ftyp") return NextResponse.json({ error: "FFmpeg did not produce a valid MP4 file." }, { status: 422 });
    const id = newId(); const objectKey = `sessions/${source.sessionId}/videos/${id}.mp4`;
    await saveVideo(objectKey, output);
    try {
      const [video] = await db.insert(videos).values({ id, sessionId: source.sessionId, photoId: source.photoId, objectKey, title: parsed.data.title || null, background: parsed.data.background.toUpperCase(), durationSeconds: parsed.data.durationSeconds, size: output.length }).returning();
      return NextResponse.json({ ...video, sessionName: source.name }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) { await deleteVideo(objectKey).catch(() => {}); throw error; }
  } finally { await rm(workingDirectory, { recursive: true, force: true }); }
}
