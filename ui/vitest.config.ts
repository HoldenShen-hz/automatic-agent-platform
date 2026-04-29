import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        // §7.2.6: shared≥90%/ui-core≥80%/features≥70%/apps≥50%
        90: {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 90,
        },
        80: {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 80,
        },
        70: {
          lines: 70,
          functions: 70,
          statements: 70,
          branches: 70,
        },
        50: {
          lines: 50,
          functions: 50,
          statements: 50,
          branches: 50,
        },
        perManualProject: true,
      },
    },
  },
});
