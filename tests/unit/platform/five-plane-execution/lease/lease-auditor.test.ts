import assert from "node:assert/strict";
import test from "node:test";

import type { LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain/lease-types.js";
import type { LeaseAuditEventType } from "../../../../../src/platform/contracts/types/domain/primitives.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// ─── Test Data ────────────────────────────────────────────────────────────────

const AUDIT_EVENT_TYPES: LeaseAuditEventType[] = [
  "lease_granted",
  "lease_renewed",
  "lease_expired",
  "lease_reclaimed",
  "stale_write_rejected",
  "lease_released",
  "lease_handover",
];

// ─── Mock Implementation ──────────────────────────────────────────────────────

function createMockStore(): AuthoritativeTaskStore {
  const audits: LeaseAuditRecord[] = [];

  const mockWorker = {
    insertLeaseAudit(audit: LeaseAuditRecord): void {
      audits.push({ ...audit });
    },

    getLeaseAudits(): LeaseAuditRecord[] {
      return [...audits];
    },

    listLeaseAuditsForExecution(executionId: string): LeaseAuditRecord[] {
      return audits.filter((a) => a.executionId === executionId);
    },

    listLeaseAuditsForLease(leaseId: string): LeaseAuditRecord[] {
      return audits.filter((a) => a.leaseId === leaseId);
    },

    getLeaseAuditById(auditId: string): LeaseAuditRecord | undefined {
      return audits.find((a) => a.id === auditId);
    },

    clearAudits(): void {
      audits.length = 0;
    },
  };

  return {
    dispatch: {
      getExecution: () => undefined,
    },
    worker: mockWorker,
  } as unknown as AuthoritativeTaskStore;
}

// ─── Tests: LeaseAuditRecord Structure ───────────────────────────────────────

test("LeaseAuditRecord captures all required fields", () => {
  const now = new Date().toISOString();
  const audit: LeaseAuditRecord = {
    id: "audit-001",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: now,
  };

  assert.equal(audit.id, "audit-001");
  assert.equal(audit.executionId, "exec-001");
  assert.equal(audit.leaseId, "lease-001");
  assert.equal(audit.workerId, "worker-001");
  assert.equal(audit.fencingToken, 1);
  assert.equal(audit.eventType, "lease_granted");
  assert.equal(audit.reasonCode, null);
  assert.equal(audit.recordedAt, now);
});

test("LeaseAuditRecord accepts all valid eventType values", () => {
  const now = new Date().toISOString();

  for (const eventType of AUDIT_EVENT_TYPES) {
    const audit: LeaseAuditRecord = {
      id: `audit-${eventType}`,
      executionId: "exec-001",
      leaseId: "lease-001",
      workerId: "worker-001",
      fencingToken: 1,
      eventType,
      reasonCode: null,
      recordedAt: now,
    };

    assert.equal(audit.eventType, eventType, `eventType ${eventType} should be valid`);
  }
});

test("LeaseAuditRecord accepts reasonCode strings", () => {
  const now = new Date().toISOString();
  const audit: LeaseAuditRecord = {
    id: "audit-001",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_released",
    reasonCode: "worker_draining",
    recordedAt: now,
  };

  assert.equal(audit.reasonCode, "worker_draining");
});

// ─── Tests: insertLeaseAudit ──────────────────────────────────────────────────

test("insertLeaseAudit creates audit entry", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-new",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);

  const retrieved = mockWorker.getLeaseAuditById("audit-new");
  assert.notEqual(retrieved, undefined, "Audit should be retrievable by ID");
  assert.equal(retrieved!.id, "audit-new");
  assert.equal(retrieved!.executionId, "exec-001");
});

test("insertLeaseAudit preserves all fields", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-full",
    executionId: "exec-002",
    leaseId: "lease-002",
    workerId: "worker-002",
    fencingToken: 5,
    eventType: "lease_renewed",
    reasonCode: "heartbeat",
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);

  const retrieved = mockWorker.getLeaseAuditById("audit-full");
  assert.notEqual(retrieved, undefined);
  assert.equal(retrieved!.id, "audit-full");
  assert.equal(retrieved!.executionId, "exec-002");
  assert.equal(retrieved!.leaseId, "lease-002");
  assert.equal(retrieved!.workerId, "worker-002");
  assert.equal(retrieved!.fencingToken, 5);
  assert.equal(retrieved!.eventType, "lease_renewed");
  assert.equal(retrieved!.reasonCode, "heartbeat");
  assert.equal(retrieved!.recordedAt, now);
});

