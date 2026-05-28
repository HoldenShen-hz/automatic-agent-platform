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
    command: "sh scripts/ci/mutation-critical-tests.sh",
  },
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "off",
  mutate: [
    "src/platform/five-plane-interface/api/http-server/**/*.ts",
    "src/platform/five-plane-interface/api/middleware/**/*.ts",
    "src/platform/five-plane-interface/ingress/**/*.ts",
    "src/platform/five-plane-interface/webhook/**/*.ts",
    "src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts",
    "src/platform/shared/utils/redis-client-options.ts",
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
