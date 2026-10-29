const windows = new Map<string, { count: number; until: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now >= entry.until) {
    windows.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}
