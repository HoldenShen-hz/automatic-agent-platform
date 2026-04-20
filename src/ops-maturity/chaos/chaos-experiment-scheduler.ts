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

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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

export class ChaosExperimentScheduler {
  private readonly experiments = new Map<string, ChaosExperiment>();
  private readonly steadyStateCache = new Map<string, number>();

  public scheduleExperiment(input: ExperimentScheduleInput): ChaosExperiment {
    const experiment: ChaosExperiment = {
      experimentId: newId("chaos"),
      name: input.name,
      description: input.description,
      target: input.target,
      fault: input.fault,
      steadyStateHypotheses: input.steadyStateHypotheses,
      status: "scheduled",
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      maxDurationMs: input.maxDurationMs,
      results: [],
    };

    this.experiments.set(experiment.experimentId, experiment);
    return experiment;
  }

  public startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "scheduled") return false;

    experiment.status = "running";
    experiment.startedAt = nowIso();
    return true;
  }

  public recordSteadyStateResult(
    experimentId: string,
    hypothesisName: string,
    measuredValue: number | null,
    passed: boolean,
    message: string,
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return;

    const result: ExperimentResult = {
      timestamp: nowIso(),
      steadyStateName: hypothesisName,
      passed,
      measuredValue,
      tolerance: experiment.steadyStateHypotheses.find((h) => h.name === hypothesisName)?.tolerance ?? 0,
      message,
    };

    experiment.results = [...experiment.results, result];

    // Check if all hypotheses have been evaluated
    if (experiment.results.length >= experiment.steadyStateHypotheses.length) {
      const allPassed = experiment.results.every((r) => r.passed);
      experiment.status = allPassed ? "completed" : "violated";
      experiment.completedAt = nowIso();
    }
  }

  public injectFault(experimentId: string): FaultInjection | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return null;
    return experiment.fault;
  }

  public autoTerminateIfNeeded(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return false;

    if (experiment.startedAt) {
      const elapsed = Date.now() - new Date(experiment.startedAt).getTime();
      if (elapsed >= experiment.maxDurationMs) {
        experiment.status = "cancelled";
        experiment.completedAt = nowIso();
        return true;
      }
    }

    return false;
  }

  public validateSteadyState(metricName: string, currentValue: number, hypothesis: SteadyStateHypothesis): boolean {
    switch (hypothesis.operator) {
      case "lt": return currentValue < hypothesis.tolerance;
      case "gt": return currentValue > hypothesis.tolerance;
      case "eq": return currentValue === hypothesis.tolerance;
      case "ne": return currentValue !== hypothesis.tolerance;
      case "lte": return currentValue <= hypothesis.tolerance;
      case "gte": return currentValue >= hypothesis.tolerance;
    }
  }

  public getExperiment(experimentId: string): ChaosExperiment | null {
    return this.experiments.get(experimentId) ?? null;
  }

  public listExperiments(status?: ChaosExperiment["status"]): ChaosExperiment[] {
    if (status) {
      return [...this.experiments.values()].filter((e) => e.status === status);
    }
    return [...this.experiments.values()];
  }

  public cancelExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "scheduled" && experiment.status !== "running") {
      return false;
    }
    experiment.status = "cancelled";
    experiment.completedAt = nowIso();
    return true;
  }
}
