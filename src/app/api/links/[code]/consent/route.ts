import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { consents, links } from "@/lib/schema";
import { consentInput } from "@/lib/validation";
import { isAdmin } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { rateLimit, requestIp } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ code: string }> };
function isMissingPhotoContextColumns(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42703";
}

export async function POST(request: Request, { params }: Ctx) {
  if (!rateLimit(`consent:${requestIp(request)}`, 30)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { code } = await params;
  const parsed = consentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent request." }, { status: 400 });
  const [link] = await db.select({ id: links.id }).from(links).where(and(eq(links.code, code), eq(links.active, true))).limit(1);
  if (!link) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  const userAgent = request.headers.get("user-agent") || "";
  const deviceType = /iPad|Tablet/i.test(userAgent) ? "tablet" : /Mobi|Android|iPhone/i.test(userAgent) ? "mobile" : "desktop";
  const region = request.headers.get("x-vercel-ip-country-region") || request.headers.get("cf-region") || request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry") || null;
  let consent;
  try {
    [consent] = await db.insert(consents).values({ id: newId(), linkId: link.id, ...parsed.data, deviceType, region, policyVersion: "2026-01" }).returning({ id: consents.id });
  } catch (error) {
    // Older production databases may not have migration 0003 yet.
    if (!isMissingPhotoContextColumns(error)) throw error;
    [consent] = await db.insert(consents).values({ id: newId(), linkId: link.id, ...parsed.data, policyVersion: "2026-01" }).returning({ id: consents.id });
  }
  return NextResponse.json({ id: consent.id }, { status: 201 });
}

export async function GET(request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await params;
  const [link] = await db.select({ id: links.id }).from(links).where(eq(links.code, code)).limit(1);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db.select({ id: consents.id, purpose: consents.purpose, decision: consents.decision, locale: consents.locale, createdAt: consents.createdAt }).from(consents).where(eq(consents.linkId, link.id));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
