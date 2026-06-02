/**
 * Stryker Mutator Configuration
 *
 * Mutation testing configuration for the automatic-agent-platform project.
 * Run with: npm run test:mutation
 *
 * Critical mutation coverage is tracked in the platform testing baseline documents.
 */

export default {
  mutator: {
    plugins: ["@stryker-mutator/typescript-checker"],
  },
  testRunner: "command",
  commandRunner: {
    command: "bash scripts/ci/mutation-critical-tests.sh",
  },
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  mutate: [
    "src/platform/five-plane-interface/**/*.ts",
    "src/platform/five-plane-control-plane/**/*.ts",
    "src/platform/five-plane-orchestration/**/*.ts",
    "src/platform/five-plane-execution/**/*.ts",
    "src/platform/five-plane-state-evidence/**/*.ts",
    "src/platform/shared/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/index.ts",
  ],
  ignorePatterns: [
    "dist/**",
    "coverage/**",
    ".cache/**",
    ".stryker-tmp/**",
    "ui/**",
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  tsconfigFile: "tsconfig.stryker.json",
};
