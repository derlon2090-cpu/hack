import { NextResponse } from "next/server";
import { clearSession, isAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  if (new URL(request.url).origin !== request.headers.get("origin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (await isAdmin()) await clearSession();
  return NextResponse.json({ ok: true });
}