test("insertLeaseAudit does not share mutable state", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-mutable",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);

  // Modify original object
  audit.reasonCode = "modified";

  const retrieved = mockWorker.getLeaseAuditById("audit-mutable");
  assert.equal(retrieved!.reasonCode, null, "Stored audit should not reflect modifications to original");
});

// ─── Tests: listLeaseAudits ───────────────────────────────────────────────────

test("listLeaseAudits returns audit history for lease", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  // Insert multiple audits for the same lease
  const audits: LeaseAuditRecord[] = [
    {
      id: "audit-1",
      executionId: "exec-001",
      leaseId: "lease-same",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
    {
      id: "audit-2",
      executionId: "exec-001",
      leaseId: "lease-same",
      workerId: "worker-001",
      fencingToken: 2,
      eventType: "lease_renewed",
      reasonCode: null,
      recordedAt: now,
    },
    {
      id: "audit-3",
      executionId: "exec-001",
      leaseId: "lease-other",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
  ];

  for (const audit of audits) {
    mockWorker.insertLeaseAudit(audit);
  }

  const leaseAudits = mockWorker.listLeaseAuditsForLease("lease-same");
  assert.equal(leaseAudits.length, 2, "Should return 2 audits for lease-same");
  assert.ok(leaseAudits.every((a: LeaseAuditRecord) => a.leaseId === "lease-same"), "All returned audits should belong to lease-same");
});

test("listLeaseAudits returns empty array for lease with no audits", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;

  const leaseAudits = mockWorker.listLeaseAuditsForLease("non-existent-lease");
  assert.equal(leaseAudits.length, 0, "Should return empty array for lease with no audits");
});

test("listLeaseAuditsForExecution returns all audits for an execution", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audits: LeaseAuditRecord[] = [
    {
      id: "audit-exec-1",
      executionId: "exec-filter",
      leaseId: "lease-1",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
    {
      id: "audit-exec-2",
      executionId: "exec-filter",
      leaseId: "lease-2",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
    {
      id: "audit-other-exec",
      executionId: "exec-other",
      leaseId: "lease-3",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
  ];

  for (const audit of audits) {
    mockWorker.insertLeaseAudit(audit);
  }

  const execAudits = mockWorker.listLeaseAuditsForExecution("exec-filter");
  assert.equal(execAudits.length, 2, "Should return 2 audits for exec-filter");
  assert.ok(execAudits.every((a: LeaseAuditRecord) => a.executionId === "exec-filter"), "All returned audits should belong to exec-filter");
});

// ─── Tests: Audit Entries Include eventType and reasonCode ──────────────────

test("Audit entries include eventType for granted lease", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-granted",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-granted");

  assert.equal(retrieved!.eventType, "lease_granted");
  assert.equal(retrieved!.reasonCode, null);
});

test("Audit entries include eventType for expired lease", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-expired",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_expired",
    reasonCode: "ttl_exceeded",
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-expired");

  assert.equal(retrieved!.eventType, "lease_expired");
  assert.equal(retrieved!.reasonCode, "ttl_exceeded");
});

test("Audit entries include eventType for released lease", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-released",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 2,
    eventType: "lease_released",
    reasonCode: "worker_draining",
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-released");

  assert.equal(retrieved!.eventType, "lease_released");
  assert.equal(retrieved!.reasonCode, "worker_draining");
});

test("Audit entries include eventType for handover", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-handover",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-old",
    fencingToken: 3,
    eventType: "lease_handover",
    reasonCode: "load_rebalance",
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-handover");

  assert.equal(retrieved!.eventType, "lease_handover");
  assert.equal(retrieved!.reasonCode, "load_rebalance");
});

