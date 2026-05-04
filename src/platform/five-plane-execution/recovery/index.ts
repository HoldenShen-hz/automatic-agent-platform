/**
 * Reliability Module (ADR-073)
 *
 * Provides weak model reliability through structured task definition,
 * failure classification, repair pipelines, and escalation handling.
 */

// Export specific types to avoid name conflicts
// ValidationDecision is exported from both validation-report.ts and validation-repair-loop.ts with different types
export type { ReviewVerdict, ReviewIssueSeverity, ReviewReport, ReviewIssue } from './review-report.js';
export { createReviewReport, hasBlockingIssues, getBlockingIssueCount, getCriticalIssueCount } from './review-report.js';

// validation-report.ts exports ValidationDecision as a union type: 'pass' | 'fail' | 'warning'
export type { ValidationReport, CheckResult, CheckError } from './validation-report.js';
export { createValidationReport, hasFailedRequiredChecks, getFailedCheckCount } from './validation-report.js';
export type { ValidationDecision as ValidationReportDecision } from './validation-report.js';

// validation-repair-loop.ts exports ValidationDecision as an interface
export type {
  ValidationLoopStage,
  ValidationFailureRecord,
  RepairEvidencePackage,
  ValidationLoopInput,
  ValidationDecision as ValidationLoopDecision,
} from './validation-repair-loop.js';
export { ValidationRepairLoopService } from './validation-repair-loop.js';

export * from './task-card.js';
export * from './patch-bundle.js';
export * from './release-record.js';
export * from './failure-classification.js';
export * from './repair-pipeline.js';
export * from './exception-recovery-types.js';
export * from './exception-recovery-config-loader.js';
export * from './stalled-execution-detector.js';
export * from './stalled-execution-escalation-service.js';
export * from './workflow-crash-simulator.js';
export * from './replay-boundary-guard.js';
export * from './resume-compatibility-check.js';

// R25-1 through R25-14: Export all runtime recovery service classes
export {
  RuntimeRecoveryService,
  type RuntimeRecoveryCandidate,
  type RecoverySuggestedAction,
  type RecoveryExecutionResult,
  type TaskRuntimeRecoveryView,
  type DivisionRecoveryOverview,
} from './runtime-recovery-service.js';

export {
  RuntimeRecoveryDecisionService,
  type RecoveryDecisionRecord,
  type RecoveryDecisionApplyResult,
} from './runtime-recovery-decision-service.js';

export {
  RuntimeRepairService,
  type RepairExecutionResult,
} from './runtime-repair-service.js';

export {
  RuntimeRecoveryReplayService,
  type RecoveryReplayExecutionOutcome,
  type RecoveryReplayTaskOutcome,
  type ExecutionRecoveryReplayReport,
  type TaskRecoveryReplayReport,
} from './runtime-recovery-replay-service.js';

export { ExecutionDbQueueDisconnectRepairService } from './execution-db-queue-disconnect-repair-service.js';

export type { RecoveryCadence, RecoveryReportError, RecoveryReport, RecoveryWorker } from "../../contracts/types/recovery-cadence.js";
export { buildRecoveryCadence } from "../../contracts/types/recovery-cadence.js";
