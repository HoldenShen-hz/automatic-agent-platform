/**
 * Boundary control configuration for chaos experiments.
 * Limits the blast radius and ensures safe experimentation.
 * §R14-09: Boundary control for chaos experiments.
 */
export interface BoundaryControl {
  maxAffectedInstances: number;
  maxAffectedPercent: number;
  allowedTargets: readonly string[];
  blockedTargets: readonly string[];
  abortOnThreshold: boolean;
  autoRollbackOnViolation: boolean;
  rollbackTimeoutMs: number;
}

/**
 * Rollback action for a violated experiment.
 * §R14-09: Rollback automation for chaos experiments.
 */
export interface RollbackAction {
  actionId: string;
  experimentId: string;
  actionType: "stop_fault" | "restore_state" | "notify" | "complete";
  status: "pending" | "executing" | "completed" | "failed";
  executedAt: string | null;
  completedAt: string | null;
  result: string | null;
}

export const DEFAULT_BOUNDARY_CONTROL: BoundaryControl = {
  maxAffectedInstances: 1,
  maxAffectedPercent: 5,
  allowedTargets: [],
  blockedTargets: ["production", "primary", "master"],
  abortOnThreshold: true,
  autoRollbackOnViolation: true,
  rollbackTimeoutMs: 30000,
};

export interface ChaosArchitectureAnchor {
  readonly contractRef: string;
  readonly adrRef: string;
  readonly architectureRef: string;
}

export const CHAOS_ARCHITECTURE_ANCHORS: ChaosArchitectureAnchor = {
  contractRef: "docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md",
  adrRef: "docs_zh/adr/089-ai-operations-governance-and-quality.md",
  architectureRef: "docs_zh/architecture/02-code-architecture-reference.md",
};

export interface ChaosScenarioCatalogEntry {
  readonly scenarioId: string;
  readonly manifestPath: string;
  readonly fallbackProfileId: string;
  readonly faultType: FaultInjection["faultType"];
}

