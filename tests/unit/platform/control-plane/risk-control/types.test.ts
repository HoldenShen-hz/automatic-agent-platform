/**
 * Unit tests for risk-control types
 * Tests the Zod schemas and type definitions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RiskLevelSchema,
  OperationRiskSchema,
  TargetResourceCriticalitySchema,
  DataSensitivitySchema,
  AutonomyModeRiskSchema,
  TenantImpactSchema,
  BlastRadiusSchema,
  HistoricalFailureRateSchema,
  EvidenceConfidenceSchema,
  RiskFactorsSchema,
  type RiskLevel,
  type OperationRisk,
  type TargetResourceCriticality,
  type DataSensitivity,
  type AutonomyModeRisk,
  type TenantImpact,
  type BlastRadius,
  type HistoricalFailureRate,
  type EvidenceConfidence,
  type RiskFactors,
} from "../../../../../src/platform/control-plane/risk-control/types.js";

test("RiskLevelSchema accepts valid risk levels", () => {
  assert.doesNotThrow(() => RiskLevelSchema.parse("low"));
  assert.doesNotThrow(() => RiskLevelSchema.parse("medium"));
  assert.doesNotThrow(() => RiskLevelSchema.parse("high"));
  assert.doesNotThrow(() => RiskLevelSchema.parse("critical"));
});

test("RiskLevelSchema rejects invalid risk levels", () => {
  assert.throws(() => RiskLevelSchema.parse("invalid"));
  assert.throws(() => RiskLevelSchema.parse(""));
  assert.throws(() => RiskLevelSchema.parse("LOW"));
  assert.throws(() => RiskLevelSchema.parse(123));
  assert.throws(() => RiskLevelSchema.parse(null));
});

test("OperationRiskSchema accepts valid operation risks", () => {
  assert.doesNotThrow(() => OperationRiskSchema.parse("read"));
  assert.doesNotThrow(() => OperationRiskSchema.parse("write"));
  assert.doesNotThrow(() => OperationRiskSchema.parse("delete"));
  assert.doesNotThrow(() => OperationRiskSchema.parse("external_call"));
});

test("OperationRiskSchema rejects invalid operation risks", () => {
  assert.throws(() => OperationRiskSchema.parse("execute"));
  assert.throws(() => OperationRiskSchema.parse("read_only"));
  assert.throws(() => OperationRiskSchema.parse(""));
});

test("TargetResourceCriticalitySchema accepts valid target criticality values", () => {
  assert.doesNotThrow(() => TargetResourceCriticalitySchema.parse("internal"));
  assert.doesNotThrow(() => TargetResourceCriticalitySchema.parse("staging"));
  assert.doesNotThrow(() => TargetResourceCriticalitySchema.parse("production"));
});

test("TargetResourceCriticalitySchema rejects invalid target criticality values", () => {
  assert.throws(() => TargetResourceCriticalitySchema.parse("dev"));
  assert.throws(() => TargetResourceCriticalitySchema.parse("local"));
  assert.throws(() => TargetResourceCriticalitySchema.parse(""));
});

test("DataSensitivitySchema accepts valid data sensitivity values", () => {
  assert.doesNotThrow(() => DataSensitivitySchema.parse("public"));
  assert.doesNotThrow(() => DataSensitivitySchema.parse("internal"));
  assert.doesNotThrow(() => DataSensitivitySchema.parse("confidential"));
  assert.doesNotThrow(() => DataSensitivitySchema.parse("restricted"));
});

test("DataSensitivitySchema rejects invalid data sensitivity values", () => {
  assert.throws(() => DataSensitivitySchema.parse("private"));
  assert.throws(() => DataSensitivitySchema.parse("secret"));
  assert.throws(() => DataSensitivitySchema.parse(""));
});

test("BlastRadiusSchema accepts valid blast radius values", () => {
  assert.doesNotThrow(() => BlastRadiusSchema.parse("single_task"));
  assert.doesNotThrow(() => BlastRadiusSchema.parse("workflow"));
  assert.doesNotThrow(() => BlastRadiusSchema.parse("tenant"));
  assert.doesNotThrow(() => BlastRadiusSchema.parse("platform"));
});

test("BlastRadiusSchema rejects invalid blast radius values", () => {
  assert.throws(() => BlastRadiusSchema.parse("global"));
  assert.throws(() => BlastRadiusSchema.parse("single"));
  assert.throws(() => BlastRadiusSchema.parse(""));
});

test("AutonomyModeRiskSchema accepts valid autonomy modes", () => {
  assert.doesNotThrow(() => AutonomyModeRiskSchema.parse("full_auto"));
  assert.doesNotThrow(() => AutonomyModeRiskSchema.parse("semi_auto"));
  assert.doesNotThrow(() => AutonomyModeRiskSchema.parse("supervised"));
  assert.doesNotThrow(() => AutonomyModeRiskSchema.parse("suggestion"));
});

test("TenantImpactSchema accepts valid tenant impact values", () => {
  assert.doesNotThrow(() => TenantImpactSchema.parse("single_task"));
  assert.doesNotThrow(() => TenantImpactSchema.parse("workflow"));
  assert.doesNotThrow(() => TenantImpactSchema.parse("tenant"));
  assert.doesNotThrow(() => TenantImpactSchema.parse("platform"));
});

test("HistoricalFailureRateSchema accepts valid historical failure rates", () => {
  assert.doesNotThrow(() => HistoricalFailureRateSchema.parse("low"));
  assert.doesNotThrow(() => HistoricalFailureRateSchema.parse("medium"));
  assert.doesNotThrow(() => HistoricalFailureRateSchema.parse("high"));
  assert.doesNotThrow(() => HistoricalFailureRateSchema.parse("critical"));
});

test("EvidenceConfidenceSchema accepts valid evidence confidence levels", () => {
  assert.doesNotThrow(() => EvidenceConfidenceSchema.parse("high"));
  assert.doesNotThrow(() => EvidenceConfidenceSchema.parse("medium"));
  assert.doesNotThrow(() => EvidenceConfidenceSchema.parse("low"));
});

test("RiskFactorsSchema accepts valid risk factors", () => {
  const validFactors: RiskFactors = {
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };
  assert.doesNotThrow(() => RiskFactorsSchema.parse(validFactors));
});

test("RiskFactorsSchema rejects missing required fields", () => {
  assert.throws(() => RiskFactorsSchema.parse({}));
  assert.throws(() => RiskFactorsSchema.parse({ stepTypeRisk: "read" }));
  assert.throws(() => RiskFactorsSchema.parse({
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    // missing other fields
  }));
});

test("RiskFactorsSchema rejects invalid stepTypeRisk", () => {
  const invalidFactors = {
    operationRisk: "execute",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };
  assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});

test("RiskFactorsSchema rejects invalid targetSystemRisk", () => {
  const invalidFactors = {
    operationRisk: "read",
    targetResourceCriticality: "dev",
    dataSensitivity: "public",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };
  assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});

test("RiskFactorsSchema rejects invalid dataClassRisk", () => {
  const invalidFactors = {
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "secret",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };
  assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});

test("RiskFactorsSchema rejects invalid blastRadius", () => {
  const invalidFactors = {
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "global",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };
  assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});

test("RiskFactorsSchema rejects invalid confidence", () => {
  const invalidFactors = {
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "supervised",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "very_high",
  };
  assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});

test("RiskLevelSchema inferred type works correctly", () => {
  const level: RiskLevel = "high";
  assert.equal(level, "high");
  assert.ok(RiskLevelSchema.safeParse(level).success);
});

test("StepTypeRiskSchema inferred type works correctly", () => {
  const stepType: StepTypeRisk = "delete";
  assert.equal(stepType, "delete");
  assert.ok(StepTypeRiskSchema.safeParse(stepType).success);
});

test("TargetSystemRiskSchema inferred type works correctly", () => {
  const target: TargetSystemRisk = "production";
  assert.equal(target, "production");
  assert.ok(TargetSystemRiskSchema.safeParse(target).success);
});

test("DataClassRiskSchema inferred type works correctly", () => {
  const dataClass: DataClassRisk = "restricted";
  assert.equal(dataClass, "restricted");
  assert.ok(DataClassRiskSchema.safeParse(dataClass).success);
});

test("BlastRadiusSchema inferred type works correctly", () => {
  const blast: BlastRadius = "platform";
  assert.equal(blast, "platform");
  assert.ok(BlastRadiusSchema.safeParse(blast).success);
});

test("ConfidenceLevelSchema inferred type works correctly", () => {
  const conf: ConfidenceLevel = "low";
  assert.equal(conf, "low");
  assert.ok(ConfidenceLevelSchema.safeParse(conf).success);
});
