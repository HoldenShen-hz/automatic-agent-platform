import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";

const configuredMaxWorkers = process.env.VITEST_MAX_WORKERS == null
  ? undefined
  : Number.parseInt(process.env.VITEST_MAX_WORKERS, 10);

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "react-native": fileURLToPath(new URL("./apps/web/src/react-native-web-stub.tsx", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    ...(configuredMaxWorkers == null ? {} : { maxWorkers: configuredMaxWorkers }),
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        "packages/shared/**": { lines: 70, functions: 70, statements: 70, branches: 60 },
        "packages/ui-core/**": { lines: 80, functions: 80, statements: 80, branches: 80 },
        "packages/features/**": { lines: 70, functions: 60, statements: 70, branches: 55 },
        "apps/**": { lines: 50, functions: 50, statements: 50, branches: 50 },
        global: { lines: 50, functions: 50, statements: 50, branches: 40 },
      },
    },
  },
});
