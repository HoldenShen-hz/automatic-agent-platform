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
// Deprecated types are accessible via executable-contracts or their source directories.

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