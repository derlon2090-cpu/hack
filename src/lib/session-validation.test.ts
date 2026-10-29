import { describe, expect, it } from "vitest";
import { createSessionInput } from "@/lib/session-validation";

const base = { name: "Portrait session", locale: "ar", durationDays: 7, retentionDays: 30 } as const;

describe("session destination validation", () => {
  it("keeps the TikTok destination optional", () => {
    const parsed = createSessionInput.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.destination).toBe("");
  });

  it("accepts an official TikTok video destination", () => {
    expect(createSessionInput.safeParse({ ...base, destination: "https://www.tiktok.com/@creator/video/1234567890123456789" }).success).toBe(true);
  });

  it("rejects non-TikTok and insecure destinations", () => {
    expect(createSessionInput.safeParse({ ...base, destination: "https://example.com/video" }).success).toBe(false);
    expect(createSessionInput.safeParse({ ...base, destination: "http://www.tiktok.com/@creator/video/1234567890123456789" }).success).toBe(false);
  });
});
