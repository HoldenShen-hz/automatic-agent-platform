/**
 * Unit tests for LeaseRepository
 *
 * Tests the SQLite lease audit data access layer.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { SqliteConnection } from "../../../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";
import { LeaseRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/lease-repository.js";

/**
 * Creates a mock SqliteConnection for testing
 */
function createMockConnection(rows: Record<string, unknown>[] = []): SqliteConnection {
  return {
    prepare: (_sql: string) => ({
      get: (..._params: unknown[]) => rows[0] ?? undefined,
      all: (..._params: unknown[]) => rows,
    }),
    exec: (_sql: string) => {},
  } as unknown as SqliteConnection;
}

test("LeaseRepository.listLeaseAudits returns lease audit records", () => {
  const mockRows = [
    {
      id: "audit_1",
      executionId: "exec_123",
      leaseId: "lease_456",
      workerId: "worker_789",
      fencingToken: 1,
      eventType: "acquired",
      reasonCode: "lease_granted",
      recordedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "audit_2",
      executionId: "exec_123",
      leaseId: "lease_456",
      workerId: "worker_789",
      fencingToken: 2,
      eventType: "renewed",
      reasonCode: "heartbeat",
      recordedAt: "2026-04-01T00:01:00.000Z",
    },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new LeaseRepository(conn);

  const results = repo.listLeaseAudits("exec_123");

  assert.equal(results.length, 2);
  assert.equal(results[0]!.id, "audit_1");
  assert.equal(results[0]!.executionId, "exec_123");
  assert.equal(results[0]!.leaseId, "lease_456");
  assert.equal(results[0]!.workerId, "worker_789");
  assert.equal(results[0]!.fencingToken, 1);
  assert.equal(results[0]!.eventType, "acquired");
  assert.equal(results[0]!.reasonCode, "lease_granted");
  assert.equal(results[1]!.id, "audit_2");
  assert.equal(results[1]!.eventType, "renewed");
});

test("LeaseRepository.listLeaseAudits returns empty array when no audits", () => {
  const conn = createMockConnection([]);
  const repo = new LeaseRepository(conn);

  const results = repo.listLeaseAudits("nonexistent_exec");

  assert.equal(results.length, 0);
});

test("LeaseRepository.listLeaseAudits handles single result", () => {
  const mockRows = [
    {
      id: "audit_single",
      executionId: "exec_abc",
      leaseId: "lease_xyz",
      workerId: "worker_def",
      fencingToken: 5,
      eventType: "released",
      reasonCode: "task_completed",
      recordedAt: "2026-04-15T12:00:00.000Z",
    },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new LeaseRepository(conn);

  const results = repo.listLeaseAudits("exec_abc");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.eventType, "released");
  assert.equal(results[0]!.fencingToken, 5);
});

test("LeaseRepository.listLeaseAudts maps all event types correctly", () => {
  const eventTypes = ["acquired", "renewed", "released", "expired", "transferred", "preempted"];
  const mockRows = eventTypes.map((eventType, index) => ({
    id: `audit_${index}`,
    executionId: "exec_test",
    leaseId: "lease_test",
    workerId: "worker_test",
    fencingToken: index + 1,
    eventType,
    reasonCode: `reason_${eventType}`,
    recordedAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  }));

  const conn = createMockConnection(mockRows);
  const repo = new LeaseRepository(conn);

  const results = repo.listLeaseAudits("exec_test");

  assert.equal(results.length, 6);
  for (let i = 0; i < eventTypes.length; i++) {
    assert.equal(results[i]!.eventType, eventTypes[i]);
  }
});
