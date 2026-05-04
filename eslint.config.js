// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
    },
  },
  // =============================================================================
  // Deprecation Enforcement - Block imports of legacy contracts
  // =============================================================================
  // R4-11: LEGACY_CONTRACT_NAMES enforcement via ESLint
  // Note: Only contracts with dedicated module paths can be blocked via import patterns.
  // Contracts without separate modules (StateMutationCommand, WorkflowStep, StepOutput, workflow_run)
  // are enforced via runtime validation (assertNotDeprecated, emitDeprecationWarning in code).
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../request-envelope/index.js", "../request-envelope/index.ts"],
              message: "request-envelope/ is deprecated. Use executable-contracts RequestEnvelope instead.",
            },
            {
              group: ["../control-directive/index.js", "../control-directive/index.ts"],
              message: "control-directive/ is deprecated. Use OperationalDirective or DecisionDirective instead.",
            },
            {
              group: ["../execution-plan/index.js", "../execution-plan/index.ts"],
              message: "execution-plan/ is deprecated. Use PlanGraphBundle from executable-contracts instead.",
            },
            {
              group: ["../execution-receipt/index.js", "../execution-receipt/index.ts"],
              message: "execution-receipt/ is deprecated. Use NodeAttemptReceipt from executable-contracts instead.",
            },
            {
              group: ["../state-command/index.js", "../state-command/index.ts"],
              message: "state-command/ is deprecated. Use inter-plane commands from executable-contracts instead.",
            },
          ],
        },
      ],
    },
  },
  { ignores: ["dist/", "node_modules/", "*.config.*", "scripts/*.mjs"] },
];
