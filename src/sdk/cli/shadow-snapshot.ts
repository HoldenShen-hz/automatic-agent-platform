/**
 * Shadow Snapshot CLI
 *
 * This module provides a command-line interface for managing shadow (workspace) snapshots.
 * Shadow snapshots capture workspace state for backup, restore, and recovery operations.
 * This CLI supports creating snapshots, listing existing snapshots, and restoring from them.
 *
 * Environment Variables:
 *   - AA_WORKSPACE_ROOT: Root directory of the workspace to snapshot (required)
 *   - AA_SHADOW_ROOT: Root directory for shadow snapshots (required)
 *   - AA_SHADOW_SNAPSHOT_ACTION: Action to perform - create, list, or restore (required)
 *   - AA_SHADOW_SNAPSHOT_MAX_ENTRY_BYTES: Maximum size per snapshot entry
 *   - AA_SHADOW_SNAPSHOT_EXCLUDES: Comma-separated list of paths to exclude
 *   - AA_SHADOW_SNAPSHOT_ID: ID for a specific snapshot (for restore)
 *   - AA_SHADOW_SNAPSHOT_LABEL: Label for the snapshot
 *   - AA_SHADOW_SNAPSHOT_REASON_CODE: Reason for snapshot creation
 *   - AA_SHADOW_SNAPSHOT_ACTOR_ID: ID of the actor creating the snapshot
 *
 * Actions:
 *   - create: Create a new shadow snapshot
 *   - list: List all shadow snapshots
 *   - restore: Restore workspace from a snapshot
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for shadow snapshot architecture
 * @see {@link docs_zh/contracts/artifact_store_contract.md} for artifact contracts
 */

import { loadShadowSnapshotCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { ShadowSnapshotService } from "../../platform/execution/tool-executor/shadow-snapshot-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

let envConfig: ReturnType<typeof loadShadowSnapshotCliEnv> | null = null;
let service: ShadowSnapshotService | null = null;

function getService(): ShadowSnapshotService {
  if (service) return service;
  // Deferred initialization - load environment only when actually needed
  // This avoids module-level side effects that break lazy loading and testing
  envConfig ??= loadShadowSnapshotCliEnv();
  service = new ShadowSnapshotService({
    workspaceRoot: envConfig.workspaceRoot,
    shadowRoot: envConfig.shadowRoot,
    sandboxPolicy: createWorkspaceWritePolicy(envConfig.shadowRoot),
    ...(envConfig.maxEntryBytes != null ? { maxEntryBytes: envConfig.maxEntryBytes } : {}),
    ...(envConfig.excludedPaths != null ? { excludedPaths: envConfig.excludedPaths } : {}),
  });
  return service;
}

let output: unknown;
// R31-43 FIX: Deferred env loading to avoid module-level side effects
const resolvedEnvConfig = envConfig ?? (envConfig = loadShadowSnapshotCliEnv(), envConfig);
switch (resolvedEnvConfig.action) {
  case "create":
    output = getService().createSnapshot({
      ...(envConfig.snapshotId != null ? { snapshotId: envConfig.snapshotId } : {}),
      ...(envConfig.label != null ? { label: envConfig.label } : {}),
      ...(envConfig.reasonCode != null ? { reasonCode: envConfig.reasonCode } : {}),
      ...(envConfig.actorId != null ? { actorId: envConfig.actorId } : {}),
    });
    break;
  case "list":
    output = getService().listSnapshots();
    break;
  case "restore":
    if (resolvedEnvConfig.snapshotId == null) {
      throw new ValidationError("missing_env:AA_SHADOW_SNAPSHOT_ID", "missing_env:AA_SHADOW_SNAPSHOT_ID");
    }
    output = getService().restoreSnapshot({
      snapshotId: resolvedEnvConfig.snapshotId,
    });
    break;
  default:
    throw new ValidationError(`unknown_shadow_snapshot_action:${resolvedEnvConfig.action}`, `unknown_shadow_snapshot_action:${resolvedEnvConfig.action}`);
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
