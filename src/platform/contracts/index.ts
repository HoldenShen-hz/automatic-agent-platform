// =============================================================================
// Platform Contracts - Barrel Export
// =============================================================================
// Canonical contracts are exported from executable-contracts/.
// Legacy/deprecated contracts are marked with @deprecated and should not be used.
//
// Export order: canonical first, then supporting, then deprecated.
// =============================================================================

// -----------------------------------------------------------------------------
// Canonical Contracts (executable-contracts) - USE THESE FIRST
// -----------------------------------------------------------------------------
export * as executableContracts from "./executable-contracts/index.js";

// -----------------------------------------------------------------------------
// Platform-Level Supporting Contracts
// -----------------------------------------------------------------------------
export * from "./constants/index.js";
export * from "./delegation-request/index.js";
export * from "./errors.js";
export * from "./model-request/index.js";
export * from "./projection-update/index.js";
export * from "./prompt-bundle/index.js";
export * from "./result-envelope/index.js";
export * from "./types/ids.js";
export * from "./types/anomaly-event-classification.js";
export * from "./types/recovery-cadence.js";
export * from "./types/status.js";
export * from "./types/unified-runtime-mode.js";
export * from "./types/unified-severity.js";

// -----------------------------------------------------------------------------
// Platform-Level Aggregated Contracts (re-exports canonical + platform types)
// -----------------------------------------------------------------------------
export {
  type PlatformPrincipal,
  type EvidenceRecord as PlatformEvidenceRecord,
  type ProjectionUpdate as PlatformProjectionUpdate,
  createPlatformPrincipal,
  createEvidenceRecord,
  createProjectionUpdate,
} from "./types/platform-contracts.js";

// Re-export canonical RequestEnvelope (from executable-contracts) as PlatformRequestEnvelope
export {
  type RequestEnvelope as PlatformRequestEnvelope,
} from "./executable-contracts/index.js";

// -----------------------------------------------------------------------------
// Evidence Record contracts
// -----------------------------------------------------------------------------
export * from "./evidence-record/index.js";

// -----------------------------------------------------------------------------
// Deprecated Contracts - DO NOT USE IN NEW CODE
// -----------------------------------------------------------------------------
// These are retained for backward compatibility only.

// Legacy request-envelope - deprecated, use executable-contracts RequestEnvelope
// NOTE: Only re-export the factory as deprecated alias; types come from executable-contracts
export {
  createRequestEnvelope as createLegacyRequestEnvelope,
} from "./request-envelope/index.js";

// Legacy control-directive (re-exported from platform-contracts for convenience)
export {
  type ControlDirectiveKind,
  type ControlDirective,
  createControlDirective,
} from "./types/platform-contracts.js";

// Legacy ExecutionPlan - deprecated, use PlanGraphBundle from executable-contracts
export {
  type ExecutionPlan,
  type ExecutionPlanStep,
  createExecutionPlan,
} from "./types/platform-contracts.js";

// Legacy ExecutionReceipt - deprecated, use NodeAttemptReceipt from executable-contracts
export {
  type ExecutionReceipt,
  type ExecutionReceiptStatus,
  createExecutionReceipt,
} from "./types/platform-contracts.js";

// -----------------------------------------------------------------------------
// LEGACY_CONTRACT_NAMES - for linting/deprecation enforcement
// -----------------------------------------------------------------------------
// These contracts are deprecated. New code should NOT import from these paths:
// - request-envelope/ (use executable-contracts RequestEnvelope)
// - control-directive/ (use OperationalDirective/DecisionDirective)
// - execution-plan/ (use PlanGraphBundle)
// - execution-receipt/ (use NodeAttemptReceipt)
// - state-command/ (use inter-plane commands from executable-contracts)
export const LEGACY_CONTRACT_NAMES = [
  "ExecutionPlan",
  "ExecutionReceipt",
  "ControlDirective",
  "StateCommand",
  "StateMutationCommand",
  "WorkflowStep",
  "StepOutput",
  "workflow_run",
] as const;