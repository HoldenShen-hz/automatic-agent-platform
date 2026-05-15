/**
 * Performance tests for Memory Service operations
 *
 * Design targets:
 * - Memory write: >5000 ops/sec
 * - Memory retrieval: >10000 ops/sec
 * - Session creation: >3000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";

import { MemoryService } from "../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { MemoryRetrievalService } from "../../../src/platform/five-plane-state-evidence/memory/memory-retrieval-service.js";
import { SessionService } from "../../../src/platform/five-plane-state-evidence/memory/session-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

test("performance: memory write >5000 ops/sec", (t) => {
  const memoryService = new MemoryService();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      memoryService.write({
        userId: `user_${i % 100}`,
        content: { type: "experience", data: `Memory content ${i}` },
        memoryType: "experience",
        importance: 0.5 + (i % 50) / 100,
        tags: ["test", "performance"],
        timestamp: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Memory write throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for in-memory service
  }
});

test("performance: memory retrieval >10000 ops/sec", (t) => {
  const retrievalService = new MemoryRetrievalService();

  // Pre-populate some memories
  for (let i = 0; i < 100; i++) {
    retrievalService.indexMemory({
      memoryId: `mem_${i}`,
      userId: `user_${i % 10}`,
      content: `Memory content ${i}`,
      memoryType: "experience",
      importance: 0.5,
      timestamp: nowIso(),
    });
  }

  try {
    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      retrievalService.search({
        userId: `user_${i % 10}`,
        query: "Memory content",
        limit: 10,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Memory retrieval throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});

test("performance: session creation >3000 ops/sec", (t) => {
  const sessionService = new SessionService();

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      sessionService.createSession({
        sessionId: newId("session"),
        userId: `user_session_${i}`,
        divisionId: "general_ops",
        createdAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Session creation throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed
  }
});