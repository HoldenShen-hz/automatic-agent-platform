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
 *
 * §66 GameDay 编排器 (P2 Enhancement for Phase 3):
 * 当前 scheduleGameDay() / startGameDay() / refreshGameDayStatus() 已实现基础调度骨架。
 * 要实现完整的 GameDay 编排能力，需要：真实故障注入执行、与监控系统联动验证稳态、
 * 多实验并行编排、以及 GameDay 报告生成。当前 ChaosExperimentScheduler 缺少与外部
 * 故障注入系统的集成和真实稳态验证流水线。
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

export class ChaosExperimentScheduler {
  private readonly experiments = new Map<string, ChaosExperiment>();
  private readonly steadyStateCache = new Map<string, number>();
  private readonly gameDays = new Map<string, ChaosGameDay>();

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

  public scheduleGameDay(input: GameDayScheduleInput): ChaosGameDay {
    const experimentIds = input.experiments.map((experiment) => this.scheduleExperiment(experiment).experimentId);
    const gameDay: ChaosGameDay = {
      gameDayId: newId("gameday"),
      name: input.name,
      scheduledAt: input.scheduledAt,
      experimentIds,
      status: "scheduled",
      startedAt: null,
      completedAt: null,
    };
    this.gameDays.set(gameDay.gameDayId, gameDay);
    return gameDay;
  }

  public startGameDay(gameDayId: string): boolean {
    const gameDay = this.gameDays.get(gameDayId);
    if (!gameDay || gameDay.status !== "scheduled") {
      return false;
    }
    for (const experimentId of gameDay.experimentIds) {
      this.startExperiment(experimentId);
    }
    gameDay.status = "running";
    gameDay.startedAt = nowIso();
    return true;
  }

  public refreshGameDayStatus(gameDayId: string): ChaosGameDay | null {
    const gameDay = this.gameDays.get(gameDayId);
    if (!gameDay) {
      return null;
    }
    const experiments = gameDay.experimentIds
      .map((experimentId) => this.experiments.get(experimentId))
      .filter((item): item is ChaosExperiment => item != null);
    if (experiments.some((item) => item.status === "violated")) {
      gameDay.status = "violated";
      gameDay.completedAt = nowIso();
      return gameDay;
    }
    if (experiments.length > 0 && experiments.every((item) => item.status === "completed")) {
      gameDay.status = "completed";
      gameDay.completedAt = nowIso();
    }
    return gameDay;
  }

  public getGameDay(gameDayId: string): ChaosGameDay | null {
    return this.gameDays.get(gameDayId) ?? null;
  }
}
