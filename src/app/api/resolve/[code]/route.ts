import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { links } from "@/lib/schema";
import { rateLimit, requestIp } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ code: string }> };
export async function GET(request: Request, { params }: Ctx) {
  if (!rateLimit(`resolve:${requestIp(request)}`, 120)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { code } = await params;
  const [link] = await db.select({ code: links.code, name: links.name, destination: links.destination, locale: links.locale }).from(links).where(and(eq(links.code, code), eq(links.active, true))).limit(1);
  if (!link) return NextResponse.json({ error: "Link unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(link, { headers: { "Cache-Control": "no-store" } });
}
