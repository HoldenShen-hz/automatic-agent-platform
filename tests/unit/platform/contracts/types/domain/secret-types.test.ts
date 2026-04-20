import assert from "node:assert/strict";
import test from "node:test";

import type {
  SecretRegistryRecord,
  SecretUsageAuditRecord,
  SecretRotationEventRecord,
  SecretLeaseRecord,
} from "../../../../../../src/platform/contracts/types/domain/secret-types.js";
import type {
  SecretCategory,
  SecretScopeType,
  SecretProviderKind,
  SecretStatus,
  SecretRotationMode,
  SecretRotationEventStatus,
  SecretLeaseStatus,
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("SecretRegistryRecord structure is correct", () => {
  const record: SecretRegistryRecord = {
    secretRef: "secret_123",
    displayName: "OpenAI API Key",
    category: "provider_api_key",
    providerKind: "vault",
    scopeType: "workspace",
    scopeRef: "ws_456",
    status: "active",
    rotationPolicyJson: '{"rotationDays":90}',
    metadataJson: '{"owner":"team@example.com"}',
    currentVersion: "v3",
    lastRotatedAt: "2026-01-01T00:00:00.000Z",
    nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.secretRef, "secret_123");
  assert.equal(record.category, "provider_api_key");
  assert.equal(record.status, "active");
  assert.equal(record.currentVersion, "v3");
});

test("SecretRegistryRecord allows null optional fields", () => {
  const record: SecretRegistryRecord = {
    secretRef: "secret_new",
    displayName: "New Secret",
    category: "oauth_client_secret",
    providerKind: "kms",
    scopeType: "tenant",
    scopeRef: "tenant_abc",
    status: "active",
    rotationPolicyJson: "{}",
    metadataJson: null,
    currentVersion: null,
    lastRotatedAt: null,
    nextRotationDueAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.metadataJson, null);
  assert.equal(record.currentVersion, null);
  assert.equal(record.lastRotatedAt, null);
});

test("SecretCategory accepts all valid values", () => {
  const categories: SecretCategory[] = [
    "provider_api_key",
    "tenant_credential",
    "oauth_client_secret",
    "signing_key",
    "db_connection_secret",
    "break_glass_secret",
  ];
  assert.equal(categories.length, 6);
});

test("SecretScopeType accepts all valid values", () => {
  const scopes: SecretScopeType[] = ["system", "tenant", "workspace", "worker"];
  assert.equal(scopes.length, 4);
});

test("SecretProviderKind accepts all valid values", () => {
  const kinds: SecretProviderKind[] = ["environment", "vault", "kms", "secret_manager"];
  assert.equal(kinds.length, 4);
});

test("SecretStatus accepts all valid values", () => {
  const statuses: SecretStatus[] = ["active", "rotating", "disabled", "revoked"];
  assert.equal(statuses.length, 4);
});

test("SecretUsageAuditRecord structure is correct", () => {
  const record: SecretUsageAuditRecord = {
    auditId: "audit_123",
    secretRef: "secret_456",
    providerKind: "vault",
    taskId: "task_789",
    executionId: "exec_abc",
    requestedBy: "worker_xyz",
    grantedTo: "task_executor",
    usagePurpose: "api_call",
    resolvedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-04-14T01:00:00.000Z",
    maskedValue: "sk-***",
    metadataJson: null,
  };
  assert.equal(record.auditId, "audit_123");
  assert.equal(record.requestedBy, "worker_xyz");
  assert.equal(record.maskedValue, "sk-***");
});

test("SecretUsageAuditRecord allows null taskId and executionId", () => {
  const record: SecretUsageAuditRecord = {
    auditId: "audit_system",
    secretRef: "secret_system",
    providerKind: "environment",
    taskId: null,
    executionId: null,
    requestedBy: "system",
    grantedTo: "system",
    usagePurpose: "health_check",
    resolvedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: null,
    maskedValue: null,
    metadataJson: null,
  };
  assert.equal(record.taskId, null);
  assert.equal(record.executionId, null);
  assert.equal(record.expiresAt, null);
});

test("SecretRotationEventRecord structure is correct", () => {
  const record: SecretRotationEventRecord = {
    eventId: "event_123",
    secretRef: "secret_456",
    providerKind: "vault",
    rotationMode: "scheduled",
    status: "completed",
    reasonCode: "scheduled_rotation",
    requestedBy: "system",
    previousVersion: "v2",
    nextVersion: "v3",
    occurredAt: "2026-04-14T00:00:00.000Z",
    metadataJson: null,
  };
  assert.equal(record.eventId, "event_123");
  assert.equal(record.status, "completed");
  assert.equal(record.previousVersion, "v2");
  assert.equal(record.nextVersion, "v3");
});

test("SecretRotationEventRecord allows emergency rotation", () => {
  const record: SecretRotationEventRecord = {
    eventId: "event_emergency",
    secretRef: "secret_emergency",
    providerKind: "kms",
    rotationMode: "emergency",
    status: "requested",
    reasonCode: "security_incident",
    requestedBy: "admin@example.com",
    previousVersion: "v1",
    nextVersion: null,
    occurredAt: "2026-04-14T00:00:00.000Z",
    metadataJson: '{"reason":"potential compromise"}',
  };
  assert.equal(record.rotationMode, "emergency");
  assert.equal(record.status, "requested");
  assert.equal(record.nextVersion, null);
});

test("SecretRotationMode accepts all valid values", () => {
  const modes: SecretRotationMode[] = ["scheduled", "emergency"];
  assert.equal(modes.length, 2);
});

test("SecretRotationEventStatus accepts all valid values", () => {
  const statuses: SecretRotationEventStatus[] = ["requested", "completed", "failed"];
  assert.equal(statuses.length, 3);
});

test("SecretLeaseRecord structure is correct", () => {
  const record: SecretLeaseRecord = {
    leaseId: "lease_123",
    secretRef: "secret_456",
    providerKind: "vault",
    taskId: "task_789",
    executionId: "exec_abc",
    requestedBy: "worker_xyz",
    grantedTo: "task_executor",
    usagePurpose: "api_call",
    issuedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-04-14T01:00:00.000Z",
    status: "active",
    revokedAt: null,
    revokedBy: null,
    revocationReasonCode: null,
    sourceVersion: "v3",
    maskedValue: "sk-***",
    metadataJson: null,
  };
  assert.equal(record.leaseId, "lease_123");
  assert.equal(record.status, "active");
  assert.equal(record.sourceVersion, "v3");
});

test("SecretLeaseRecord allows revoked lease", () => {
  const record: SecretLeaseRecord = {
    leaseId: "lease_revoked",
    secretRef: "secret_revoked",
    providerKind: "environment",
    taskId: "task_def",
    executionId: "exec_ghi",
    requestedBy: "worker_abc",
    grantedTo: "task_executor",
    usagePurpose: "db_connection",
    issuedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-04-14T01:00:00.000Z",
    status: "revoked",
    revokedAt: "2026-04-14T00:30:00.000Z",
    revokedBy: "admin@example.com",
    revocationReasonCode: "task_cancelled",
    sourceVersion: "v1",
    maskedValue: "conn_***",
    metadataJson: null,
  };
  assert.equal(record.status, "revoked");
  assert.ok(record.revokedAt !== null);
  assert.equal(record.revokedBy, "admin@example.com");
});

test("SecretLeaseRecord allows null taskId and executionId", () => {
  const record: SecretLeaseRecord = {
    leaseId: "lease_system",
    secretRef: "secret_system",
    providerKind: "secret_manager",
    taskId: null,
    executionId: null,
    requestedBy: "system",
    grantedTo: "scheduler",
    usagePurpose: "health_check",
    issuedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-04-14T12:00:00.000Z",
    status: "active",
    revokedAt: null,
    revokedBy: null,
    revocationReasonCode: null,
    sourceVersion: null,
    maskedValue: null,
    metadataJson: null,
  };
  assert.equal(record.taskId, null);
  assert.equal(record.executionId, null);
});

test("SecretLeaseStatus accepts all valid values", () => {
  const statuses: SecretLeaseStatus[] = ["active", "expired", "revoked"];
  assert.equal(statuses.length, 3);
});
