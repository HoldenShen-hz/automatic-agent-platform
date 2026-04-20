import type { CodeDiagnosticsSummary } from "../code-diagnostics-service.js";
import { isToolCallSuccessful } from "../tool-call-result.js";
import type {
  EditBatchItemResult,
  EditBatchRequest,
  EditBatchResult,
  EditInstruction,
  EditReplacementAttempt,
  EditReplacementAttemptLevel,
  EditReplacementRequest,
  EditReplacementResult,
  MatchCandidate,
  MatchOutcome,
} from "./edit-replacement-types.js";
import { matchExact, offsetToLineColumn } from "./match.js";

export function buildAttempt(
  attemptLevel: EditReplacementAttemptLevel,
  outcome: MatchOutcome,
  content: string,
): EditReplacementAttempt {
  return {
    attemptLevel,
    matched: outcome.matched,
    candidateCount: outcome.candidateCount,
    similarityScore: outcome.similarityScore,
    warningCodes: outcome.warningCodes,
    appliedRange: outcome.candidate == null ? null : formatRange(content, outcome.candidate.startOffset, outcome.candidate.endOffset),
  };
}

export function findAlreadyAppliedRange(content: string, request: EditInstruction): MatchCandidate | null {
  if (request.oldString === request.newString || content.includes(request.oldString)) {
    return null;
  }
  const outcome = matchExact(content, request.newString);
  return outcome.candidateCount === 1 ? outcome.candidate : null;
}

export function formatRange(content: string, startOffset: number, endOffset: number): string {
  const start = offsetToLineColumn(content, startOffset);
  const end = offsetToLineColumn(content, endOffset);
  return `L${start.line}:C${start.column}-L${end.line}:C${end.column}`;
}

export function buildEditReplacementResult(
  request: EditReplacementRequest,
  status: EditReplacementResult["status"],
  output: string | null,
  attempts: EditReplacementAttempt[],
  warnings: string[],
  matchLevel: EditReplacementAttemptLevel | null,
  similarityScore: number | null,
  appliedRange: string | null,
  diagnostics: CodeDiagnosticsSummary | null,
  startedAtMs: number,
  error: EditReplacementResult["error"],
  executionReceipt: string | null,
): EditReplacementResult {
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

export function buildEditBatchResult(
  request: EditBatchRequest,
  status: EditBatchResult["status"],
  output: string | null,
  edits: EditBatchItemResult[],
  warnings: string[],
  appliedEditCount: number,
  rolledBack: boolean,
  diagnostics: CodeDiagnosticsSummary | null,
  startedAtMs: number,
  error: EditBatchResult["error"],
  executionReceipt: string | null,
): EditBatchResult {
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
