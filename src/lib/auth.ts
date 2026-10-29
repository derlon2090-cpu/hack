import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "frameflow-session";
const TTL_SECONDS = 60 * 60 * 8;
export const ADMIN_ACTOR = () => process.env.ADMIN_EMAIL?.toLowerCase() || "admin";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token: string | undefined) {
  if (!token) return false;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return false;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email: string; exp: number };
    return session.email === ADMIN_ACTOR() && session.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function isAdmin() {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}

export async function setSession(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: TTL_SECONDS });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export { COOKIE };
