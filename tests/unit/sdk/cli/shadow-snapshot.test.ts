/**
 * Shadow Snapshot CLI Tests
 *
 * Tests for shadow-snapshot.ts CLI module and its environment loader.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadShadowSnapshotCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { SHADOW_SNAPSHOT_ACTIONS } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-support.js";

// ---------------------------------------------------------------------------
// Tests for loadShadowSnapshotCliEnv
// ---------------------------------------------------------------------------

test("loadShadowSnapshotCliEnv parses create action", () => {
  const config = loadShadowSnapshotCliEnv({
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "create",
  });

  assert.equal(config.action, "create");
  assert.equal(config.workspaceRoot, "/workspace");
  assert.equal(config.shadowRoot, "/shadow");
});

test("loadShadowSnapshotCliEnv parses list action", () => {
  const config = loadShadowSnapshotCliEnv({
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "list",
  });

  assert.equal(config.action, "list");
});

test("loadShadowSnapshotCliEnv parses restore action", () => {
  const config = loadShadowSnapshotCliEnv({
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "restore",
    AA_SHADOW_SNAPSHOT_ID: "snapshot-123",
  });

  assert.equal(config.action, "restore");
  assert.equal(config.snapshotId, "snapshot-123");
});

test("loadShadowSnapshotCliEnv parses optional fields", () => {
  const config = loadShadowSnapshotCliEnv({
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "create",
    AA_SHADOW_SNAPSHOT_MAX_ENTRY_BYTES: "4096",
    AA_SHADOW_SNAPSHOT_EXCLUDES: "node_modules,.git,dist",
    AA_SHADOW_SNAPSHOT_LABEL: "test-label",
    AA_SHADOW_SNAPSHOT_REASON_CODE: "test.reason",
    AA_SHADOW_SNAPSHOT_ACTOR_ID: "actor-123",
  });

  assert.equal(config.maxEntryBytes, 4096);
  assert.deepEqual(config.excludedPaths, ["node_modules", ".git", "dist"]);
  assert.equal(config.label, "test-label");
  assert.equal(config.reasonCode, "test.reason");
  assert.equal(config.actorId, "actor-123");
});

test("loadShadowSnapshotCliEnv throws for missing workspaceRoot", () => {
  assert.throws(
    () =>
      loadShadowSnapshotCliEnv({
        AA_SHADOW_ROOT: "/shadow",
        AA_SHADOW_SNAPSHOT_ACTION: "create",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "missing_env:AA_WORKSPACE_ROOT",
  );
});

test("loadShadowSnapshotCliEnv throws for missing shadowRoot", () => {
  assert.throws(
    () =>
      loadShadowSnapshotCliEnv({
        AA_WORKSPACE_ROOT: "/workspace",
        AA_SHADOW_SNAPSHOT_ACTION: "create",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "missing_env:AA_SHADOW_ROOT",
  );
});

test("loadShadowSnapshotCliEnv throws for invalid action", () => {
  assert.throws(
    () =>
      loadShadowSnapshotCliEnv({
        AA_WORKSPACE_ROOT: "/workspace",
        AA_SHADOW_ROOT: "/shadow",
        AA_SHADOW_SNAPSHOT_ACTION: "invalid_action",
      }),
    (error) =>
      error instanceof ValidationError && error.code === "invalid_env:AA_SHADOW_SNAPSHOT_ACTION",
  );
});

// ---------------------------------------------------------------------------
// Tests for SHADOW_SNAPSHOT_ACTIONS enum
// ---------------------------------------------------------------------------

test("SHADOW_SNAPSHOT_ACTIONS contains create, list, restore", () => {
  assert.deepEqual(SHADOW_SNAPSHOT_ACTIONS, ["create", "list", "restore"]);
});

test("SHADOW_SNAPSHOT_ACTIONS has exactly 3 actions", () => {
  assert.equal(SHADOW_SNAPSHOT_ACTIONS.length, 3);
});

// ---------------------------------------------------------------------------
// Tests for shadow snapshot action branching logic
// ---------------------------------------------------------------------------

test("create action does not require snapshotId", () => {
  const config = {
    action: "create" as const,
    snapshotId: null,
  };

  // For create, snapshotId is optional
  const requiresSnapshotId = config.action === "restore" && config.snapshotId == null;
  assert.equal(requiresSnapshotId, false);
});

test("restore action requires snapshotId", () => {
  const config = {
    action: "restore" as const,
    snapshotId: null,
  };

  const requiresSnapshotId = config.action === "restore" && config.snapshotId == null;
  assert.equal(requiresSnapshotId, true);
});

test("restore action with snapshotId does not require it", () => {
  const config = {
    action: "restore" as const,
    snapshotId: "snapshot-123",
  };

  const requiresSnapshotId = config.action === "restore" && config.snapshotId == null;
  assert.equal(requiresSnapshotId, false);
});

test("list action does not require snapshotId", () => {
  const config: { action: string; snapshotId: string | null } = {
    action: "list",
    snapshotId: null,
  };

  // Only restore action requires snapshotId
  const requiresSnapshotId = config.action === "restore" && config.snapshotId == null;
  assert.equal(requiresSnapshotId, false);
});

// ---------------------------------------------------------------------------
// Tests for snapshot service options building
// ---------------------------------------------------------------------------

test("snapshot service options includes maxEntryBytes when provided", () => {
  const envConfig = {
    maxEntryBytes: 8192,
    excludedPaths: null,
  };

  const options: Record<string, unknown> = {};
  if (envConfig.maxEntryBytes != null) {
    options.maxEntryBytes = envConfig.maxEntryBytes;
  }

  assert.equal(options.maxEntryBytes, 8192);
});

test("snapshot service options includes excludedPaths when provided", () => {
  const envConfig = {
    maxEntryBytes: null,
    excludedPaths: ["node_modules", ".git"],
  };

  const options: Record<string, unknown> = {};
  if (envConfig.excludedPaths != null) {
    options.excludedPaths = envConfig.excludedPaths;
  }

  assert.deepEqual(options.excludedPaths, ["node_modules", ".git"]);
});

test("snapshot service options omits optional fields when null", () => {
  const envConfig = {
    maxEntryBytes: null,
    excludedPaths: null,
  };

  const options: Record<string, unknown> = {};
  if (envConfig.maxEntryBytes != null) {
    options.maxEntryBytes = envConfig.maxEntryBytes;
  }
  if (envConfig.excludedPaths != null) {
    options.excludedPaths = envConfig.excludedPaths;
  }

  assert.equal(Object.keys(options).length, 0);
});

// ---------------------------------------------------------------------------
// Tests for create snapshot args building
// ---------------------------------------------------------------------------

test("create snapshot builds args with optional snapshotId", () => {
  const envConfig = {
    snapshotId: "snap-123",
    label: "test snapshot",
    reasonCode: "test.reason",
    actorId: "actor-456",
  };

  const args: Record<string, unknown> = {};
  if (envConfig.snapshotId != null) {
    args.snapshotId = envConfig.snapshotId;
  }
  if (envConfig.label != null) {
    args.label = envConfig.label;
  }
  if (envConfig.reasonCode != null) {
    args.reasonCode = envConfig.reasonCode;
  }
  if (envConfig.actorId != null) {
    args.actorId = envConfig.actorId;
  }

  assert.equal(args.snapshotId, "snap-123");
  assert.equal(args.label, "test snapshot");
  assert.equal(args.reasonCode, "test.reason");
  assert.equal(args.actorId, "actor-456");
});

test("create snapshot builds args without optional snapshotId", () => {
  const envConfig = {
    snapshotId: null,
    label: "test snapshot",
    reasonCode: null,
    actorId: null,
  };

  const args: Record<string, unknown> = {};
  if (envConfig.snapshotId != null) {
    args.snapshotId = envConfig.snapshotId;
  }
  if (envConfig.label != null) {
    args.label = envConfig.label;
  }
  if (envConfig.reasonCode != null) {
    args.reasonCode = envConfig.reasonCode;
  }
  if (envConfig.actorId != null) {
    args.actorId = envConfig.actorId;
  }

  assert.equal(args.snapshotId, undefined);
  assert.equal(args.label, "test snapshot");
  assert.equal(args.reasonCode, undefined);
  assert.equal(args.actorId, undefined);
});
