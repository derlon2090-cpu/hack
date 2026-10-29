export function isSessionAvailable(active: boolean, expiresAt: Date | string | null, now = Date.now()) {
  return active && (expiresAt === null || Date.parse(typeof expiresAt === "string" ? expiresAt : expiresAt.toISOString()) > now);
}

export function isShareAvailable(token: string | null, expiresAt: Date | string | null, now = Date.now()) {
  return Boolean(token && expiresAt && Date.parse(typeof expiresAt === "string" ? expiresAt : expiresAt.toISOString()) > now);
}
