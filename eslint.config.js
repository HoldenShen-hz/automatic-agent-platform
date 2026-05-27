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
    ignores: ["dist/**", "node_modules/**", "ui/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "scripts/**/*.mjs",
      "scripts/**/*.ts",
      "tests/**/*.ts",
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
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/require-await": "warn",
    },
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "helpers/**/*.ts", "scripts/**/*.mjs", "scripts/**/*.ts"],
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
