import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ACTOR, makeSession, setSession } from "@/lib/auth";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { clearFailures, failureDelayMs } from "@/lib/login-throttle";

const schema = z.object({ code: z.string().min(1).max(512) });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const ip = requestIp(request);
  if (!rateLimit(`login:${ip}`, 8, 60_000)) return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const hash = process.env.ACCESS_CODE_HASH || process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return NextResponse.json({ error: "Sign-in is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const valid = parsed.success ? await compare(parsed.data.code, hash).catch(() => false) : false;
  if (!valid) {
    await pause(failureDelayMs(ip));
    return NextResponse.json({ error: "The access code is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  clearFailures(ip);
  await setSession(makeSession(ADMIN_ACTOR()));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
