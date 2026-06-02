// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const typedFiles = [
  "src/**/*.ts",
  "tests/**/*.ts",
  "helpers/**/*.ts",
  "scripts/**/*.ts",
];

export default tseslint.config(
  {
    ignores: ["dist/**", "dist-types/**", "node_modules/**", "ui/**", "coverage-report/**", ".dr-reports/**", ".stryker-tmp/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
      "*.mjs",
      "src/**/*.ts",
      "src/**/*.tsx",
      "scripts/**/*.mjs",
      "scripts/**/*.ts",
      "tests/**/*.ts",
      "tests/**/*.tsx",
      "helpers/**/*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "warn",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx", "helpers/**/*.ts", "scripts/**/*.mjs", "scripts/**/*.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
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
  {
    files: typedFiles,
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
