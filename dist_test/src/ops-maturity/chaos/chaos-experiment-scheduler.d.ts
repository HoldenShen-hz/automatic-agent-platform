/**
 * @fileoverview Chaos Engineering Experiment Scheduler
 *
 * Provides:
 * - Experiment scheduling and lifecycle management
 * - Steady-state hypothesis validation
 * - Automated experiment termination on violation
 * - Experiment result classification (success/failure/inconclusive)
 *
 * §68 混沌工程 - 实验调度 + 自动化稳态验证
 */
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
export interface ChaosExperiment {
    experimentId: string;
    name: string;
    description: string;
    target: ExperimentTarget;
    fault: FaultInjection;
    steadyStateHypotheses: readonly SteadyStateHypothesis[];
    status: "scheduled" | "running" | "completed" | "cancelled" | "violated";
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    maxDurationMs: number;
    results: readonly ExperimentResult[];
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
}
export declare class ChaosExperimentScheduler {
    private readonly experiments;
    private readonly steadyStateCache;
    scheduleExperiment(input: ExperimentScheduleInput): ChaosExperiment;
    startExperiment(experimentId: string): boolean;
    recordSteadyStateResult(experimentId: string, hypothesisName: string, measuredValue: number | null, passed: boolean, message: string): void;
    injectFault(experimentId: string): FaultInjection | null;
    autoTerminateIfNeeded(experimentId: string): boolean;
    validateSteadyState(metricName: string, currentValue: number, hypothesis: SteadyStateHypothesis): boolean;
    getExperiment(experimentId: string): ChaosExperiment | null;
    listExperiments(status?: ChaosExperiment["status"]): ChaosExperiment[];
    cancelExperiment(experimentId: string): boolean;
}
