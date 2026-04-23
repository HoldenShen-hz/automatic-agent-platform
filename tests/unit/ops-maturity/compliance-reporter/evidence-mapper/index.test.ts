import assert from "node:assert/strict";
import test from "node:test";

import {
  mapEvidenceByType,
  findMissingEvidenceTypes,
  EvidenceMapperService,
} from "../../../../../src/ops-maturity/compliance-reporter/evidence-mapper/index.js";

test("mapEvidenceByType groups evidence by type", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "access_log" },
    { evidenceId: "e3", evidenceType: "config_snapshot" },
  ];

  const result = mapEvidenceByType(items);

  assert.deepStrictEqual(result["access_log"], ["e1", "e2"]);
  assert.deepStrictEqual(result["config_snapshot"], ["e3"]);
});

test("mapEvidenceByType returns empty object for empty input", () => {
  const result = mapEvidenceByType([]);
  assert.deepStrictEqual(result, {});
});

test("mapEvidenceByType handles single item", () => {
  const items = [{ evidenceId: "e1", evidenceType: "audit" }];
  const result = mapEvidenceByType(items);
  assert.deepStrictEqual(result["audit"], ["e1"]);
});

test("findMissingEvidenceTypes returns types not covered", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "config_snapshot" },
  ];
  const requiredTypes = ["access_log", "config_snapshot", "metrics"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepStrictEqual(result, ["metrics"]);
});

test("findMissingEvidenceTypes returns empty when all types covered", () => {
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "config_snapshot" },
  ];
  const requiredTypes = ["access_log", "config_snapshot"];

  const result = findMissingEvidenceTypes(items, requiredTypes);

  assert.deepStrictEqual(result, []);
});

test("EvidenceMapperService.map groups evidence by type", () => {
  const service = new EvidenceMapperService();
  const items = [
    { evidenceId: "e1", evidenceType: "type-a" },
    { evidenceId: "e2", evidenceType: "type-a" },
  ];

  const result = service.map(items);

  assert.deepStrictEqual(result["type-a"], ["e1", "e2"]);
});

test("EvidenceMapperService.summarizeCoverage calculates coverage ratio", () => {
  const service = new EvidenceMapperService();
  const items = [
    { evidenceId: "e1", evidenceType: "access_log" },
    { evidenceId: "e2", evidenceType: "config_snapshot" },
  ];
  const requiredTypes = ["access_log", "config_snapshot", "metrics"];

  const result = service.summarizeCoverage(items, requiredTypes);

  assert.equal(result.coverageRatio, 0.67);
  assert.deepStrictEqual(result.coveredTypes, ["access_log", "config_snapshot"]);
  assert.deepStrictEqual(result.missingTypes, ["metrics"]);
});

test("EvidenceMapperService.summarizeCoverage returns 1.0 when no required types", () => {
  const service = new EvidenceMapperService();
  const items = [{ evidenceId: "e1", evidenceType: "access_log" }];

  const result = service.summarizeCoverage(items, []);

  assert.equal(result.coverageRatio, 1);
  assert.deepStrictEqual(result.coveredTypes, []);
  assert.deepStrictEqual(result.missingTypes, []);
});

test("EvidenceMapperService.summarizeCoverage returns 0.0 when no items and required types exist", () => {
  const service = new EvidenceMapperService();
  const items: { evidenceId: string; evidenceType: string }[] = [];
  const requiredTypes = ["access_log"];

  const result = service.summarizeCoverage(items, requiredTypes);

  assert.equal(result.coverageRatio, 0);
  assert.deepStrictEqual(result.coveredTypes, []);
  assert.deepStrictEqual(result.missingTypes, ["access_log"]);
});
