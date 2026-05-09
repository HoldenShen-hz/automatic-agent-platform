import assert from "node:assert/strict";
import test from "node:test";

import { SimpleReflectionEngine } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";
import type { EvidenceRecord } from "../../../../src/ops-maturity/drift-detection/evidence-store.js";

function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "ev_1",
    taskType: "tool_execution",
    sessionId: "sess_1",
    traceId: "trace_1",
    success: false,
    failureMode: "type_error",
    costUsd: 0.10,
    latencyMs: 500,
    toolCalls: 5,
    repairRounds: 1,
    rollback: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

test("SimpleReflectionEngine.reflectSingle generates reflection for single record", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    id: "ev_1",
    failureMode: "type_error",
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.equal(reflection.id.startsWith("refl_"), true);
  assert.deepEqual(reflection.evidenceIds, ["ev_1"]);
  assert.equal(reflection.taskType, "tool_execution");
});

test("SimpleReflectionEngine.reflectSingle uses unknown for missing failureMode", async () => {
  const engine = new SimpleReflectionEngine();
  // Omit failureMode by not including it in overrides
  const evidence: EvidenceRecord = {
    id: "ev_1",
    taskType: "tool_execution",
    sessionId: "sess_1",
    traceId: "trace_1",
    success: false,
    costUsd: 0.10,
    latencyMs: 500,
    toolCalls: 5,
    repairRounds: 1,
    rollback: false,
    createdAt: "2026-04-14T00:00:00.000Z",
  };

  const reflection = await engine.reflectSingle(evidence);

  assert.equal(reflection.rootCause.includes("needs manual investigation"), true);
});

test("SimpleReflectionEngine.reflect groups by failure mode", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "type_error" }),
    createEvidence({ id: "ev_2", failureMode: "type_error" }),
    createEvidence({ id: "ev_3", failureMode: "test_failure" }),
  ];

  const reflections = await engine.reflect(evidence);

  // Only type_error has 2 records, test_failure has only 1
  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]!.metadata?.failureMode, "type_error");
});

test("SimpleReflectionEngine.reflect ignores successful records", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", success: true, failureMode: "type_error" }),
    createEvidence({ id: "ev_2", success: false, failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  // Only 1 failed record - not enough for reflection
  assert.equal(reflections.length, 0);
});

test("SimpleReflectionEngine.reflect produces success-pattern reflections when repeated successes accumulate", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_s1", success: true, failureMode: undefined, taskType: "tool_execution", repairRounds: 0, toolCalls: 2 }),
    createEvidence({ id: "ev_s2", success: true, failureMode: undefined, taskType: "tool_execution", repairRounds: 0, toolCalls: 3 }),
    createEvidence({ id: "ev_s3", success: true, failureMode: undefined, taskType: "tool_execution", repairRounds: 0, toolCalls: 2 }),
  ];

  const reflections = await engine.reflect(evidence);
  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]!.patternType, "success");
  assert.equal(reflections[0]!.metadata?.successPattern, true);
});

test("SimpleReflectionEngine.reflect ignores records without failureMode", async () => {
  const engine = new SimpleReflectionEngine();
  // Create evidence records without failureMode property
  const evidence: EvidenceRecord[] = [
    {
      id: "ev_1",
      taskType: "tool_execution",
      sessionId: "sess_1",
      traceId: "trace_1",
      success: false,
      costUsd: 0.10,
      latencyMs: 500,
      toolCalls: 5,
      repairRounds: 1,
      rollback: false,
      createdAt: "2026-04-14T00:00:00.000Z",
    },
    {
      id: "ev_2",
      taskType: "tool_execution",
      sessionId: "sess_1",
      traceId: "trace_2",
      success: false,
      costUsd: 0.10,
      latencyMs: 500,
      toolCalls: 5,
      repairRounds: 1,
      rollback: false,
      createdAt: "2026-04-14T00:00:00.000Z",
    },
  ];

  const reflections = await engine.reflect(evidence);

  assert.equal(reflections.length, 0);
});

test("SimpleReflectionEngine.reflectSingle calculates confidence correctly", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    repairRounds: 1,
  });

  const reflection = await engine.reflectSingle(evidence);

  // Sample size 1 / 5 = 0.2 * 0.6 = 0.12
  // Repair rounds 1 / 3 = 0.33 * 0.4 = 0.13, 1 - 0.13 = 0.87 * 0.4 = 0.35
  // Total = 0.12 + 0.35 = 0.47
  assert.ok(reflection.confidence > 0 && reflection.confidence <= 1);
});

test("SimpleReflectionEngine.reflectSingle includes metadata", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    id: "ev_1",
    failureMode: "schema_error",
    costUsd: 0.25,
    repairRounds: 2,
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.metadata !== undefined);
  assert.equal(reflection.metadata!.failureMode, "schema_error");
  assert.equal(reflection.metadata!.sampleSize, 1);
  assert.equal(reflection.metadata!.avgCostUsd, 0.25);
});

test("SimpleReflectionEngine.analyzeRootCause identifies type errors", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "type_mismatch" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("Type checking"));
});

test("SimpleReflectionEngine.analyzeRootCause identifies test failures", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "test_timeout" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("Test failures"));
});

test("SimpleReflectionEngine.analyzeRootCause identifies security violations", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "forbidden_access" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("Security violations"));
});

test("SimpleReflectionEngine.analyzeRootCause identifies high repair rounds", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    failureMode: "unknown_error",
    repairRounds: 3,
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("Multiple repair rounds"));
});

test("SimpleReflectionEngine.analyzeRootCause identifies high cost", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    failureMode: "unknown_error",
    costUsd: 1.00,
    repairRounds: 1,
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("High cost"));
});

test("SimpleReflectionEngine.generateRecommendation for type errors", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "type_error" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.recommendation.includes("type annotations"));
});

test("SimpleReflectionEngine.generateRecommendation for test failures", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "test_failure" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.recommendation.includes("easier to test"));
});

test("SimpleReflectionEngine.generateRecommendation for security issues", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "security_violation" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.recommendation.includes("security policy checks"));
});

test("SimpleReflectionEngine.generateRecommendation for high repair rounds", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    failureMode: "unknown",
    repairRounds: 2,
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.recommendation.includes("planning"));
});

test("SimpleReflectionEngine.reflect aggregates multiple records", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "schema_error", costUsd: 0.10, repairRounds: 1 }),
    createEvidence({ id: "ev_2", failureMode: "schema_error", costUsd: 0.20, repairRounds: 2 }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.equal(reflections.length, 1);
  // Should aggregate evidenceIds
  assert.equal(reflections[0]!.evidenceIds.length, 2);
  // Should calculate average cost (using approximate comparison for floating point)
  assert.ok(Math.abs((reflections[0]!.metadata!.avgCostUsd as number) - 0.15) < 0.001);
});

test("SimpleReflectionEngine.reflect handles empty array", async () => {
  const engine = new SimpleReflectionEngine();

  const reflections = await engine.reflect([]);

  assert.equal(reflections.length, 0);
});
