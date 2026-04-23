/**
 * @fileoverview Chaos Engineering Experiment Scheduler
 *
 * Provides:
 * - Experiment scheduling and lifecycle management
 * - Steady-state hypothesis validation
 * - Automated experiment termination on violation
 * - Experiment result classification (success/failure/inconclusive)
 *
 * §68 Chaos Engineering - Experiment Scheduling + Automated Steady-State Validation
 *
 * §66 GameDay Orchestrator (P2 Enhancement for Phase 3):
 * Current scheduleGameDay() / startGameDay() / refreshGameDayStatus() implement basic scheduling skeleton.
 * To implement complete GameDay orchestration capability, the following are needed: real fault injection
 * execution, integration with monitoring system for steady-state validation, multi-experiment parallel
 * orchestration, and GameDay report generation. Currently ChaosExperimentScheduler lacks integration
 * with external fault injection systems and real steady-state validation pipeline.
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
export interface GameDayScheduleInput {
    name: string;
    scheduledAt: string;
    experiments: readonly ExperimentScheduleInput[];
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
export declare class ChaosExperimentScheduler {
    private readonly experiments;
    private readonly steadyStateCache;
    private readonly gameDays;
    scheduleExperiment(input: ExperimentScheduleInput): ChaosExperiment;
    startExperiment(experimentId: string): boolean;
    recordSteadyStateResult(experimentId: string, hypothesisName: string, measuredValue: number | null, passed: boolean, message: string): void;
    injectFault(experimentId: string): FaultInjection | null;
    autoTerminateIfNeeded(experimentId: string): boolean;
    validateSteadyState(metricName: string, currentValue: number, hypothesis: SteadyStateHypothesis): boolean;
    getExperiment(experimentId: string): ChaosExperiment | null;
    listExperiments(status?: ChaosExperiment["status"]): ChaosExperiment[];
    cancelExperiment(experimentId: string): boolean;
    scheduleGameDay(input: GameDayScheduleInput): ChaosGameDay;
    startGameDay(gameDayId: string): boolean;
    refreshGameDayStatus(gameDayId: string): ChaosGameDay | null;
    getGameDay(gameDayId: string): ChaosGameDay | null;
}
