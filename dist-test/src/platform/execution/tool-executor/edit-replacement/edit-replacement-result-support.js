import { isToolCallSuccessful } from "../tool-call-result.js";
import { matchExact, offsetToLineColumn } from "./match.js";
export function buildAttempt(attemptLevel, outcome, content) {
    return {
        attemptLevel,
        matched: outcome.matched,
        candidateCount: outcome.candidateCount,
        similarityScore: outcome.similarityScore,
        warningCodes: outcome.warningCodes,
        appliedRange: outcome.candidate == null ? null : formatRange(content, outcome.candidate.startOffset, outcome.candidate.endOffset),
    };
}
export function findAlreadyAppliedRange(content, request) {
    if (request.oldString === request.newString || content.includes(request.oldString)) {
        return null;
    }
    const outcome = matchExact(content, request.newString);
    return outcome.candidateCount === 1 ? outcome.candidate : null;
}
export function formatRange(content, startOffset, endOffset) {
    const start = offsetToLineColumn(content, startOffset);
    const end = offsetToLineColumn(content, endOffset);
    return `L${start.line}:C${start.column}-L${end.line}:C${end.column}`;
}
export function buildEditReplacementResult(request, status, output, attempts, warnings, matchLevel, similarityScore, appliedRange, diagnostics, startedAtMs, error, executionReceipt) {
    const durationMs = Math.max(0, Date.now() - startedAtMs);
    return {
        callId: request.callId,
        toolName: request.toolName,
        status,
        success: isToolCallSuccessful(status),
        output,
        data: {
            attempts: attempts.map((attempt) => ({ ...attempt })),
            matchLevel,
            similarityScore,
            appliedRange,
        },
        metadata: {
            filePath: request.filePath,
            warnings: [...warnings],
            attemptCount: attempts.length,
            warningCount: warnings.length,
            diagnostics,
        },
        attempts,
        warnings,
        matchLevel,
        similarityScore,
        appliedRange,
        artifacts: [],
        durationMs,
        executionReceipt,
        error,
    };
}
export function buildEditBatchResult(request, status, output, edits, warnings, appliedEditCount, rolledBack, diagnostics, startedAtMs, error, executionReceipt) {
    const durationMs = Math.max(0, Date.now() - startedAtMs);
    const attemptCount = edits.reduce((sum, edit) => sum + edit.attempts.length, 0);
    return {
        callId: request.callId,
        toolName: request.toolName,
        status,
        success: isToolCallSuccessful(status),
        output,
        data: {
            edits: edits.map((edit) => ({
                ...edit,
                attempts: edit.attempts.map((attempt) => ({ ...attempt })),
                warnings: [...edit.warnings],
            })),
            appliedEditCount,
            rolledBack,
        },
        metadata: {
            filePath: request.filePath,
            warnings: [...warnings],
            attemptCount,
            warningCount: warnings.length,
            editCount: request.edits.length,
            diagnostics,
        },
        edits,
        warnings,
        artifacts: [],
        durationMs,
        executionReceipt,
        error,
    };
}
//# sourceMappingURL=edit-replacement-result-support.js.map