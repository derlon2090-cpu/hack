import { describe, expect, it } from "vitest";
import { buildVideoFilter, videoArguments } from "@/lib/video-render";

describe("MP4 render configuration", () => {
  it("produces a bounded H.264 MP4 filter and format pipeline", () => {
    const args = videoArguments("photo.jpg", "video.mp4", 5, "8B5CF6");
    expect(args).toContain("libx264");
    expect(args).toContain("+faststart");
    expect(args[args.indexOf("-t") + 1]).toBe("5");
    expect(args[args.indexOf("-vf") + 1]).toContain("0x8B5CF6");
  });
  it("supports an escaped optional caption and configured font", () => {
    const filter = buildVideoFilter("22D3EE", "Portrait: 'Studio'", "font.ttf");
    expect(filter).toContain("Portrait\\: \\'Studio\\'");
  });
  it("rejects unsupported durations, malformed colors, and captions without a font", () => {
    expect(() => videoArguments("in", "out", 60, "000000")).toThrow();
    expect(() => videoArguments("in", "out", 5, "url(//bad)")).toThrow();
    expect(() => buildVideoFilter("000000", "caption")).toThrow();
  });
});
