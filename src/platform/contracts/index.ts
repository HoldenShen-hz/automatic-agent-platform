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
// R13-33: Export ResponsibilityBoundary types per §3.2 ResponsibilityBoundary spec
export * from "./types/responsibility-boundary.js";

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

// Re-export CANONICAL_CONTRACT_NAMES for direct access (tests expect this)
export {
  CANONICAL_CONTRACT_NAMES,
  type CanonicalContractName,
} from "./executable-contracts/index.js";

// R7-44 FIX: Re-export ContractEnvelope signature verification for inter-plane contract validation
export {
  type ContractEnvelope,
  type ContractEnvelopeVerificationResult,
  createContractEnvelope,
  verifyContractEnvelopeSignature,
  signContractEnvelope,
} from "./executable-contracts/index.js";

// R7-44 FIX: Inter-plane Contract Gateway with signature verification
// R7-45 FIX: Bulkhead isolation pattern for plane-to-plane communication
export {
  type InterPlaneGatewayConfig,
  type InterPlaneSendResult,
  type InterPlaneReceiveResult,
  type PlaneName,
  type InterPlaneMessageType,
  InterPlaneContractGateway,
  createInterPlaneGateway,
} from "./inter-plane-contract-gateway.js";

// emitDeprecationWarning and assertNotDeprecated are defined in this file below
// and provide runtime enforcement for LEGACY_CONTRACT_NAMES usage

// -----------------------------------------------------------------------------
// Evidence Record contracts
// -----------------------------------------------------------------------------
export * from "./evidence-record/index.js";

// =============================================================================
// Deprecated Contracts - DO NOT USE IN NEW CODE
// =============================================================================
// These are retained for backward compatibility only.
// Canonical types are exported from executable-contracts/ or their source directories.
//
// DEPRECATED SECTION - these exports come AFTER canonical types to discourage use
// -----------------------------------------------------------------------------

/**
 * @deprecated Use RequestEnvelope from executable-contracts (canonical per §5.3).
 * This namespace is retained for backward compatibility only.
 */
export * as requestEnvelopeContract from "./request-envelope/index.js";

// =============================================================================
// LEGACY_CONTRACT_NAMES - centralized enforcement (R4-11)
// =============================================================================
// These contracts are deprecated. New code should NOT import from these paths:
// - request-envelope/ (use RequestEnvelope from executable-contracts)
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

export type LegacyContractName = (typeof LEGACY_CONTRACT_NAMES)[number];

/**
 * Emits a console warning if a deprecated contract name is detected.
 * Use this in migration scripts or CI to detect usage of deprecated contracts.
 *
 * @param contractName - The contract name to check
 * @param importPath - The path where the contract was imported from (for error reporting)
 * @returns true if the contract is deprecated (warning was emitted)
 */
export function emitDeprecationWarning(contractName: string, importPath?: string): boolean {
  if (LEGACY_CONTRACT_NAMES.includes(contractName as LegacyContractName)) {
    const pathSuffix = importPath ? ` imported from "${importPath}"` : "";
    console.warn(
      `[DEPRECATION WARNING] "${contractName}"${pathSuffix} is a deprecated contract. ` +
      `Migrate to canonical executable-contracts per §4 and §5.3. ` +
      `See LEGACY_CONTRACT_NAMES in platform/contracts/index.ts for the full list.`,
    );
    return true;
  }
  return false;
}

/**
 * Validates that a contract name is not in the deprecated list.
 * Use in factory functions or constructors to fail fast on deprecated usage.
 *
 * @param contractName - The contract name to validate
 * @throws Error if the contract is deprecated
 */
export function assertNotDeprecated(contractName: string): void {
  if (LEGACY_CONTRACT_NAMES.includes(contractName as LegacyContractName)) {
    throw new Error(
      `Contract "${contractName}" is deprecated per §4 and §5.3. ` +
      `Use canonical executable-contracts instead. ` +
      `See LEGACY_CONTRACT_NAMES in platform/contracts/index.ts.`,
    );
  }
}