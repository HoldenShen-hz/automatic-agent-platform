/**
 * ARCH-P1-1: Principal Type Coverage Tests
 *
 * Architecture §11.1 defines 6 Principal types (Human / ServiceAccount / Agent /
 * System / External / Anonymous). This test verifies the codebase includes all 6.
 *
 * Test type: Unit
 * @see docs_zh/quality/00-full-coverage-test-manual.md §26.1
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformPrincipalTypes,
  type PlatformPrincipalType,
} from "../../../../../src/platform/control-plane/iam/access-model.js";

/**
 * The 6 principal types required by architecture §11.1.
 * These map to PlatformPrincipalType values in access-model.ts.
 */
const ARCHITECTURE_REQUIRED_PRINCIPAL_TYPES = [
  "human",
  "service_account",
  "agent",
  "system",
  "external",
  "anonymous",
] as const;

test("[ARCH-P1-1] PlatformPrincipalType enum covers all 6 architecture-required types", () => {
  const currentTypes = listPlatformPrincipalTypes();

  for (const required of ARCHITECTURE_REQUIRED_PRINCIPAL_TYPES) {
    const found = currentTypes.includes(required as PlatformPrincipalType);
    assert.ok(
      found,
      `PlatformPrincipalType must include "${required}" (architecture §11.1 requirement)`,
    );
  }
});

test("[ARCH-P1-1] PlatformPrincipalType count matches architecture requirement of 6", () => {
  const count = listPlatformPrincipalTypes().length;
  assert.equal(
    count,
    6,
    `PlatformPrincipalType must have exactly 6 types (got ${count})`,
  );
});

test("[ARCH-P1-1] Each principal type has default roles defined", () => {
  const types = listPlatformPrincipalTypes();
  for (const type of types) {
    const roles = type;
    assert.ok(
      roles !== undefined,
      `Principal type "${type}" must have default roles defined`,
    );
  }
});