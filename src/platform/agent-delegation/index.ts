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
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

// Re-export all types and services from orchestration/agent-delegation
export {
  DelegationManagerService,
  type DelegationExpirationConfig,
  type ExpirationScanResult,
} from "../five-plane-orchestration/agent-delegation/delegation-manager.service.js";
export { createDelegationManager } from "../five-plane-orchestration/agent-delegation/delegation-manager-factory.js";

export {
  DelegationTracker,
  type DelegationTreeNode,
  type DelegationMetrics,
} from "../five-plane-orchestration/agent-delegation/delegation-tracker.js";
export { createDelegationTracker } from "../five-plane-orchestration/agent-delegation/delegation-tracker.js";

export {
  ContextIsolator,
  createContextIsolator,
  IsolationLevel,
  type IsolatedContext,
} from "../five-plane-orchestration/agent-delegation/context-isolator.js";

export {
  TopologyValidator,
  createTopologyValidator,
  type TopologyValidatorConfig,
} from "../five-plane-orchestration/agent-delegation/topology-validator.js";
export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
} from "../five-plane-orchestration/agent-delegation/topology-validator.js";

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
} from "../five-plane-orchestration/agent-delegation/delegation-types.js";
