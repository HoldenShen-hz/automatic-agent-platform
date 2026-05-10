import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
import { EnvSecretProvider } from "../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import { ValidationError, StorageError, PolicyDeniedError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "secret-validation-integration.db");
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
// Registration validation
// ---------------------------------------------------------------------------

test("registerSecret rejects empty secretRef", () => {
  const harness = createHarness("aa-int-val-empty-ref-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "",
          displayName: "Empty Ref Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.empty.ref",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects whitespace-only secretRef", () => {
  const harness = createHarness("aa-int-val-whitespace-ref-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "   ",
          displayName: "Whitespace Ref Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.whitespace.ref",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects empty displayName", () => {
  const harness = createHarness("aa-int-val-empty-name-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/empty/name",
          displayName: "",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.empty.name",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_display_name",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects invalid category", () => {
  const harness = createHarness("aa-int-val-invalid-cat-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/cat",
          displayName: "Invalid Category Secret",
          category: "not_a_real_category" as any,
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.invalid.cat",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_category",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects invalid providerKind", () => {
  const harness = createHarness("aa-int-val-invalid-prov-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/prov",
          displayName: "Invalid Provider Secret",
          category: "provider_api_key",
          providerKind: "not_a_real_provider" as any,
          scopeType: "system",
          scopeRef: "system.invalid.prov",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_provider_kind",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects invalid scopeType", () => {
  const harness = createHarness("aa-int-val-invalid-scope-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/scope",
          displayName: "Invalid Scope Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "not_a_real_scope" as any,
          scopeRef: "system.invalid.scope",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
        }),
      (e: any) => e.code === "secret.invalid_scope_type",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("registerSecret rejects invalid status value", () => {
  const harness = createHarness("aa-int-val-invalid-status-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.registerSecret({
          secretRef: "secret://system/invalid/status",
          displayName: "Invalid Status Secret",
          category: "provider_api_key",
          providerKind: "environment",
          scopeType: "system",
          scopeRef: "system.invalid.status",
          rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
          status: "not_a_real_status" as any,
        }),
      (e: any) => e.code === "secret.invalid_status",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Resolution validation
// ---------------------------------------------------------------------------

test("resolveSecret rejects unregistered secret", async () => {
  const harness = createHarness("aa-int-val-unreg-");
  try {
    const service = createService(harness);
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/not/registered",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code === "secret.registry_not_found:secret://system/not/registered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret rejects disabled secret", async () => {
  const harness = createHarness("aa-int-val-disabled-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/disabled",
      displayName: "Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      status: "disabled",
    });
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/disabled",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code === "secret.registry_unavailable:secret://system/disabled:disabled",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret rejects revoked secret", async () => {
  const harness = createHarness("aa-int-val-revoked-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/revoked",
      displayName: "Revoked Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoked",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      status: "revoked",
    });
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/revoked",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code === "secret.registry_unavailable:secret://system/revoked:revoked",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("resolveSecret rejects empty requestedBy", async () => {
  const harness = createHarness("aa-int-val-empty-reqby-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_REQBY: "secret-value",
    });
    service.registerSecret({
      secretRef: "secret://system/reqby",
      displayName: "Empty RequestedBy Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.reqby",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    await assert.rejects(
      async () =>
        service.resolveSecret({
          secretRef: "secret://system/reqby",
          requestedBy: "",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code === "secret.invalid_requested_by",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Lease validation
// ---------------------------------------------------------------------------

test("issueSecretLease rejects unregistered secret", async () => {
  const harness = createHarness("aa-int-val-lease-unreg-");
  try {
    const service = createService(harness);
    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/not/registered",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
          ttlMinutes: 30,
        }),
      (e: any) => e.code === "secret.registry_not_found:secret://system/not/registered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease rejects when ttlMinutes not provided and policy has no ttl", async () => {
  const harness = createHarness("aa-int-val-lease-no-ttl-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_NO_TTL: "no-ttl-value",
    });
    service.registerSecret({
      secretRef: "secret://system/no/ttl",
      displayName: "No TTL Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.no.ttl",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: null, breakGlass: false },
    });
    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/no/ttl",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
        }),
      (e: any) => e.code.includes("secret.lease_ttl_required"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("issueSecretLease rejects disabled secret", async () => {
  const harness = createHarness("aa-int-val-lease-disabled-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/lease/disabled",
      displayName: "Lease Disabled Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.lease.disabled",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
      status: "disabled",
    });
    await assert.rejects(
      async () =>
        service.issueSecretLease({
          secretRef: "secret://system/lease/disabled",
          requestedBy: "test.user",
          grantedTo: "test.worker",
          usagePurpose: "test",
          ttlMinutes: 30,
        }),
      (e: any) => e.code === "secret.registry_unavailable:secret://system/lease/disabled:disabled",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Revocation validation
// ---------------------------------------------------------------------------

test("revokeSecretLease rejects non-existent lease", () => {
  const harness = createHarness("aa-int-val-revoke-notfound-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.revokeSecretLease({
          leaseId: "definitely-does-not-exist",
          revokedBy: "admin",
          reasonCode: "test",
        }),
      (e: any) => e.code === "secret.lease_not_found:definitely-does-not-exist",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("revokeSecretLease rejects empty revokedBy", async () => {
  const harness = createHarness("aa-int-val-revoke-empty-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_REVOKE_EMPTY: "revoke-empty-value",
    });
    service.registerSecret({
      secretRef: "secret://system/revoke/empty",
      displayName: "Revoke Empty Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoke.empty",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/revoke/empty",
      requestedBy: "user",
      grantedTo: "holder",
      usagePurpose: "test",
      ttlMinutes: 60,
    });
    assert.throws(
      () =>
        service.revokeSecretLease({
          leaseId: lease.lease.leaseId,
          revokedBy: "",
          reasonCode: "test",
        }),
      (e: any) => e.code === "secret.invalid_revoked_by",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("revokeSecretLease rejects empty reasonCode", async () => {
  const harness = createHarness("aa-int-val-revoke-reason-");
  try {
    const service = createService(harness, {
      AA_SECRET_SYSTEM_REVOKE_REASON: "revoke-reason-value",
    });
    service.registerSecret({
      secretRef: "secret://system/revoke/reason",
      displayName: "Revoke Reason Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.revoke.reason",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    const lease = await service.issueSecretLease({
      secretRef: "secret://system/revoke/reason",
      requestedBy: "user",
      grantedTo: "holder",
      usagePurpose: "test",
      ttlMinutes: 60,
    });
    assert.throws(
      () =>
        service.revokeSecretLease({
          leaseId: lease.lease.leaseId,
          revokedBy: "admin",
          reasonCode: "",
        }),
      (e: any) => e.code === "secret.invalid_revocation_reason_code",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Rotation event validation
// ---------------------------------------------------------------------------

test("recordRotationEvent rejects non-existent secret", () => {
  const harness = createHarness("aa-int-val-rot-unreg-");
  try {
    const service = createService(harness);
    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/not/registered",
          rotationMode: "scheduled",
          status: "requested",
          reasonCode: "test",
          requestedBy: "test",
        }),
      (e: any) => e.code === "secret.registry_not_found:secret://system/not/registered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent rejects invalid rotationMode", () => {
  const harness = createHarness("aa-int-val-rot-mode-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/rot/mode",
      displayName: "Rot Mode Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.rot.mode",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/rot/mode",
          rotationMode: "invalid_mode" as any,
          status: "requested",
          reasonCode: "test",
          requestedBy: "test",
        }),
      (e: any) => e.code === "secret.invalid_rotation_mode",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent rejects invalid rotationStatus", () => {
  const harness = createHarness("aa-int-val-rot-status-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/rot/status",
      displayName: "Rot Status Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.rot.status",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/rot/status",
          rotationMode: "scheduled",
          status: "invalid_status" as any,
          reasonCode: "test",
          requestedBy: "test",
        }),
      (e: any) => e.code === "secret.invalid_rotation_status",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("recordRotationEvent rejects empty reasonCode", () => {
  const harness = createHarness("aa-int-val-rot-reason-");
  try {
    const service = createService(harness);
    service.registerSecret({
      secretRef: "secret://system/rot/reason",
      displayName: "Rot Reason Secret",
      category: "provider_api_key",
      providerKind: "environment",
      scopeType: "system",
      scopeRef: "system.rot.reason",
      rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
    });
    assert.throws(
      () =>
        service.recordRotationEvent({
          secretRef: "secret://system/rot/reason",
          rotationMode: "scheduled",
          status: "requested",
          reasonCode: "",
          requestedBy: "test",
        }),
      (e: any) => e.code === "secret.invalid_rotation_reason_code",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// ---------------------------------------------------------------------------
// Audit summary validation
// ---------------------------------------------------------------------------

test("buildAuditSummary rejects unregistered secret", () => {
  const harness = createHarness("aa-int-val-audit-unreg-");
  try {
    const service = createService(harness);
    assert.throws(
      () => service.buildAuditSummary("secret://system/not/registered"),
      (e: any) => e.code === "secret.registry_not_found:secret://system/not/registered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("listSecretLeases rejects unregistered secret", () => {
  const harness = createHarness("aa-int-val-leases-unreg-");
  try {
    const service = createService(harness);
    assert.throws(
      () => service.listSecretLeases("secret://system/not/registered"),
      (e: any) => e.code === "secret.registry_not_found:secret://system/not/registered",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});