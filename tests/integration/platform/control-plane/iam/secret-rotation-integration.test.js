// @ts-nocheck
/**
 * Integration Tests: Secret Rotation
 *
 * Tests secret rotation lifecycle including registration, scheduled rotation,
 * emergency rotation, event recording, due secrets listing, and audit summary.
 *
 * Uses SQLite with real SqliteDatabase and AuthoritativeTaskStore.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EnvSecretProvider } from "../../../../../../src/platform/control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

function createHarness(prefix) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-rotation-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createService(harness, env = {}) {
  const provider = new EnvSecretProvider({ env });
  return new SecretManagementService(harness.db, harness.store, {
    providers: {
      environment: {
        providerKind: "environment",
        async describeSecret(secretRef) {
          return provider.describeSecret(secretRef);
        },
        async requireSecret(secretRef) {
          return provider.requireSecret(secretRef);
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Registration and default cadence
// ---------------------------------------------------------------------------

test("registerSecret stores record and computes next rotation from lastRotatedAt", () => {
  const harness = createHarness("aa-int-rot-reg-");
  try {
    const service = createService(harness);
    const lastRotated = "2026-03-01T00:00:00.000Z";
    const registry = service.registerSecret({
      secretRef: "secret://system/int/rotation/reg",
      displayName: "Integration Test Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.reg",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: lastRotated,
    });

    assert.equal(registry.secretRef, "secret://system/int/rotation/reg");
    assert.equal(registry.status, "active");
    assert.ok(registry.nextRotationDueAt != null);

    const nextDue = new Date(registry.nextRotationDueAt);
    const expected = new Date("2026-03-31T00:00:00.000Z");
    assert.ok(Math.abs(nextDue.getTime() - expected.getTime()) < 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret with null cadenceDays leaves nextRotationDueAt null (no scheduled rotation)", () => {
  const harness = createHarness("aa-int-rot-nocadence-");
  try {
    const service = createService(harness);
    const registry = service.registerSecret({
      secretRef: "secret://system/int/rotation/nocadence",
      displayName: "No Scheduled Rotation",
      category: "oauth_client_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.nocadence",
      rotationPolicy: { cadenceDays: null, ttlMinutes: 30, breakGlass: false },
      currentVersion: "v1",
    });

    assert.equal(registry.nextRotationDueAt, null);
    assert.equal(JSON.parse(registry.rotationPolicyJson).cadenceDays, 90);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Rotation event lifecycle
// ---------------------------------------------------------------------------

test("recordRotationEvent creates requested event and sets registry to rotating", () => {
  const harness = createHarness("aa-int-rot-event-req-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/event/req",
      displayName: "Rotation Requested Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.event.req",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const event = service.recordRotationEvent({
      secretRef: "secret://system/int/rotation/event/req",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
    });

    assert.equal(event.status, "requested");
    assert.equal(event.rotationMode, "scheduled");
    assert.equal(event.previousVersion, "v1");
    assert.equal(event.nextVersion, "v2");

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rotation/event/req");
    assert.equal(registry.status, "rotating");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with completed status advances version and resets rotation timer", () => {
  const harness = createHarness("aa-int-rot-completed-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/completed",
      displayName: "Rotation Completed Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.completed",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-03-01T00:00:00.000Z",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rotation/completed",
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-03-15T00:00:00.000Z",
    });

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rotation/completed");
    assert.equal(registry.status, "active");
    assert.equal(registry.currentVersion, "v2");
    assert.equal(registry.lastRotatedAt, "2026-03-15T00:00:00.000Z");

    const expectedNext = new Date("2026-04-14T00:00:00.000Z");
    const actualNext = new Date(registry.nextRotationDueAt);
    assert.ok(Math.abs(actualNext.getTime() - expectedNext.getTime()) < 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent with failed status returns failed event but keeps registry active", () => {
  const harness = createHarness("aa-int-rot-failed-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/failed",
      displayName: "Rotation Failed Test",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.failed",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    const event = service.recordRotationEvent({
      secretRef: "secret://system/int/rotation/failed",
      rotationMode: "scheduled",
      status: "failed",
      reasonCode: "provider_unavailable",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: null,
    });

    assert.equal(event.status, "failed");
    assert.equal(event.reasonCode, "provider_unavailable");

    const registry = harness.store.getSecretRegistryRecord("secret://system/int/rotation/failed");
    assert.equal(registry.status, "active");
    assert.equal(registry.currentVersion, "v1");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent emergency mode sets rotationMode to emergency", () => {
  const harness = createHarness("aa-int-rot-emergency-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/emergency",
      displayName: "Emergency Rotation Test",
      category: "break_glass_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.emergency",
      rotationPolicy: { cadenceDays: 14, ttlMinutes: 15, breakGlass: true },
      currentVersion: "v1",
    });

    const event = service.recordRotationEvent({
      secretRef: "secret://system/int/rotation/emergency",
      rotationMode: "emergency",
      status: "requested",
      reasonCode: "security_incident",
      requestedBy: "security.team",
      previousVersion: "v1",
      nextVersion: "v2",
    });

    assert.equal(event.rotationMode, "emergency");
    assert.equal(event.reasonCode, "security_incident");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Listing due secrets
// ---------------------------------------------------------------------------

test("listRotationDueSecrets returns only active secrets with past due dates", () => {
  const harness = createHarness("aa-int-rot-listdue-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/due/active",
      displayName: "Due Active Secret",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.due.active",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    service.registerSecret({
      secretRef: "secret://system/int/rotation/due/disabled",
      displayName: "Due But Disabled Secret",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.due.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
      status: "disabled",
    });

    service.registerSecret({
      secretRef: "secret://system/int/rotation/due/future",
      displayName: "Future Due Secret",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.due.future",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
    assert.equal(dueSecrets.length, 1);
    assert.equal(dueSecrets[0].secretRef, "secret://system/int/rotation/due/active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Request due rotations
// ---------------------------------------------------------------------------

test("requestDueRotations creates rotation events for all due secrets", () => {
  const harness = createHarness("aa-int-rot-requestdue-");
  try {
    const service = createService(harness);
    for (let i = 1; i <= 3; i++) {
      service.registerSecret({
        secretRef: `secret://system/int/rotation/request/due/${i}`,
        displayName: `Due Secret ${i}`,
        category: "provider_api_key",
        providerKind: "environment",
        scopeType: "system",
        scopeRef: `system.int.rotation.request.due.${i}`,
        rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        currentVersion: "v1",
        lastRotatedAt: "2026-01-01T00:00:00.000Z",
        nextRotationDueAt: "2026-04-01T00:00:00.000Z",
      });
    }

    const events = service.requestDueRotations("2026-04-15T00:00:00.000Z", "ops.rotation");
    assert.equal(events.length, 3);
    assert.ok(events.every((e) => e.status === "requested"));
    assert.ok(events.every((e) => e.rotationMode === "scheduled"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("requestDueRotations returns empty array when no secrets are due", () => {
  const harness = createHarness("aa-int-rot-nonedue-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/none/due",
      displayName: "Not Due Secret",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.none.due",
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
// Audit summary
// ---------------------------------------------------------------------------

test("buildAuditSummary includes rotation events and correct rotationDue flag", () => {
  const harness = createHarness("aa-int-rot-audit-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/int/rotation/audit",
      displayName: "Audit Test Secret",
      category: "tenant_credential",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.audit",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    service.recordRotationEvent({
      secretRef: "secret://system/int/rotation/audit",
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
    });

    const summary = service.buildAuditSummary("secret://system/int/rotation/audit", "2026-04-15T00:00:00.000Z");
    assert.equal(summary.rotationEvents.length, 1);
    assert.equal(summary.rotationDue, true);
    assert.equal(summary.registry.secretRef, "secret://system/int/rotation/audit");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Integration: full rotation lifecycle
// ---------------------------------------------------------------------------

test("full rotation lifecycle: register -> request rotation -> complete -> verify new version and timer", () => {
  const harness = createHarness("aa-int-rot-lifecycle-");
  try {
    const service = createService(harness);

    const registry = service.registerSecret({
      secretRef: "secret://system/int/rotation/lifecycle",
      displayName: "Lifecycle Test Secret",
      category: "db_connection_secret",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.int.rotation.lifecycle",
      rotationPolicy: { cadenceDays: 30, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-03-01T00:00:00.000Z",
    });

    const requested = service.recordRotationEvent({
      secretRef: registry.secretRef,
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "rotation_window_open",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-01T00:00:00.000Z",
    });

    let current = harness.store.getSecretRegistryRecord(registry.secretRef);
    assert.equal(current.status, "rotating");
    assert.equal(requested.status, "requested");

    const completed = service.recordRotationEvent({
      secretRef: registry.secretRef,
      rotationMode: "scheduled",
      status: "completed",
      reasonCode: "rotation_applied",
      requestedBy: "ops.rotation",
      previousVersion: "v1",
      nextVersion: "v2",
      occurredAt: "2026-04-01T00:30:00.000Z",
    });

    current = harness.store.getSecretRegistryRecord(registry.secretRef);
    assert.equal(current.status, "active");
    assert.equal(current.currentVersion, "v2");
    assert.equal(current.lastRotatedAt, "2026-04-01T00:30:00.000Z");

    const expectedNext = new Date("2026-05-01T00:30:00.000Z");
    const actualNext = new Date(current.nextRotationDueAt);
    assert.ok(Math.abs(actualNext.getTime() - expectedNext.getTime()) < 1000);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});