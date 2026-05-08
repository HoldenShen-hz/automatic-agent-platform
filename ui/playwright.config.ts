import { defineConfig } from "@playwright/test";

const PORT = 4173;
const HOST = "127.0.0.1";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["a11y/**/*.spec.ts", "playwright/**/*.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm --workspace @aa/web run dev -- --host ${HOST} --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
