import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { makeSession, verifySession } from "@/lib/auth";

describe("administrator session signatures", () => {
  it("accepts an untampered, unexpired session for the configured administrator", () => {
    process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-local-unit-tests";
    process.env.ADMIN_EMAIL = "admin@example.test";
    expect(verifySession(makeSession("admin@example.test"))).toBe(true);
  });
  it("rejects tampered tokens, another account, and expired sessions", () => {
    process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-local-unit-tests";
    process.env.ADMIN_EMAIL = "admin@example.test";
    const token = makeSession("admin@example.test");
    const [payload, signature] = token.split(".");
    expect(verifySession(`${payload}.${signature.slice(0, -1)}x`)).toBe(false);
    expect(verifySession(makeSession("intruder@example.test"))).toBe(false);
    const expired = Buffer.from(JSON.stringify({ email: "admin@example.test", exp: 1 })).toString("base64url");
    const expiredSignature = createHmac("sha256", process.env.AUTH_SECRET!).update(expired).digest("base64url");
    expect(verifySession(`${expired}.${expiredSignature}`)).toBe(false);
  });
});
