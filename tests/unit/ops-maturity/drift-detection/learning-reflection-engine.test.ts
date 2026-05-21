/**
 * Tests for learning/reflection-engine.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleReflectionEngine,
  type EvidenceRecord,
} from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";

function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: `ev_${Math.random().toString(36).slice(2, 8)}`,
    taskType: "general_task",
    sessionId: "sess_1",
    traceId: "exec_1",
    success: false,
    failureMode: "type_error",
    failureCategory: "type_error",
    costUsd: 0.10,
    latencyMs: 500,
    toolCalls: 3,
    repairRounds: 1,
    rollback: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("SimpleReflectionEngine reflect returns empty array for empty evidence", async () => {
  const engine = new SimpleReflectionEngine();
  const reflections = await engine.reflect([]);
  assert.strictEqual(reflections.length, 0);
});

test("SimpleReflectionEngine reflect generates reflection for multiple failures of same type", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "type_error" }),
    createEvidence({ failureMode: "type_error" }),
    createEvidence({ failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  const typeReflection = reflections.find((r) =>
    r.rootCause.toLowerCase().includes("type")
  );
  assert.ok(typeReflection);
});

test("SimpleReflectionEngine reflect generates success reflection for multiple successes of same task type", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ success: true, failureMode: undefined, taskType: "direct_task" }),
    createEvidence({ success: true, failureMode: undefined, taskType: "direct_task" }),
    createEvidence({ success: true, failureMode: undefined, taskType: "direct_task" }),
  ];

  const reflections = await engine.reflect(evidence);

  const successReflection = reflections.find((r) => r.patternType === "success");
  assert.ok(successReflection);
});

test("SimpleReflectionEngine reflect does not generate reflection for single failure", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.strictEqual(reflections.length, 0);
});

test("SimpleReflectionEngine reflect calculates confidence based on sample size", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "type_error" }),
    createEvidence({ id: "ev_2", failureMode: "type_error" }),
    createEvidence({ id: "ev_3", failureMode: "type_error" }),
    createEvidence({ id: "ev_4", failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(reflections[0]!.confidence > 0);
  assert.ok(reflections[0]!.confidence <= 1);
});

test("SimpleReflectionEngine reflect includes evidence ids in reflection", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ id: "ev_1", failureMode: "type_error" }),
    createEvidence({ id: "ev_2", failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(reflections[0]!.evidenceIds.length >= 2);
});

test("SimpleReflectionEngine reflectSingle generates reflection for a single failure", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({ success: false, failureMode: "timeout" });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection);
  assert.strictEqual(reflection.patternType, "failure");
});

test("SimpleReflectionEngine reflectSingle generates success reflection for a single success", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = createEvidence({
    success: true,
    failureMode: undefined,
    taskType: "simple_task",
  });

  const reflection = await engine.reflectSingle(evidence);

  assert.ok(reflection);
  assert.strictEqual(reflection.patternType, "success");
});

test("SimpleReflectionEngine reflect identifies type checking root cause for type errors", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "type_error" }),
    createEvidence({ failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.rootCause.toLowerCase().includes("type") ||
    reflections[0]!.rootCause.toLowerCase().includes("schema")
  );
});

test("SimpleReflectionEngine reflect identifies test failure root cause", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "test_failure" }),
    createEvidence({ failureMode: "test_failure" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.rootCause.toLowerCase().includes("test")
  );
});

test("SimpleReflectionEngine reflect identifies security root cause", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "security_policy_violation" }),
    createEvidence({ failureMode: "security_policy_violation" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.rootCause.toLowerCase().includes("security")
  );
});

test("SimpleReflectionEngine reflect identifies high repair rounds as complexity issue", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ repairRounds: 3 }),
    createEvidence({ repairRounds: 4 }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.rootCause.toLowerCase().includes("repair") ||
    reflections[0]!.rootCause.toLowerCase().includes("complex") ||
    reflections[0]!.rootCause.toLowerCase().includes("planning")
  );
});

test("SimpleReflectionEngine reflect identifies high cost as inefficiency", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ costUsd: 0.75 }),
    createEvidence({ costUsd: 0.80 }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.rootCause.toLowerCase().includes("cost") ||
    reflections[0]!.rootCause.toLowerCase().includes("inefficient")
  );
});

test("SimpleReflectionEngine reflect recommends type annotations for type errors", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "type_error" }),
    createEvidence({ failureMode: "type_error" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.recommendation.toLowerCase().includes("type") ||
    reflections[0]!.recommendation.toLowerCase().includes("annotation") ||
    reflections[0]!.recommendation.toLowerCase().includes("schema")
  );
});

test("SimpleReflectionEngine reflect recommends simpler implementation for test failures", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "test_failure" }),
    createEvidence({ failureMode: "test_failure" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.recommendation.toLowerCase().includes("simple") ||
    reflections[0]!.recommendation.toLowerCase().includes("test")
  );
});

test("SimpleReflectionEngine reflect recommends security validation for security violations", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({ failureMode: "security_policy_violation" }),
    createEvidence({ failureMode: "security_policy_violation" }),
  ];

  const reflections = await engine.reflect(evidence);

  assert.ok(reflections.length > 0);
  assert.ok(
    reflections[0]!.recommendation.toLowerCase().includes("security") ||
    reflections[0]!.recommendation.toLowerCase().includes("validation")
  );
});

test("SimpleReflectionEngine reflect detects direct resolution pattern", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({
      success: true,
      failureMode: undefined,
      repairRounds: 0,
      toolCalls: 3,
    }),
    createEvidence({
      success: true,
      failureMode: undefined,
      repairRounds: 0,
      toolCalls: 2,
    }),
    createEvidence({
      success: true,
      failureMode: undefined,
      repairRounds: 0,
      toolCalls: 4,
    }),
  ];

  const reflections = await engine.reflect(evidence);

  const successReflection = reflections.find((r) => r.patternType === "success");
  assert.ok(successReflection);
  assert.ok(
    successReflection!.rootCause.toLowerCase().includes("direct")
  );
});

test("SimpleReflectionEngine reflect detects complex workflow pattern", async () => {
  const engine = new SimpleReflectionEngine();
  const evidence = [
    createEvidence({
      success: true,
      failureMode: undefined,
      toolCalls: 12,
    }),
    createEvidence({
      success: true,
      failureMode: undefined,
      toolCalls: 15,
    }),
    createEvidence({
      success: true,
      failureMode: undefined,
      toolCalls: 11,
    }),
  ];

  const reflections = await engine.reflect(evidence);

  const successReflection = reflections.find((r) => r.patternType === "success");
  assert.ok(successReflection);
  assert.ok(
    successReflection!.rootCause.toLowerCase().includes("complex") ||
    successReflection!.rootCause.toLowerCase().includes("multi-step")
  );
});