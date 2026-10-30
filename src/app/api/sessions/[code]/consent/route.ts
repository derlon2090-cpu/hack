import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { consents, sessions } from "@/lib/schema";
import { consentInput } from "@/lib/validation";
import { newId } from "@/lib/ids";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { isSessionAvailable } from "@/lib/session-lifecycle";

type Context = { params: Promise<{ code: string }> };
function isMissingDeviceCodeColumn(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42703";
}

export async function POST(request: Request, { params }: Context) {
  if (!rateLimit(`consent:${requestIp(request)}`, 30)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = consentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent request." }, { status: 400 });
  const { code } = await params;
  const [session] = await db.select({ id: sessions.id, purpose: sessions.purpose, active: sessions.active, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.code, code)).limit(1);
  if (!session || !isSessionAvailable(session.active, session.expiresAt)) return NextResponse.json({ error: "Session unavailable." }, { status: 404 });
  const { deviceCode, ...choice } = parsed.data;
  const consentValues = { id: newId(), linkId: null, sessionId: session.id, purpose: session.purpose || choice.purpose, decision: choice.decision, locale: choice.locale, deviceCode, policyVersion: "frameflow-2026-01" };
  let consent;
  try {
    [consent] = await db.insert(consents).values(consentValues).returning({ id: consents.id });
  } catch (error) {
    if (!isMissingDeviceCodeColumn(error)) throw error;
    const legacyPolicyVersion = deviceCode ? `${consentValues.policyVersion};device=${deviceCode}` : consentValues.policyVersion;
    const legacyValues = { id: consentValues.id, linkId: consentValues.linkId, sessionId: consentValues.sessionId, purpose: consentValues.purpose, decision: consentValues.decision, locale: consentValues.locale, policyVersion: legacyPolicyVersion };
    [consent] = await db.insert(consents).values(legacyValues).returning({ id: consents.id });
  }
  return NextResponse.json({ id: consent.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
