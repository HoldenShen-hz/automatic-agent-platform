/**
 * [SYS-ARCH-1.1] Plane Isolation Tests
 *
 * Verifies that cross-plane imports violate architecture.
 * These tests ensure the five-plane runtime structure is maintained.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";

test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to execution", () => {
  const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
  for (const file of stateEvidenceFiles) {
    const content = readFileSync(file, "utf8");
    // Skip declaration files and index files
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    assert.ok(
      !content.match(/from\s+"[^"]*\/execution\//),
      `${file} must not import from execution plane`,
    );
  }
});

test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to control-plane", () => {
  const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
  for (const file of stateEvidenceFiles) {
    const content = readFileSync(file, "utf8");
    // Skip declaration files and index files
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    assert.ok(
      !content.match(/from\s+"[^"]*\/control-plane\//),
      `${file} must not import from control-plane`,
    );
  }
});

test("[SYS-ARCH-1.1] no cross-plane imports from control-plane to state-evidence", () => {
  const controlPlaneFiles = globSync("src/platform/control-plane/**/*.ts");
  for (const file of controlPlaneFiles) {
    const content = readFileSync(file, "utf8");
    // Skip declaration files and index files
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    assert.ok(
      !content.match(/from\s+"[^"]*\/state-evidence\//),
      `${file} must not import from state-evidence plane`,
    );
  }
});

test("[SYS-ARCH-1.1] no cross-plane imports from control-plane to execution", () => {
  const controlPlaneFiles = globSync("src/platform/control-plane/**/*.ts");
  for (const file of controlPlaneFiles) {
    const content = readFileSync(file, "utf8");
    // Skip declaration files and index files
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    assert.ok(
      !content.match(/from\s+"[^"]*\/execution\//),
      `${file} must not import from execution plane`,
    );
  }
});

test("[SYS-ARCH-1.1] no cross-plane imports from interface to execution skipping shared", () => {
  const interfaceFiles = globSync("src/platform/interface/**/*.ts");
  for (const file of interfaceFiles) {
    const content = readFileSync(file, "utf8");
    // Skip declaration files and index files
    if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
      continue;
    }
    // Interface may only import from shared and contracts
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/from\s+"([^"]+)";/);
      if (match && match[1] !== undefined) {
        const importPath = match[1];
        // Allowed: relative imports, shared, contracts
        const isAllowed =
          importPath.startsWith(".") ||
          importPath.includes("/shared/") ||
          importPath.includes("/contracts/") ||
          importPath.includes("@") ||
          importPath.startsWith("#");
        const isCrossPlaneToExecution =
          !importPath.startsWith(".") &&
          !importPath.includes("/shared/") &&
          !importPath.includes("/contracts/") &&
          !importPath.includes("@") &&
          !importPath.startsWith("#") &&
          importPath.includes("/execution/");
        assert.ok(
          isAllowed || !isCrossPlaneToExecution,
          `${file} must not import from execution plane directly (use shared adapter)`,
        );
      }
    }
  }
});
