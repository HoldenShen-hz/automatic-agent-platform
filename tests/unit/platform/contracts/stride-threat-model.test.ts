/**
 * STRIDE Threat Model Unit Tests (ARCH-P0-3)
 *
 * Tests the STRIDE threat model implementation covering:
 * - StrideCategory enum defines 6 STRIDE dimensions
 * - ThreatMatrix has entries for all 6 STRIDE dimensions
 * - Each STRIDE dimension has at least one mitigation
 *
 * @see src/platform/five-plane-control-plane/iam/threat-model/stride-framework.ts
 * @see src/platform/five-plane-control-plane/iam/threat-model/threat-matrix-registry.ts
 * @see docs_zh/quality/00-full-coverage-test-manual.md section 25.3
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  STRIDE_CATEGORIES,
  type StrideCategory,
  type ThreatEntry,
  type ThreatMatrix,
  validateThreatMatrix,
} from "../../../../src/platform/five-plane-control-plane/iam/threat-model/stride-framework.js";
import {
  ThreatMatrixRegistry,
  defaultThreatMatrixRegistry,
} from "../../../../src/platform/five-plane-control-plane/iam/threat-model/threat-matrix-registry.js";

// =============================================================================
// STRIDE Categories (6 Dimensions) Tests
// =============================================================================

test("[ARCH-P0-3] StrideCategory enum defines all 6 STRIDE dimensions", () => {
  // STRIDE: Spoofing, Tampering, Repudiation, Information Disclosure,
  //         Denial of Service, Elevation of Privilege
  const expectedCategories: StrideCategory[] = [
    "SPOOFING",
    "TAMPERING",
    "REPUDIATION",
    "INFORMATION_DISCLOSURE",
    "DENIAL_OF_SERVICE",
    "ELEVATION_OF_PRIVILEGE",
  ];

  assert.equal(STRIDE_CATEGORIES.length, 6, "STRIDE_CATEGORIES should have exactly 6 dimensions");

  for (const category of expectedCategories) {
    assert.ok(
      STRIDE_CATEGORIES.includes(category),
      `Expected ${category} to be in STRIDE_CATEGORIES`,
    );
  }
});

test("[ARCH-P0-3] StrideCategory type accepts only valid STRIDE values", () => {
  // This test verifies the type narrowing works correctly
  const validCategory: StrideCategory = "SPOOFING";
  assert.equal(validCategory, "SPOOFING");

  const allCategories: StrideCategory[] = [
    "SPOOFING",
    "TAMPERING",
    "REPUDIATION",
    "INFORMATION_DISCLOSURE",
    "DENIAL_OF_SERVICE",
    "ELEVATION_OF_PRIVILEGE",
  ];

  for (const category of allCategories) {
    const entry: StrideCategory = category;
    assert.ok(
      STRIDE_CATEGORIES.includes(entry),
      `Category ${entry} should be valid`,
    );
  }
});

test("[ARCH-P0-3] STRIDE_CATEGORIES is a readonly tuple with 6 elements", () => {
  // Verify the array has exactly 6 elements
  assert.equal(STRIDE_CATEGORIES.length, 6, "STRIDE_CATEGORIES should have 6 elements");

  // Verify expected categories are present (without mutating)
  const expectedCategories: StrideCategory[] = [
    "SPOOFING",
    "TAMPERING",
    "REPUDIATION",
    "INFORMATION_DISCLOSURE",
    "DENIAL_OF_SERVICE",
    "ELEVATION_OF_PRIVILEGE",
  ];

  for (const category of expectedCategories) {
    assert.ok(
      STRIDE_CATEGORIES.includes(category),
      `Expected ${category} to be in STRIDE_CATEGORIES`,
    );
  }
});

// =============================================================================
// ThreatMatrix Registry Tests
// =============================================================================

test("[ARCH-P0-3] ThreatMatrix has entries for all 6 STRIDE dimensions", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  const categoriesInMatrix = new Set(matrix.entries.map((entry) => entry.category));
  const missingCategories = STRIDE_CATEGORIES.filter(
    (category) => !categoriesInMatrix.has(category),
  );

  assert.equal(
    missingCategories.length,
    0,
    `Missing STRIDE categories in matrix: ${missingCategories.join(", ")}`,
  );

  // Verify we have at least 6 entries (one per STRIDE dimension, but some categories may have multiple entries)
  assert.ok(matrix.entries.length >= 6, "ThreatMatrix should have at least 6 entries, one per STRIDE dimension");
});

test("[ARCH-P0-3] ThreatMatrixRegistry.validate() passes for valid matrix", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const validation = validateThreatMatrix(matrix);

  assert.ok(validation.valid, "ThreatMatrix should be valid");
  assert.equal(validation.missingCategories.length, 0, "No missing categories expected");
});

test("[ARCH-P0-3] ThreatMatrixRegistry.listCategories() returns all 6 categories", () => {
  const categories = defaultThreatMatrixRegistry.listCategories();
  assert.equal(categories.length, 6, "Should return all 6 STRIDE categories");

  for (const expected of STRIDE_CATEGORIES) {
    assert.ok(categories.includes(expected), `Expected ${expected} in listCategories()`);
  }
});

test("[ARCH-P0-3] ThreatMatrixRegistry.listByCategory returns entries for each STRIDE dimension", () => {
  for (const category of STRIDE_CATEGORIES) {
    const entries = defaultThreatMatrixRegistry.listByCategory(category);
    assert.ok(
      entries.length > 0,
      `Expected at least one entry for STRIDE category ${category}`,
    );

    // Verify all returned entries have the correct category
    for (const entry of entries) {
      assert.equal(
        entry.category,
        category,
        `Entry ${entry.threatId} should have category ${category}`,
      );
    }
  }
});

// =============================================================================
// ThreatEntry Structure Tests
// =============================================================================

test("[ARCH-P0-3] Each STRIDE dimension has at least one mitigation", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const entry of matrix.entries) {
    assert.ok(
      entry.mitigations.length > 0,
      `Entry ${entry.threatId} (${entry.category}) should have at least one mitigation`,
    );

    // Verify mitigations are non-empty strings
    for (const mitigation of entry.mitigations) {
      assert.ok(
        typeof mitigation === "string" && mitigation.length > 0,
        `Mitigation "${mitigation}" for ${entry.threatId} should be a non-empty string`,
      );
    }
  }
});

test("[ARCH-P0-3] ThreatEntry has required fields for all entries", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const entry of matrix.entries) {
    assert.ok(entry.threatId, `Entry should have threatId`);
    assert.ok(entry.title, `Entry ${entry.threatId} should have title`);
    assert.ok(entry.scenario, `Entry ${entry.threatId} should have scenario`);
    assert.ok(entry.category, `Entry ${entry.threatId} should have category`);
    assert.ok(Array.isArray(entry.mitigations), `Entry ${entry.threatId} should have mitigations array`);
    assert.ok(Array.isArray(entry.implementationRefs), `Entry ${entry.threatId} should have implementationRefs array`);
    assert.ok(entry.residualRisk, `Entry ${entry.threatId} should have residualRisk`);
  }
});

test("[ARCH-P0-3] ThreatEntry.residualRisk is a valid level", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const validRisks = ["low", "medium", "high"];

  for (const entry of matrix.entries) {
    assert.ok(
      validRisks.includes(entry.residualRisk),
      `Entry ${entry.threatId} has invalid residualRisk: ${entry.residualRisk}`,
    );
  }
});

test("[ARCH-P0-3] ThreatEntry.implementationRefs contains valid file paths", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const entry of matrix.entries) {
    assert.ok(entry.implementationRefs.length > 0, `Entry ${entry.threatId} should have implementation refs`);

    for (const ref of entry.implementationRefs) {
      assert.ok(
        typeof ref === "string" && ref.includes("/"),
        `Implementation ref "${ref}" for ${entry.threatId} should be a file path`,
      );
    }
  }
});

// =============================================================================
// ThreatMatrix Structure Tests
// =============================================================================

test("[ARCH-P0-3] ThreatMatrix has required metadata fields", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  assert.ok(matrix.version, "ThreatMatrix should have version");
  assert.ok(matrix.updatedAt, "ThreatMatrix should have updatedAt");
  assert.ok(matrix.owner, "ThreatMatrix should have owner");
  assert.ok(Array.isArray(matrix.entries), "ThreatMatrix should have entries array");
});

test("[ARCH-P0-3] ThreatMatrix.version follows expected format", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  // Version should be a string like "YYYY.MM"
  assert.ok(
    /^\d{4}\.\d{2}$/.test(matrix.version),
    `Version "${matrix.version}" should follow YYYY.MM format`,
  );
});

test("[ARCH-P0-3] ThreatMatrix.updatedAt is a valid ISO timestamp", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const date = new Date(matrix.updatedAt);

  assert.ok(!isNaN(date.getTime()), `updatedAt "${matrix.updatedAt}" should be a valid ISO date`);
});

test("[ARCH-P0-3] ThreatMatrix.getMatrix returns independent copies", () => {
  const matrix1 = defaultThreatMatrixRegistry.getMatrix();
  const matrix2 = defaultThreatMatrixRegistry.getMatrix();

  // Should be equal in content
  assert.equal(matrix1.version, matrix2.version);
  assert.equal(matrix1.entries.length, matrix2.entries.length);

  // But entries should be different object references (defensive copy)
  assert.ok(
    matrix1.entries !== matrix2.entries,
    "getMatrix should return a new matrix object each time",
  );
});

// =============================================================================
// Edge Cases and Validation Tests
// =============================================================================

test("[ARCH-P0-3] validateThreatMatrix returns missing categories for incomplete matrix", () => {
  const incompleteMatrix: ThreatMatrix = {
    version: "2026.04",
    updatedAt: "2026-04-23T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "test_spoofing",
        category: "SPOOFING",
        title: "Test",
        scenario: "Test scenario",
        mitigations: ["Test mitigation"],
        implementationRefs: ["src/test.js"],
        residualRisk: "medium",
      },
    ],
  };

  const validation = validateThreatMatrix(incompleteMatrix);

  assert.ok(!validation.valid, "Incomplete matrix should be invalid");
  assert.ok(validation.missingCategories.length > 0, "Should report missing categories");

  // Should report all categories except SPOOFING as missing
  const expectedMissing = STRIDE_CATEGORIES.filter((c) => c !== "SPOOFING");
  assert.deepEqual(validation.missingCategories, expectedMissing);
});

test("[ARCH-P0-3] validateThreatMatrix passes for complete matrix", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const validation = validateThreatMatrix(matrix);

  assert.ok(validation.valid, "Complete matrix should be valid");
  assert.equal(validation.missingCategories.length, 0, "No missing categories");
});

test("[ARCH-P0-3] ThreatMatrixRegistry can be instantiated with custom matrix", () => {
  const customEntries: ThreatEntry[] = [
    {
      threatId: "custom_spoofing",
      category: "SPOOFING",
      title: "Custom spoofing threat",
      scenario: "A custom spoofing scenario",
      mitigations: ["Custom mitigation 1", "Custom mitigation 2"],
      implementationRefs: ["src/custom/path.js"],
      residualRisk: "low",
    },
  ];

  const customMatrix: ThreatMatrix = {
    version: "2026.05",
    updatedAt: "2026-05-01T00:00:00.000Z",
    owner: "custom_test",
    entries: customEntries,
  };

  const registry = new ThreatMatrixRegistry(customMatrix);
  const result = registry.validate();

  assert.ok(!result.valid, "Custom matrix with only SPOOFING should be invalid");
  assert.equal(result.missingCategories.length, 5, "Should have 5 missing categories");
});

test("[ARCH-P0-3] All STRIDE categories are represented in default matrix", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const categoryCounts: Record<StrideCategory, number> = {
    SPOOFING: 0,
    TAMPERING: 0,
    REPUDIATION: 0,
    INFORMATION_DISCLOSURE: 0,
    DENIAL_OF_SERVICE: 0,
    ELEVATION_OF_PRIVILEGE: 0,
  };

  for (const entry of matrix.entries) {
    categoryCounts[entry.category]++;
  }

  for (const category of STRIDE_CATEGORIES) {
    assert.ok(
      categoryCounts[category] > 0,
      `Category ${category} should have at least one entry in the default matrix`,
    );
  }
});

// =============================================================================
// Issue 2004: TAMPERING (config) and INFO_DISCLOSURE (agent memory) Mitigations
// =============================================================================

test("[ISSUE-2004] TAMPERING category includes config manipulation mitigations", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const tamperingEntries = matrix.entries.filter((e) => e.category === "TAMPERING");

  assert.ok(tamperingEntries.length > 0, "TAMPERING category must have at least one entry");

  // Collect all mitigations across TAMPERING entries
  const allMitigations = tamperingEntries.flatMap((e) => e.mitigations);

  // Check for config-related mitigations (issue 2004)
  const configRelatedMitigations = [
    "configuration schema validation at load time",
    "signed and versioned config artifacts",
    "configuration change audit logging",
    "immutable config in production deployments",
    "runtime config validation against known-good baselines",
  ];

  for (const configMitigation of configRelatedMitigations) {
    assert.ok(
      allMitigations.includes(configMitigation),
      `TAMPERING should include config mitigation: "${configMitigation}"`,
    );
  }
});

test("[ISSUE-2004] INFORMATION_DISCLOSURE category includes agent memory mitigations", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const infoDisclosures = matrix.entries.filter((e) => e.category === "INFORMATION_DISCLOSURE");

  assert.ok(infoDisclosures.length > 0, "INFORMATION_DISCLOSURE category must have at least one entry");

  // Collect all mitigations across INFO_DISCLOSURE entries
  const allMitigations = infoDisclosures.flatMap((e) => e.mitigations);

  // Check for agent memory related mitigations (issue 2004)
  const agentMemoryMitigations = [
    "agent memory encryption at rest",
    "memory isolation by workspace or session",
    "memory access audit logging",
    "selective memory erasure on session termination",
    "memory snapshot access controls",
  ];

  for (const memoryMitigation of agentMemoryMitigations) {
    assert.ok(
      allMitigations.includes(memoryMitigation),
      `INFORMATION_DISCLOSURE should include agent memory mitigation: "${memoryMitigation}"`,
    );
  }
});

test("[ISSUE-2004] TAMPERING has at least one config-specific threat entry", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const tamperingEntries = matrix.entries.filter((e) => e.category === "TAMPERING");

  // Verify there's an entry specifically addressing config manipulation
  const configTamperingEntries = tamperingEntries.filter((e) =>
    e.title.toLowerCase().includes("config") ||
    e.mitigations.some((m) => m.includes("config")),
  );

  assert.ok(
    configTamperingEntries.length > 0,
    "TAMPERING category should have at least one config-related threat entry",
  );
});

test("[ISSUE-2004] INFORMATION_DISCLOSURE has at least one agent-memory-specific threat entry", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const infoDisclosures = matrix.entries.filter((e) => e.category === "INFORMATION_DISCLOSURE");

  // Verify there's an entry specifically addressing agent memory exposure
  const memoryEntries = infoDisclosures.filter((e) =>
    e.title.toLowerCase().includes("memory") ||
    e.mitigations.some((m) => m.includes("memory")),
  );

  assert.ok(
    memoryEntries.length > 0,
    "INFORMATION_DISCLOSURE category should have at least one agent-memory-related threat entry",
  );
});

test("[ISSUE-2004] ThreatMatrixRegistry validate passes after fix", () => {
  const validation = defaultThreatMatrixRegistry.validate();
  assert.ok(validation.valid, "ThreatMatrix should be valid after adding missing mitigations");
  assert.equal(validation.missingCategories.length, 0, "No categories should be missing");
});
