import { NextRequest, NextResponse } from "next/server";

const cookieName = "frameflow-session";

async function validSession(token: string | undefined) {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret || secret.length < 32) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const expected = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (expected.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (mismatch !== 0) return false;
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string; exp?: number };
    return data.email === (process.env.ADMIN_EMAIL?.toLowerCase() || "admin") && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function isPublicApi(path: string, method: string) {
  if (path.startsWith("/api/auth/")) return true;
  if (path.startsWith("/api/resolve/") || path.startsWith("/api/share/")) return true;
  if (path.startsWith("/api/sessions/") && (path.endsWith("/public") || path.endsWith("/consent") && method === "POST" || path.endsWith("/visit") && method === "POST")) return true;
  if (path.startsWith("/api/links/") && (path.endsWith("/consent") && method === "POST" || method === "POST" && !path.endsWith("/consent"))) return true;
  if (path === "/api/photos" && method === "POST") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/favicon.svg" || pathname.startsWith("/s/") || pathname.startsWith("/wal/") || pathname.startsWith("/l/") || pathname.startsWith("/v/")) return NextResponse.next();
  if (pathname.startsWith("/api/") && isPublicApi(pathname, request.method)) return NextResponse.next();
  if (await validSession(request.cookies.get(cookieName)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"] };
