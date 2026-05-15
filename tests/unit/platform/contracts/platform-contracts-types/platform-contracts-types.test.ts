/**
 * Platform Contracts Types Unit Tests
 *
 * Tests the platform-level contract types and factory functions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
  type PlatformPrincipal,
  type EvidenceRecord,
  type ProjectionUpdate,
} from "../../../../../src/platform/contracts/types/platform-contracts.js";
import {
  createStateCommand,
  type LegacyStateCommandType as StateCommandType,
  type StateCommand,
} from "../../../../../src/platform/contracts/state-command/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("platform-contracts: createPlatformPrincipal creates valid principal", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator", "admin"],
  });

  assert.equal(principal.actorId, "user-1");
  assert.equal(principal.tenantId, "tenant-1");
  assert.deepEqual(principal.roles, ["operator", "admin"]);
});

test("platform-contracts: createPlatformPrincipal defaults roles to empty array", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-2",
    tenantId: "tenant-2",
  });

  assert.deepEqual(principal.roles, []);
});

test("platform-contracts: createPlatformPrincipal omits optional fields when not provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-3",
    tenantId: null,
  });

  assert.equal(principal.tenantId, null);
  assert.equal(principal.authMethod, undefined);
  assert.equal(principal.displayName, undefined);
});

test("platform-contracts: createPlatformPrincipal includes authMethod when provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-4",
    tenantId: "tenant-4",
    authMethod: "oauth2",
  });

  assert.equal(principal.authMethod, "oauth2");
});

test("platform-contracts: createPlatformPrincipal includes displayName when provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-5",
    tenantId: "tenant-5",
    displayName: "Test User",
  });

  assert.equal(principal.displayName, "Test User");
});

test("platform-contracts: createRequestEnvelope creates valid envelope", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { goal: "test goal" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.principal, principal);
  assert.equal(envelope.tenantId, "tenant-1");
  assert.deepEqual(envelope.payload, { goal: "test goal" });
  assert.deepEqual(envelope.metadata, {});
});

test("platform-contracts: createRequestEnvelope uses custom values when provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    requestId: "custom-request-id",
    idempotencyKey: "custom-idem-key",
    traceId: "custom-trace-id",
    timestamp: "2026-04-29T00:00:00.000Z",
    metadata: { source: "test" },
  });

  assert.equal(envelope.requestId, "custom-request-id");
  assert.equal(envelope.idempotencyKey, "custom-idem-key");
  assert.equal(envelope.traceId, "custom-trace-id");
  assert.equal(envelope.timestamp, "2026-04-29T00:00:00.000Z");
  assert.deepEqual(envelope.metadata, { source: "test" });
});

test("platform-contracts: createRequestEnvelope converts metadata values to strings", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    metadata: { numberValue: 42, boolValue: true },
  });

  assert.equal(envelope.metadata.numberValue, "42");
  assert.equal(envelope.metadata.boolValue, "true");
});

test("platform-contracts: createRequestEnvelope defaults tenantId from principal when not provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "principal-tenant",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.equal(envelope.tenantId, "principal-tenant");
});

test("platform-contracts: createRequestEnvelope uses global tenantId when principal has no tenant", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: null,
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.equal(envelope.tenantId, "global");
});

test("platform-contracts: createStateCommand creates valid command", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const command = createStateCommand({
    traceId: "trace-1",
    principal,
    leaseId: "lease-1",
    fencingToken: "token-1",
    event: "TaskCreated",
    type: "update_truth",
    aggregateId: "task-123",
    expectedVersion: 1,
    payload: { status: "created" },
  });

  assert.ok(command.commandId.startsWith("statecmd_"));
  assert.equal(command.traceId, "trace-1");
  assert.equal(command.principal, principal);
  assert.equal(command.leaseId, "lease-1");
  assert.equal(command.fencingToken, "token-1");
  assert.equal(command.event, "TaskCreated");
  assert.equal(command.type, "update_truth");
  assert.equal(command.aggregateId, "task-123");
  assert.equal(command.expectedVersion, 1);
  assert.deepEqual(command.payload, { status: "created" });
});

test("platform-contracts: createStateCommand accepts custom commandId", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const command = createStateCommand({
    commandId: "custom-cmd-id",
    traceId: "trace-1",
    principal,
    leaseId: "lease-1",
    fencingToken: "token-1",
    event: "TaskStarted",
    type: "append_event",
    aggregateId: "task-123",
    expectedVersion: 2,
    payload: { startedAt: "2026-04-29T00:00:00.000Z" },
  });

  assert.equal(command.commandId, "custom-cmd-id");
});

test("platform-contracts: createStateCommand accepts all StateCommandType values", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const types: StateCommandType[] = ["update_truth", "append_event", "write_checkpoint", "store_artifact"];

  for (const type of types) {
    const command = createStateCommand({
      traceId: "trace-1",
      principal,
      leaseId: "lease-1",
      fencingToken: "token-1",
      event: "TestEvent",
      type,
      aggregateId: "agg-1",
      expectedVersion: 1,
      payload: {},
    });

    assert.equal(command.type, type, `type '${type}' should be accepted`);
  }
});

test("platform-contracts: createEvidenceRecord creates valid record", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record = createEvidenceRecord({
    traceId: "trace-evid-1",
    principal,
    category: "decision",
    targetRef: "task-123",
    content: { decision: "approved" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace-evid-1");
  assert.equal(record.principal, principal);
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "task-123");
  assert.deepEqual(record.content, { decision: "approved" });
  assert.ok(record.timestamp.length > 0);
  assert.deepEqual(record.metadata, {});
});

test("platform-contracts: createEvidenceRecord accepts custom recordId and metadata", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record = createEvidenceRecord({
    recordId: "custom-evid-123",
    traceId: "trace-1",
    principal,
    category: "execution",
    targetRef: "node-run-456",
    content: { status: "succeeded" },
    metadata: { workerId: "worker-1" },
  });

  assert.equal(record.recordId, "custom-evid-123");
  assert.deepEqual(record.metadata, { workerId: "worker-1" });
});

test("platform-contracts: createEvidenceRecord accepts all category values", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const categories: EvidenceRecord["category"][] = ["decision", "execution", "approval", "audit", "compliance"];

  for (const category of categories) {
    const record = createEvidenceRecord({
      traceId: "trace-1",
      principal,
      category,
      targetRef: "ref-1",
      content: {},
    });

    assert.equal(record.category, category, `category '${category}' should be accepted`);
  }
});

test("platform-contracts: createProjectionUpdate creates valid projection", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-1",
    projectionType: "TaskStatus",
    version: 5,
    sourceEvents: ["event-1", "event-2"],
    patch: { status: "completed" },
    triggeredBy: "worker-1",
  });

  assert.equal(update.projectionId, "proj-1");
  assert.equal(update.projectionType, "TaskStatus");
  assert.equal(update.version, 5);
  assert.deepEqual(update.sourceEvents, ["event-1", "event-2"]);
  assert.deepEqual(update.patch, { status: "completed" });
  assert.equal(update.metadata.triggeredBy, "worker-1");
  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
  assert.ok(update.timestamp.length > 0);
});

test("platform-contracts: createProjectionUpdate accepts optional parameters", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-2",
    projectionType: "TaskStatus",
    version: 10,
    sourceEvents: ["event-3"],
    patch: { status: "failed" },
    triggeredBy: "system",
    rebuiltAt: "2026-04-28T00:00:00.000Z",
    idempotencyKey: "custom-idem",
  });

  assert.equal(update.projectionId, "proj-2");
  assert.equal(update.version, 10);
  assert.equal(update.metadata.rebuiltAt, "2026-04-28T00:00:00.000Z");
  assert.equal(update.metadata.idempotencyKey, "custom-idem");
});

test("platform-contracts: PlatformPrincipal has correct shape", () => {
  const principal: PlatformPrincipal = {
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: ["role-1", "role-2"],
    authMethod: "bearer",
    displayName: "Test Actor",
  };

  assert.equal(principal.actorId, "actor-1");
  assert.equal(principal.tenantId, "tenant-1");
  assert.deepEqual(principal.roles, ["role-1", "role-2"]);
  assert.equal(principal.authMethod, "bearer");
  assert.equal(principal.displayName, "Test Actor");
});

test("platform-contracts: StateCommand has correct shape", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const command: StateCommand = {
    commandId: "cmd-1",
    traceId: "trace-1",
    principal,
    leaseId: "lease-1",
    fencingToken: "token-1",
    event: "TestEvent",
    type: "update_truth",
    aggregateId: "agg-1",
    expectedVersion: 1,
    payload: { data: "test" },
  };

  assert.equal(command.commandId, "cmd-1");
  assert.equal(command.type, "update_truth");
});

test("platform-contracts: EvidenceRecord has correct shape", () => {
  const principal = createPlatformPrincipal({
    actorId: "user-1",
    tenantId: "tenant-1",
    roles: [],
  });

  const record: EvidenceRecord = {
    recordId: "rec-1",
    traceId: "trace-1",
    principal,
    category: "execution",
    targetRef: "target-1",
    content: { result: "ok" },
    timestamp: "2026-04-29T00:00:00.000Z",
    metadata: { key: "value" },
  };

  assert.equal(record.recordId, "rec-1");
  assert.equal(record.category, "execution");
  assert.deepEqual(record.metadata, { key: "value" });
});

test("platform-contracts: ProjectionUpdate has correct shape", () => {
  const update: ProjectionUpdate = {
    projectionId: "proj-1",
    projectionType: "TestProjection",
    version: 1,
    timestamp: "2026-04-29T00:00:00.000Z",
    sourceEvents: ["evt-1"],
    patch: { field: "value" },
    metadata: {
      triggeredBy: "test",
      idempotencyKey: "idem-1",
    },
  };

  assert.equal(update.projectionId, "proj-1");
  assert.deepEqual(update.patch, { field: "value" });
});
