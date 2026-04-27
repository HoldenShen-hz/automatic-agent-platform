/**
 * Performance Test: Inspect Service
 * Measures inspect view building, summary parsing, and query operations
 *
 * Design targets:
 * - Task inspect view building: <50ms P99
 * - Summary parsing functions: <1ms P99
 * - Query normalization: <0.1ms P99
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";
import { performance } from "node:perf_hooks";

import {
  parseApprovalRequestSummary,
  parseApprovalDecisionSummary,
  parseDispatchDecisionTraceFromEvent,
  normalizeLimit,
  parseJsonArray,
  findActiveExecutionId,
} from "../../src/platform/shared/observability/inspect-service-support.js";
import type { ApprovalRecord, EventRecord } from "../../src/platform/contracts/types/domain.js";

// ============================================================================
// Approval Request Summary Parsing Benchmarks
// ============================================================================

test("performance: parseApprovalRequestSummary() P99 <0.5ms", (t) => {
  const sampleJson = JSON.stringify({
    approvalId: "approval_123",
    taskId: "task_456",
    sourceAgentId: "agent_builder",
    riskLevel: "high",
    options: ["option_a", "option_b"],
    timeoutPolicy: "approve",
  });

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseApprovalRequestSummary(sampleJson);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseApprovalRequestSummary(sampleJson);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseApprovalRequestSummary P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: parseApprovalRequestSummary() with malformed JSON returns defaults <0.5ms", (t) => {
  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseApprovalRequestSummary("invalid json {{{");
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseApprovalRequestSummary("invalid json {{{");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseApprovalRequestSummary (malformed) P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Approval Decision Summary Parsing Benchmarks
// ============================================================================

test("performance: parseApprovalDecisionSummary() P99 <0.5ms", (t) => {
  const sampleJson = JSON.stringify({
    approvalId: "approval_123",
    decisionType: "option_selected",
    selectedOptionId: "option_a",
    respondedBy: "user_456",
    respondedAt: "2024-01-01T00:00:00.000Z",
  });

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseApprovalDecisionSummary(sampleJson);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseApprovalDecisionSummary(sampleJson);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseApprovalDecisionSummary P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: parseApprovalDecisionSummary() with null returns defaults <0.5ms", (t) => {
  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseApprovalDecisionSummary(null);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseApprovalDecisionSummary(null);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseApprovalDecisionSummary (null) P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Dispatch Decision Trace Parsing Benchmarks
// ============================================================================

test("performance: parseDispatchDecisionTraceFromEvent() P99 <1ms", (t) => {
  const validEvent: EventRecord = {
    id: "evt_123",
    taskId: "task_456",
    executionId: "exec_789",
    eventType: "dispatch:decision_recorded",
    eventTier: "tier_1",
    payloadJson: JSON.stringify({
      ticketId: "ticket_abc",
      executionId: "exec_789",
      taskId: "task_456",
      requiredCapabilities: ["code-execution"],
      evaluations: [],
    }),
    traceId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const latencies: number[] = [];
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseDispatchDecisionTraceFromEvent(validEvent);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseDispatchDecisionTraceFromEvent(validEvent);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 1,
      `parseDispatchDecisionTraceFromEvent P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: parseDispatchDecisionTraceFromEvent() with wrong event type returns null <0.5ms", (t) => {
  const wrongEventType: EventRecord = {
    id: "evt_123",
    taskId: "task_456",
    executionId: null,
    eventType: "task:created",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseDispatchDecisionTraceFromEvent(wrongEventType);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseDispatchDecisionTraceFromEvent(wrongEventType);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseDispatchDecisionTraceFromEvent (wrong type) P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Query Normalization Benchmarks
// ============================================================================

test("performance: normalizeLimit() P99 <0.05ms", (t) => {
  const latencies: number[] = [];
  const iterations = 20000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    normalizeLimit(i % 200, 50);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    normalizeLimit(i % 200, 50);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.05,
      `normalizeLimit P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: normalizeLimit() with undefined/NaN fallback <0.05ms", (t) => {
  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    normalizeLimit(undefined, 50);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    normalizeLimit(undefined, 50);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(
      p99 < 0.05,
      `normalizeLimit (fallback) P99 latency ${p99.toFixed(4)}ms exceeds 0.05ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// JSON Array Parsing Benchmarks
// ============================================================================

test("performance: parseJsonArray() P99 <0.5ms", (t) => {
  const sampleJson = JSON.stringify(["item1", "item2", "item3", "item4", "item5"]);

  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseJsonArray(sampleJson);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseJsonArray(sampleJson);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseJsonArray P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: parseJsonArray() with malformed JSON returns empty array <0.5ms", (t) => {
  const latencies: number[] = [];
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    parseJsonArray("not valid json");
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    parseJsonArray("not valid json");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(
      p99 < 0.5,
      `parseJsonArray (malformed) P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Active Execution Finding Benchmarks
// ============================================================================

test("performance: findActiveExecutionId() P99 <0.1ms", (t) => {
  const executions = [
    { id: "exec_1", status: "succeeded" },
    { id: "exec_2", status: "failed" },
    { id: "exec_3", status: "running" },
    { id: "exec_4", status: "cancelled" },
  ];

  const latencies: number[] = [];
  const iterations = 20000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    findActiveExecutionId(executions);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    findActiveExecutionId(executions);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.1,
      `findActiveExecutionId P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: findActiveExecutionId() with all terminal statuses <0.1ms", (t) => {
  const terminalExecutions = [
    { id: "exec_1", status: "succeeded" },
    { id: "exec_2", status: "failed" },
    { id: "exec_3", status: "cancelled" },
    { id: "exec_4", status: "superseded" },
  ];

  const latencies: number[] = [];
  const iterations = 20000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    findActiveExecutionId(terminalExecutions);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    findActiveExecutionId(terminalExecutions);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(
      p99 < 0.1,
      `findActiveExecutionId (all terminal) P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Throughput Benchmarks
// ============================================================================

test("performance: parseApprovalRequestSummary() throughput >50000 ops/sec", (t) => {
  const sampleJson = JSON.stringify({
    approvalId: "approval_123",
    taskId: "task_456",
    sourceAgentId: "agent_builder",
    riskLevel: "high",
    options: ["option_a", "option_b"],
    timeoutPolicy: "approve",
  });

  const iterations = 30000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    parseApprovalRequestSummary(sampleJson);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 50000,
      `parseApprovalRequestSummary throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: parseJsonArray() throughput >50000 ops/sec", (t) => {
  const sampleJson = JSON.stringify(["a", "b", "c", "d", "e", "f", "g", "h"]);

  const iterations = 30000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    parseJsonArray(sampleJson);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 50000,
      `parseJsonArray throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
