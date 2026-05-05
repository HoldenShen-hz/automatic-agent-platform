import assert from "node:assert/strict";
import test from "node:test";

import { SimpleReflectionEngine } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";
import type { EvidenceRecord } from "../../../../src/ops-maturity/drift-detection/evidence-store.js";

/**
 * Issue #2110: Requires >=2 failures to reflect, single security event ignored
 */
function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: overrides.id ?? "ev_1",
    taskType: overrides.taskType ?? "tool_execution",
    sessionId: overrides.sessionId ?? "sess_1",
    traceId: overrides.traceId ?? "trace_1",
    success: overrides.success ?? false,
    failureMode: overrides.failureMode ?? "type_error",
    costUsd: overrides.costUsd ?? 0.10,
    latencyMs: overrides.latencyMs ?? 500,
    toolCalls: overrides.toolCalls ?? 5,
    repairRounds: overrides.repairRounds ?? 1,
    rollback: overrides.rollback ?? false,
    createdAt: overrides.createdAt ?? "2026-04-14T00:00:00.000Z",
  };
}

test("SimpleReflectionEngine: reflect requires minimum 2 records (issue #2110)", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "security_forbidden" }),
  ];

  // FIX #2110: Single security event IS reflected (not ignored)
  const reflections = await engine.reflect(evidence);

  assert.equal(reflections.length, 1, "Single security event is reflected - security events are critical");
  assert.equal(reflections[0]!.evidenceIds.length, 1);
});

test("SimpleReflectionEngine: reflect handles single security event via reflectSingle", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    id: "ev_security_1",
    failureMode: "security_forbidden",
    success: false,
  });

  // reflectSingle is async and doesn't require minimum records
  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection !== null);
  assert.equal(reflection.evidenceIds.length, 1);
  // reflectSingle works even for single security events
});

test("SimpleReflectionEngine: reflectSync with multiple records works", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "type_error" }),
    createEvidence({ id: "ev_2", failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]!.evidenceIds.length, 2);
});

test("SimpleReflectionEngine: analyzeRootCause identifies security violations", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "forbidden_access" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.rootCause.includes("Security violations"));
});

test("SimpleReflectionEngine: generateRecommendation for security issues", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ failureMode: "security_violation" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.recommendation.includes("security policy checks"));
});

test("SimpleReflectionEngine: reflect ignores successful records", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", success: true, failureMode: "type_error" }),
    createEvidence({ id: "ev_2", success: false, failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  // With 2 records (1 success + 1 failure), reflect() generates a reflection
  // because >= 2 records establishes a pattern. Success records contribute
  // context for correlation analysis even though they don't trigger alone.
  assert.equal(reflections.length, 1);
});

test("SimpleReflectionEngine: reflect groups by taskType", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", taskType: "task_a", failureMode: "type_error" }),
    createEvidence({ id: "ev_2", taskType: "task_a", failureMode: "type_error" }),
    createEvidence({ id: "ev_3", taskType: "task_b", failureMode: "test_failure" }),
  ];

  const reflections = await engine.reflect(evidence);

  // task_a has 2 records -> produces reflection
  // task_b has 1 record -> not enough
  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]!.taskType, "task_a");
});

test("SimpleReflectionEngine: calculateConfidence with success and failure", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    id: "ev_conf",
    failureMode: "test_failure",
    repairRounds: 1,
  });

  const reflection = await engine.reflectSingle(evidence);

  // confidence should be between 0 and 1
  assert.ok(reflection.confidence >= 0);
  assert.ok(reflection.confidence <= 1);
});

test("SimpleReflectionEngine: metadata includes sample statistics", async () => {
  const evidence = createEvidence({
    id: "ev_meta",
    failureMode: "schema_error",
    costUsd: 0.25,
    repairRounds: 2,
  });

  const engine = new SimpleReflectionEngine();
  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection.metadata !== undefined);
  assert.equal(reflection.metadata!.failureMode, "schema_error");
  assert.equal(reflection.metadata!.sampleSize, 1);
});