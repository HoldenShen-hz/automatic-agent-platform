/**
 * SQL Syntax IS Operator Test
 *
 * Validates that SQL queries use proper comparison operators (=, <>, etc.)
 * instead of the IS operator for parameter-based comparisons.
 *
 * PostgreSQL's IS operator only works with NULL, TRUE, FALSE, and UNKNOWN.
 * Using IS with parameter placeholders (e.g., `tenant_id IS $1` or `tenant_id IS ?`)
 * is invalid SQL syntax - the correct operator is =.
 *
 * References:
 * - R28-03: environment column comparison in release-repository.ts
 * - R28-04: tenant_id column comparison in marketplace-repository.ts
 * - R28-05: tenant_id column comparison in operations-repository.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Files to check for invalid IS operator usage with parameters
const ASYNC_REPOSITORIES = [
  "src/platform/five-plane-state-evidence/truth/async-repositories/release-repository.ts",
  "src/platform/five-plane-state-evidence/truth/async-repositories/marketplace-repository.ts",
  "src/platform/five-plane-state-evidence/truth/async-repositories/operations-repository.ts",
];

const SQLITE_REPOSITORIES = [
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/release-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/marketplace-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/operations-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/division-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/billing-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.ts",
  "src/platform/five-plane-state-evidence/truth/sqlite/repositories/intelligence-repository.ts",
];

function getFileContent(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

test("async-repositories should not use 'IS $N' for parameter comparisons", () => {
  for (const file of ASYNC_REPOSITORIES) {
    const content = getFileContent(file);
    const lines = content.split("\n");

    const invalidLines: Array<{ line: number; content: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for pattern: something IS $N where N is a digit
      if (/IS\s+\$\d/.test(line)) {
        invalidLines.push({ line: i + 1, content: line.trim() });
      }
    }

    assert.strictEqual(
      invalidLines.length,
      0,
      `Found ${invalidLines.length} line(s) with invalid 'IS $N' syntax in ${file}:\n${invalidLines
        .map((l) => `  Line ${l.line}: ${l.content}`)
        .join("\n")}`,
    );
  }
});

test("sqlite-repositories should not use 'IS ?' for parameter comparisons", () => {
  for (const file of SQLITE_REPOSITORIES) {
    const content = getFileContent(file);
    const lines = content.split("\n");

    const invalidLines: Array<{ line: number; content: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for pattern: something IS ? (but NOT IS NULL or IS NOT NULL)
      // IS NULL and IS NOT NULL are valid SQL
      const isNullPattern = /\bIS\s+NULL\b|\bIS\s+NOT\s+NULL\b/gi;
      const hasInvalidIs = /IS\s+\?/.test(line);
      const hasValidIs = isNullPattern.test(line);

      if (hasInvalidIs && !hasValidIs) {
        invalidLines.push({ line: i + 1, content: line.trim() });
      }
    }

    assert.strictEqual(
      invalidLines.length,
      0,
      `Found ${invalidLines.length} line(s) with invalid 'IS ?' syntax in ${file}:\n${invalidLines
        .map((l) => `  Line ${l.line}: ${l.content}`)
        .join("\n")}`,
    );
  }
});

test("should use = not IS for tenant_id parameter comparisons", () => {
  const allFiles = [...ASYNC_REPOSITORIES, ...SQLITE_REPOSITORIES];
  for (const file of allFiles) {
    const content = getFileContent(file);
    // Check that tenant_id comparisons use = not IS
    const tenantIdIsLines = content
      .split("\n")
      .filter((line) => /tenant_id\s+IS\s+[\$\?]/.test(line));

    assert.strictEqual(
      tenantIdIsLines.length,
      0,
      `Found tenant_id comparisons using IS operator in ${file}`,
    );
  }
});

test("should use = not IS for environment parameter comparisons", () => {
  for (const file of ASYNC_REPOSITORIES) {
    const content = getFileContent(file);
    const environmentIsLines = content
      .split("\n")
      .filter((line) => /environment\s+IS\s+\$\d/.test(line));

    assert.strictEqual(
      environmentIsLines.length,
      0,
      `Found environment comparisons using IS operator in ${file}`,
    );
  }

  for (const file of SQLITE_REPOSITORIES) {
    const content = getFileContent(file);
    const environmentIsLines = content
      .split("\n")
      .filter((line) => /environment\s+IS\s+\?/.test(line));

    assert.strictEqual(
      environmentIsLines.length,
      0,
      `Found environment comparisons using IS operator in ${file}`,
    );
  }
});
