import { describe, expect, it } from "vitest";
import { clearFailures, failureDelayMs } from "@/lib/login-throttle";

describe("failed access-code delay", () => {
  it("increases delay between invalid attempts and resets after a valid sign-in", () => {
    const key = `throttle-test-${crypto.randomUUID()}`;
    expect(failureDelayMs(key)).toBe(250);
    expect(failureDelayMs(key)).toBe(500);
    expect(failureDelayMs(key)).toBe(1_000);
    clearFailures(key);
    expect(failureDelayMs(key)).toBe(250);
    clearFailures(key);
  });
});
