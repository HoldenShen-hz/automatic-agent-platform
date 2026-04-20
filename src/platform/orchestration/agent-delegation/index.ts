/**
 * Agent Delegation - Public API
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */

// Re-export types
export type {
  AgentContext,
  PermissionSet,
  PermissionConstraints,
  DelegationSpec,
  DelegationResult,
  DelegationHandle,
  DelegationChain,
  DelegationChainNode,
  DelegationOptions,
  DelegationEvent,
  DelegationCreatedEvent,
  DelegationCompletedEvent,
  DelegationFailedEvent,
  DelegationStatus,
} from "./delegation-types.js";

// Re-export topology validator
export {
  TopologyValidator,
  createTopologyValidator,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
  type TopologyValidatorConfig,
} from "./topology-validator.js";

// Re-export delegation manager
export { DelegationManagerService, createDelegationManager } from "./delegation-manager.service.js";

// Re-export context isolator
export {
  ContextIsolator,
  createContextIsolator,
  IsolationLevel,
  type IsolatedContext,
} from "./context-isolator.js";

// Re-export delegation tracker
export { DelegationTracker, createDelegationTracker, type DelegationTreeNode, type DelegationMetrics } from "./delegation-tracker.js";

// Re-export delegation manager types
export type { DelegationExpirationConfig, ExpirationScanResult } from "./delegation-manager.service.js";
