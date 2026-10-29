import { NextResponse } from "next/server";
import { COOKIE, isAdmin } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const authenticated = await isAdmin();
  const token = (await cookies()).get(COOKIE)?.value;
  let email = "";
  if (authenticated && token) {
    const payload = token.split(".")[0];
    try { email = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string }).email || ""; } catch { /* The session validator already rejects malformed data. */ }
  }
  return NextResponse.json({ authenticated, email }, { headers: { "Cache-Control": "no-store" } });
}
