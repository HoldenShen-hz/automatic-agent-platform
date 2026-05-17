/**
 * Performance Test: Multi-Step Orchestration
 * G4 Benchmark — Multi-step orchestration components P99 < 100ms
 *
 * Design target: Orchestration operations <100ms P99
 * Tests the internal components of multi-step orchestration.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId } from "../../src/platform/contracts/types/ids.js";
import { routeComplexity, type ComplexityRouterConfig } from "../../src/platform/five-plane-execution/execution-engine/complexity-router.js";
import { createKvCachePrefixConfig, estimateTokens } from "../../src/platform/five-plane-execution/execution-engine/kv-cache-prefix-config.js";
import { LoopDetectionState, hashToolCall, normalizeToolInputForHash } from "../../src/platform/five-plane-execution/execution-engine/loop-detection.js";
import { IntakeRouter } from "../../src/platform/five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

// ============================================================================
// Complexity Router Benchmarks
// ============================================================================

test("performance: ComplexityRouter routeComplexity() for simple request P99 < 10ms", () => {
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    routeComplexity("Show me the status");
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Show me the status");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ComplexityRouter simple: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 10,
    `ComplexityRouter simple P99 latency ${p99.toFixed(3)}ms exceeds 10ms target`,
  );
});

test("performance: ComplexityRouter routeComplexity() for complex request P99 < 10ms", () => {
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    routeComplexity("Perform a comprehensive security audit of all files in the repository");
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Perform a comprehensive security audit of all files in the repository");
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`ComplexityRouter complex: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 10,
    `ComplexityRouter complex P99 latency ${p99.toFixed(3)}ms exceeds 10ms target`,
  );
});

test("performance: ComplexityRouter routeComplexity() throughput > 100 ops/sec", () => {
  const iterations = 100;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    routeComplexity("List all the files in the project");
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`ComplexityRouter throughput: ${opsPerSec.toFixed(0)} ops/sec`);

  assert.ok(
    opsPerSec > 100,
    `ComplexityRouter throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100 ops/sec`,
  );
});

// ============================================================================
// KV Cache Prefix Config Benchmarks
// ============================================================================

test("performance: createKvCachePrefixConfig() P99 < 5ms", () => {
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    createKvCachePrefixConfig({});
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    createKvCachePrefixConfig({});
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`createKvCachePrefixConfig: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `createKvCachePrefixConfig P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: estimateTokens() throughput > 5000 ops/sec", () => {
  const text = "This is a test prompt with multiple words to estimate token count for performance testing.";

  const iterations = 500;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    estimateTokens(text);
  }
  const elapsed = performance.now() - start;

  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`estimateTokens throughput: ${opsPerSec.toFixed(0)} ops/sec`);

  assert.ok(
    opsPerSec > 5000,
    `estimateTokens throughput ${opsPerSec.toFixed(0)} ops/sec should be > 5000 ops/sec`,
  );
});

// ============================================================================
// Loop Detection Benchmarks
// ============================================================================

test("performance: hashToolCall() P99 < 1ms", () => {
  const iterations = 2000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    hashToolCall("read", { path: "/tmp/test.txt" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    hashToolCall("read", { path: "/tmp/test.txt" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`hashToolCall: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 1,
    `hashToolCall P99 latency ${p99.toFixed(3)}ms exceeds 1ms target`,
  );
});

test("performance: normalizeToolInputForHash() P99 < 1ms", () => {
  const iterations = 2000;
  const input = { path: "/tmp/test.txt", content: "some content to hash" };

  // Warmup
  for (let i = 0; i < 10; i++) {
    normalizeToolInputForHash(input);
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    normalizeToolInputForHash(input);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`normalizeToolInputForHash: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 1,
    `normalizeToolInputForHash P99 latency ${p99.toFixed(3)}ms exceeds 1ms target`,
  );
});

test("performance: LoopDetectionState.recordToolCall() P99 < 5ms", () => {
  const state = new LoopDetectionState();
  const iterations = 500;

  // Warmup
  for (let i = 0; i < 10; i++) {
    state.recordToolCall("read", { path: "/tmp/test.txt" });
    state.reset();
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    state.recordToolCall("read", { path: "/tmp/test.txt" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`LoopDetectionState.recordToolCall: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 5,
    `LoopDetectionState.recordToolCall P99 latency ${p99.toFixed(3)}ms exceeds 5ms target`,
  );
});

test("performance: LoopDetectionState.getRepeatCount() P99 < 1ms", () => {
  const state = new LoopDetectionState();
  // Pre-populate with some data
  state.recordToolCall("read", { path: "/tmp/test.txt" });
  state.recordToolCall("read", { path: "/tmp/test.txt" });
  state.recordToolCall("read", { path: "/tmp/test.txt" });

  const iterations = 2000;

  // Warmup
  for (let i = 0; i < 10; i++) {
    state.getRepeatCount("read", { path: "/tmp/test.txt" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    state.getRepeatCount("read", { path: "/tmp/test.txt" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`LoopDetectionState.getRepeatCount: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 1,
    `LoopDetectionState.getRepeatCount P99 latency ${p99.toFixed(3)}ms exceeds 1ms target`,
  );
});

// ============================================================================
// Intake Router Benchmarks
// ============================================================================

test("performance: IntakeRouter.route() P99 < 50ms", () => {
  const router = new IntakeRouter();
  const iterations = 100;

  // Warmup
  for (let i = 0; i < 5; i++) {
    router.route({ title: "Test Task", request: "Show me the status" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    router.route({ title: "Test Task", request: "Show me the status" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`IntakeRouter.route: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 50,
    `IntakeRouter.route P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );
});

test("performance: IntakeRouter.route() complex request P99 < 100ms", () => {
  const router = new IntakeRouter();
  const iterations = 50;

  // Warmup
  for (let i = 0; i < 3; i++) {
    router.route({
      title: "Security Audit",
      request: "Perform a comprehensive security audit of all files in the repository and identify potential vulnerabilities",
    });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    router.route({
      title: "Security Audit",
      request: "Perform a comprehensive security audit of all files in the repository and identify potential vulnerabilities",
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`IntakeRouter.route complex: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `IntakeRouter.route complex P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

// ============================================================================
// Workflow Planner Benchmarks
// ============================================================================

test("performance: WorkflowPlanner.plan() P99 < 100ms", () => {
  const router = new IntakeRouter();
  const routing = router.route({ title: "Test", request: "Build a feature" });
  const planner = new WorkflowPlanner();
  const iterations = 50;

  // Warmup
  for (let i = 0; i < 3; i++) {
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`WorkflowPlanner.plan: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 100,
    `WorkflowPlanner.plan P99 latency ${p99.toFixed(3)}ms exceeds 100ms target`,
  );
});

// ============================================================================
// Combined Orchestration Path Benchmarks
// ============================================================================

test("performance: IntakeRouter + WorkflowPlanner combined P99 < 150ms", () => {
  const router = new IntakeRouter();
  const planner = new WorkflowPlanner();
  const iterations = 50;

  // Warmup
  for (let i = 0; i < 3; i++) {
    const routing = router.route({ title: "Test", request: "Build a feature" });
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const routing = router.route({ title: "Test", request: "Build a feature" });
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`IntakeRouter + WorkflowPlanner: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 150,
    `IntakeRouter + WorkflowPlanner P99 latency ${p99.toFixed(3)}ms exceeds 150ms target`,
  );
});

test("performance: ComplexityRouter + IntakeRouter + WorkflowPlanner P99 < 200ms", () => {
  const intakeRouter = new IntakeRouter();
  const planner = new WorkflowPlanner();
  const iterations = 30;

  // Warmup
  for (let i = 0; i < 2; i++) {
    routeComplexity("Build a feature");
    const routing = intakeRouter.route({ title: "Test", request: "Build a feature" });
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
  }

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    routeComplexity("Build a feature");
    const routing = intakeRouter.route({ title: "Test", request: "Build a feature" });
    planner.plan({ workflowId: routing.workflowId, request: "Build a feature" });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  console.log(`Full orchestration path: P50=${p50.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);

  assert.ok(
    p99 < 200,
    `Full orchestration path P99 latency ${p99.toFixed(3)}ms exceeds 200ms target`,
  );
});
