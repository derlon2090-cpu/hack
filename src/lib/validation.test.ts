import { describe, expect, it } from "vitest";
import { consentInput, linkInput, uploadInput } from "@/lib/validation";

describe("campaign consent and image upload validation", () => {
  it("records a distinct consent decision for each declared purpose", () => {
    const consent = { purpose: "Take a portrait for the event", decision: "granted", locale: "zh" };
    expect(consentInput.safeParse(consent).success).toBe(true);
    expect(consentInput.safeParse({ ...consent, decision: "implicit" }).success).toBe(false);
    expect(consentInput.safeParse({ ...consent, purpose: "" }).success).toBe(false);
  });
  it("requires an explicit user confirmation before image data can be submitted", () => {
    const payload = { consentId: "572f2928-d3d0-4654-bcc2-118f7c3fb23b", explicitConfirmation: true, mimeType: "image/jpeg", data: "data:image/jpeg;base64,/9j/2Q==" };
    expect(uploadInput.safeParse(payload).success).toBe(true);
    expect(uploadInput.safeParse({ ...payload, explicitConfirmation: false }).success).toBe(false);
    expect(uploadInput.safeParse({ ...payload, explicitConfirmation: undefined }).success).toBe(false);
  });
});

describe("link creation input validation", () => {
  const valid = { name: "Spring launch", destination: "https://example.com/landing", locale: "en" };
  it("accepts named public HTTPS destinations", () => {
    expect(linkInput.safeParse(valid).success).toBe(true);
  });
  it("rejects dangerous schemes, credentials and local hosts", () => {
    expect(linkInput.safeParse({ ...valid, destination: "javascript:alert(1)" }).success).toBe(false);
    expect(linkInput.safeParse({ ...valid, destination: "https://user:pass@example.com" }).success).toBe(false);
    expect(linkInput.safeParse({ ...valid, destination: "http://localhost:3000" }).success).toBe(false);
  });
});
