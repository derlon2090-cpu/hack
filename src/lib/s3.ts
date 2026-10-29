import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;
function storage() {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("Private S3 storage is not configured.");
  }
  client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
  });
  return client;
}

export async function savePhoto(key: string, body: Buffer, contentType: string) {
  await storage().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: "AES256", Metadata: { application: "frameflow-studio" } }));
}

export const saveVideo = (key: string, body: Buffer) => savePhoto(key, body, "video/mp4");

export async function getPrivatePhoto(key: string) {
  return storage().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

export async function deletePhoto(key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

export const deleteVideo = deletePhoto;

export function isStorageConfigured() {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}
