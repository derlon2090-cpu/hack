import { describe, expect, it } from "vitest";
import { mayRequestCamera, mayUploadPhoto } from "@/lib/camera-consent";

describe("camera permission and upload gates", () => {
  it("only reaches the browser permission request after recorded purpose consent and an explicit camera step", () => {
    expect(mayRequestCamera(false, "", false)).toBe(false);
    expect(mayRequestCamera(true, "", true)).toBe(false);
    expect(mayRequestCamera(true, "consent-uuid", false)).toBe(false);
    expect(mayRequestCamera(true, "consent-uuid", true)).toBe(true);
  });
  it("uploads only a photo with active camera consent and an explicit final confirmation", () => {
    expect(mayUploadPhoto(false, true)).toBe(false);
    expect(mayUploadPhoto(true, false)).toBe(false);
    expect(mayUploadPhoto(true, true)).toBe(true);
  });
});
