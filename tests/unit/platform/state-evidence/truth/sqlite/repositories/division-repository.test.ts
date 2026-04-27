/**
 * Unit tests for DivisionRepository
 *
 * Tests the SQLite data movement job data access layer.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { SqliteConnection } from "../../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";
import { DivisionRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/division-repository.js";

/**
 * Creates a mock SqliteConnection for testing
 */
function createMockConnection(rows: Record<string, unknown>[] = []): SqliteConnection {
  let callCount = 0;
  return {
    prepare: (_sql: string) => ({
      get: (..._params: unknown[]) => rows[0] ?? undefined,
      all: (..._params: unknown[]) => {
        callCount++;
        return rows;
      },
    }),
    exec: (_sql: string) => {},
  } as unknown as SqliteConnection;
}

test("DivisionRepository.listDataMovementJobRecords returns all records when no filters", () => {
  const mockRows = [
    {
      jobId: "job_1",
      tenantId: "tenant_abc",
      organizationId: "org_123",
      workspaceId: "ws_456",
      sourceNamespaceId: "ns_source",
      targetNamespaceId: "ns_target",
      sourcePlane: "platform",
      targetPlane: "analytics",
      movementType: "archive",
      inputRefsJson: '["ref1", "ref2"]',
      status: "completed",
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T01:00:00.000Z",
      reportJson: '{"recordsMoved": 100}',
    },
    {
      jobId: "job_2",
      tenantId: "tenant_abc",
      organizationId: "org_123",
      workspaceId: "ws_456",
      sourceNamespaceId: "ns_source_2",
      targetNamespaceId: "ns_target_2",
      sourcePlane: "platform",
      targetPlane: "analytics",
      movementType: "restore",
      inputRefsJson: '["ref3"]',
      status: "pending",
      startedAt: "2026-04-02T00:00:00.000Z",
      finishedAt: null,
      reportJson: null,
    },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords();

  assert.equal(results.length, 2);
  assert.equal(results[0]!.jobId, "job_1");
  assert.equal(results[0]!.movementType, "archive");
  assert.equal(results[0]!.status, "completed");
  assert.equal(results[1]!.jobId, "job_2");
  assert.equal(results[1]!.movementType, "restore");
});

test("DivisionRepository.listDataMovementJobRecords filters by tenantId", () => {
  const mockRows = [
    {
      jobId: "job_1",
      tenantId: "tenant_target",
      organizationId: "org_123",
      workspaceId: "ws_456",
      sourceNamespaceId: "ns_source",
      targetNamespaceId: "ns_target",
      sourcePlane: "platform",
      targetPlane: "analytics",
      movementType: "archive",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: null,
      reportJson: null,
    },
    {
      jobId: "job_2",
      tenantId: "tenant_other",
      organizationId: "org_456",
      workspaceId: "ws_789",
      sourceNamespaceId: "ns_source_2",
      targetNamespaceId: "ns_target_2",
      sourcePlane: "platform",
      targetPlane: "analytics",
      movementType: "archive",
      inputRefsJson: "[]",
      status: "pending",
      startedAt: "2026-04-02T00:00:00.000Z",
      finishedAt: null,
      reportJson: null,
    },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords({ tenantId: "tenant_target" });

  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.tenantId === "tenant_target"));
});

test("DivisionRepository.listDataMovementJobRecords filters by status", () => {
  const mockRows = [
    { jobId: "job_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", sourceNamespaceId: "s1", targetNamespaceId: "t1", sourcePlane: "p1", targetPlane: "p2", movementType: "archive", inputRefsJson: "[]", status: "completed", startedAt: "2026-04-01T00:00:00.000Z", finishedAt: null, reportJson: null },
    { jobId: "job_2", tenantId: "t2", organizationId: "o2", workspaceId: "w2", sourceNamespaceId: "s2", targetNamespaceId: "t2", sourcePlane: "p1", targetPlane: "p2", movementType: "archive", inputRefsJson: "[]", status: "pending", startedAt: "2026-04-02T00:00:00.000Z", finishedAt: null, reportJson: null },
    { jobId: "job_3", tenantId: "t3", organizationId: "o3", workspaceId: "w3", sourceNamespaceId: "s3", targetNamespaceId: "t3", sourcePlane: "p1", targetPlane: "p2", movementType: "archive", inputRefsJson: "[]", status: "completed", startedAt: "2026-04-03T00:00:00.000Z", finishedAt: null, reportJson: null },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords({ status: "completed" });

  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.status === "completed"));
});

test("DivisionRepository.listDataMovementJobRecords filters by movementType", () => {
  const mockRows = [
    { jobId: "job_1", tenantId: "t1", organizationId: "o1", workspaceId: "w1", sourceNamespaceId: "s1", targetNamespaceId: "t1", sourcePlane: "p1", targetPlane: "p2", movementType: "archive", inputRefsJson: "[]", status: "completed", startedAt: "2026-04-01T00:00:00.000Z", finishedAt: null, reportJson: null },
    { jobId: "job_2", tenantId: "t2", organizationId: "o2", workspaceId: "w2", sourceNamespaceId: "s2", targetNamespaceId: "t2", sourcePlane: "p1", targetPlane: "p2", movementType: "restore", inputRefsJson: "[]", status: "pending", startedAt: "2026-04-02T00:00:00.000Z", finishedAt: null, reportJson: null },
  ];

  const conn = createMockConnection(mockRows);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords({ movementType: "restore" });

  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.movementType === "restore"));
});

test("DivisionRepository.listDataMovementJobRecords applies limit", () => {
  const mockRows = Array.from({ length: 10 }, (_, i) => ({
    jobId: `job_${i}`,
    tenantId: "t1",
    organizationId: "o1",
    workspaceId: "w1",
    sourceNamespaceId: "s1",
    targetNamespaceId: "t1",
    sourcePlane: "p1",
    targetPlane: "p2",
    movementType: "archive",
    inputRefsJson: "[]",
    status: "completed",
    startedAt: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    finishedAt: null,
    reportJson: null,
  }));

  const conn = createMockConnection(mockRows);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords({ limit: 5 });

  assert.equal(results.length, 5);
});

test("DivisionRepository.listDataMovementJobRecords uses default limit of 100", () => {
  let usedLimit = 0;
  const mockConn: SqliteConnection = {
    prepare: (_sql: string) => ({
      get: (..._params: unknown[]) => undefined,
      all: (...params: unknown[]) => {
        usedLimit = params[params.length - 1] as number;
        return [];
      },
    }),
    exec: (_sql: string) => {},
  } as unknown as SqliteConnection;

  const repo = new DivisionRepository(mockConn);
  repo.listDataMovementJobRecords();

  assert.equal(usedLimit, 100);
});

test("DivisionRepository.listDataMovementJobRecords returns empty array when no matches", () => {
  const conn = createMockConnection([]);
  const repo = new DivisionRepository(conn);

  const results = repo.listDataMovementJobRecords({ tenantId: "nonexistent" });

  assert.equal(results.length, 0);
});
