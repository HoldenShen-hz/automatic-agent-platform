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
import { existsSync, mkdirSync, rmSync, writeFileSync, } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { CodeDiagnosticsService, formatDiagnosticsFeedback, } from "./code-diagnostics-service.js";
import { checkFreshness, takeFileSnapshot, } from "../../control-plane/iam/file-freshness.js";
import { ToolExecutionError } from "../../contracts/errors.js";
import { checkSandboxPath } from "../../control-plane/iam/sandbox-policy.js";
import { checkToolPathScope } from "./tool-path-scope.js";
/**
 * A single hunk within a patch, representing a region of changes.
 */
import { createSkippedResult, isNullPath, parsePatch, readExistingFile, } from "./patch-dsl-support.js";
export class PatchDslService {
    diagnosticsService;
    /**
     * Creates a new PatchDslService.
     *
     * @param diagnosticsService - Service for code diagnostics after changes
     */
    constructor(diagnosticsService = new CodeDiagnosticsService()) {
        this.diagnosticsService = diagnosticsService;
    }
    /**
     * Applies multiple patches with validation and rollback support.
     *
     * @param request - Patch application request with patches and policy
     * @returns Result of patch application with per-file results
     */
    async applyPatches(request) {
        const startedAtMs = Date.now();
        const prepared = [];
        const results = [];
        // Phase 1: Prepare all patches (validation without commitment)
        for (const [index, patch] of request.patches.entries()) {
            const preparedPatch = this.preparePatch(patch, request);
            if ("errorCode" in preparedPatch.result && preparedPatch.result.status === "failed") {
                // On first failure, mark all remaining patches as skipped
                const priorResults = prepared.map(() => createSkippedResult(request.patches[index - prepared.length] ?? patch));
                const tailResults = request.patches.slice(index + 1).map(createSkippedResult);
                const mergedResults = [
                    ...request.patches.slice(0, index).map(createSkippedResult),
                    preparedPatch.result,
                    ...tailResults,
                ];
                return this.buildResult(request, preparedPatch.result.errorCode?.startsWith("sandbox.") || preparedPatch.result.errorCode?.startsWith("tool.path_scope")
                    ? "blocked"
                    : "failed", false, mergedResults, null, startedAtMs);
            }
            prepared.push(preparedPatch);
            results.push(preparedPatch.result);
        }
        // Phase 2: Capture state of all affected files for rollback
        const affectedPaths = this.captureAffectedPaths(prepared);
        // Phase 3: Commit all prepared patches
        try {
            for (const preparedPatch of prepared) {
                this.commitPreparedPatch(preparedPatch);
            }
        }
        catch (error) {
            // Rollback on failure
            this.restoreAffectedPaths(affectedPaths);
            return this.buildResult(request, "failed", false, prepared.map((item) => ({
                ...item.result,
                status: "failed",
                errorCode: item.result.errorCode ?? "patch.commit_failed",
                errorMessage: error instanceof Error ? error.message : String(error),
            })), null, startedAtMs);
        }
        // Phase 4: Collect diagnostics and build final result
        const successResults = prepared.map((item) => item.result);
        const changedPaths = prepared.flatMap((item) => {
            if (item.operation === "delete") {
                return [];
            }
            return item.targetPath == null ? [] : [item.targetPath];
        });
        const diagnostics = await this.diagnosticsService.collectForFiles(changedPaths);
        return this.buildResult(request, "succeeded", true, successResults, diagnostics, startedAtMs);
    }
    /**
     * Parses a patch string into structured FilePatch objects.
     * Auto-detects unified diff vs Codex format.
     */
    parsePatchString(patchContent) {
        return parsePatch(patchContent);
    }
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
    preparePatch(patch, request) {
        const strictMode = request.strictMode ?? false;
        let operation = this.classifyOperation(patch);
        const sourcePathInput = isNullPath(patch.oldPath) ? null : patch.oldPath;
        const targetPathInput = isNullPath(patch.newPath) ? null : patch.newPath;
        // Both paths null - invalid
        if (sourcePathInput == null && targetPathInput == null) {
            return {
                patch,
                result: this.failedResult("", patch, "patch.invalid_path", "Both oldPath and newPath are empty"),
                operation,
                sourcePath: null,
                targetPath: null,
                originalContent: null,
                nextContent: null,
            };
        }
        let sourcePath = null;
        let targetPath = null;
        // Resolve and validate source path
        if (sourcePathInput != null) {
            const sourceCheck = this.resolvePatchPath(request, sourcePathInput, true);
            if (!sourceCheck.allowed) {
                return {
                    patch,
                    result: this.failedResult(targetPathInput ?? sourcePathInput, patch, "sandbox.write_path_denied", sourceCheck.reasonCode ?? "sandbox.write_path_denied"),
                    operation,
                    sourcePath: null,
                    targetPath: null,
                    originalContent: null,
                    nextContent: null,
                };
            }
            sourcePath = sourceCheck.normalizedPath;
        }
        // Resolve and validate target path
        if (targetPathInput != null) {
            const targetCheck = this.resolvePatchPath(request, targetPathInput, true);
            if (!targetCheck.allowed) {
                return {
                    patch,
                    result: this.failedResult(targetPathInput, patch, "sandbox.write_path_denied", targetCheck.reasonCode ?? "sandbox.write_path_denied"),
                    operation,
                    sourcePath,
                    targetPath: null,
                    originalContent: null,
                    nextContent: null,
                };
            }
            targetPath = targetCheck.normalizedPath;
        }
        // Create operation but creation not allowed
        if (operation === "create" && !request.allowCreation) {
            return {
                patch,
                result: this.failedResult(targetPathInput ?? sourcePathInput ?? "", patch, "patch.file_not_found", `File does not exist: ${targetPathInput ?? sourcePathInput ?? ""}`),
                operation,
                sourcePath,
                targetPath,
                originalContent: null,
                nextContent: null,
            };
        }
        // Delete operation validation
        if (operation === "delete") {
            if (sourcePath == null || !existsSync(sourcePath)) {
                return {
                    patch,
                    result: this.failedResult(patch.oldPath, patch, "patch.file_not_found", `File does not exist: ${patch.oldPath}`),
                    operation,
                    sourcePath,
                    targetPath,
                    originalContent: null,
                    nextContent: null,
                };
            }
            return {
                patch,
                result: {
                    filePath: patch.oldPath,
                    status: "deleted",
                    hunksApplied: 0,
                    hunksTotal: patch.hunks.length,
                },
                operation,
                sourcePath,
                targetPath: null,
                originalContent: readExistingFile(sourcePath),
                nextContent: null,
            };
        }
        // Check source file existence for non-create operations
        const sourceExists = sourcePath != null && existsSync(sourcePath);
        if (!sourceExists) {
            // Special case: allowCreation with same source and target = create
            if (request.allowCreation && targetPath != null && sourcePath === targetPath) {
                operation = "create";
            }
            else if (operation !== "create") {
                return {
                    patch,
                    result: this.failedResult(patch.oldPath || patch.newPath, patch, "patch.file_not_found", `File does not exist: ${patch.oldPath || patch.newPath}`),
                    operation,
                    sourcePath,
                    targetPath,
                    originalContent: null,
                    nextContent: null,
                };
            }
        }
        // Move operation: target must not exist
        if (operation === "move" && targetPath != null && existsSync(targetPath) && targetPath !== sourcePath) {
            return {
                patch,
                result: this.failedResult(patch.newPath, patch, "patch.move_target_exists", `Target already exists: ${patch.newPath}`),
                operation,
                sourcePath,
                targetPath,
                originalContent: null,
                nextContent: null,
            };
        }
        // Read original content (empty string for creates)
        const originalContent = sourceExists && sourcePath != null ? readExistingFile(sourcePath) : "";
        // Reject binary files
        if (originalContent.includes("\u0000")) {
            return {
                patch,
                result: this.failedResult(patch.newPath || patch.oldPath, patch, "tool.edit_binary_file_denied", "Binary files are not supported by apply_patch"),
                operation,
                sourcePath,
                targetPath,
                originalContent: null,
                nextContent: null,
            };
        }
        // Resolve initial snapshot for freshness checking
        const initialSnapshot = this.resolveInitialSnapshot(sourcePath, patch.expectedSnapshot, request.freshnessConfig);
        // Apply hunks to get the new content
        const applied = this.applyHunks(originalContent, patch.hunks, strictMode);
        if (!applied.success) {
            return {
                patch,
                result: this.failedResult(patch.newPath || patch.oldPath, patch, "patch.hunk_not_found", applied.errorMessage ?? "Unable to apply patch hunk", applied.hunksApplied),
                operation,
                sourcePath,
                targetPath,
                originalContent,
                nextContent: null,
            };
        }
        // Freshness check to detect external modifications
        if (sourcePath != null && initialSnapshot != null && request.freshnessConfig != null) {
            const freshnessResult = checkFreshness(sourcePath, initialSnapshot, request.freshnessConfig);
            if (!freshnessResult.fresh) {
                return {
                    patch,
                    result: this.failedResult(patch.newPath || patch.oldPath, patch, "tool.file_stale_modification_denied", `File was modified externally: ${freshnessResult.reason}`, applied.hunksApplied),
                    operation,
                    sourcePath,
                    targetPath,
                    originalContent,
                    nextContent: null,
                };
            }
        }
        // Determine final status
        const filePath = patch.newPath || patch.oldPath;
        const status = operation === "create"
            ? "created"
            : operation === "move"
                ? "moved"
                : "applied";
        return {
            patch,
            result: {
                filePath,
                status,
                hunksApplied: applied.hunksApplied,
                hunksTotal: patch.hunks.length,
            },
            operation,
            sourcePath,
            targetPath: targetPath ?? sourcePath,
            originalContent,
            nextContent: applied.content,
        };
    }
    /**
     * Classifies a patch operation based on old and new paths.
     */
    classifyOperation(patch) {
        if (isNullPath(patch.newPath)) {
            return "delete";
        }
        if (isNullPath(patch.oldPath)) {
            return "create";
        }
        return patch.oldPath !== patch.newPath ? "move" : "update";
    }
    /**
     * Resolves a patch path against sandbox policy and path scope.
     */
    resolvePatchPath(request, inputPath, allowMissingLeaf) {
        // Direct path check against sandbox policy
        const directCheck = checkSandboxPath(request.sandboxPolicy, inputPath);
        if (directCheck.allowed) {
            const scopeCheck = checkToolPathScope(directCheck.normalizedPath, request.allowedPathRoots);
            if (!scopeCheck.allowed) {
                return {
                    allowed: false,
                    normalizedPath: scopeCheck.normalizedPath,
                    reasonCode: "tool.path_scope_write_denied",
                };
            }
            return directCheck;
        }
        // If path is unresolvable and we're allowed to create, check parent
        if (!allowMissingLeaf || !(directCheck.reasonCode?.startsWith("sandbox.path_unresolvable:") ?? false)) {
            return directCheck;
        }
        // Resolve parent directory
        const resolvedPath = resolve(inputPath);
        const parentPath = dirname(resolvedPath);
        const parentCheck = checkSandboxPath(request.sandboxPolicy, parentPath);
        if (!parentCheck.allowed) {
            return parentCheck;
        }
        // Build normalized path in allowed parent
        const normalizedPath = resolve(parentCheck.normalizedPath, basename(resolvedPath));
        const scopeCheck = checkToolPathScope(normalizedPath, request.allowedPathRoots);
        if (!scopeCheck.allowed) {
            return {
                allowed: false,
                normalizedPath: scopeCheck.normalizedPath,
                reasonCode: "tool.path_scope_write_denied",
            };
        }
        return {
            allowed: true,
            normalizedPath,
            reasonCode: null,
        };
    }
    /**
     * Resolves the initial snapshot for freshness checking.
     */
    resolveInitialSnapshot(filePath, expectedSnapshot, freshnessConfig) {
        // Use provided snapshot if available
        if (expectedSnapshot != null) {
            return expectedSnapshot;
        }
        // Otherwise take a snapshot if conditions allow
        if (filePath == null || freshnessConfig == null || !existsSync(filePath)) {
            return null;
        }
        return takeFileSnapshot(filePath, {
            includeDigest: freshnessConfig.requireDigest ?? false,
            digestAlgorithm: freshnessConfig.digestAlgorithm ?? "sha256",
        });
    }
    /**
     * Applies hunks to content and returns the modified content.
     */
    applyHunks(originalContent, hunks, strictMode) {
        const lines = originalContent.split("\n");
        let hunksApplied = 0;
        for (const hunk of hunks) {
            const applied = this.applyHunk(lines, hunk, strictMode);
            if (!applied.success) {
                const result = {
                    success: false,
                    content: originalContent,
                    hunksApplied,
                };
                if (applied.errorMessage != null) {
                    result.errorMessage = applied.errorMessage;
                }
                return result;
            }
            hunksApplied += 1;
        }
        return {
            success: true,
            content: lines.join("\n"),
            hunksApplied,
        };
    }
    /**
     * Applies a single hunk to a lines array.
     */
    applyHunk(lines, hunk, strictMode) {
        // Parse hunk operations (add, delete, context)
        const operations = this.parseHunkOperations(hunk.lines);
        const oldLines = operations
            .filter((operation) => operation.kind !== "add")
            .map((operation) => operation.value);
        const newLines = operations
            .filter((operation) => operation.kind !== "delete")
            .map((operation) => operation.value);
        // Find where this hunk applies in the file
        const preferredIndex = Math.max(0, Math.min(lines.length, (hunk.oldStart || hunk.newStart || 1) - 1));
        const matchIndex = this.findMatchIndex(lines, oldLines, preferredIndex, strictMode);
        if (matchIndex === -1) {
            return {
                success: false,
                errorMessage: `Unable to locate patch hunk near line ${hunk.oldStart}`,
            };
        }
        // Apply the hunk: replace oldLines with newLines
        lines.splice(matchIndex, oldLines.length, ...newLines);
        return { success: true };
    }
    /**
     * Parses hunk content into operations.
     */
    parseHunkOperations(hunkLines) {
        const operations = [];
        for (const line of hunkLines) {
            if (line.startsWith("@@") || line === "\\ No newline at end of file") {
                continue;
            }
            if (line.startsWith("+")) {
                operations.push({ kind: "add", value: line.slice(1) });
                continue;
            }
            if (line.startsWith("-")) {
                operations.push({ kind: "delete", value: line.slice(1) });
                continue;
            }
            if (line.startsWith(" ")) {
                operations.push({ kind: "context", value: line.slice(1) });
                continue;
            }
            // Line without marker is treated as context
            continue;
        }
        return operations;
    }
    /**
     * Finds the index where a hunk's oldLines match in the file content.
     */
    findMatchIndex(lines, oldLines, preferredIndex, strictMode) {
        if (oldLines.length === 0) {
            return preferredIndex;
        }
        // Find all occurrences of oldLines pattern
        const matches = [];
        for (let index = 0; index <= lines.length - oldLines.length; index += 1) {
            let matched = true;
            for (let offset = 0; offset < oldLines.length; offset += 1) {
                if (lines[index + offset] !== oldLines[offset]) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                matches.push(index);
            }
        }
        if (matches.length === 0) {
            return -1; // No match found
        }
        if (strictMode) {
            // In strict mode, only accept match at the expected position
            return matches.includes(preferredIndex) ? preferredIndex : -1;
        }
        // Return match closest to preferred position (greedy by proximity)
        return matches.reduce((best, candidate) => {
            if (Math.abs(candidate - preferredIndex) < Math.abs(best - preferredIndex)) {
                return candidate;
            }
            return best;
        }, matches[0] ?? -1);
    }
    /**
     * Captures snapshots of all files that will be affected by patches.
     * Used for rollback on failure.
     */
    captureAffectedPaths(prepared) {
        const snapshots = new Map();
        for (const item of prepared) {
            for (const filePath of [item.sourcePath, item.targetPath]) {
                if (filePath == null || snapshots.has(filePath)) {
                    continue;
                }
                if (existsSync(filePath)) {
                    snapshots.set(filePath, {
                        existed: true,
                        content: readExistingFile(filePath),
                    });
                }
                else {
                    snapshots.set(filePath, {
                        existed: false,
                        content: null,
                    });
                }
            }
        }
        return snapshots;
    }
    /**
     * Restores affected files to their pre-patch state.
     */
    restoreAffectedPaths(snapshots) {
        for (const [filePath, snapshot] of snapshots.entries()) {
            if (snapshot.existed) {
                // Restore original content
                mkdirSync(dirname(filePath), { recursive: true });
                writeFileSync(filePath, snapshot.content ?? "", "utf8");
            }
            else if (existsSync(filePath)) {
                // Remove file that didn't exist before
                rmSync(filePath, { force: true });
            }
        }
    }
    /**
     * Commits a prepared patch to the filesystem.
     */
    commitPreparedPatch(prepared) {
        if (prepared.operation === "delete") {
            if (prepared.sourcePath != null) {
                rmSync(prepared.sourcePath, { force: true });
            }
            return;
        }
        const targetPath = prepared.targetPath;
        if (targetPath == null) {
            throw new ToolExecutionError("patch.target_path_missing", "patch.target_path_missing", {
                retryable: false,
                details: {
                    operation: prepared.operation,
                    sourcePath: prepared.sourcePath,
                },
            });
        }
        // Ensure parent directory exists
        mkdirSync(dirname(targetPath), { recursive: true });
        // Write new content
        writeFileSync(targetPath, prepared.nextContent ?? "", "utf8");
        // Remove source file if this was a move
        if (prepared.operation === "move" && prepared.sourcePath != null && prepared.sourcePath !== targetPath && existsSync(prepared.sourcePath)) {
            rmSync(prepared.sourcePath, { force: true });
        }
    }
    /**
     * Creates a failed result for a patch.
     */
    failedResult(filePath, patch, errorCode, errorMessage, hunksApplied = 0) {
        return {
            filePath,
            status: "failed",
            hunksApplied,
            hunksTotal: patch.hunks.length,
            errorCode,
            errorMessage,
        };
    }
    /**
     * Builds the final PatchApplicationResult.
     */
    buildResult(request, status, success, results, diagnostics, startedAtMs) {
        const changedCount = results.filter((result) => ["applied", "created", "deleted", "moved"].includes(result.status)).length;
        const durationMs = Math.max(0, Date.now() - startedAtMs);
        return {
            callId: request.callId,
            toolName: request.toolName,
            status,
            success,
            output: success
                ? [`Applied ${changedCount} patches`, formatDiagnosticsFeedback(diagnostics)].filter((part) => part != null).join("\n")
                : null,
            results,
            diagnostics,
            durationMs,
        };
    }
}
//# sourceMappingURL=patch-dsl-service.js.map