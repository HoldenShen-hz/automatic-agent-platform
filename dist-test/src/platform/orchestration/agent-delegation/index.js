/**
 * Agent Delegation - Public API
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
// Re-export topology validator
export { TopologyValidator, createTopologyValidator, DelegationDepthExceededError, DelegationFanoutExceededError, DelegationCycleDetectedError, DEFAULT_MAX_DEPTH, DEFAULT_MAX_FANOUT, } from "./topology-validator.js";
// Re-export delegation manager
export { DelegationManagerService, createDelegationManager } from "./delegation-manager.service.js";
// Re-export context isolator
export { ContextIsolator, createContextIsolator, IsolationLevel, } from "./context-isolator.js";
// Re-export delegation tracker
export { DelegationTracker, createDelegationTracker } from "./delegation-tracker.js";
export * from "./collaboration-protocol/index.js";
//# sourceMappingURL=index.js.map