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

export const EXECUTION_CAPABILITY_BASELINES: readonly ExecutionCapabilityBaseline[] = Object.freeze([
  { capabilityId: "dispatcher", entryModule: "src/platform/execution/dispatcher/index.ts", description: "Tool dispatch and tool registry baselines.", baselineServices: ["executeToolCall"] },
  { capabilityId: "distributed-lock", entryModule: "src/platform/execution/distributed-lock/index.ts", description: "Distributed lock and fencing baselines.", baselineServices: ["DistributedLockService"] },
  { capabilityId: "execution-engine", entryModule: "src/platform/execution/execution-engine/index.ts", description: "Execution engine and model-driven task execution baselines.", baselineServices: ["AgentExecutor"] },
  { capabilityId: "ha", entryModule: "src/platform/execution/ha/index.ts", description: "HA coordinator, leader election, and lease reclaim baselines.", baselineServices: ["HaCoordinatorService"] },
  { capabilityId: "hot-upgrade", entryModule: "src/platform/execution/hot-upgrade/index.ts", description: "Hot upgrade planning and execution baselines.", baselineServices: ["HotUpgradeService"] },
  { capabilityId: "lease", entryModule: "src/platform/execution/lease/index.ts", description: "Execution lease, renewal, and expiration baselines.", baselineServices: ["ExecutionLeaseService"] },
  { capabilityId: "plugin-executor", entryModule: "src/platform/execution/plugin-executor/index.ts", description: "Plugin execution runtime baselines.", baselineServices: ["PluginExecutorService", "AdapterExecutor"] },
  { capabilityId: "queue", entryModule: "src/platform/execution/queue/index.ts", description: "Task queueing and durable enqueue baselines.", baselineServices: ["RedisQueueAdapter"] },
  { capabilityId: "recovery", entryModule: "src/platform/execution/recovery/index.ts", description: "Recovery, replay, and stuck-run resolution baselines.", baselineServices: ["RecoveryService"] },
  { capabilityId: "resource", entryModule: "src/platform/execution/resource/index.ts", description: "Runtime resource and process tracking baselines.", baselineServices: ["ProcessTrackerService"] },
  { capabilityId: "startup", entryModule: "src/platform/execution/startup/index.ts", description: "Startup preflight, shutdown, and process error handling baselines.", baselineServices: ["StartupPreflightService"] },
  { capabilityId: "state-transition", entryModule: "src/platform/execution/state-transition/index.ts", description: "Workflow and execution state transition baselines.", baselineServices: ["TransitionService"] },
  { capabilityId: "tool-executor", entryModule: "src/platform/execution/tool-executor/index.ts", description: "Tool execution and command mediation baselines.", baselineServices: ["CommandExecutor"] },
  { capabilityId: "worker-pool", entryModule: "src/platform/execution/worker-pool/index.ts", description: "Worker registration, handshake, writeback, and scheduling baselines.", baselineServices: ["WorkerRegistryService"] },
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
