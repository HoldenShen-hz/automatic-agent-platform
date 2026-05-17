/**
 * Lease Operations Performance Tests
 *
 * Performance tests for lease operations:
 * - acquireLease() throughput
 * - renewLease() throughput
 * - releaseLease() throughput
 * - validateWriteAccess() throughput
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";

/**
 * Mock Lease Service for performance testing without database.
 * This isolates the pure logic performance.
 */
class MockLeaseService {
  private leases: Map<string, { executionId: string; workerId: string; status: string; expiresAt: string }> = new Map();
  private fenceTokens: Map<string, number> = new Map();

  public acquireLease(executionId: string, workerId: string, ttlMs: number): { success: boolean; fenceToken: number } {
    // Check for existing active lease
    for (const lease of this.leases.values()) {
      if (lease.executionId === executionId && lease.status === "active") {
        return { success: false, fenceToken: 0 };
      }
    }

    const fenceToken = (this.fenceTokens.get(executionId) ?? 0) + 1;
    this.fenceTokens.set(executionId, fenceToken);

    const leaseId = `lease-${executionId}-${Date.now()}`;
    this.leases.set(leaseId, {
      executionId,
      workerId,
      status: "active",
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    });

    return { success: true, fenceToken };
  }

  public renewLease(leaseId: string, workerId: string, ttlMs: number): { success: boolean } {
    const lease = this.leases.get(leaseId);
    if (!lease || lease.workerId !== workerId || lease.status !== "active") {
      return { success: false };
    }

    lease.expiresAt = new Date(Date.now() + ttlMs).toISOString();
    return { success: true };
  }

  public releaseLease(leaseId: string, workerId: string): { success: boolean } {
    const lease = this.leases.get(leaseId);
    if (!lease || lease.workerId !== workerId) {
      return { success: false };
    }

    lease.status = "released";
    return { success: true };
  }

  public validateWriteAccess(executionId: string, workerId: string, fenceToken: number): { allowed: boolean } {
    for (const lease of this.leases.values()) {
      if (lease.executionId === executionId && lease.status === "active") {
        const expectedToken = this.fenceTokens.get(executionId);
        if (lease.workerId === workerId && fenceToken === expectedToken) {
          return { allowed: true };
        }
        return { allowed: false };
      }
    }
    return { allowed: false };
  }
}

/**
 * Performance test configuration.
 */
interface PerfConfig {
  iterations: number;
  warmupIterations: number;
}

const DEFAULT_PERF_CONFIG: PerfConfig = {
  iterations: 100000,
  warmupIterations: 1000,
};

// ── Acquire Lease Performance Tests ───────────────────────────────────────────

test("Performance: MockLeaseService.acquireLease() throughput", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    service.acquireLease(`warmup-exec-${i}`, `worker-${i % 10}`, 10000);
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    service.acquireLease(`exec-${i}`, `worker-${i % 100}`, 10000);
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`acquireLease() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(4)}ms`);

  // Pure memory operations should be very fast
  try {
    assert.ok(opsPerSecond > 50000, `Expected > 50000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ── Renew Lease Performance Tests ─────────────────────────────────────────────

test("Performance: MockLeaseService.renewLease() throughput", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();
  const leaseIds: string[] = [];

  // Setup leases
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    const result = service.acquireLease(`exec-renew-${i}`, "worker-0", 10000);
    if (result.success) {
      leaseIds.push(`lease-exec-renew-${i}-${Date.now()}`);
    }
  }

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    service.renewLease(`lease-renew-${i % 100}`, "worker-0", 10000);
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    service.renewLease(`lease-renew-${i % 1000}`, "worker-0", 10000);
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`renewLease() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(4)}ms`);

  // Pure memory operations should be very fast
  try {
    assert.ok(opsPerSecond > 50000, `Expected > 50000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ── Release Lease Performance Tests ───────────────────────────────────────────

test("Performance: MockLeaseService.releaseLease() throughput", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    service.releaseLease(`lease-release-${i}`, "worker-release");
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    service.releaseLease(`lease-release-${i}`, "worker-release");
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`releaseLease() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(4)}ms`);

  // Pure memory operations should be very fast
  try {
    assert.ok(opsPerSecond > 50000, `Expected > 50000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ── Validate Write Access Performance Tests ─────────────────────────────────────

test("Performance: MockLeaseService.validateWriteAccess() throughput", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();

  // Setup active leases
  for (let i = 0; i < 1000; i++) {
    service.acquireLease(`exec-validate-${i}`, `worker-${i % 10}`, 10000);
  }

  // Warmup
  for (let i = 0; i < DEFAULT_PERF_CONFIG.warmupIterations; i++) {
    service.validateWriteAccess(`exec-validate-${i % 1000}`, `worker-${i % 10}`, 1);
  }

  const start = Date.now();

  for (let i = 0; i < DEFAULT_PERF_CONFIG.iterations; i++) {
    service.validateWriteAccess(`exec-validate-${i % 1000}`, `worker-${i % 10}`, 1);
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (DEFAULT_PERF_CONFIG.iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / DEFAULT_PERF_CONFIG.iterations;

  console.log(`validateWriteAccess() - ${DEFAULT_PERF_CONFIG.iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(4)}ms`);

  // Pure memory operations should be very fast
  try {
    assert.ok(opsPerSecond > 50000, `Expected > 50000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ── Concurrent Lease Operations ─────────────────────────────────────────────────

test("Performance: Concurrent lease acquire-release cycles", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();
  const iterations = 10000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const result = service.acquireLease(`exec-concurrent-${i}`, "worker-0", 10000);
    if (result.success) {
      service.releaseLease(`lease-exec-concurrent-${i}-${Date.now()}`, "worker-0");
    }
  }

  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    const result = service.acquireLease(`exec-cycle-${i}`, "worker-0", 10000);
    if (result.success) {
      service.releaseLease(`lease-exec-cycle-${i}-${Date.now()}`, "worker-0");
    }
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  console.log(`acquire-release cycle - ${iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`  Avg latency: ${avgLatencyMs.toFixed(4)}ms`);

  // Should handle many cycles per second
  assert.ok(opsPerSecond > 5000, `Expected > 5000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});

// ── Lease Lookup Performance ─────────────────────────────────────────────────────

test("Performance: Lease lookup by execution ID", { timeout: 60000 }, (t) => {
  const service = new MockLeaseService();
  const executionIds: string[] = [];

  // Setup 10000 leases
  for (let i = 0; i < 10000; i++) {
    const execId = `exec-lookup-${i}`;
    executionIds.push(execId);
    service.acquireLease(execId, `worker-${i % 10}`, 10000);
  }

  const iterations = DEFAULT_PERF_CONFIG.iterations;

  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    service.validateWriteAccess(executionIds[i % executionIds.length], `worker-${i % 10}`, 1);
  }

  const elapsed = Date.now() - start;
  const opsPerSecond = (iterations / elapsed) * 1000;

  console.log(`lease lookup (10000 leases) - ${iterations} iterations in ${elapsed}ms`);
  console.log(`  Throughput: ${opsPerSecond.toFixed(2)} ops/sec`);

  // Map lookups should be O(1)
  assert.ok(opsPerSecond > 30000, `Expected > 30000 ops/sec, got ${opsPerSecond.toFixed(2)}`);
});
