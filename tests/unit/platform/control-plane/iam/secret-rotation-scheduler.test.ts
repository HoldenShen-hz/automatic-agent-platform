import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretManagementService } from "../../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-rotation-scheduler.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

/**
 * §23 Secret Rotation Scheduler
 *
 * Tests the daily scheduler for 90-day secret rotation.
 * The scheduler periodically checks for secrets due for rotation
 * and marks them as rotation-requested.
 */
test("startDailyRotationScheduler triggers initial rotation check on start", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-init-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register a secret that is due for rotation
    service.registerSecret({
      secretRef: "secret://system/due/rotation",
      displayName: "Due Rotation Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.due.rotation",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    // Verify the secret is in "active" status before scheduler runs
    const beforeRegistry = harness.store.getSecretRegistryRecord("secret://system/due/rotation");
    assert.equal(beforeRegistry?.status, "active");

    // Start the scheduler with a very short interval to trigger immediately
    const timer = service.startDailyRotationScheduler(10);

    // Allow time for the initial check to run
    // The scheduler runs synchronously on start before returning the timer
    const afterRegistry = harness.store.getSecretRegistryRecord("secret://system/due/rotation");
    assert.equal(afterRegistry?.status, "rotating");

    // Clear the interval timer
    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("startDailyRotationScheduler processes multiple due secrets", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-multi-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register multiple secrets that are due for rotation
    const secretRefs = [
      "secret://system/rotate/me/first",
      "secret://system/rotate/me/second",
      "secret://system/rotate/me/third",
    ];

    for (const secretRef of secretRefs) {
      service.registerSecret({
        secretRef,
        displayName: `Rotation Secret ${secretRef.split("/").pop()}`,
        category: "provider_api_key",
        providerKind: "vault",
        scopeType: "system",
        scopeRef: `system.${secretRef.split("/").pop()}`,
        rotationPolicy: { cadenceDays: 90, ttlMinutes: 30, breakGlass: false },
        currentVersion: "v1",
        lastRotatedAt: "2026-01-01T00:00:00.000Z",
        nextRotationDueAt: "2026-04-01T00:00:00.000Z",
      });
    }

    // Start scheduler with short interval
    const timer = service.startDailyRotationScheduler(10);

    // All secrets should be marked as rotating
    for (const secretRef of secretRefs) {
      const registry = harness.store.getSecretRegistryRecord(secretRef);
      assert.equal(registry?.status, "rotating", `Expected ${secretRef} to be rotating`);
    }

    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("startDailyRotationScheduler skips secrets not yet due", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-skip-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register a secret that is NOT due for rotation (future date)
    service.registerSecret({
      secretRef: "secret://system/not/due/yet",
      displayName: "Future Rotation Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.not.due",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z", // Future date
    });

    const timer = service.startDailyRotationScheduler(10);

    // Secret should remain active since it's not due yet
    const registry = harness.store.getSecretRegistryRecord("secret://system/not/due/yet");
    assert.equal(registry?.status, "active");

    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("startDailyRotationScheduler returns timer that can be stopped", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-stop-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register a secret due for rotation
    service.registerSecret({
      secretRef: "secret://system/stoppable/scheduler",
      displayName: "Stoppable Scheduler Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.stoppable",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    const timer = service.startDailyRotationScheduler(60000); // 60 second interval

    // The timer should be a valid NodeJS.Timer that can be cleared
    assert.ok(timer != null);
    assert.ok(typeof timer.ref === "function");
    assert.ok(typeof timer.unref === "function");
    assert.ok(typeof timer.hasRef === "function");

    // After unref, the timer should not keep the process alive
    timer.unref();

    // Clear the timer
    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("startDailyRotationScheduler uses 90-day default cadence", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-90day-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register a secret with no explicit cadence (should default to 90 days)
    service.registerSecret({
      secretRef: "secret://system/default/cadence",
      displayName: "Default Cadence Secret",
      category: "oauth_client_secret",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.default.cadence",
      rotationPolicy: { cadenceDays: null, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
    });

    // Verify the policy normalizes to 90-day default
    const registry = harness.store.getSecretRegistryRecord("secret://system/default/cadence");
    const policy = JSON.parse(registry?.rotationPolicyJson ?? "{}");

    // cadenceDays should be normalized to 90
    assert.equal(policy.cadenceDays, 90);

    // Set lastRotatedAt to trigger due status
    harness.store.upsertSecretRegistryRecord({
      ...registry!,
      lastRotatedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
      nextRotationDueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const timer = service.startDailyRotationScheduler(10);

    const updatedRegistry = harness.store.getSecretRegistryRecord("secret://system/default/cadence");
    assert.equal(updatedRegistry?.status, "rotating");

    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("requestDueRotations returns empty array when no secrets are due", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-none-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register a secret that is not due
    service.registerSecret({
      secretRef: "secret://system/not/due",
      displayName: "Not Due Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.not.due",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    const events = service.requestDueRotations();
    assert.equal(events.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("startDailyRotationScheduler handles errors gracefully and continues", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-error-");
  try {
    const service = new SecretManagementService(harness.db, harness.store, {
      providers: {
        // Provider that will fail for the secret
        vault: {
          providerKind: "vault",
          async describeSecret() {
            throw new Error("Provider temporarily unavailable");
          },
          async requireSecret() {
            throw new Error("Provider temporarily unavailable");
          },
        },
      },
    });

    // Register a secret that is due
    service.registerSecret({
      secretRef: "secret://system/provider/failure",
      displayName: "Provider Failure Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.provider.failure",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    // The scheduler should still start and not throw
    const timer = service.startDailyRotationScheduler(10);

    // The scheduler catches errors internally and continues
    // The secret should still be marked as rotating (request was made)
    const registry = harness.store.getSecretRegistryRecord("secret://system/provider/failure");
    assert.equal(registry?.status, "rotating");

    clearInterval(timer);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listRotationDueSecrets returns only active secrets with past due dates", () => {
  const harness = createHarness("aa-secret-rotation-scheduler-list-");
  try {
    const service = new SecretManagementService(harness.db, harness.store);

    // Register multiple secrets with different statuses
    service.registerSecret({
      secretRef: "secret://system/due/active",
      displayName: "Due Active Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.due.active",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
    });

    service.registerSecret({
      secretRef: "secret://system/not/due/active",
      displayName: "Not Due Active Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.not.due.active",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    // Mark one as disabled
    service.registerSecret({
      secretRef: "secret://system/due/disabled",
      displayName: "Due Disabled Secret",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "system.due.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      currentVersion: "v1",
      lastRotatedAt: "2026-01-01T00:00:00.000Z",
      nextRotationDueAt: "2026-04-01T00:00:00.000Z",
      status: "disabled",
    });

    const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");

    // Only the "due/active" secret should be returned
    assert.equal(dueSecrets.length, 1);
    assert.equal(dueSecrets[0]?.secretRef, "secret://system/due/active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});