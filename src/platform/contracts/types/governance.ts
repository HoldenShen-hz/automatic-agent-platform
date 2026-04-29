/**
 * Governance Contract Types
 *
 * Defines the inter-plane contract for model governance.
 * This allows sibling planes (Model Gateway, prompt-engine) to share
 * governance data without direct cross-layer coupling.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §15.3
 */

/**
 * Status of a model profile in the governance system.
 */
export type ModelGovernanceProfileStatus = "active" | "degraded" | "disabled";

/**
 * Snapshot of model governance state for all active profiles.
 *
 * This type is used by Model Gateway to check governance status
 * of profiles during routing decisions.
 */
export interface ModelGovernanceSnapshot {
  /**
   * Map of profile name to governance status.
   */
  readonly profileStatuses: Record<string, ModelGovernanceProfileStatus>;
  /**
   * Map of profile name to rollback target profile name.
   * null means no rollback target defined.
   */
  readonly rollbackTargets: Record<string, string | null>;
}

/**
 * Creates an empty governance snapshot with no profiles.
 */
export function createEmptyGovernanceSnapshot(): ModelGovernanceSnapshot {
  return {
    profileStatuses: {},
    rollbackTargets: {},
  };
}
