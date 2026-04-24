import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsFiles = ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}", "tools/**/*.ts", "tests/**/*.{ts,tsx}"];
const testGlobals = {
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  test: "readonly",
  vi: "readonly",
};

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "apps/web/dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: tsFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...testGlobals,
      },
    },
  },
);
