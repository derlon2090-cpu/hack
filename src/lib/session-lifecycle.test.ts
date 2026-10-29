import { describe, expect, it } from "vitest";
import { isSessionAvailable, isShareAvailable } from "@/lib/session-lifecycle";

describe("session and share link expiry", () => {
  const now = Date.parse("2026-10-29T00:00:00Z");
  it("rejects paused and expired sessions, while respecting non-expiring sessions", () => {
    expect(isSessionAvailable(true, null, now)).toBe(true);
    expect(isSessionAvailable(false, null, now)).toBe(false);
    expect(isSessionAvailable(true, "2026-10-28T23:59:59Z", now)).toBe(false);
    expect(isSessionAvailable(true, "2026-10-29T00:00:01Z", now)).toBe(true);
  });
  it("keeps share links unavailable without a token or after expiry", () => {
    expect(isShareAvailable(null, "2026-10-30T00:00:00Z", now)).toBe(false);
    expect(isShareAvailable("token", null, now)).toBe(false);
    expect(isShareAvailable("token", "2026-10-28T23:59:59Z", now)).toBe(false);
    expect(isShareAvailable("token", "2026-10-29T00:00:01Z", now)).toBe(true);
  });
});
