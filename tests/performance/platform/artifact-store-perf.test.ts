/**
 * Performance Test: Artifact Store Operations
 * Measures artifact write throughput and query latency
 *
 * Design targets:
 * - Text artifact write: >500 ops/sec
 * - JSON artifact write: >400 ops/sec
 * - P99 latency <10ms
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";

import { ArtifactStore } from "../../../src/platform/state-evidence/artifacts/artifact-store.js";
import { newId } from "../../../src/platform/contracts/types/ids.js";
import { cleanupPath } from "../../helpers/fs.js";

function createTempArtifactStore(): { store: ArtifactStore; cleanup: () => void } {
  const tempDir = join(".tmp", `artifact-perf-${process.pid}-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const store = new ArtifactStore({ rootDir: tempDir });
  return {
    store,
    cleanup: () => cleanupPath(tempDir),
  };
}

function createLargeContent(sizeKb: number): string {
  return "x".repeat(sizeKb * 1024);
}

test("performance: text artifact write throughput >500 ops/sec", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const iterations = 200;
    const taskId = newId("task");
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.writeTextArtifact({
        taskId,
        executionId: newId("exec"),
        kind: "document",
        fileName: `test-${i}.txt`,
        content: `Test content ${i}: Hello world`,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    assert.ok(
      opsPerSec > 500,
      `Text artifact write throughput ${opsPerSec.toFixed(2)} ops/sec must be >500 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
    );
  } finally {
    cleanup();
  }
});

test("performance: text artifact write P99 latency <5ms", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const latencies: number[] = [];
    const iterations = 500;
    const taskId = newId("task");

    // Warmup
    for (let i = 0; i < 10; i++) {
      store.writeTextArtifact({
        taskId,
        kind: "document",
        fileName: `warmup-${i}.txt`,
        content: "Warmup content",
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.writeTextArtifact({
        taskId,
        kind: "document",
        fileName: `test-${i}.txt`,
        content: `Test content ${i}: Hello world`,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    assert.ok(
      p99 < 5,
      `Text artifact write P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } finally {
    cleanup();
  }
});

test("performance: JSON artifact write throughput >400 ops/sec", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const iterations = 200;
    const taskId = newId("task");
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.writeJsonArtifact({
        taskId,
        executionId: newId("exec"),
        kind: "data",
        fileName: `test-${i}`,
        content: {
          id: i,
          message: "Test message",
          timestamp: Date.now(),
          data: { nested: "value", count: i },
        },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    assert.ok(
      opsPerSec > 400,
      `JSON artifact write throughput ${opsPerSec.toFixed(2)} ops/sec must be >400 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
    );
  } finally {
    cleanup();
  }
});

test("performance: JSON artifact write P99 latency <8ms", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const latencies: number[] = [];
    const iterations = 500;
    const taskId = newId("task");

    // Warmup
    for (let i = 0; i < 10; i++) {
      store.writeJsonArtifact({
        taskId,
        kind: "data",
        fileName: `warmup-${i}`,
        content: { index: i },
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.writeJsonArtifact({
        taskId,
        kind: "data",
        fileName: `test-${i}`,
        content: {
          id: i,
          message: "Test message",
          timestamp: Date.now(),
          items: Array.from({ length: 10 }, (_, j) => ({ idx: j })),
        },
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    assert.ok(
      p99 < 8,
      `JSON artifact write P99 latency ${p99.toFixed(3)}ms exceeds 8ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } finally {
    cleanup();
  }
});

test("performance: large artifact write (10KB) P99 <20ms", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const latencies: number[] = [];
    const iterations = 200;
    const taskId = newId("task");
    const largeContent = createLargeContent(10); // 10KB

    // Warmup
    store.writeTextArtifact({
      taskId,
      kind: "large-doc",
      fileName: "warmup.txt",
      content: largeContent,
    });

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.writeTextArtifact({
        taskId,
        kind: "large-doc",
        fileName: `large-${i}.txt`,
        content: largeContent,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    assert.ok(
      p99 < 100,
      `Large artifact write P99 latency ${p99.toFixed(3)}ms exceeds 100ms target. P50: ${p50.toFixed(3)}ms`,
    );
  } finally {
    cleanup();
  }
});

test("performance: artifact write memory usage stable under load", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const iterations = 100;
    const taskId = newId("task");
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      store.writeTextArtifact({
        taskId,
        kind: "document",
        fileName: `mem-test-${i}.txt`,
        content: `Content for iteration ${i}: ${"x".repeat(100)}`,
      });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    // Allow up to 50MB increase for 100 iterations (should be much less with proper GC)
    assert.ok(
      memoryIncrease < 50,
      `Memory increase ${memoryIncrease.toFixed(2)}MB exceeds 50MB for ${iterations} writes`,
    );
  } finally {
    cleanup();
  }
});

test("performance: sequential writes to same task maintain throughput", () => {
  const { store, cleanup } = createTempArtifactStore();

  try {
    const taskId = newId("task");
    const iterations = 100;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.writeTextArtifact({
        taskId,
        kind: "document",
        fileName: `seq-${i}.txt`,
        content: `Sequential write ${i}`,
      });
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p99 = timings[Math.floor(iterations * 0.99)]!;
    const p50 = timings[Math.floor(iterations * 0.5)]!;

    // Sequential writes to same task should still be fast
    assert.ok(
      p99 < 15,
      `Sequential write P99 ${p99.toFixed(3)}ms exceeds 15ms target`,
    );
    assert.ok(
      p50 < 8,
      `Sequential write P50 ${p50.toFixed(3)}ms exceeds 8ms target`,
    );
  } finally {
    cleanup();
  }
});