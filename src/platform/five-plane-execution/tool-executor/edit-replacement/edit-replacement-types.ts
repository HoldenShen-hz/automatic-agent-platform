import type { CodeDiagnosticsSummary } from "../code-diagnostics-service.js";
import type { SandboxPolicy } from "../../../control-plane/iam/sandbox-policy.js";
import type { ToolCallResult } from "../tool-call-result.js";

export type EditReplacementAttemptLevel =
  | "exact"
  | "whitespace_normalized"
  | "indentation_normalized"
  | "fuzzy"
  | "context_anchored";

export interface EditReplacementAttempt {
  attemptLevel: EditReplacementAttemptLevel;
  matched: boolean;
  candidateCount: number;
  similarityScore: number | null;
  warningCodes: string[];
  appliedRange: string | null;
}

export interface EditReplacementRequest {
  callId: string;
  taskId: string;
  executionId: string | null;
  traceId: string;
  toolName: string;
  sandboxPolicy: SandboxPolicy;
  allowedPathRoots?: readonly string[];
  filePath: string;
  oldString: string;
  newString: string;
  beforeAnchor?: string;
  afterAnchor?: string;
  occurredAt?: string;
  lockTtlMs?: number;
  timeoutMs?: number;
}

export interface EditInstruction {
  oldString: string;
  newString: string;
  beforeAnchor?: string;
  afterAnchor?: string;
}

export interface EditBatchRequest extends Omit<
  EditReplacementRequest,
  "toolName" | "oldString" | "newString" | "beforeAnchor" | "afterAnchor"
> {
  toolName: string;
  edits: readonly EditInstruction[];
}

export interface EditReplacementData {
  attempts: EditReplacementAttempt[];
  matchLevel: EditReplacementAttemptLevel | null;
  similarityScore: number | null;
  appliedRange: string | null;
}

export interface EditBatchItemResult {
  index: number;
  status: "applied" | "already_applied" | "failed";
  attempts: EditReplacementAttempt[];
  warnings: string[];
  matchLevel: EditReplacementAttemptLevel | null;
  similarityScore: number | null;
  appliedRange: string | null;
  errorCode: string | null;
}

export interface EditBatchData {
  edits: EditBatchItemResult[];
  appliedEditCount: number;
  rolledBack: boolean;
}

export interface EditReplacementMetadata {
  filePath: string;
  warnings: readonly string[];
  attemptCount: number;
  warningCount: number;
  diagnostics: CodeDiagnosticsSummary | null;
}

export interface EditBatchMetadata {
  filePath: string;
  warnings: readonly string[];
  attemptCount: number;
  warningCount: number;
  editCount: number;
  diagnostics: CodeDiagnosticsSummary | null;
}

export interface EditReplacementResult extends ToolCallResult<
  string | null,
  EditReplacementData,
  EditReplacementMetadata
> {
  attempts: EditReplacementAttempt[];
  warnings: string[];
  matchLevel: EditReplacementAttemptLevel | null;
  similarityScore: number | null;
  appliedRange: string | null;
}

export interface EditBatchResult extends ToolCallResult<
  string | null,
  EditBatchData,
  EditBatchMetadata
> {
  edits: EditBatchItemResult[];
  warnings: string[];
}

export interface MatchCandidate {
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface MatchOutcome {
  matched: boolean;
  candidateCount: number;
  candidate: MatchCandidate | null;
  similarityScore: number | null;
  warningCodes: string[];
  stopReason: "matched" | "multiple_candidates" | "not_found" | "similarity_too_low";
}

export interface StageEvaluation {
  attempts: EditReplacementAttempt[];
  matchedCandidate: MatchCandidate | null;
  errorCode: string | null;
  similarityScore: number | null;
}

export interface PreparedEdit {
  updatedContent: string;
  item: EditBatchItemResult;
}
