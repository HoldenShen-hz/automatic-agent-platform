import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { EnvSecretProvider } from "../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-rotation-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createService(harness: ReturnType<typeof createHarness>, env: Record<string, string> = {}) {
  const provider = new EnvSecretProvider({ env });
  return new SecretManagementService(harness.db, harness.store, {
    providers: {
      environment: {
        providerKind: "environment",
        async describeSecret(secretRef: string) {
          return provider.describeSecret(secretRef);
        },
        async requireSecret(secretRef: string) {
          return provider.requireSecret(secretRef);
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Secret rotation lifecycle
// ---------------------------------------------------------------------------

test("recordRotationEvent with status 'requested' transitions registry to 'rotating'", () => {
  const harness = createHarness("aa-int-rot-requested-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/requested",
      displayName: "Rotation Requested Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.requested",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rot/requested",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/requested");
    assert.equal(registry?.status, "rotating");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with status 'completed' transitions registry to 'active' and updates version", () => {
  const harness = createHarness("aa-int-rot-completed-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/completed",
      displayName: "Rotation Completed Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.completed",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rot/completed",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-15T00:00:00.000Z",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/completed");
    assert.equal(registry?.status, "active");
    assert.equal(registry?.currentVersion, "v2");
    assert.equal(registry?.lastRotatedAt, "2026-04-15T00:00:00.000Z");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with status 'completed' computes nextRotationDueAt based on cadence", () => {
  const harness = createHarness("aa-int-rot-nextdue-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/nextdue",
      displayName: "Next Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.nextdue",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rot/nextdue",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-15T00:00:00.000Z",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/nextdue");
    const expectedNext = new Date("2026-05-15T00:00:00.000Z");
    const actualNext = new Date(registry?.nextRotationDueAt!);
    assert.ok(Math.abs(actualNext.getTime() - expectedNext.getTime()) < 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with emergency mode records correct rotationMode", () => {
  const harness = createHarness("aa-int-rot-emergency-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/emergency",
      displayName: "Emergency Secret",
      category: "break_glass_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.emergency",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 15, breakGlass: true },
      currentVersion: "v1",
    });

    const event = service.recordRotationEvent({
      secretRef: "secret://system/int/rot/emergency",
      rotationMode: "emergency",
      status: "requested",
      reasonCode: "security_incident",
      requestedBy: "security.team",
      previousVersion: "v1",
    });

    assert.equal(event.rotationMode, "emergency");
    assert.equal(event.reasonCode, "security_incident");
    assert.equal(event.requestedBy, "security.team");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with failed status does not change currentVersion", () => {
  const harness = createHarness("aa-int-rot-failed-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/failed",
      displayName: "Failed Rotation Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.failed",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rot/failed",
      rotationMode: "scheduled",
      status: "failed",
      reasonCode: "provider_unavailable",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/failed");
    assert.equal(registry?.currentVersion, "v1");
    assert.equal(registry?.status, "active"); // Failed does not trigger rotating status
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// listRotationDueSecrets
// ---------------------------------------------------------------------------

test("listRotationDueSecrets returns secrets with past nextRotationDueAt", () => {
  const harness = createHarness("aa-int-rot-listdue-");
  try {
    const service = createService(harness);
    // Due secret - rotation date has passed
    service.registerSecret({
      secretRef: "secret://system/int/rot/due",
      displayName: "Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.due",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
    assert.equal(dueSecrets.length, 1);
    assert.equal(dueSecrets[0]?.secretRef, "secret://system/int/rot/due");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listRotationDueSecrets excludes secrets with future nextRotationDueAt", () => {
  const harness = createHarness("aa-int-rot-future-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/future",
      displayName: "Future Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.future",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
    assert.equal(dueSecrets.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listRotationDueSecrets excludes disabled secrets", () => {
  const harness = createHarness("aa-int-rot-disabled-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/disabled",
      displayName: "Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
      status: "disabled",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
    assert.equal(dueSecrets.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// requestDueRotations
// ---------------------------------------------------------------------------

test("requestDueRotations creates rotation events for all due secrets", () => {
  const harness = createHarness("aa-int-rot-reqdue-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/reqdue/first",
      displayName: "First Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.reqdue.first",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerSecret({
      secretRef: "secret://system/int/rot/reqdue/second",
      displayName: "Second Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.reqdue.second",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    const events = service.requestDueRotations("2026-04-15T00:00:00.000Z", "ops.rotation");
    assert.equal(events.length, 2);

    // Verify secrets are now in rotating status
    const first = harness.store.getSecretRegistryRecord("secret://system/int/rot/reqdue/first");
    const second = harness.store.getSecretRegistryRecord("secret://system/int/rot/reqdue/second");
    assert.equal(first?.status, "rotating");
    assert.equal(second?.status, "rotating");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("requestDueRotations returns empty array when no secrets are due", () => {
  const harness = createHarness("aa-int-rot-none-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/none",
      displayName: "Not Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.none",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    const events = service.requestDueRotations("2026-04-15T00:00:00.000Z");
    assert.equal(events.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Full rotation workflow
// ---------------------------------------------------------------------------

test("complete rotation workflow: requested -> completed -> new version active", () => {
  const harness = createHarness("aa-int-rot-workflow-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/workflow",
      displayName: "Workflow Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.workflow",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    // Step 1: Request rotation
    const requestedEvent = service.recordRotationEvent({
      secretRef: "secret://system/int/rot/workflow",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_due",
      requestedBy: "system.rotation",
      previousVersion: "v1",
    });
    assert.equal(requestedEvent.status, "requested");

    let registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/workflow");
    assert.equal(registry?.status, "rotating");
    assert.equal(registry?.currentVersion, "v1");

    // Step 2: Complete rotation with new version
    const completedEvent = service.recordRotationEvent({
      secretRef: "secret://system/int/rot/workflow",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-15T00:00:00.000Z",
    });
    assert.equal(completedEvent.status, "completed");
    assert.equal(completedEvent.nextVersion, "v2");

    registry = harness.store.getSecretRegistryRecord("secret://system/int/rot/workflow");
    assert.equal(registry?.status, "active");
    assert.equal(registry?.currentVersion, "v2");
    assert.equal(registry?.lastRotatedAt, "2026-04-15T00:00:00.000Z");
    assert.ok(registry?.nextRotationDueAt != null);

    // Step 3: Verify audit summary shows rotation due is false
    const summary = service.buildAuditSummary("secret://system/int/rot/workflow", "2026-04-15T01:00:00.000Z");
    assert.equal(summary.rotationDue, false);
    assert.equal(summary.rotationEvents.length, 2);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("buildAuditSummary shows rotationDue true when nextRotationDueAt has passed", () => {
  const harness = createHarness("aa-int-rot-audit-due-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rot/audit/due",
      displayName: "Audit Due Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rot.audit.due",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    const summary = service.buildAuditSummary("secret://system/int/rot/audit/due", "2026-04-15T00:00:00.000Z");
    assert.equal(summary.rotationDue, true);
    assert.equal(summary.registry.nextRotationDueAt, "2026-04-01T00:00:00.000Z");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});