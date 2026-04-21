import type { CodeDiagnosticsSummary } from "./code-diagnostics-service.js";
import type { FileSnapshot, FreshnessConfig } from "../../control-plane/iam/file-freshness.js";
import type { SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
export interface PatchHunk {
    /** Starting line number in the original file */
    oldStart: number;
    /** Number of lines in the original file this hunk covers */
    oldCount: number;
    /** Starting line number in the modified file */
    newStart: number;
    /** Number of lines in the modified file this hunk produces */
    newCount: number;
    /** Content lines of this hunk (including diff markers) */
    lines: string[];
}
/**
 * A complete file patch with hunks and optional freshness snapshot.
 */
export interface FilePatch {
    /** Original file path (empty for new files) */
    oldPath: string;
    /** Target file path (empty for deletions) */
    newPath: string;
    /** Hunks of changes to apply */
    hunks: PatchHunk[];
    /** Optional: expected file snapshot for freshness check */
    expectedSnapshot?: FileSnapshot | null;
}
/**
 * Request to apply one or more patches.
 */
export interface PatchApplicationRequest {
    /** Unique call identifier */
    callId: string;
    /** Task context identifier */
    taskId: string;
    /** Execution context identifier */
    executionId: string | null;
    /** Distributed tracing identifier */
    traceId: string;
    /** Tool name (should be "apply_patch") */
    toolName: string;
    /** Sandbox policy for path validation */
    sandboxPolicy: SandboxPolicy;
    /** Optional path scope restrictions */
    allowedPathRoots?: readonly string[];
    /** Patches to apply */
    patches: readonly FilePatch[];
    /** If true, fail when hunk cannot be matched exactly */
    strictMode?: boolean;
    /** If true, allow creating new files */
    allowCreation?: boolean;
    /** Configuration for freshness validation */
    freshnessConfig?: FreshnessConfig;
    /** Timestamp of the operation (defaults to now) */
    occurredAt?: string;
}
/**
 * Result of applying a single file patch.
 */
export interface PatchResult {
    /** File path affected */
    filePath: string;
    /** Status of the patch application */
    status: "applied" | "created" | "deleted" | "moved" | "failed" | "skipped";
    /** Number of hunks successfully applied */
    hunksApplied: number;
    /** Total number of hunks in the patch */
    hunksTotal: number;
    /** Error code if failed */
    errorCode?: string;
    /** Error message if failed */
    errorMessage?: string;
}
/**
 * Complete result of a patch application request.
 */
export interface PatchApplicationResult {
    /** Call identifier */
    callId: string;
    /** Tool that was invoked */
    toolName: string;
    /** Overall status */
    status: "succeeded" | "failed" | "blocked";
    /** Whether the operation succeeded */
    success: boolean;
    /** Human-readable output summary */
    output: string | null;
    /** Results for each individual patch */
    results: PatchResult[];
    /** Code diagnostics for changed files */
    diagnostics: CodeDiagnosticsSummary | null;
    /** Time taken in milliseconds */
    durationMs: number;
}
/**
 * Internal structure for a prepared patch ready for commitment.
 */
export interface PreparedPatch {
    /** Original patch request */
    patch: FilePatch;
    /** Result object for this patch */
    result: PatchResult;
    /** Classified operation type */
    operation: "update" | "create" | "delete" | "move";
    /** Resolved source path */
    sourcePath: string | null;
    /** Resolved target path */
    targetPath: string | null;
    /** Content before modification */
    originalContent: string | null;
    /** Content after modification */
    nextContent: string | null;
}
/**
 * Snapshot of file state before modification, for rollback.
 */
export interface FileStateSnapshot {
    /** Whether the file existed before */
    existed: boolean;
    /** Content if file existed, null otherwise */
    content: string | null;
}
/**
 * Auto-detects patch format and delegates to appropriate parser.
 */
export declare function parsePatch(content: string): FilePatch[];
/**
 * Checks if a path represents a null/empty path.
 */
export declare function isNullPath(inputPath: string): boolean;
/**
 * Reads an existing file's content.
 */
export declare function readExistingFile(filePath: string): string;
/**
 * Creates a skipped result for a patch that wasn't applied.
 */
export declare function createSkippedResult(patch: FilePatch): PatchResult;
/**
 * PatchDslService applies structured patches to files with validation and rollback.
 *
 * The service provides:
 * 1. Multi-format parsing (unified diff, Codex)
 * 2. Sandbox path validation before any file operation
 * 3. Atomic patch application with all-or-nothing semantics
 * 4. Automatic rollback on failure
 * 5. Freshness checking to prevent overwriting external changes
 *
 * Operations are classified as:
 * - create: New file (oldPath is null/empty)
 * - delete: Remove file (newPath is null/empty)
 * - update: Modify existing file (same path)
 * - move: Rename file (different oldPath and newPath)
 */
