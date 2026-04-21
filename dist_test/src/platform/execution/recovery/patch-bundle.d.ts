/**
 * PatchBundle - Structured Code Changes
 *
 * A structured representation of code changes produced by the build stage.
 * Enables verification and diff analysis.
 */
export type PatchStatus = 'pending' | 'applied' | 'rejected' | 'rolled_back';
export interface PatchBundle {
    /** Unique bundle identifier */
    bundleId: string;
    /** Associated task card ID */
    taskId: string;
    /** Files modified */
    changedFiles: readonly ChangedFile[];
    /** Total diff lines across all files */
    totalDiffLines: number;
    /** Creation timestamp */
    createdAt: string;
    /** Author agent ID */
    authorAgentId: string;
    /** Patch status */
    status: PatchStatus;
}
export interface ChangedFile {
    /** File path (relative or absolute) */
    path: string;
    /** Change type */
    operation: 'create' | 'modify' | 'delete' | 'rename';
    /** Diff hunks */
    hunks: readonly DiffHunk[];
    /** Original line count (for modified files) */
    originalLines?: number;
    /** Final line count */
    finalLines?: number;
}
export interface DiffHunk {
    /** Starting line in original file */
    originalStart: number;
    /** Number of lines in original file */
    originalCount: number;
    /** Starting line in final file */
    finalStart: number;
    /** Number of lines in final file */
    finalCount: number;
    /** Diff lines */
    lines: readonly string[];
}
export declare function createPatchBundle(input: {
    bundleId: string;
    taskId: string;
    changedFiles: readonly ChangedFile[];
    authorAgentId: string;
}): PatchBundle;
export declare function validatePatchBundle(bundle: PatchBundle, taskCard: {
    maxChangedFiles: number;
    maxDiffLines: number;
    forbiddenPaths: readonly string[];
}): PatchValidationResult;
export interface PatchValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
