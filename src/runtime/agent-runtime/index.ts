/**
 * Agent Runtime
 *
 * This module re-exports agent runtime components from the five-plane execution engine.
 * It provides the core agent runtime lifecycle, execution, and state management APIs.
 */

// Re-export all agent runtime components from platform execution engine
export * from "../../platform/five-plane-execution/execution-engine/middleware-init.js";
export * from "../../platform/five-plane-execution/execution-engine/model-call-provider.js";
export * from "../../platform/five-plane-execution/execution-engine/session-lifecycle.js";
export * from "../../platform/five-plane-execution/execution-engine/context-compaction-service.js";
export * from "../../platform/five-plane-execution/execution-engine/agent-executor.js";
export * from "../../platform/five-plane-execution/execution-engine/agent-middleware-chain.js";
export * from "../../platform/five-plane-execution/execution-engine/single-task-execution.js";

// Types
export type {
  LlmModelCallRequest,
  LlmModelCallResult,
  ModelCallProviderConfig,
} from "../../platform/five-plane-execution/execution-engine/model-call-provider.js";

export type {
  ContextCompactionOptions,
  ContextCompactionResult,
  CompactedContextMessage,
} from "../../platform/five-plane-execution/execution-engine/context-compaction-service.js";

export type {
  SessionTerminalStatus,
  TaskActiveStatus,
} from "../../platform/five-plane-execution/execution-engine/session-lifecycle.js";
