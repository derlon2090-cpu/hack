import { NextResponse } from "next/server";
import { desc, eq, gt, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { consents, links, photos, sessions } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { uploadInput } from "@/lib/validation";
import { newId } from "@/lib/ids";
import { deletePhoto, isStorageConfigured, savePhoto } from "@/lib/s3";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { mayUploadPhoto } from "@/lib/camera-consent";
import { isSessionAvailable } from "@/lib/session-lifecycle";
import { isValidImagePayload } from "@/lib/image-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

function isMissingPhotoContextColumns(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42703";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let rows;
  try {
    rows = await db.select({ id: photos.id, linkId: photos.linkId, sessionId: photos.sessionId, sessionName: sql<string | null>`coalesce(${sessions.name}, ${links.name})`, sessionCode: sessions.code, linkCode: links.code, destination: sql<string | null>`coalesce(${sessions.destination}, ${links.destination})`, deviceType: consents.deviceType, region: consents.region, objectKey: photos.objectKey, mimeType: photos.mimeType, size: photos.size, createdAt: photos.createdAt }).from(photos).leftJoin(links, eq(photos.linkId, links.id)).leftJoin(sessions, eq(photos.sessionId, sessions.id)).leftJoin(consents, eq(photos.consentId, consents.id)).orderBy(desc(photos.createdAt));
  } catch (error) {
    // Keep the dashboard available while a deployment is waiting for migration 0003.
    if (!isMissingPhotoContextColumns(error)) throw error;
    const legacyRows = await db.select({ id: photos.id, linkId: photos.linkId, sessionId: photos.sessionId, sessionName: sql<string | null>`coalesce(${sessions.name}, ${links.name})`, sessionCode: sessions.code, linkCode: links.code, destination: sql<string | null>`coalesce(${sessions.destination}, ${links.destination})`, objectKey: photos.objectKey, mimeType: photos.mimeType, size: photos.size, createdAt: photos.createdAt }).from(photos).leftJoin(links, eq(photos.linkId, links.id)).leftJoin(sessions, eq(photos.sessionId, sessions.id)).orderBy(desc(photos.createdAt));
    rows = legacyRows.map((row) => ({ ...row, deviceType: null, region: null }));
  }
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!rateLimit(`photo:${requestIp(request)}`, 8)) return NextResponse.json({ error: "Too many upload attempts." }, { status: 429 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Private image storage is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 7 * 1024 * 1024) return NextResponse.json({ error: "Upload is too large." }, { status: 413 });
  const raw = await request.json().catch(() => null);
  const parsed = uploadInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid image or confirmation." }, { status: 400 });
  const { consentId, mimeType, data } = parsed.data;
  const [consent] = await db.select({ id: consents.id, linkId: consents.linkId, sessionId: consents.sessionId }).from(consents).where(and(eq(consents.id, consentId), eq(consents.decision, "granted"), gt(consents.createdAt, new Date(Date.now() - 30 * 60_000)))).limit(1);
  if (!mayUploadPhoto(Boolean(consent), parsed.data.explicitConfirmation)) return NextResponse.json({ error: "An active camera consent and explicit confirmation are required." }, { status: 403 });
  if (consent.sessionId) {
    const [activeSession] = await db.select({ id: sessions.id, active: sessions.active, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.id, consent.sessionId)).limit(1);
    if (!activeSession || !isSessionAvailable(activeSession.active, activeSession.expiresAt)) return NextResponse.json({ error: "This session has expired or been cancelled." }, { status: 410 });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
  const buffer = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
  if (!isValidImagePayload(mimeType, buffer)) return NextResponse.json({ error: "Image must be a valid JPEG, PNG, or WebP under 5 MB." }, { status: 400 });
  const id = newId();
  const scopeId = consent.sessionId || consent.linkId;
  if (!scopeId) return NextResponse.json({ error: "The consent is not linked to an active session." }, { status: 403 });
  const objectKey = `${consent.sessionId ? "sessions" : "legacy"}/${scopeId}/photos/${id}.${mimeType.split("/")[1]}`;
  try { await savePhoto(objectKey, buffer, mimeType); }
  catch (error) { console.error("Private image storage upload failed", error); return NextResponse.json({ error: "Unable to save photo." }, { status: 503 }); }
  let photo;
  try { [photo] = await db.insert(photos).values({ id, linkId: consent.linkId, sessionId: consent.sessionId, consentId, objectKey, mimeType, size: buffer.length }).returning({ id: photos.id, createdAt: photos.createdAt }); }
  catch (error) { await deletePhoto(objectKey).catch((cleanupError) => console.error("Orphaned image cleanup failed", cleanupError)); throw error; }
  return NextResponse.json(photo, { status: 201 });
}
