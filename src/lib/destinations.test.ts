import { describe, expect, it } from "vitest";
import { isSupportedDestination } from "@/lib/destinations";

describe("official video destinations", () => {
  it("accepts standard YouTube videos and preserves their URL", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=18";
    expect(isSupportedDestination(url)).toBe(true);
    expect(new URL(url).href).toBe(url);
  });
  it("accepts YouTube Shorts and short links", () => {
    expect(isSupportedDestination("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
    expect(isSupportedDestination("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });
  it("accepts official TikTok shared video links", () => {
    expect(isSupportedDestination("https://www.tiktok.com/@creator/video/1234567890123456789")).toBe(true);
    expect(isSupportedDestination("https://vm.tiktok.com/ZM1234567/")).toBe(true);
  });
  it("does not rewrite or mistake spoofed hosts for platform links", () => {
    expect(isSupportedDestination("https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isSupportedDestination("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isSupportedDestination("https://youtu.be/short")).toBe(false);
    expect(isSupportedDestination("https://www.tiktok.com/")).toBe(false);
  });
});