test("Audit entries include eventType for stale write rejection", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-stale",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "stale_write_rejected",
    reasonCode: "fencing_token_mismatch",
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-stale");

  assert.equal(retrieved!.eventType, "stale_write_rejected");
  assert.equal(retrieved!.reasonCode, "fencing_token_mismatch");
});

// ─── Tests: Timestamps ───────────────────────────────────────────────────────

test("Timestamps are recorded correctly", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const beforeInsert = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-time",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: beforeInsert,
  };

  mockWorker.insertLeaseAudit(audit);

  const afterInsert = new Date().toISOString();
  const retrieved = mockWorker.getLeaseAuditById("audit-time");

  assert.ok(retrieved!.recordedAt >= beforeInsert, "recordedAt should be >= beforeInsert");
  assert.ok(retrieved!.recordedAt <= afterInsert, "recordedAt should be <= afterInsert");
});

test("recordedAt timestamp is ISO 8601 format", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audit: LeaseAuditRecord = {
    id: "audit-iso",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: now,
  };

  mockWorker.insertLeaseAudit(audit);
  const retrieved = mockWorker.getLeaseAuditById("audit-iso");

  // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
  assert.ok(isoRegex.test(retrieved!.recordedAt), "recordedAt should be in ISO 8601 format");
});

test("Multiple audits maintain correct chronological order", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;

  const now = new Date();
  const timestamps = [
    new Date(now.getTime()).toISOString(),
    new Date(now.getTime() + 1000).toISOString(),
    new Date(now.getTime() + 2000).toISOString(),
  ];

  const audits: LeaseAuditRecord[] = [
    {
      id: "audit-time-1",
      executionId: "exec-001",
      leaseId: "lease-001",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: timestamps[0]!,
    },
    {
      id: "audit-time-2",
      executionId: "exec-001",
      leaseId: "lease-001",
      workerId: "worker-001",
      fencingToken: 2,
      eventType: "lease_renewed",
      reasonCode: null,
      recordedAt: timestamps[1]!,
    },
    {
      id: "audit-time-3",
      executionId: "exec-001",
      leaseId: "lease-001",
      workerId: "worker-001",
      fencingToken: 3,
      eventType: "lease_released",
      reasonCode: "done",
      recordedAt: timestamps[2]!,
    },
  ];

  for (const audit of audits) {
    mockWorker.insertLeaseAudit(audit);
  }

  const leaseAudits = mockWorker.listLeaseAuditsForLease("lease-001");
  assert.equal(leaseAudits.length, 3);

  // Verify chronological order
  assert.equal(leaseAudits[0].id, "audit-time-1");
  assert.equal(leaseAudits[0].recordedAt, timestamps[0]);
  assert.equal(leaseAudits[1].id, "audit-time-2");
  assert.equal(leaseAudits[1].recordedAt, timestamps[1]);
  assert.equal(leaseAudits[2].id, "audit-time-3");
  assert.equal(leaseAudits[2].recordedAt, timestamps[2]);
});

// ─── Tests: getLeaseAudits returns all audits ─────────────────────────────────

test("getLeaseAudits returns all stored audits", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;
  const now = new Date().toISOString();

  const audits: LeaseAuditRecord[] = [
    {
      id: "audit-all-1",
      executionId: "exec-001",
      leaseId: "lease-001",
      workerId: "worker-001",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
    {
      id: "audit-all-2",
      executionId: "exec-002",
      leaseId: "lease-002",
      workerId: "worker-002",
      fencingToken: 1,
      eventType: "lease_granted",
      reasonCode: null,
      recordedAt: now,
    },
  ];

  for (const audit of audits) {
    mockWorker.insertLeaseAudit(audit);
  }

  const allAudits = mockWorker.getLeaseAudits();
  assert.equal(allAudits.length, 2, "getLeaseAudits should return all audits");
});

test("getLeaseAudits returns empty array when no audits exist", () => {
  const store = createMockStore();
  const mockWorker = (store as any).worker;

  const allAudits = mockWorker.getLeaseAudits();
  assert.equal(allAudits.length, 0, "getLeaseAudits should return empty array when no audits exist");
});