export interface ChaosFallbackProfile {
  readonly profileId: string;
  readonly faultType: FaultInjection["faultType"];
  readonly intensity: number;
  readonly durationMs: number;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface SteadyStateHypothesis {
  name: string;
  metricName: string;
  tolerance: number;
  operator: "lt" | "gt" | "eq" | "ne" | "lte" | "gte";
}

export interface ExperimentTarget {
  targetKind: "service" | "node" | "network" | "database";
  targetId: string;
  labels: Readonly<Record<string, string>>;
}

export interface FaultInjection {
  faultType: "latency" | "error" | "timeout" | "packet_loss" | "cpu_load" | "memory_pressure";
  intensity: number;
  durationMs: number;
  parameters: Readonly<Record<string, unknown>>;
}

export const DEFAULT_CHAOS_FALLBACK_PROFILES: readonly ChaosFallbackProfile[] = [
  {
    profileId: "network-delay-fallback",
    faultType: "latency",
    intensity: 0.5,
    durationMs: 120000,
    parameters: { latencyMs: 500, jitterMs: 100 },
  },
  {
    profileId: "pod-kill-fallback",
    faultType: "error",
    intensity: 1,
    durationMs: 30000,
    parameters: { mode: "one" },
  },
  {
    profileId: "postgres-disconnect-fallback",
    faultType: "timeout",
    intensity: 1,
    durationMs: 60000,
    parameters: { target: "postgres" },
  },
  {
    profileId: "redis-disconnect-fallback",
    faultType: "timeout",
    intensity: 1,
    durationMs: 60000,
    parameters: { target: "redis" },
  },
] as const;

export const DEFAULT_CHAOS_SCENARIO_CATALOG: readonly ChaosScenarioCatalogEntry[] = [
  {
    scenarioId: "network-delay",
    manifestPath: "deploy/chaos/network-delay.yaml",
    fallbackProfileId: "network-delay-fallback",
    faultType: "latency",
  },
  {
    scenarioId: "pod-kill",
    manifestPath: "deploy/chaos/pod-kill.yaml",
    fallbackProfileId: "pod-kill-fallback",
    faultType: "error",
  },
  {
    scenarioId: "postgres-disconnect",
    manifestPath: "deploy/chaos/postgres-disconnect.yaml",
    fallbackProfileId: "postgres-disconnect-fallback",
    faultType: "timeout",
  },
  {
    scenarioId: "redis-disconnect",
    manifestPath: "deploy/chaos/redis-disconnect.yaml",
    fallbackProfileId: "redis-disconnect-fallback",
    faultType: "timeout",
  },
] as const;

export interface ChaosExperiment {
  experimentId: string;
  name: string;
  description: string;
  target: ExperimentTarget;
  fault: FaultInjection;
  steadyStateHypotheses: readonly SteadyStateHypothesis[];
  status: "scheduled" | "running" | "completed" | "cancelled" | "violated" | "rollback";
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  maxDurationMs: number;
  results: readonly ExperimentResult[];
  boundaryControl: BoundaryControl;
  rollbackActions: readonly RollbackAction[];
  violationDetectedAt: string | null;
  faultInjectedAt: string | null;
  faultExecutionStatus: "idle" | "applied" | "failed";
  faultExecutionMessage: string | null;
}

export interface ExperimentResult {
  timestamp: string;
  steadyStateName: string;
  passed: boolean;
  measuredValue: number | null;
  tolerance: number;
  message: string;
}

export interface ExperimentScheduleInput {
  name: string;
  description: string;
  target: ExperimentTarget;
  fault: FaultInjection;
  steadyStateHypotheses: readonly SteadyStateHypothesis[];
  scheduledAt: string;
  maxDurationMs: number;
  boundaryControl?: Partial<BoundaryControl>;
}

export interface GameDayScheduleInput {
  name: string;
  scheduledAt: string;
  experiments: readonly ExperimentScheduleInput[];
}

export interface PanicDrillReport {
  readonly drillId: string;
  readonly gameDayId: string;
  readonly ingress_block_time_ms: number | null;
  readonly execution_quiescence_time_ms: number | null;
  readonly plane_ack_success_rate: number | null;
  readonly planesContacted: readonly string[];
  readonly planesAcknowledged: readonly string[];
  readonly generatedAt: string;
}

export interface ChaosGameDay {
  gameDayId: string;
  name: string;
  scheduledAt: string;
  experimentIds: readonly string[];
  status: "scheduled" | "running" | "completed" | "violated";
  startedAt: string | null;
  completedAt: string | null;
}

export interface ChaosExperimentSchedulerSnapshot {
  readonly experiments: readonly ChaosExperiment[];
  readonly steadyStateMetrics: readonly { key: string; value: number; timestamp: number }[];
  readonly gameDays: readonly ChaosGameDay[];
  readonly rollbackQueues: readonly { experimentId: string; actions: readonly RollbackAction[] }[];
}

export interface ChaosExperimentSchedulerRepository {
  loadSnapshot(): ChaosExperimentSchedulerSnapshot | null;
  saveSnapshot(snapshot: ChaosExperimentSchedulerSnapshot): void;
}

export class InMemoryChaosExperimentSchedulerRepository implements ChaosExperimentSchedulerRepository {
  private snapshot: ChaosExperimentSchedulerSnapshot | null = null;

  public loadSnapshot(): ChaosExperimentSchedulerSnapshot | null {
    return this.snapshot;
  }

  public saveSnapshot(snapshot: ChaosExperimentSchedulerSnapshot): void {
    this.snapshot = snapshot;
  }
}

export interface ChaosFaultInjectionResult {
  readonly applied: boolean;
  readonly message: string;
  readonly faultType?: FaultInjection["faultType"];
  readonly intensity?: number;
  readonly durationMs?: number;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export type ChaosFaultExecutor = (params: {
  readonly experiment: ChaosExperiment;
  readonly fault: FaultInjection;
}) => ChaosFaultInjectionResult;

export type ChaosRollbackActionExecutor = (params: {
  readonly experiment: ChaosExperiment;
  readonly action: RollbackAction;
  readonly signal: AbortSignal;
}) => Promise<string> | string;

export interface ChaosExperimentSchedulerOptions {
  readonly repository?: ChaosExperimentSchedulerRepository;
  readonly faultExecutor?: ChaosFaultExecutor;
  readonly rollbackActionExecutor?: ChaosRollbackActionExecutor;
}
