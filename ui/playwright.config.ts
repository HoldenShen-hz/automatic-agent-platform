import { defineConfig } from "@playwright/test";
import testTarget from "./test-target.json";

const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? String(testTarget.port), 10);
const HOST = process.env.PLAYWRIGHT_HOST ?? testTarget.host;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${HOST}:${PORT}`;
const PLAYWRIGHT_WORKERS = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "12", 10);

export default defineConfig({
  testDir: "./tests",
  testMatch: ["a11y/**/*.spec.ts", "playwright/**/*.spec.ts", "../tools/e2e/src/**/*.spec.ts"],
  timeout: 30_000,
  fullyParallel: true,
  workers: PLAYWRIGHT_WORKERS,
  retries: Number.parseInt(process.env.PLAYWRIGHT_RETRIES ?? "0", 10),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: `npm --workspace @aa/web run dev -- --host ${HOST} --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
