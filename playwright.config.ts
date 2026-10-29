import { defineConfig, devices } from "@playwright/test";
import { hashSync } from "bcryptjs";

const port = 3108;
const baseURL = `http://127.0.0.1:${port}`;
const testCode = "frameflow-e2e-only";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://frameflow:frameflow@127.0.0.1:1/frameflow_test",
      AUTH_SECRET: "playwright-only-secret-with-at-least-thirty-two-characters",
      ACCESS_CODE_HASH: hashSync(testCode, 4),
      NEXT_PUBLIC_APP_URL: baseURL,
      NODE_ENV: "development"
    }
  }
});
