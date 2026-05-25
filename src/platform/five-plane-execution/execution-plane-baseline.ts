export type ExecutionCapabilityId =
  | "dispatcher"
  | "distributed-lock"
  | "execution-engine"
  | "ha"
  | "hot-upgrade"
  | "lease"
  | "plugin-executor"
  | "queue"
  | "recovery"
  | "resource"
  | "startup"
  | "state-transition"
  | "tool-executor"
  | "worker-pool";

export interface ExecutionCapabilityBaseline {
  readonly capabilityId: ExecutionCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

function freezeExecutionBaseline(
  baseline: ExecutionCapabilityBaseline,
): ExecutionCapabilityBaseline {
  return Object.freeze({
    ...baseline,
    baselineServices: Object.freeze([...baseline.baselineServices]),
  });
}

export const EXECUTION_CAPABILITY_BASELINES: readonly ExecutionCapabilityBaseline[] = Object.freeze([
  freezeExecutionBaseline({ capabilityId: "dispatcher", entryModule: "src/platform/five-plane-execution/dispatcher/index.ts", description: "Tool dispatch and tool registry baselines.", baselineServices: ["executeToolCall"] }),
  freezeExecutionBaseline({ capabilityId: "distributed-lock", entryModule: "src/platform/five-plane-execution/distributed-lock/index.ts", description: "Distributed lock and fencing baselines.", baselineServices: ["createLockAdapter"] }),
  freezeExecutionBaseline({ capabilityId: "execution-engine", entryModule: "src/platform/five-plane-execution/execution-engine/index.ts", description: "Execution engine and model-driven task execution baselines.", baselineServices: ["AgentExecutor"] }),
  freezeExecutionBaseline({ capabilityId: "ha", entryModule: "src/platform/five-plane-execution/ha/index.ts", description: "HA coordinator, leader election, and lease reclaim baselines.", baselineServices: ["HaCoordinatorService"] }),
  freezeExecutionBaseline({ capabilityId: "hot-upgrade", entryModule: "src/platform/five-plane-execution/hot-upgrade/index.ts", description: "Hot upgrade planning and execution baselines.", baselineServices: ["HotUpgradeService"] }),
  freezeExecutionBaseline({ capabilityId: "lease", entryModule: "src/platform/five-plane-execution/lease/index.ts", description: "Execution lease, renewal, and expiration baselines.", baselineServices: ["ExecutionLeaseService"] }),
  freezeExecutionBaseline({ capabilityId: "plugin-executor", entryModule: "src/platform/five-plane-execution/plugin-executor/index.ts", description: "Plugin execution runtime baselines.", baselineServices: ["PluginExecutorService", "AdapterExecutor", "BrowserExecutor", "HumanWaitExecutor", "SubWorkflowExecutor"] }),
  freezeExecutionBaseline({ capabilityId: "queue", entryModule: "src/platform/five-plane-execution/queue/index.ts", description: "Task queueing and durable enqueue baselines.", baselineServices: ["RedisQueueAdapter"] }),
  freezeExecutionBaseline({ capabilityId: "recovery", entryModule: "src/platform/five-plane-execution/recovery/index.ts", description: "Recovery, replay, and stuck-run resolution baselines.", baselineServices: ["RuntimeRecoveryService"] }),
  freezeExecutionBaseline({ capabilityId: "resource", entryModule: "src/platform/five-plane-execution/resource/index.ts", description: "Runtime resource and process tracking baselines.", baselineServices: ["ProcessTracker"] }),
  freezeExecutionBaseline({ capabilityId: "startup", entryModule: "src/platform/five-plane-execution/startup/index.ts", description: "Startup preflight, shutdown, and process error handling baselines.", baselineServices: ["StartupConsistencyChecker"] }),
  freezeExecutionBaseline({ capabilityId: "state-transition", entryModule: "src/platform/five-plane-execution/state-transition/index.ts", description: "Workflow and execution state transition baselines.", baselineServices: ["TransitionService"] }),
  freezeExecutionBaseline({ capabilityId: "tool-executor", entryModule: "src/platform/five-plane-execution/tool-executor/index.ts", description: "Tool execution and command mediation baselines.", baselineServices: ["CommandExecutor", "ToolExecutor"] }),
  freezeExecutionBaseline({ capabilityId: "worker-pool", entryModule: "src/platform/five-plane-execution/worker-pool/index.ts", description: "Worker registration, handshake, writeback, and scheduling baselines.", baselineServices: ["WorkerRegistryService"] }),
]);

export function listExecutionCapabilityBaselines(): readonly ExecutionCapabilityBaseline[] {
  return EXECUTION_CAPABILITY_BASELINES;
}

export function resolveExecutionCapabilityBaseline(capabilityId: ExecutionCapabilityId): ExecutionCapabilityBaseline {
  const baseline = EXECUTION_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`execution_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
