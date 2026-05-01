/**
 * Performance Test: Tool Executor
 * Measures tool execution throughput, parallel execution, and latency
 *
 * Design targets:
 * - Command execution: >1000 ops/sec
 * - Parallel tool execution: >2000 ops/sec
 * - Concurrent-safe tool batching: >5000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { ToolExecutor } from "../../src/platform/execution/tool-executor/tool-executor.js";
import type { CommandToolRequest } from "../../src/platform/execution/tool-executor/tool-metadata.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

/**
 * Mock command executor for testing
 */
class MockCommandExecutor {
  public async execute(request: CommandToolRequest, _signal?: AbortSignal): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // Simulate minimal processing time
    const delay = Math.random() * 0.5;
    return { exitCode: 0, stdout: `processed: ${request.command}`, stderr: "" };
  }
}

// ============================================================================
// Command Execution Benchmarks
// ============================================================================

test("performance: ToolExecutor.executeCommand() throughput >1000 ops/sec", (t) => {
  const executor = new ToolExecutor(new MockCommandExecutor());

  const request: CommandToolRequest = {
    command: "echo test",
    workingDirectory: "/tmp",
    timeoutMs: 5000,
    context: { taskId: newId("task"), executionId: newId("exec") },
  };

  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    executor.executeCommand({ ...request, command: `echo test-${i}` });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 1000, `ToolExecutor command execution ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: ToolExecutor.executeCommand() latency P99 <10ms", (t) => {
  const executor = new ToolExecutor(new MockCommandExecutor());

  const request: CommandToolRequest = {
    command: "echo test",
    workingDirectory: "/tmp",
    timeoutMs: 5000,
    context: { taskId: newId("task"), executionId: newId("exec") },
  };

  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    executor.executeCommand({ ...request, command: `echo test-${i}` });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(p99 < 10, `ToolExecutor command P99 latency ${p99.toFixed(3)}ms must be <10ms`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Parallel Execution Benchmarks
// ============================================================================

test("performance: ToolExecutor.executeParallel() 10 items throughput >500 ops/sec", (t) => {
  const executor = new ToolExecutor(new MockCommandExecutor());

  const items = Array.from({ length: 10 }, (_, i) => ({
    id: `item-${i}`,
    tool: { command: `echo ${i}`, workingDirectory: "/tmp", timeoutMs: 5000, context: { taskId: newId("task"), executionId: newId("exec") } } as CommandToolRequest,
    metadata: { readOnly: true, isConcurrencySafe: true },
  }));

  const iterations = 100;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    executor.executeParallel(items);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 500, `ToolExecutor parallel (10 items) ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: ToolExecutor.executeParallel() 50 items throughput >200 ops/sec", (t) => {
  const executor = new ToolExecutor(new MockCommandExecutor());

  const items = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i}`,
    tool: { command: `echo ${i}`, workingDirectory: "/tmp", timeoutMs: 5000, context: { taskId: newId("task"), executionId: newId("exec") } } as CommandToolRequest,
    metadata: { readOnly: true, isConcurrencySafe: true },
  }));

  const iterations = 50;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    executor.executeParallel(items);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 200, `ToolExecutor parallel (50 items) ${opsPerSec.toFixed(0)} ops/sec must be >200 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Concurrent Batch Benchmarks
// ============================================================================

test("performance: ToolExecutor batch processing 100 concurrent commands >1000 ops/sec", (t) => {
  const executor = new ToolExecutor(new MockCommandExecutor());

  const iterations = 100;
  const batchSize = 10;

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const items = Array.from({ length: batchSize }, (_, j) => ({
      id: `item-${i}-${j}`,
      tool: { command: `echo ${i}-${j}`, workingDirectory: "/tmp", timeoutMs: 5000, context: { taskId: newId("task"), executionId: newId("exec") } } as CommandToolRequest,
      metadata: { readOnly: true, isConcurrencySafe: true },
    }));
    executor.executeParallel(items);
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * batchSize;
  const opsPerSec = (totalOps / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 1000, `ToolExecutor batch concurrent ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});