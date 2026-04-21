/**
 * Patch DSL Service
 *
 * Provides formal patch application for multi-file code changes with:
 * - Unified diff and Codex-style patch parsing
 * - Add / update / delete / move operations
 * - Preflight validation before any file write
 * - Fail-closed sandbox and path-scope enforcement
 * - Freshness guard support to prevent overwriting external changes
 * - Best-effort rollback on commit failure
 *
 * This service is the foundation for structured patch application,
 * ensuring all changes are validated against security policies
 * before any filesystem modification occurs.
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 */
import { CodeDiagnosticsService } from "./code-diagnostics-service.js";
/**
 * A single hunk within a patch, representing a region of changes.
 */
import { type FilePatch, type PatchApplicationRequest, type PatchApplicationResult } from "./patch-dsl-support.js";
export type { FilePatch, PatchApplicationRequest, PatchApplicationResult, PatchHunk, PatchResult, } from "./patch-dsl-support.js";
export declare class PatchDslService {
    private readonly diagnosticsService;
    /**
     * Creates a new PatchDslService.
     *
     * @param diagnosticsService - Service for code diagnostics after changes
     */
    constructor(diagnosticsService?: CodeDiagnosticsService);
    /**
     * Applies multiple patches with validation and rollback support.
     *
     * @param request - Patch application request with patches and policy
     * @returns Result of patch application with per-file results
     */
    applyPatches(request: PatchApplicationRequest): PatchApplicationResult;
    /**
     * Parses a patch string into structured FilePatch objects.
     * Auto-detects unified diff vs Codex format.
     */
    parsePatchString(patchContent: string): FilePatch[];
    /**
     * Prepares a patch for application (validation without commitment).
     *
     * This method:
     * 1. Classifies the operation (create, delete, update, move)
     * 2. Validates paths against sandbox policy
     * 3. Checks file existence for non-create operations
     * 4. Validates hunk application against file content
     * 5. Checks freshness if configured
     *
     * Returns a PreparedPatch with resolved paths and computed content.
     */
    private preparePatch;
    /**
     * Classifies a patch operation based on old and new paths.
     */
    private classifyOperation;
    /**
     * Resolves a patch path against sandbox policy and path scope.
     */
    private resolvePatchPath;
    /**
     * Resolves the initial snapshot for freshness checking.
     */
    private resolveInitialSnapshot;
    /**
     * Applies hunks to content and returns the modified content.
     */
    private applyHunks;
    /**
     * Applies a single hunk to a lines array.
     */
    private applyHunk;
    /**
     * Parses hunk content into operations.
     */
    private parseHunkOperations;
    /**
     * Finds the index where a hunk's oldLines match in the file content.
     */
    private findMatchIndex;
    /**
     * Captures snapshots of all files that will be affected by patches.
     * Used for rollback on failure.
     */
    private captureAffectedPaths;
    /**
     * Restores affected files to their pre-patch state.
     */
    private restoreAffectedPaths;
    /**
     * Commits a prepared patch to the filesystem.
     */
    private commitPreparedPatch;
    /**
     * Creates a failed result for a patch.
     */
    private failedResult;
    /**
     * Builds the final PatchApplicationResult.
     */
    private buildResult;
}
