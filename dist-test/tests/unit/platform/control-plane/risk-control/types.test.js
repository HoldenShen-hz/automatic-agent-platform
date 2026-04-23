/**
 * Unit tests for risk-control types
 * Tests the Zod schemas and type definitions
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RiskLevelSchema, StepTypeRiskSchema, TargetSystemRiskSchema, DataClassRiskSchema, BlastRadiusSchema, ConfidenceLevelSchema, RiskFactorsSchema, } from "../../../../../src/platform/control-plane/risk-control/types.js";
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
test("StepTypeRiskSchema accepts valid step types", () => {
    assert.doesNotThrow(() => StepTypeRiskSchema.parse("read"));
    assert.doesNotThrow(() => StepTypeRiskSchema.parse("write"));
    assert.doesNotThrow(() => StepTypeRiskSchema.parse("delete"));
    assert.doesNotThrow(() => StepTypeRiskSchema.parse("external_call"));
});
test("StepTypeRiskSchema rejects invalid step types", () => {
    assert.throws(() => StepTypeRiskSchema.parse("execute"));
    assert.throws(() => StepTypeRiskSchema.parse("read_only"));
    assert.throws(() => StepTypeRiskSchema.parse(""));
});
test("TargetSystemRiskSchema accepts valid target systems", () => {
    assert.doesNotThrow(() => TargetSystemRiskSchema.parse("internal"));
    assert.doesNotThrow(() => TargetSystemRiskSchema.parse("staging"));
    assert.doesNotThrow(() => TargetSystemRiskSchema.parse("production"));
});
test("TargetSystemRiskSchema rejects invalid target systems", () => {
    assert.throws(() => TargetSystemRiskSchema.parse("dev"));
    assert.throws(() => TargetSystemRiskSchema.parse("local"));
    assert.throws(() => TargetSystemRiskSchema.parse(""));
});
test("DataClassRiskSchema accepts valid data classes", () => {
    assert.doesNotThrow(() => DataClassRiskSchema.parse("public"));
    assert.doesNotThrow(() => DataClassRiskSchema.parse("internal"));
    assert.doesNotThrow(() => DataClassRiskSchema.parse("confidential"));
    assert.doesNotThrow(() => DataClassRiskSchema.parse("restricted"));
});
test("DataClassRiskSchema rejects invalid data classes", () => {
    assert.throws(() => DataClassRiskSchema.parse("private"));
    assert.throws(() => DataClassRiskSchema.parse("secret"));
    assert.throws(() => DataClassRiskSchema.parse(""));
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
test("ConfidenceLevelSchema accepts valid confidence levels", () => {
    assert.doesNotThrow(() => ConfidenceLevelSchema.parse("high"));
    assert.doesNotThrow(() => ConfidenceLevelSchema.parse("medium"));
    assert.doesNotThrow(() => ConfidenceLevelSchema.parse("low"));
});
test("ConfidenceLevelSchema rejects invalid confidence levels", () => {
    assert.throws(() => ConfidenceLevelSchema.parse("very_high"));
    assert.throws(() => ConfidenceLevelSchema.parse("medium_high"));
    assert.throws(() => ConfidenceLevelSchema.parse(""));
});
test("RiskFactorsSchema accepts valid risk factors", () => {
    const validFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
    };
    assert.doesNotThrow(() => RiskFactorsSchema.parse(validFactors));
});
test("RiskFactorsSchema accepts boundary priorFailureRatePercent values", () => {
    const minFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
    };
    assert.doesNotThrow(() => RiskFactorsSchema.parse(minFactors));
    const maxFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 100,
        confidence: "high",
    };
    assert.doesNotThrow(() => RiskFactorsSchema.parse(maxFactors));
});
test("RiskFactorsSchema rejects priorFailureRatePercent below 0", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: -1,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskFactorsSchema rejects priorFailureRatePercent above 100", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 101,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
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
        stepTypeRisk: "execute",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskFactorsSchema rejects invalid targetSystemRisk", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "dev",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskFactorsSchema rejects invalid dataClassRisk", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "secret",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskFactorsSchema rejects invalid blastRadius", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "global",
        priorFailureRatePercent: 5,
        confidence: "high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskFactorsSchema rejects invalid confidence", () => {
    const invalidFactors = {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 5,
        confidence: "very_high",
    };
    assert.throws(() => RiskFactorsSchema.parse(invalidFactors));
});
test("RiskLevelSchema inferred type works correctly", () => {
    const level = "high";
    assert.equal(level, "high");
    assert.ok(RiskLevelSchema.safeParse(level).success);
});
test("StepTypeRiskSchema inferred type works correctly", () => {
    const stepType = "delete";
    assert.equal(stepType, "delete");
    assert.ok(StepTypeRiskSchema.safeParse(stepType).success);
});
test("TargetSystemRiskSchema inferred type works correctly", () => {
    const target = "production";
    assert.equal(target, "production");
    assert.ok(TargetSystemRiskSchema.safeParse(target).success);
});
test("DataClassRiskSchema inferred type works correctly", () => {
    const dataClass = "restricted";
    assert.equal(dataClass, "restricted");
    assert.ok(DataClassRiskSchema.safeParse(dataClass).success);
});
test("BlastRadiusSchema inferred type works correctly", () => {
    const blast = "platform";
    assert.equal(blast, "platform");
    assert.ok(BlastRadiusSchema.safeParse(blast).success);
});
test("ConfidenceLevelSchema inferred type works correctly", () => {
    const conf = "low";
    assert.equal(conf, "low");
    assert.ok(ConfidenceLevelSchema.safeParse(conf).success);
});
//# sourceMappingURL=types.test.js.map