import { describe, expect, it } from "vitest";
import { newCode } from "@/lib/ids";

describe("shareable short codes", () => {
  it("uses a readable, URL-safe alphanumeric slug", () => {
    expect(newCode()).toMatch(/^[A-HJ-NP-Za-hj-km-z2-9]{11}$/);
  });

  it("generates distinct codes for separate links", () => {
    const codes = new Set(Array.from({ length: 200 }, () => newCode()));
    expect(codes.size).toBe(200);
  });
});
