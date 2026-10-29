const attempts = new Map<string, { count: number; updatedAt: number }>();

export function failureDelayMs(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  const count = current && now - current.updatedAt < 15 * 60_000 ? current.count + 1 : 1;
  attempts.set(key, { count, updatedAt: now });
  return Math.min(250 * 2 ** Math.min(count - 1, 5), 8_000);
}

export function clearFailures(key: string) { attempts.delete(key); }

