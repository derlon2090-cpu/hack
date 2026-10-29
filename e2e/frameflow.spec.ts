import { expect, test } from "@playwright/test";

const baseSession = {
  id: "f2492ad9-2480-4c48-9bdc-193da1baaf39",
  code: "camera-e2e-session",
  name: "Portrait study",
  purpose: "Capture a portrait for the team story.",
  destination: null,
  locale: "en",
  active: true,
  expiresAt: null,
  retentionDays: 30,
  views: 0,
  createdAt: "2026-10-29T12:00:00.000Z",
  photoCount: 0
};

test("redirects an unsigned visit to the protected dashboard to access-code login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Access code")).toHaveAttribute("type", "password");
});

test("toggles access-code visibility and rejects an incorrect code without echoing it", async ({ page }) => {
  await page.goto("/login");
  const field = page.getByLabel("Access code");
  await field.fill("this-is-not-the-access-code");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue("this-is-not-the-access-code");
  await page.getByRole("button", { name: "Hide code" }).click();
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Enter FrameFlow" }).click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText("That access code is incorrect.");
  await expect(page.locator("body")).not.toContainText("this-is-not-the-access-code");
});

test("signs in and creates a session that displays its real share link", async ({ page }) => {
  let createdDestination = "";
  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    const payload = route.request().postDataJSON() as { name: string; locale: string; durationDays: number; purpose: string; destination: string; retentionDays: number };
    createdDestination = payload.destination;
    return route.fulfill({ status: 201, json: { ...baseSession, ...payload, url: `http://127.0.0.1:3108/s/${baseSession.code}` } });
  });
  await page.route("**/api/photos", (route) => route.fulfill({ json: [] }));
  await page.goto("/login");
  await page.getByLabel("Access code").fill("frameflow-e2e-only");
  await page.getByRole("button", { name: "Enter FrameFlow" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Your studio, in focus." })).toBeVisible();
  await page.waitForResponse((response) => response.url().endsWith("/api/sessions") && response.request().method() === "GET");
  await page.getByRole("button", { name: "Create a new session" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Session name").fill("Portrait study");
  await page.getByLabel("TikTok video URL (optional)").fill("https://vt.tiktok.com/ZSNhLMsxg/");
  await page.getByLabel("Purpose (optional)").fill("Capture a portrait for the team story.");
  await page.getByRole("button", { name: "Create session" }).last().click();
  await expect(page.getByText("http://127.0.0.1:3108/s/camera-e2e-session")).toBeVisible();
  expect(createdDestination).toBe("https://vt.tiktok.com/ZSNhLMsxg/");
  await expect(page.getByText("TikTok destination: vt.tiktok.com")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Preview" })).toHaveAttribute("href", "/s/camera-e2e-session");
});

test("records a decline without requesting camera permission", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __cameraRequests?: number };
    state.__cameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { state.__cameraRequests! += 1; throw new Error("Camera must not be requested after a decline."); } } });
  });
  await page.route("**/api/sessions/camera-e2e-session/public", (route) => route.request().method() === "GET" ? route.fulfill({ json: { ...baseSession, views: 1 } }) : route.fulfill({ status: 202, json: { ok: true } }));
  const decisions: string[] = [];
  await page.route("**/api/sessions/camera-e2e-session/consent", async (route) => { decisions.push(route.request().postDataJSON().decision as string); await route.fulfill({ status: 201, json: { id: "df5f0f98-498a-47d0-90b0-e80a8f24c2d0" } }); });
  await page.goto("/s/camera-e2e-session");
  await expect(page.getByRole("heading", { name: "A quick note before we begin" })).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
  expect(decisions).toEqual(["denied"]);
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(0);
});

test("captures a preview and uploads only after the visitor confirms", async ({ page }) => {
  const destination = "https://www.tiktok.com/@creator/video/1234567890123456789";
  await page.route("https://www.tiktok.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "TikTok destination" }));
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 240;
    const context = canvas.getContext("2d"); if (context) { context.fillStyle = "#8b5cf6"; context.fillRect(0, 0, canvas.width, canvas.height); }
    const testStream = canvas.captureStream(30);
    const state = window as Window & { __cameraRequests?: number };
    state.__cameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { state.__cameraRequests! += 1; return testStream; } } });
  });
  await page.route("**/api/sessions/camera-e2e-session/public", (route) => route.request().method() === "GET" ? route.fulfill({ json: { ...baseSession, destination, views: 1 } }) : route.fulfill({ status: 202, json: { ok: true } }));
  await page.route("**/api/sessions/camera-e2e-session/consent", (route) => route.fulfill({ status: 201, json: { id: "df5f0f98-498a-47d0-90b0-e80a8f24c2d0" } }));
  let uploads = 0;
  let uploadedData = "";
  await page.route("**/api/photos", async (route) => {
    uploads++;
    const body = route.request().postDataJSON() as { explicitConfirmation: boolean; consentId: string; data: string };
    uploadedData = body.data;
    expect(body.explicitConfirmation).toBe(true);
    expect(body.consentId).toBe("df5f0f98-498a-47d0-90b0-e80a8f24c2d0");
    await route.fulfill({ status: 201, json: { id: "4d39240d-d29a-461a-b544-82522dab7c61", createdAt: "2026-10-29T12:00:00.000Z" } });
  });

  await page.goto("/s/camera-e2e-session");
  await page.getByLabel("I agree to use the camera for this purpose.").check();
  await page.getByRole("button", { name: "Agree & continue" }).click();
  await page.getByRole("button", { name: "Enable camera" }).click();
  await expect(page.locator("video[aria-label='Live camera preview']")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __cameraRequests?: number }).__cameraRequests)).toBe(1);
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByAltText("Preview of your photo before confirmation")).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Confirm & upload" }).click();
  await expect(page.locator(".landing-lead")).toHaveText("Photo saved. Redirecting to your TikTok video…");
  expect(uploads).toBe(1);
  expect(uploadedData.startsWith("data:image/jpeg;base64,")).toBe(true);
  await page.waitForURL(destination);
});
