import { describe, expect, it } from "vitest";
import { isValidImagePayload } from "@/lib/image-validation";

describe("private photo upload validation", () => {
  it("requires an image signature that matches the declared MIME type", () => {
    const jpeg = Buffer.alloc(24);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[22] = 0xff; jpeg[23] = 0xd9;
    expect(isValidImagePayload("image/jpeg", jpeg)).toBe(true);
    expect(isValidImagePayload("image/png", jpeg)).toBe(false);
    expect(isValidImagePayload("text/html", jpeg)).toBe(false);
  });
  it("rejects incomplete images and images over the upload limit", () => {
    expect(isValidImagePayload("image/jpeg", Buffer.from([0xff, 0xd8]))).toBe(false);
    expect(isValidImagePayload("image/png", Buffer.alloc(200), 100)).toBe(false);
  });
});
