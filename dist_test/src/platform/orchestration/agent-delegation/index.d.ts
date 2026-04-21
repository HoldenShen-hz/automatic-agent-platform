/**
 * Agent Delegation - Public API
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
export type { AgentContext, PermissionSet, PermissionConstraints, DelegationSpec, DelegationResult, DelegationHandle, DelegationChain, DelegationChainNode, DelegationOptions, DelegationEvent, DelegationCreatedEvent, DelegationCompletedEvent, DelegationFailedEvent, DelegationStatus, } from "./delegation-types.js";
export { TopologyValidator, createTopologyValidator, DelegationDepthExceededError, DelegationFanoutExceededError, DelegationCycleDetectedError, DEFAULT_MAX_DEPTH, DEFAULT_MAX_FANOUT, type TopologyValidatorConfig, } from "./topology-validator.js";
export { DelegationManagerService, createDelegationManager } from "./delegation-manager.service.js";
export { ContextIsolator, createContextIsolator, IsolationLevel, type IsolatedContext, } from "./context-isolator.js";
export { DelegationTracker, createDelegationTracker, type DelegationTreeNode, type DelegationMetrics } from "./delegation-tracker.js";
export type { DelegationExpirationConfig, ExpirationScanResult } from "./delegation-manager.service.js";
