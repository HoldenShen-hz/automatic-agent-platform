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
    "src/platform/five-plane-interface/api/http-server/auth-routes.ts",
    "src/platform/five-plane-interface/api/http-server/billing-routes.ts",
    "src/platform/five-plane-interface/api/http-server/approval-routes.ts",
    "src/platform/five-plane-interface/api/http-server/gateway-routes.ts",
    "src/platform/five-plane-interface/api/http-server/schemas.ts",
    "src/platform/five-plane-interface/api/middleware/input-validation.ts",
    "src/platform/five-plane-interface/api/middleware/sanitize.ts",
    "src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts",
    "src/platform/shared/utils/redis-client-options.ts",
  ],
  ignorePatterns: [
    "**",
    "!package.json",
    "!package-lock.json",
    "!tsconfig.json",
    "!src/**/*.ts",
    "!tests/**/*.ts",
    "!scripts/ci/mutation-critical-tests.sh",
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  tsconfigFile: "tsconfig.json",
};
