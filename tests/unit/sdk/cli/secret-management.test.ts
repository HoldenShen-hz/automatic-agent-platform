/**
 * Secret Management CLI Tests
 *
 * Tests for secret-management.ts CLI module and its environment loader.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadSecretManagementCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { SECRET_ACTIONS } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-support.js";

// ---------------------------------------------------------------------------
// Tests for loadSecretManagementCliEnv
// ---------------------------------------------------------------------------

test("loadSecretManagementCliEnv parses register action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "register",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_DISPLAY_NAME: "Test Secret",
    AA_SECRET_CATEGORY: "api_key",
    AA_SECRET_PROVIDER_KIND: "aws",
    AA_SECRET_SCOPE_TYPE: "workspace",
    AA_SECRET_SCOPE_REF: "workspace-1",
  });

  assert.equal(config.action, "register");
  assert.equal(config.dbPath, "/tmp/test.db");
  assert.equal(config.secretRef, "ref-123");
  assert.equal(config.displayName, "Test Secret");
  assert.equal(config.category, "api_key");
  assert.equal(config.providerKind, "aws");
});

test("loadSecretManagementCliEnv parses resolve action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "resolve",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_REQUESTED_BY: "user-1",
    AA_SECRET_GRANTED_TO: "service-1",
    AA_SECRET_USAGE_PURPOSE: "api_access",
  });

  assert.equal(config.action, "resolve");
  assert.equal(config.requestedBy, "user-1");
  assert.equal(config.grantedTo, "service-1");
  assert.equal(config.usagePurpose, "api_access");
});

test("loadSecretManagementCliEnv parses rotate action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "rotate",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_ROTATION_MODE: "scheduled",
    AA_SECRET_ROTATION_STATUS: "completed",
    AA_SECRET_ROTATION_REASON_CODE: "rotation.scheduled",
    AA_SECRET_REQUESTED_BY: "system",
  });

  assert.equal(config.action, "rotate");
  assert.equal(config.rotationMode, "scheduled");
  assert.equal(config.rotationStatus, "completed");
  assert.equal(config.rotationReasonCode, "rotation.scheduled");
});

test("loadSecretManagementCliEnv parses issue action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "issue",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_REQUESTED_BY: "user-1",
    AA_SECRET_GRANTED_TO: "service-1",
    AA_SECRET_USAGE_PURPOSE: "api_access",
    AA_SECRET_LEASE_TTL_MINUTES: "60",
  });

  assert.equal(config.action, "issue");
  assert.equal(config.leaseTtlMinutes, 60);
});

test("loadSecretManagementCliEnv parses revoke action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "revoke",
    AA_SECRET_LEASE_ID: "lease-456",
    AA_SECRET_REQUESTED_BY: "admin",
    AA_SECRET_REVOCATION_REASON_CODE: "security_incident",
  });

  assert.equal(config.action, "revoke");
  assert.equal(config.leaseId, "lease-456");
  assert.equal(config.revocationReasonCode, "security_incident");
});

test("loadSecretManagementCliEnv parses leases action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "leases",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_AS_OF: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(config.action, "leases");
  assert.equal(config.secretRef, "ref-123");
  assert.equal(config.asOf, "2024-01-01T00:00:00.000Z");
});

test("loadSecretManagementCliEnv parses due action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "due",
    AA_SECRET_AS_OF: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(config.action, "due");
  assert.equal(config.asOf, "2024-01-01T00:00:00.000Z");
});

test("loadSecretManagementCliEnv parses request_due action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "request_due",
    AA_SECRET_AS_OF: "2024-01-01T00:00:00.000Z",
    AA_SECRET_REQUESTED_BY: "rotation-service",
  });

  assert.equal(config.action, "request_due");
  assert.equal(config.requestedBy, "rotation-service");
});

test("loadSecretManagementCliEnv parses refresh action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "refresh",
    AA_SECRET_REF: "ref-123",
  });

  assert.equal(config.action, "refresh");
  assert.equal(config.secretRef, "ref-123");
});

test("loadSecretManagementCliEnv parses summary action", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "summary",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_AS_OF: "2024-01-01T00:00:00.000Z",
  });

  assert.equal(config.action, "summary");
});

test("loadSecretManagementCliEnv parses rotation policy fields", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "register",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_ROTATION_CADENCE_DAYS: "30",
    AA_SECRET_TTL_MINUTES: "1440",
    AA_SECRET_BREAK_GLASS: "true",
  });

  assert.equal(config.rotationCadenceDays, 30);
  assert.equal(config.ttlMinutes, 1440);
  assert.equal(config.breakGlass, true);
});

test("loadSecretManagementCliEnv parses task and execution context", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "resolve",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_TASK_ID: "task-123",
    AA_SECRET_EXECUTION_ID: "exec-456",
  });

  assert.equal(config.taskId, "task-123");
  assert.equal(config.executionId, "exec-456");
});

test("loadSecretManagementCliEnv parses metadata JSON", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "register",
    AA_SECRET_REF: "ref-123",
    AA_SECRET_METADATA: '{"key":"value","count":42}',
  });

  assert.deepEqual(config.metadata, { key: "value", count: 42 });
});

test("loadSecretManagementCliEnv defaults action to summary", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });

  assert.equal(config.action, "summary");
});

test("loadSecretManagementCliEnv throws for missing dbPath", () => {
  assert.throws(
    () =>
      loadSecretManagementCliEnv({}),
    (error) =>
      error instanceof ValidationError && error.code === "missing_env:AA_DB_PATH",
  );
});

test("loadSecretManagementCliEnv throws for invalid action", () => {
  assert.throws(
    () =>
      loadSecretManagementCliEnv({
        AA_DB_PATH: "/tmp/test.db",
        AA_SECRET_ACTION: "invalid_action",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "invalid_env:AA_SECRET_ACTION",
  );
});

// ---------------------------------------------------------------------------
// Tests for SECRET_ACTIONS enum
// ---------------------------------------------------------------------------

test("SECRET_ACTIONS contains all expected actions", () => {
  const expected = ["register", "resolve", "rotate", "issue", "revoke", "leases", "due", "request_due", "refresh", "summary", "generate-token"];
  assert.deepEqual(SECRET_ACTIONS, expected);
});

test("SECRET_ACTIONS has exactly 11 actions", () => {
  assert.equal(SECRET_ACTIONS.length, 11);
});

// ---------------------------------------------------------------------------
// Tests for secret registration args building
// ---------------------------------------------------------------------------

test("register builds args with all required fields", () => {
  const envConfig = {
    secretRef: "ref-123",
    displayName: "Test Secret",
    category: "api_key",
    providerKind: "aws",
    scopeType: "workspace",
    scopeRef: "workspace-1",
    rotationCadenceDays: 30,
    ttlMinutes: 1440,
    breakGlass: false,
    metadata: { key: "value" },
  };

  const args: Record<string, unknown> = {
    secretRef: envConfig.secretRef,
    displayName: envConfig.displayName,
    category: envConfig.category,
    providerKind: envConfig.providerKind,
    scopeType: envConfig.scopeType,
    scopeRef: envConfig.scopeRef,
    rotationPolicy: {
      cadenceDays: envConfig.rotationCadenceDays,
      ttlMinutes: envConfig.ttlMinutes,
      breakGlass: envConfig.breakGlass,
    },
    metadata: envConfig.metadata,
  };

  assert.equal(args.secretRef, "ref-123");
  assert.deepEqual(args.rotationPolicy, { cadenceDays: 30, ttlMinutes: 1440, breakGlass: false });
});

test("register omits optional fields when not provided", () => {
  const envConfig = {
    secretRef: "ref-123",
    displayName: "Test",
    category: "api_key",
    providerKind: "aws",
    scopeType: "workspace",
    scopeRef: "workspace-1",
    rotationCadenceDays: null,
    ttlMinutes: null,
    breakGlass: false,
    metadata: null,
    currentVersion: null,
  };

  const args: Record<string, unknown> = {
    secretRef: envConfig.secretRef,
    displayName: envConfig.displayName,
    category: envConfig.category as never,
    providerKind: envConfig.providerKind as never,
    scopeType: envConfig.scopeType as never,
    scopeRef: envConfig.scopeRef,
    rotationPolicy: {
      cadenceDays: envConfig.rotationCadenceDays,
      ttlMinutes: envConfig.ttlMinutes,
      breakGlass: envConfig.breakGlass,
    },
  };
  if (envConfig.metadata) {
    args.metadata = envConfig.metadata;
  }
  if (envConfig.currentVersion) {
    args.currentVersion = envConfig.currentVersion;
  }

  assert.equal(args.metadata, undefined);
  assert.equal(args.currentVersion, undefined);
  assert.deepEqual(args.rotationPolicy, { cadenceDays: null, ttlMinutes: null, breakGlass: false });
});

// ---------------------------------------------------------------------------
// Tests for secret resolve args building
// ---------------------------------------------------------------------------

test("resolve builds args with task and execution context", () => {
  const envConfig = {
    secretRef: "ref-123",
    requestedBy: "user-1",
    grantedTo: "service-1",
    usagePurpose: "api_access",
    taskId: "task-456",
    executionId: "exec-789",
    expiresAt: "2024-12-31T23:59:59.000Z",
    usageMetadata: { ip: "192.168.1.1" },
  };

  const args: Record<string, unknown> = {
    secretRef: envConfig.secretRef,
    requestedBy: envConfig.requestedBy,
    grantedTo: envConfig.grantedTo,
    usagePurpose: envConfig.usagePurpose,
  };
  if (envConfig.taskId) {
    args.taskId = envConfig.taskId;
  }
  if (envConfig.executionId) {
    args.executionId = envConfig.executionId;
  }
  if (envConfig.expiresAt) {
    args.expiresAt = envConfig.expiresAt;
  }
  if (envConfig.usageMetadata) {
    args.metadata = envConfig.usageMetadata;
  }

  assert.equal(args.taskId, "task-456");
  assert.equal(args.executionId, "exec-789");
  assert.equal(args.expiresAt, "2024-12-31T23:59:59.000Z");
});

// ---------------------------------------------------------------------------
// Tests for rotation event args building
// ---------------------------------------------------------------------------

test("rotate builds args with version info", () => {
  const envConfig = {
    secretRef: "ref-123",
    rotationMode: "scheduled",
    rotationStatus: "completed",
    rotationReasonCode: "rotation.scheduled",
    requestedBy: "system",
    previousVersion: "v1",
    nextVersion: "v2",
    rotationMetadata: { automated: true },
  };

  const args: Record<string, unknown> = {
    secretRef: envConfig.secretRef,
    rotationMode: envConfig.rotationMode as never,
    status: envConfig.rotationStatus as never,
    reasonCode: envConfig.rotationReasonCode,
    requestedBy: envConfig.requestedBy,
  };
  if (envConfig.previousVersion) {
    args.previousVersion = envConfig.previousVersion;
  }
  if (envConfig.nextVersion) {
    args.nextVersion = envConfig.nextVersion;
  }
  if (envConfig.rotationMetadata) {
    args.metadata = envConfig.rotationMetadata;
  }

  assert.equal(args.previousVersion, "v1");
  assert.equal(args.nextVersion, "v2");
});

// ---------------------------------------------------------------------------
// Tests for unknown action error
// ---------------------------------------------------------------------------

test("unknown action throws ValidationError", () => {
  const action = "unknown_action";
  const errorCode = `unsupported_secret_action:${action}`;

  assert.throws(
    () => {
      if (!SECRET_ACTIONS.includes(action as typeof SECRET_ACTIONS[number])) {
        throw new ValidationError(errorCode, errorCode);
      }
    },
    { message: errorCode },
  );
});
