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
    "src/core/api/http-server/auth-routes.ts",
    "src/core/api/http-server/billing-routes.ts",
    "src/core/api/http-server/approval-routes.ts",
    "src/core/api/http-server/gateway-routes.ts",
    "src/core/api/http-server/schemas.ts",
    "src/core/api/middleware/input-validation.ts",
    "src/core/api/middleware/sanitize.ts",
    "src/core/agent-loop/oapeflir-loop-service.ts",
    "src/core/runtime/redis-client-options.ts",
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
