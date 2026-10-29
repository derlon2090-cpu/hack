import "dotenv/config";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, sql } from "../src/lib/db";
import { photos, sessions, videos } from "../src/lib/schema";
import { deletePhoto, deleteVideo } from "../src/lib/s3";

const fallbackDays = Number(process.env.PHOTO_RETENTION_DAYS || "30");
if (!Number.isSafeInteger(fallbackDays) || fallbackDays < 1) throw new Error("PHOTO_RETENTION_DAYS must be a positive whole number.");
const fallbackCutoff = new Date(Date.now() - fallbackDays * 24 * 60 * 60 * 1000);

try {
  let removedVideos = 0; let removedPhotos = 0;
  const sessionVideos = await db.select({ id: videos.id, objectKey: videos.objectKey, createdAt: videos.createdAt, retentionDays: sessions.retentionDays }).from(videos).innerJoin(sessions, eq(videos.sessionId, sessions.id));
  for (const video of sessionVideos) {
    if (video.createdAt.getTime() >= Date.now() - video.retentionDays * 24 * 60 * 60 * 1000) continue;
    await deleteVideo(video.objectKey); await db.delete(videos).where(eq(videos.id, video.id)); removedVideos++;
  }

  const sessionPhotos = await db.select({ id: photos.id, objectKey: photos.objectKey, createdAt: photos.createdAt, retentionDays: sessions.retentionDays }).from(photos).innerJoin(sessions, eq(photos.sessionId, sessions.id));
  for (const photo of sessionPhotos) {
    if (photo.createdAt.getTime() >= Date.now() - photo.retentionDays * 24 * 60 * 60 * 1000) continue;
    const associated = await db.select({ id: videos.id, objectKey: videos.objectKey }).from(videos).where(eq(videos.photoId, photo.id));
    for (const video of associated) { await deleteVideo(video.objectKey); await db.delete(videos).where(eq(videos.id, video.id)); removedVideos++; }
    await deletePhoto(photo.objectKey); await db.delete(photos).where(eq(photos.id, photo.id)); removedPhotos++;
  }

  const legacy = await db.select({ id: photos.id, objectKey: photos.objectKey }).from(photos).where(and(isNull(photos.sessionId), lt(photos.createdAt, fallbackCutoff)));
  for (const photo of legacy) {
    const associated = await db.select({ id: videos.id, objectKey: videos.objectKey }).from(videos).where(eq(videos.photoId, photo.id));
    for (const video of associated) { await deleteVideo(video.objectKey); await db.delete(videos).where(eq(videos.id, video.id)); removedVideos++; }
    await deletePhoto(photo.objectKey); await db.delete(photos).where(eq(photos.id, photo.id)); removedPhotos++;
  }
  console.log(`Purged ${removedPhotos} photo(s) and ${removedVideos} video(s) according to session retention policies.`);
} finally { await sql.end(); }
