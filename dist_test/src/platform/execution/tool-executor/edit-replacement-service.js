import { readFileSync, writeFileSync } from "node:fs";
import { checkSandboxPath } from "../../control-plane/iam/sandbox-policy.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { CodeDiagnosticsService, formatDiagnosticsFeedback, } from "./code-diagnostics-service.js";
import { coerceEditBatchRequest, coerceEditReplacementRequest, formatToolArgumentCoercionWarnings, } from "./tool-argument-coercion.js";
import { isExecutionToolAllowed, resolveExecutionAllowedPathRoots, resolveExecutionAllowedTools, } from "./tool-execution-access.js";
import { checkToolPathScope } from "./tool-path-scope.js";
import { resolveToolExecutionMetadata, resolveToolTimeoutMs } from "./tool-metadata.js";
import { buildEditBatchResult, buildEditReplacementResult, findAlreadyAppliedRange, formatRange, } from "./edit-replacement/edit-replacement-result-support.js";
import { preserveTrailingNewline } from "./edit-replacement/string-utils.js";
import { evaluateEditStages } from "./edit-replacement/edit-replacement-stage-support.js";
import { reindentBlockToMatch } from "./edit-replacement/apply.js";
export class EditReplacementService {
    db;
    store;
    diagnosticsService;
    /**
     * Creates a new EditReplacementService.
     *
     * @param db - SQLite database for transaction support and lock management
     * @param store - AuthoritativeTaskStore for file lock CRUD operations
     */
    constructor(db, store, diagnosticsService = new CodeDiagnosticsService()) {
        this.db = db;
        this.store = store;
        this.diagnosticsService = diagnosticsService;
    }
    /**
     * Executes an edit replacement operation on a file.
     *
     * @param request - Edit replacement request with file path and string specifications
     * @returns EditReplacementResult with status, attempts, and diagnostics
     */
    execute(request) {
        const startedAtMs = Date.now();
        const coercedRequest = coerceEditReplacementRequest(request);
        const normalizedRequest = coercedRequest.value;
        const coercionWarnings = formatToolArgumentCoercionWarnings(coercedRequest.traces);
        const metadata = resolveToolExecutionMetadata(normalizedRequest.toolName);
        const timeoutMs = resolveToolTimeoutMs(normalizedRequest.timeoutMs, metadata);
        const execution = normalizedRequest.executionId == null ? null : this.store.execution.getExecution(normalizedRequest.executionId);
        const allowedToolsResolution = resolveExecutionAllowedTools({
            execution: execution ?? null,
            executionRequired: normalizedRequest.executionId != null,
        });
        if (allowedToolsResolution.errorCode != null) {
            return this.blocked(request, allowedToolsResolution.errorCode, startedAtMs);
        }
        if (!isExecutionToolAllowed(normalizedRequest.toolName, allowedToolsResolution.allowedTools)) {
            return this.blocked(normalizedRequest, "tool.tool_not_allowed", startedAtMs);
        }
        const allowedPathRootsResolution = resolveExecutionAllowedPathRoots({
            execution: execution ?? null,
            executionRequired: normalizedRequest.executionId != null,
            requestAllowedPathRoots: normalizedRequest.allowedPathRoots,
        });
        if (allowedPathRootsResolution.errorCode != null) {
            return this.blocked(request, allowedPathRootsResolution.errorCode, startedAtMs);
        }
        const allowedPathRoots = allowedPathRootsResolution.allowedPathRoots;
        const pathCheck = checkSandboxPath(normalizedRequest.sandboxPolicy, normalizedRequest.filePath);
        if (!pathCheck.allowed) {
            return this.blocked(normalizedRequest, "sandbox.write_path_denied", startedAtMs);
        }
        const scopeCheck = checkToolPathScope(pathCheck.normalizedPath, allowedPathRoots);
        if (!scopeCheck.allowed) {
            return this.blocked(normalizedRequest, "tool.path_scope_write_denied", startedAtMs);
        }
        if (this.hasTimedOut(startedAtMs, timeoutMs)) {
            return this.timedOut(normalizedRequest, startedAtMs);
        }
        let originalContent;
        try {
            originalContent = readFileSync(pathCheck.normalizedPath, "utf8");
        }
        catch (error) {
            return this.failed(normalizedRequest, "tool.execution_failed", `Unable to read target file: ${error instanceof Error ? error.message : String(error)}`, startedAtMs);
        }
        if (originalContent.includes("\u0000")) {
            return this.blocked(normalizedRequest, "tool.edit_binary_file_denied", startedAtMs);
        }
        if (normalizedRequest.oldString.length === 0) {
            return this.failed(normalizedRequest, "tool.edit_target_not_found", "oldString must not be empty", startedAtMs);
        }
        if (this.hasTimedOut(startedAtMs, timeoutMs)) {
            return this.timedOut(normalizedRequest, startedAtMs);
        }
        const occurredAt = normalizedRequest.occurredAt ?? nowIso();
        const ownerId = normalizedRequest.executionId ?? normalizedRequest.callId;
        const lockId = newId("lock");
        const lockExpiresAt = new Date(new Date(occurredAt).getTime() + (normalizedRequest.lockTtlMs ?? 60_000)).toISOString();
        const conflictingLocks = this.store
            .listActiveFileLocksForResource(pathCheck.normalizedPath, occurredAt)
            .filter((lock) => lock.ownerId !== ownerId);
        if (conflictingLocks.length > 0) {
            return this.failed(normalizedRequest, "tool.file_lock_conflict", `Write lock already held for ${pathCheck.normalizedPath}`, startedAtMs, true);
        }
        this.db.transaction(() => {
            this.store.lock.insertFileLock({
                id: lockId,
                taskId: normalizedRequest.taskId,
                executionId: normalizedRequest.executionId,
                lockScope: "workspace_path",
                resourcePath: pathCheck.normalizedPath,
                lockMode: "write",
                ownerId,
                expiresAt: lockExpiresAt,
                createdAt: occurredAt,
                updatedAt: occurredAt,
            });
        });
        try {
            const alreadyApplied = findAlreadyAppliedRange(originalContent, normalizedRequest);
            if (alreadyApplied != null) {
                const appliedRange = formatRange(originalContent, alreadyApplied.startOffset, alreadyApplied.endOffset);
                const diagnostics = this.collectDiagnostics(pathCheck.normalizedPath);
                return buildEditReplacementResult(normalizedRequest, "succeeded", `Edit already applied at ${appliedRange}.`, [], [...coercionWarnings, "edit_already_applied"], null, null, appliedRange, diagnostics, startedAtMs, null, `noop:${normalizedRequest.callId}`);
            }
            const evaluation = evaluateEditStages(originalContent, normalizedRequest);
            if (this.hasTimedOut(startedAtMs, timeoutMs)) {
                return this.timedOut(normalizedRequest, startedAtMs);
            }
            const warnings = [...coercionWarnings, ...evaluation.attempts.flatMap((attempt) => attempt.warningCodes)];
            const matchedAttempt = evaluation.attempts.find((attempt) => attempt.matched) ?? null;
            if (evaluation.errorCode != null || evaluation.matchedCandidate == null || matchedAttempt == null) {
                return this.failed(normalizedRequest, evaluation.errorCode ?? "tool.edit_target_not_found", evaluation.errorCode ?? "Unable to locate a unique edit target", startedAtMs, evaluation.errorCode === "tool.file_lock_conflict", evaluation.attempts, warnings, evaluation.similarityScore);
            }
            const replacement = matchedAttempt.attemptLevel === "indentation_normalized" ||
                matchedAttempt.attemptLevel === "fuzzy" ||
                matchedAttempt.attemptLevel === "context_anchored"
                ? reindentBlockToMatch(normalizedRequest.newString, evaluation.matchedCandidate.text)
                : normalizedRequest.newString;
            const normalizedReplacement = preserveTrailingNewline(replacement, evaluation.matchedCandidate.text);
            const updatedContent = `${originalContent.slice(0, evaluation.matchedCandidate.startOffset)}${normalizedReplacement}${originalContent.slice(evaluation.matchedCandidate.endOffset)}`;
            if (this.hasTimedOut(startedAtMs, timeoutMs)) {
                return this.timedOut(request, startedAtMs);
            }
            writeFileSync(pathCheck.normalizedPath, updatedContent, "utf8");
            const appliedRange = formatRange(originalContent, evaluation.matchedCandidate.startOffset, evaluation.matchedCandidate.endOffset);
            const diagnostics = this.collectDiagnostics(pathCheck.normalizedPath);
            return buildEditReplacementResult(normalizedRequest, "succeeded", [
                `Applied edit at ${appliedRange} using ${matchedAttempt.attemptLevel}.`,
                formatDiagnosticsFeedback(diagnostics),
            ].filter((part) => part != null).join("\n"), evaluation.attempts, warnings, matchedAttempt.attemptLevel, matchedAttempt.similarityScore, appliedRange, diagnostics, startedAtMs, null, `ok:${normalizedRequest.callId}`);
        }
        catch (error) {
            return this.failed(normalizedRequest, "tool.execution_failed", error instanceof Error ? error.message : String(error), startedAtMs);
        }
        finally {
            this.db.transaction(() => {
                this.store.lock.deleteFileLock(lockId);
            });
        }
    }
    executeBatch(request) {
        const startedAtMs = Date.now();
        const coercedRequest = coerceEditBatchRequest(request);
        const normalizedRequest = coercedRequest.value;
        const coercionWarnings = formatToolArgumentCoercionWarnings(coercedRequest.traces);
        const metadata = resolveToolExecutionMetadata(normalizedRequest.toolName);
        const timeoutMs = resolveToolTimeoutMs(normalizedRequest.timeoutMs, metadata);
        const execution = normalizedRequest.executionId == null ? null : this.store.execution.getExecution(normalizedRequest.executionId);
        const allowedToolsResolution = resolveExecutionAllowedTools({
            execution: execution ?? null,
            executionRequired: normalizedRequest.executionId != null,
        });
        if (allowedToolsResolution.errorCode != null) {
            return this.blockedBatch(normalizedRequest, allowedToolsResolution.errorCode, startedAtMs);
        }
        if (!isExecutionToolAllowed(normalizedRequest.toolName, allowedToolsResolution.allowedTools)) {
            return this.blockedBatch(normalizedRequest, "tool.tool_not_allowed", startedAtMs);
        }
        const allowedPathRootsResolution = resolveExecutionAllowedPathRoots({
            execution: execution ?? null,
            executionRequired: normalizedRequest.executionId != null,
            requestAllowedPathRoots: normalizedRequest.allowedPathRoots,
        });
        if (allowedPathRootsResolution.errorCode != null) {
            return this.blockedBatch(normalizedRequest, allowedPathRootsResolution.errorCode, startedAtMs);
        }
        const allowedPathRoots = allowedPathRootsResolution.allowedPathRoots;
        const pathCheck = checkSandboxPath(normalizedRequest.sandboxPolicy, normalizedRequest.filePath);
        if (!pathCheck.allowed) {
            return this.blockedBatch(normalizedRequest, "sandbox.write_path_denied", startedAtMs);
        }
        const scopeCheck = checkToolPathScope(pathCheck.normalizedPath, allowedPathRoots);
        if (!scopeCheck.allowed) {
            return this.blockedBatch(normalizedRequest, "tool.path_scope_write_denied", startedAtMs);
        }
        if (this.hasTimedOut(startedAtMs, timeoutMs)) {
            return this.timedOutBatch(normalizedRequest, startedAtMs);
        }
        let originalContent;
        try {
            originalContent = readFileSync(pathCheck.normalizedPath, "utf8");
        }
        catch (error) {
            return this.failedBatch(normalizedRequest, "tool.execution_failed", `Unable to read target file: ${error instanceof Error ? error.message : String(error)}`, startedAtMs);
        }
        if (originalContent.includes("\u0000")) {
            return this.blockedBatch(normalizedRequest, "tool.edit_binary_file_denied", startedAtMs);
        }
        if (normalizedRequest.edits.length === 0) {
            return this.failedBatch(normalizedRequest, "tool.edit_batch_empty", "edits must not be empty", startedAtMs);
        }
        if (this.hasTimedOut(startedAtMs, timeoutMs)) {
            return this.timedOutBatch(normalizedRequest, startedAtMs);
        }
        const occurredAt = normalizedRequest.occurredAt ?? nowIso();
        const ownerId = normalizedRequest.executionId ?? normalizedRequest.callId;
        const lockId = newId("lock");
        const lockExpiresAt = new Date(new Date(occurredAt).getTime() + (normalizedRequest.lockTtlMs ?? 60_000)).toISOString();
        const conflictingLocks = this.store
            .listActiveFileLocksForResource(pathCheck.normalizedPath, occurredAt)
            .filter((lock) => lock.ownerId !== ownerId);
        if (conflictingLocks.length > 0) {
            return this.failedBatch(normalizedRequest, "tool.file_lock_conflict", `Write lock already held for ${pathCheck.normalizedPath}`, startedAtMs, true);
        }
        this.db.transaction(() => {
            this.store.lock.insertFileLock({
                id: lockId,
                taskId: normalizedRequest.taskId,
                executionId: normalizedRequest.executionId,
                lockScope: "workspace_path",
                resourcePath: pathCheck.normalizedPath,
                lockMode: "write",
                ownerId,
                expiresAt: lockExpiresAt,
                createdAt: occurredAt,
                updatedAt: occurredAt,
            });
        });
        try {
            let workingContent = originalContent;
            const edits = [];
            for (const [index, edit] of normalizedRequest.edits.entries()) {
                if (this.hasTimedOut(startedAtMs, timeoutMs)) {
                    return this.timedOutBatch(normalizedRequest, startedAtMs, edits);
                }
                const prepared = this.prepareEdit(workingContent, edit, index);
                edits.push(prepared.item);
                if (prepared.item.status === "failed") {
                    return this.failedBatch(normalizedRequest, prepared.item.errorCode ?? "tool.edit_target_not_found", `Atomic edit batch stopped at item ${index + 1}`, startedAtMs, prepared.item.errorCode === "tool.file_lock_conflict", edits, true);
                }
                workingContent = prepared.updatedContent;
            }
            if (this.hasTimedOut(startedAtMs, timeoutMs)) {
                return this.timedOutBatch(normalizedRequest, startedAtMs, edits);
            }
            if (workingContent !== originalContent) {
                writeFileSync(pathCheck.normalizedPath, workingContent, "utf8");
            }
            const warnings = [...coercionWarnings, ...edits.flatMap((item) => item.warnings)];
            const appliedEditCount = edits.filter((item) => item.status === "applied").length;
            const alreadyAppliedCount = edits.filter((item) => item.status === "already_applied").length;
            const message = appliedEditCount === 0
                ? `Edit batch already applied for ${edits.length} edits.`
                : `Applied ${appliedEditCount} edits atomically${alreadyAppliedCount > 0 ? ` (${alreadyAppliedCount} already applied)` : ""}.`;
            const diagnostics = this.collectDiagnostics(pathCheck.normalizedPath);
            return buildEditBatchResult(normalizedRequest, "succeeded", [
                message,
                formatDiagnosticsFeedback(diagnostics),
            ].filter((part) => part != null).join("\n"), edits, warnings, appliedEditCount, false, diagnostics, startedAtMs, null, `ok:${normalizedRequest.callId}`);
        }
        catch (error) {
            return this.failedBatch(normalizedRequest, "tool.execution_failed", error instanceof Error ? error.message : String(error), startedAtMs);
        }
        finally {
            this.db.transaction(() => {
                this.store.lock.deleteFileLock(lockId);
            });
        }
    }
    prepareEdit(content, request, index = 0) {
        if (request.oldString.length === 0) {
            return {
                updatedContent: content,
                item: {
                    index,
                    status: "failed",
                    attempts: [],
                    warnings: [],
                    matchLevel: null,
                    similarityScore: null,
                    appliedRange: null,
                    errorCode: "tool.edit_target_not_found",
                },
            };
        }
        const alreadyApplied = findAlreadyAppliedRange(content, request);
        if (alreadyApplied != null) {
            return {
                updatedContent: content,
                item: {
                    index,
                    status: "already_applied",
                    attempts: [],
                    warnings: ["edit_already_applied"],
                    matchLevel: null,
                    similarityScore: null,
                    appliedRange: formatRange(content, alreadyApplied.startOffset, alreadyApplied.endOffset),
                    errorCode: null,
                },
            };
        }
        const evaluation = evaluateEditStages(content, request);
        const warnings = evaluation.attempts.flatMap((attempt) => attempt.warningCodes);
        const matchedAttempt = evaluation.attempts.find((attempt) => attempt.matched) ?? null;
        if (evaluation.errorCode != null || evaluation.matchedCandidate == null || matchedAttempt == null) {
            return {
                updatedContent: content,
                item: {
                    index,
                    status: "failed",
                    attempts: evaluation.attempts,
                    warnings,
                    matchLevel: null,
                    similarityScore: evaluation.similarityScore,
                    appliedRange: null,
                    errorCode: evaluation.errorCode ?? "tool.edit_target_not_found",
                },
            };
        }
        const replacement = matchedAttempt.attemptLevel === "indentation_normalized" ||
            matchedAttempt.attemptLevel === "fuzzy" ||
            matchedAttempt.attemptLevel === "context_anchored"
            ? reindentBlockToMatch(request.newString, evaluation.matchedCandidate.text)
            : request.newString;
        const normalizedReplacement = preserveTrailingNewline(replacement, evaluation.matchedCandidate.text);
        const updatedContent = `${content.slice(0, evaluation.matchedCandidate.startOffset)}${normalizedReplacement}${content.slice(evaluation.matchedCandidate.endOffset)}`;
        return {
            updatedContent,
            item: {
                index,
                status: "applied",
                attempts: evaluation.attempts,
                warnings,
                matchLevel: matchedAttempt.attemptLevel,
                similarityScore: matchedAttempt.similarityScore,
                appliedRange: formatRange(content, evaluation.matchedCandidate.startOffset, evaluation.matchedCandidate.endOffset),
                errorCode: null,
            },
        };
    }
    /**
     * Evaluates all matching stages in sequence, stopping at the first unique match
     * or when a stage produces multiple candidates (ambiguous).
     *
     * @param content - Current file content
     * @param request - Original edit request
     * @returns StageEvaluation with all attempts and final outcome
     */
    blocked(request, reasonCode, startedAtMs) {
        return buildEditReplacementResult(request, "blocked", `Edit replacement blocked: ${reasonCode}.`, [], [], null, null, null, null, startedAtMs, {
            code: reasonCode,
            message: reasonCode,
            retryable: false,
            source: "security",
        }, null);
    }
    timedOut(request, startedAtMs) {
        return buildEditReplacementResult(request, "timed_out", "Edit replacement timed out.", [], [], null, null, null, null, startedAtMs, {
            code: "tool.timeout",
            message: "Edit replacement timed out",
            retryable: true,
            source: "tool",
        }, null);
    }
    /**
     * Creates a failed result with error details.
     */
    failed(request, code, message, startedAtMs, retryable = false, attempts = [], warnings = [], similarityScore = null) {
        return buildEditReplacementResult(request, "failed", `Edit replacement failed: ${message}`, attempts, warnings, null, similarityScore, null, null, startedAtMs, {
            code,
            message,
            retryable,
            source: "tool",
        }, null);
    }
    blockedBatch(request, reasonCode, startedAtMs) {
        return buildEditBatchResult(request, "blocked", `Edit batch blocked: ${reasonCode}.`, [], [], 0, false, null, startedAtMs, {
            code: reasonCode,
            message: reasonCode,
            retryable: false,
            source: "security",
        }, null);
    }
    timedOutBatch(request, startedAtMs, edits = []) {
        return buildEditBatchResult(request, "timed_out", "Edit batch timed out.", edits, edits.flatMap((item) => item.warnings), edits.filter((item) => item.status === "applied").length, edits.some((item) => item.status === "applied"), null, startedAtMs, {
            code: "tool.timeout",
            message: "Edit batch timed out",
            retryable: true,
            source: "tool",
        }, null);
    }
    failedBatch(request, code, message, startedAtMs, retryable = false, edits = [], rolledBack = false) {
        return buildEditBatchResult(request, "failed", `Edit batch failed: ${message}`, edits, edits.flatMap((item) => item.warnings), edits.filter((item) => item.status === "applied").length, rolledBack, null, startedAtMs, {
            code,
            message,
            retryable,
            source: "tool",
        }, null);
    }
    hasTimedOut(startedAtMs, timeoutMs) {
        return Date.now() - startedAtMs >= timeoutMs;
    }
    collectDiagnostics(filePath) {
        return this.diagnosticsService.collectForFiles([filePath]);
    }
}
//# sourceMappingURL=edit-replacement-service.js.map