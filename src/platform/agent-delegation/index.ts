/**
 * Agent Delegation Module
 *
 * Manages delegation of tasks and authority between agents.
 *
 * ## Overview
 *
 * This module wraps the agent delegation services located in `orchestration/agent-delegation/`
 * to provide a dedicated namespace per the platform architecture.
 *
 * ## Contents
 *
 * - DelegationManager: Manages delegation lifecycle
 * - DelegationTracker: Tracks delegation state and history
 * - DelegationContextIsolator: Provides isolated context for delegated operations
 * - TopologyValidator: Validates delegation topology constraints
 *
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

// Re-export all types and services from orchestration/agent-delegation
export {
  DelegationManagerService,
  type DelegationExpirationConfig,
  type ExpirationScanResult,
} from "../orchestration/agent-delegation/delegation-manager.service.js";
export { createDelegationManager } from "../orchestration/agent-delegation/delegation-manager.service.js";

export {
  DelegationTracker,
  type DelegationTreeNode,
  type DelegationMetrics,
} from "../orchestration/agent-delegation/delegation-tracker.js";
export { createDelegationTracker } from "../orchestration/agent-delegation/delegation-tracker.js";

export {
  ContextIsolator,
  type IsolatedContext,
} from "../orchestration/agent-delegation/context-isolator.js";
export { createContextIsolator } from "../orchestration/agent-delegation/context-isolator.js";

export {
  TopologyValidator,
  type TopologyValidatorConfig,
} from "../orchestration/agent-delegation/topology-validator.js";
export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
} from "../orchestration/agent-delegation/topology-validator.js";

export type {
  AgentContext,
  PermissionSet,
  PermissionConstraints,
  DelegationSpec,
  DelegationResult,
  DelegationStatus,
  DelegationHandle,
  DelegationChainNode,
  DelegationChain,
  DelegationCreatedEvent,
  DelegationCompletedEvent,
  DelegationFailedEvent,
  DelegationEvent,
  DelegationOptions,
} from "../orchestration/agent-delegation/delegation-types.js";
