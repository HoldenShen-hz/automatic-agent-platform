/**
 * Unit tests for STRIDE Framework types and functions
 * Tests types, validation, and utility functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  STRIDE_CATEGORIES,
  validateThreatMatrix,
  listThreatsByCategory,
  type StrideCategory,
  type ThreatMatrix,
  type ThreatEntry,
} from "../../../../../../src/platform/control-plane/iam/threat-model/stride-framework.js";

test("STRIDE_CATEGORIES contains exactly 6 categories", () => {
  assert.equal(STRIDE_CATEGORIES.length, 6);
});

test("STRIDE_CATEGORIES contains SPOOFING", () => {
  assert.ok(STRIDE_CATEGORIES.includes("SPOOFING"));
});

test("STRIDE_CATEGORIES contains TAMPERING", () => {
  assert.ok(STRIDE_CATEGORIES.includes("TAMPERING"));
});

test("STRIDE_CATEGORIES contains REPUDIATION", () => {
  assert.ok(STRIDE_CATEGORIES.includes("REPUDIATION"));
});

test("STRIDE_CATEGORIES contains INFORMATION_DISCLOSURE", () => {
  assert.ok(STRIDE_CATEGORIES.includes("INFORMATION_DISCLOSURE"));
});

test("STRIDE_CATEGORIES contains DENIAL_OF_SERVICE", () => {
  assert.ok(STRIDE_CATEGORIES.includes("DENIAL_OF_SERVICE"));
});

test("STRIDE_CATEGORIES contains ELEVATION_OF_PRIVILEGE", () => {
  assert.ok(STRIDE_CATEGORIES.includes("ELEVATION_OF_PRIVILEGE"));
});

test("StrideCategory is a subtype of string", () => {
  const category: StrideCategory = "SPOOFING";
  assert.equal(category, "SPOOFING");
});

test("validateThreatMatrix returns valid for complete matrix", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: STRIDE_CATEGORIES.map((cat, i) => ({
      threatId: `threat_${i}`,
      category: cat,
      title: `Test threat for ${cat}`,
      scenario: "Test scenario",
      mitigations: [" mitigation1"],
      implementationRefs: ["src/test.ts"],
      residualRisk: "medium" as const,
    })),
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, true);
  assert.equal(result.missingCategories.length, 0);
});

test("validateThreatMatrix returns missing categories for incomplete matrix", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "threat_1",
        category: "SPOOFING" as StrideCategory,
        title: "Test threat",
        scenario: "Test scenario",
        mitigations: ["mit1"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "low" as const,
      },
    ],
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, false);
  assert.ok(result.missingCategories.length > 0);
  assert.ok(result.missingCategories.includes("TAMPERING"));
});

test("listThreatsByCategory returns matching entries", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "threat_1",
        category: "SPOOFING" as StrideCategory,
        title: "Spoofing threat 1",
        scenario: "Scenario 1",
        mitigations: ["mit1"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "low" as const,
      },
      {
        threatId: "threat_2",
        category: "SPOOFING" as StrideCategory,
        title: "Spoofing threat 2",
        scenario: "Scenario 2",
        mitigations: ["mit2"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "medium" as const,
      },
      {
        threatId: "threat_3",
        category: "TAMPERING" as StrideCategory,
        title: "Tampering threat",
        scenario: "Scenario 3",
        mitigations: ["mit3"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "high" as const,
      },
    ],
  };

  const spoofingThreats = listThreatsByCategory(matrix, "SPOOFING");

  assert.equal(spoofingThreats.length, 2);
  assert.ok(spoofingThreats.every((t) => t.category === "SPOOFING"));
});

test("listThreatsByCategory returns empty array for non-existent category", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "threat_1",
        category: "SPOOFING" as StrideCategory,
        title: "Spoofing threat",
        scenario: "Scenario",
        mitigations: ["mit1"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "low" as const,
      },
    ],
  };

  const dosThreats = listThreatsByCategory(matrix, "DENIAL_OF_SERVICE");

  assert.equal(dosThreats.length, 0);
});

test("ThreatEntry has correct structure", () => {
  const entry: ThreatEntry = {
    threatId: "test_threat",
    category: "SPOOFING",
    title: "Test Threat",
    scenario: "Test scenario description",
    mitigations: ["mit1", "mit2", "mit3"],
    implementationRefs: ["src/file1.ts", "src/file2.ts"],
    residualRisk: "medium",
  };

  assert.equal(entry.threatId, "test_threat");
  assert.equal(entry.category, "SPOOFING");
  assert.equal(entry.title, "Test Threat");
  assert.equal(entry.scenario, "Test scenario description");
  assert.equal(entry.mitigations.length, 3);
  assert.equal(entry.implementationRefs.length, 2);
  assert.equal(entry.residualRisk, "medium");
});

test("ThreatMatrix has correct structure", () => {
  const matrix: ThreatMatrix = {
    version: "2.0",
    updatedAt: "2026-04-24T00:00:00.000Z",
    owner: "security-team",
    entries: [],
  };

  assert.equal(matrix.version, "2.0");
  assert.equal(matrix.updatedAt, "2026-04-24T00:00:00.000Z");
  assert.equal(matrix.owner, "security-team");
  assert.ok(Array.isArray(matrix.entries));
});

test("validateThreatMatrix handles empty entries", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: [],
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, false);
  assert.equal(result.missingCategories.length, STRIDE_CATEGORIES.length);
});

test("validateThreatMatrix handles all categories covered", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: STRIDE_CATEGORIES.map((cat) => ({
      threatId: `threat_${cat}`,
      category: cat as StrideCategory,
      title: `Threat for ${cat}`,
      scenario: "Scenario",
      mitigations: ["mit"],
      implementationRefs: ["src/test.ts"],
      residualRisk: "low" as const,
    })),
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, true);
  assert.equal(result.missingCategories.length, 0);
});