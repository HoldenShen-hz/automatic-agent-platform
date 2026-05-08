/**
 * Unit tests for evidence-mapper functions (mapEvidenceByType, findMissingEvidenceTypes)
 *
 * Verifies these functions have real implementations with actual logic.
 * Tests cover:
 * - Functions don't just throw "not implemented"
 * - Functions have real logic beyond returning constants
 * - Functions properly compute values from inputs
 *
 * @see src/ops-maturity/compliance-reporter/evidence-mapper/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mapEvidenceByType,
  findMissingEvidenceTypes,
} from "../../../../src/ops-maturity/compliance-reporter/evidence-mapper/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// mapEvidenceByType Tests
// ─────────────────────────────────────────────────────────────────────────────

test("mapEvidenceByType groups evidence by type correctly", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "type_a" },
    { evidenceId: "e2", evidenceType: "type_a" },
    { evidenceId: "e3", evidenceType: "type_b" },
  ];

  const result = mapEvidenceByType(items);

  assert.deepEqual(result.type_a, ["e1", "e2"]);
  assert.deepEqual(result.type_b, ["e3"]);
});

test("mapEvidenceByType handles empty array", () => {
  const result = mapEvidenceByType([]);
  assert.deepEqual(result, {});
});

test("mapEvidenceByType handles single item", () => {
  const result = mapEvidenceByType([{ evidenceId: "e1", evidenceType: "access_log" }]);
  assert.deepEqual(result.access_log, ["e1"]);
});

test("mapEvidenceByType handles multiple types", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "config_snapshot" },
    { evidenceId: "e3", evidenceType: "access_log" },
    { evidenceId: "e4", evidenceType: "metrics" },
  ];

  const result = mapEvidenceByType(items);

  assert.deepEqual(result.access_log, ["e1", "e3"]);
  assert.deepEqual(result.config_snapshot, ["e2"]);
  assert.deepEqual(result.metrics, ["e4"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// findMissingEvidenceTypes Tests
// ─────────────────────────────────────────────────────────────────────────────

test("findMissingEvidenceTypes returns types not covered by evidence", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "config_snapshot" },
  ];
  const requiredTypes = ["access_log", "config_snapshot", "metrics", "network_logs"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepEqual(result, ["metrics", "network_logs"]);
});

test("findMissingEvidenceTypes returns empty when all types covered", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "metrics" },
  ];
  const requiredTypes = ["access_log", "metrics"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepEqual(result, []);
});

test("findMissingEvidenceTypes handles empty items array", () => {
  const items: { evidenceId: string; evidenceType: string }[] = [];
  const requiredTypes = ["access_log", "metrics"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepEqual(result, ["access_log", "metrics"]);
});

test("findMissingEvidenceTypes handles empty requiredTypes", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
  ];
  const requiredTypes: string[] = [];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepEqual(result, []);
});

test("findMissingEvidenceTypes is case sensitive", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "Access_Log" },
  ];
  const requiredTypes = ["access_log"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepEqual(result, ["access_log"]);
});