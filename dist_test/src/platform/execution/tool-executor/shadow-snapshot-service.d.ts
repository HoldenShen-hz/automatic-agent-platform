/**
 * Shadow Snapshot Service
 *
 * Provides workspace backup capabilities using a shadow git repository.
 * Creates point-in-time snapshots of the workspace that can be restored.
 *
 * Key features:
 * - Creates git commits in a shadow repository (separate from workspace)
 * - Excludes large directories (node_modules, .git, dist, etc.)
 * - Validates workspace paths against sandbox policy
 * - Enforces size limits to prevent snapshot bloat
 * - Supports restore to any previous snapshot
 *
 * The shadow repository is stored separately from the workspace to avoid
 * polluting the workspace itself with version control metadata.
 */
import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
/**
 * Configuration options for the shadow snapshot service.
 */
export interface ShadowSnapshotServiceOptions {
    /** Root directory of the workspace to snapshot */
    workspaceRoot: string;
    /** Root directory where shadow git repository is stored */
    shadowRoot: string;
    /** Sandbox policy for path validation (defaults to workspace write policy) */
    sandboxPolicy?: SandboxPolicy;
    /** Maximum size in bytes for any single file/directory entry */
    maxEntryBytes?: number;
    /** Additional paths to exclude from snapshots */
    excludedPaths?: readonly string[];
    /** Path to git binary (defaults to "git") */
    gitBinary?: string;
}
/**
 * Record of a created shadow snapshot.
 */
export interface ShadowSnapshotRecord {
    /** Unique identifier for this snapshot */
    snapshotId: string;
    /** Git commit SHA of this snapshot */
    commitSha: string;
    /** ISO timestamp when snapshot was created */
    createdAt: string;
    /** Workspace root that was snapshotted */
    workspaceRoot: string;
    /** Location of shadow git repository */
    shadowRoot: string;
    /** Optional human-readable label */
    label: string | null;
    /** Reason code for why the snapshot was created */
    reasonCode: string | null;
    /** Actor ID who triggered the snapshot */
    actorId: string | null;
    /** Files that changed in this snapshot */
    changedPaths: string[];
    /** Paths that were excluded */
    excludedPaths: string[];
}
/**
 * Result of restoring a snapshot, includes timing metadata.
 */
export interface ShadowSnapshotRestoreResult extends ShadowSnapshotRecord {
    /** ISO timestamp when restore was performed */
    restoredAt: string;
}
/**
 * Creates and manages shadow snapshots of a workspace.
 */
export declare class ShadowSnapshotService {
    private readonly workspaceRoot;
    private readonly shadowRoot;
    private readonly sandboxPolicy;
    private readonly maxEntryBytes;
    private readonly excludedPaths;
    private readonly gitBinary;
    constructor(options: ShadowSnapshotServiceOptions);
    /**
     * Creates a new shadow snapshot of the workspace.
     */
    createSnapshot(input?: {
        snapshotId?: string;
        label?: string | null;
        reasonCode?: string | null;
        actorId?: string | null;
    }): ShadowSnapshotRecord;
    /**
     * Lists all shadow snapshots in reverse chronological order.
     */
    listSnapshots(): ShadowSnapshotRecord[];
    /**
     * Restores the workspace to a previous snapshot state.
     */
    restoreSnapshot(input: {
        snapshotId: string;
    }): ShadowSnapshotRestoreResult;
    /**
     * Validates that workspace root is accessible under sandbox policy.
     */
    private validateWorkspaceRoot;
    /**
     * Validates shadow root location and creates it if needed.
     * Ensures shadow root is outside the workspace.
     */
    private validateShadowRoot;
    /**
     * Checks that no single entry in the workspace exceeds the size limit.
     */
    private guardWorkspaceEntrySizes;
    /**
     * Initializes the shadow git repository if it doesn't exist.
     */
    private ensureRepository;
    /**
     * Returns the path to the snapshot metadata directory.
     */
    private snapshotMetadataDir;
    /**
     * Persists a snapshot record as JSON.
     */
    private persistRecord;
    /**
     * Loads a snapshot record by ID.
     */
    private loadRecord;
    /**
     * Loads a snapshot record from a file path.
     */
    private loadRecordByPath;
    /**
     * Executes a git command in the shadow repository.
     */
    private git;
}
