/**
 * @fileoverview Chaos Engineering Experiment Scheduler
 *
 * Provides:
 * - Experiment scheduling and lifecycle management
 * - Steady-state hypothesis validation
 * - Automated experiment termination on violation
 * - Experiment result classification (success/failure/inconclusive)
 * - Rollback and boundary control for safe chaos engineering
 *
 * §68 Chaos Engineering: fault injection, game days, steady-state validation.
 * §67 Capacity Planning: failover reserve, capacity modeling.
 *
 * Architecture anchors:
 * - docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md
 * - docs_zh/adr/089-ai-operations-governance-and-quality.md
 * - docs_zh/architecture/02-code-architecture-reference.md
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import {
  CHAOS_ARCHITECTURE_ANCHORS,
  DEFAULT_BOUNDARY_CONTROL,
  type BoundaryControl,
  type ChaosExperiment,
  type ChaosExperimentSchedulerOptions,
  type ChaosExperimentSchedulerRepository,
  type ChaosExperimentSchedulerSnapshot,
  type ChaosFaultExecutor,
  type ChaosFaultInjectionResult,
  type ChaosGameDay,
  type ExperimentResult,
  type ExperimentTarget,
  type ExperimentScheduleInput,
  type FaultInjection,
  type GameDayScheduleInput,
  type PanicDrillReport,
  type RollbackAction,
  type SteadyStateHypothesis,
} from "./chaos-experiment-types.js";
export {
  CHAOS_ARCHITECTURE_ANCHORS,
  DEFAULT_BOUNDARY_CONTROL,
  InMemoryChaosExperimentSchedulerRepository,
} from "./chaos-experiment-types.js";
export type {
  BoundaryControl,
  ChaosArchitectureAnchor,
  ChaosExperiment,
  ChaosExperimentSchedulerOptions,
  ChaosExperimentSchedulerRepository,
  ChaosExperimentSchedulerSnapshot,
  ChaosFaultExecutor,
  ChaosFaultInjectionResult,
  ChaosGameDay,
  ExperimentResult,
  ExperimentScheduleInput,
  ExperimentTarget,
  FaultInjection,
  GameDayScheduleInput,
  PanicDrillReport,
  RollbackAction,
  SteadyStateHypothesis,
} from "./chaos-experiment-types.js";

const chaosLogger = new StructuredLogger();

export class ChaosExperimentScheduler {
  private readonly repository: ChaosExperimentSchedulerRepository | null;
  private readonly faultExecutor: ChaosFaultExecutor;
  private readonly experiments = new Map<string, ChaosExperiment>();
  private readonly steadyStateCache = new Map<string, { value: number; timestamp: number }>();
  private readonly gameDays = new Map<string, ChaosGameDay>();
  private readonly rollbackQueue = new Map<string, RollbackAction[]>();
  private readonly monitoringIntervals = new Map<string, ReturnType<typeof setInterval>>();
  // R21-18 fix: Track evaluated hypotheses to prevent duplicate accumulation
  private readonly evaluatedHypotheses = new Set<string>();

  public constructor(options: ChaosExperimentSchedulerOptions = {}) {
    this.repository = options.repository ?? null;
    this.faultExecutor = options.faultExecutor ?? this.defaultFaultExecutor.bind(this);
    this.hydrateFromRepository();
  }

  /**
   * Default fault executor with blast radius control.
   * Validates boundary control before injection.
   * §R14-09: Blast radius enforcement.
   */
  private defaultFaultExecutor(params: {
    readonly experiment: ChaosExperiment;
    readonly fault: FaultInjection;
  }): ChaosFaultInjectionResult {
    const { experiment, fault } = params;
    const bc = experiment.boundaryControl;

    // Blast radius validation: check allowed/blocked targets
    if (bc.allowedTargets.length > 0 && !bc.allowedTargets.includes(experiment.target.targetId)) {
      return { applied: false, message: `Target ${experiment.target.targetId} not in allowed targets` };
    }
    if (bc.blockedTargets.includes(experiment.target.targetId)) {
      return { applied: false, message: `Target ${experiment.target.targetId} is blocked` };
    }

    // Blast radius validation: check affected instances limit
    const targetInstanceCount = this.getTargetInstanceCount(experiment.target);
    if (targetInstanceCount > bc.maxAffectedInstances) {
      return {
        applied: false,
        message: `Blast radius exceeded: ${targetInstanceCount} instances > ${bc.maxAffectedInstances} limit`,
      };
    }
    const affectedPercent = (targetInstanceCount / this.getTotalInstances()) * 100;
    if (affectedPercent > bc.maxAffectedPercent) {
      return {
        applied: false,
        message: `Blast radius exceeded: ${affectedPercent.toFixed(1)}% > ${bc.maxAffectedPercent}% limit`,
      };
    }

    // Actual fault injection would occur here in a real implementation
    // For now, log the injection and return success
    chaosLogger.log({
      level: "info",
      message: "chaos.fault_injection.started",
      data: {
        faultType: fault.faultType,
        targetId: experiment.target.targetId,
        intensity: fault.intensity,
        durationMs: fault.durationMs,
      },
    });

    return {
      applied: true,
      message: `Injected ${fault.faultType} fault on ${experiment.target.targetId} ` +
        `(blast radius: ${targetInstanceCount} instances, ${affectedPercent.toFixed(1)}% of capacity)`,
    };
  }

  private getTargetInstanceCount(target: ExperimentTarget): number {
    // In real implementation, query target labels and count matching instances
    // For stub, use target labels as a proxy
    const labelCount = Object.keys(target.labels).length;
    return Math.max(1, labelCount);
  }

  private getTotalInstances(): number {
    // In real implementation, query total instances in the target pool
    return 100;
  }

  private hydrateFromRepository(): void {
    const snapshot = this.repository?.loadSnapshot();
    if (!snapshot) {
      return;
    }
    for (const experiment of snapshot.experiments) {
      this.experiments.set(experiment.experimentId, { ...experiment });
    }
    for (const metric of snapshot.steadyStateMetrics) {
      this.steadyStateCache.set(metric.key, { value: metric.value, timestamp: metric.timestamp });
    }
    for (const gameDay of snapshot.gameDays) {
      this.gameDays.set(gameDay.gameDayId, { ...gameDay });
    }
    for (const queueEntry of snapshot.rollbackQueues) {
      this.rollbackQueue.set(queueEntry.experimentId, [...queueEntry.actions]);
    }
  }

  private persistSnapshot(): void {
    if (!this.repository) {
      return;
    }
    this.repository.saveSnapshot({
      experiments: [...this.experiments.values()].map((experiment) => ({ ...experiment })),
      steadyStateMetrics: [...this.steadyStateCache.entries()].map(([key, metric]) => ({
        key,
        value: metric.value,
        timestamp: metric.timestamp,
      })),
      gameDays: [...this.gameDays.values()].map((gameDay) => ({ ...gameDay })),
      rollbackQueues: [...this.rollbackQueue.entries()].map(([experimentId, actions]) => ({
        experimentId,
        actions: actions.map((action) => ({ ...action })),
      })),
    });
  }

  /**
   * Schedules a new chaos experiment with boundary control.
   * §R14-09: Boundary control and rollback automation.
   */
  public scheduleExperiment(input: ExperimentScheduleInput): ChaosExperiment {
    const boundaryControl: BoundaryControl = {
      ...DEFAULT_BOUNDARY_CONTROL,
      ...input.boundaryControl,
    };

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
      boundaryControl,
      rollbackActions: [],
      violationDetectedAt: null,
      faultInjectedAt: null,
      faultExecutionStatus: "idle",
      faultExecutionMessage: null,
    };

    this.experiments.set(experiment.experimentId, experiment);
    this.persistSnapshot();
    return experiment;
  }

  /**
   * Starts a chaos experiment.
   * Validates boundary control before starting.
   */
  public startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "scheduled") return false;

    // Validate boundary control
    if (!this.validateBoundaryControl(experiment)) {
      experiment.status = "cancelled";
      experiment.completedAt = nowIso();
      this.persistSnapshot();
      return false;
    }

    experiment.status = "running";
    experiment.startedAt = nowIso();
    this.persistSnapshot();
    return true;
  }

  /**
   * Validates boundary control settings for an experiment.
   * Returns false if experiment would violate safety boundaries.
   * §R14-09: Boundary control validation.
   */
  public validateBoundaryControl(experiment: ChaosExperiment): boolean {
    const { boundaryControl, target } = experiment;

    // Check if target is in blocked list
    if (boundaryControl.blockedTargets.length > 0) {
      const targetId = target.targetId.toLowerCase();
      const labelValues = Object.values(target.labels).map((value) => value.toLowerCase());
      for (const blocked of boundaryControl.blockedTargets) {
        const blockedLower = blocked.toLowerCase();
        if (targetId.includes(blockedLower) || labelValues.some((value) => value.includes(blockedLower))) {
          chaosLogger.log({
            level: "warn",
            message: "chaos.boundary.blocked_target",
            data: { targetId: target.targetId, blockedPattern: blocked },
          });
          return false;
        }
      }
    }

    // Check if target is in allowed list (if specified)
    if (boundaryControl.allowedTargets.length > 0) {
      const targetId = target.targetId.toLowerCase();
      const labelValues = Object.values(target.labels).map((value) => value.toLowerCase());
      const isAllowed = boundaryControl.allowedTargets.some(
        (allowed) => {
          const allowedLower = allowed.toLowerCase();
          return targetId.includes(allowedLower) || labelValues.some((value) => value.includes(allowedLower));
        },
      );
      if (!isAllowed) {
        chaosLogger.log({
          level: "warn",
          message: "chaos.boundary.not_allowed",
          data: { targetId: target.targetId },
        });
        return false;
      }
    }

    const affectedInstances = Number(target.labels.affected_instances ?? target.labels.instance_count ?? "1");
    if (Number.isFinite(affectedInstances) && affectedInstances > boundaryControl.maxAffectedInstances) {
      chaosLogger.log({
        level: "warn",
        message: "chaos.boundary.max_instances_exceeded",
        data: { targetId: target.targetId, affectedInstances, maxAffectedInstances: boundaryControl.maxAffectedInstances },
      });
      return false;
    }

    const affectedPercent = Number(target.labels.affected_percent ?? target.labels.blast_radius_percent ?? "0");
    if (Number.isFinite(affectedPercent) && affectedPercent > boundaryControl.maxAffectedPercent) {
      chaosLogger.log({
        level: "warn",
        message: "chaos.boundary.max_percent_exceeded",
        data: { targetId: target.targetId, affectedPercent, maxAffectedPercent: boundaryControl.maxAffectedPercent },
      });
      return false;
    }

    return true;
  }

  /**
   * Records steady state hypothesis result and triggers rollback if violated.
   * §R14-09: Rollback on violation.
   */
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

    // R21-18 fix: Track evaluated hypotheses to prevent duplicate evaluations
    const evaluatedKey = `${experimentId}:${hypothesisName}`;
    const alreadyEvaluated = this.evaluatedHypotheses.has(evaluatedKey);
    if (alreadyEvaluated) {
      this.persistSnapshot();
      return;
    }
    this.evaluatedHypotheses.add(evaluatedKey);

    experiment.results = [...experiment.results, result];

    // Check if all hypotheses have been evaluated
    if (experiment.results.length >= experiment.steadyStateHypotheses.length) {
      const allPassed = experiment.results.every((r) => r.passed);

      if (!allPassed) {
        // Violation detected - trigger rollback if configured
        experiment.violationDetectedAt = nowIso();
        experiment.status = "violated";

        if (experiment.boundaryControl.autoRollbackOnViolation) {
          this.initiateRollback(experimentId);
        }
      } else {
        experiment.status = "completed";
      }
      experiment.completedAt = nowIso();
    }
    this.persistSnapshot();
  }

  /**
   * Initiates rollback procedure for a violated experiment.
   * §R14-09: Rollback automation.
   */
  public initiateRollback(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    // Create rollback actions
    const stopFaultAction: RollbackAction = {
      actionId: newId("rollback"),
      experimentId,
      actionType: "stop_fault",
      status: "pending",
      executedAt: null,
      completedAt: null,
      result: null,
    };

    const restoreStateAction: RollbackAction = {
      actionId: newId("rollback"),
      experimentId,
      actionType: "restore_state",
      status: "pending",
      executedAt: null,
      completedAt: null,
      result: null,
    };

    const notifyAction: RollbackAction = {
      actionId: newId("rollback"),
      experimentId,
      actionType: "notify",
      status: "pending",
      executedAt: null,
      completedAt: null,
      result: null,
    };

    const rollbackActions = [stopFaultAction, restoreStateAction, notifyAction];
    experiment.rollbackActions = rollbackActions;
    experiment.status = "rollback";

    // Queue rollback actions
    this.rollbackQueue.set(experimentId, rollbackActions);

    // Execute rollback with timeout
    this.executeRollbackWithTimeout(experimentId, experiment.boundaryControl.rollbackTimeoutMs);
    this.persistSnapshot();

    return true;
  }

  /**
   * Executes rollback actions with a timeout.
   */
  private executeRollbackWithTimeout(experimentId: string, timeoutMs: number): void {
    const timeout = setTimeout(() => {
      this.completeRollbackActions(experimentId, "failed", "Rollback timed out");
    }, timeoutMs);

    // Execute rollback actions asynchronously
    this.executeRollbackActions(experimentId).then((result) => {
      clearTimeout(timeout);
      this.completeRollbackActions(experimentId, "completed", result);
    }).catch((error) => {
      clearTimeout(timeout);
      this.completeRollbackActions(experimentId, "failed", String(error));
    });
  }

  /**
   * Executes rollback actions for an experiment.
   */
  private async executeRollbackActions(experimentId: string): Promise<string> {
    const actions = this.rollbackQueue.get(experimentId);
    if (!actions) return "No rollback actions";

    for (const action of actions) {
      action.status = "executing";
      action.executedAt = nowIso();

      // Simulate rollback action execution
      await this.simulateRollbackAction(action);

      action.status = "completed";
      action.completedAt = nowIso();
      action.result = `Action ${action.actionType} completed successfully`;
    }

    return "All rollback actions completed";
  }

  /**
   * Simulates rollback action execution.
   * In real implementation, this would call actual rollback mechanisms.
   */
  private async simulateRollbackAction(action: RollbackAction): Promise<void> {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    switch (action.actionType) {
      case "stop_fault":
        chaosLogger.log({ level: "info", message: "chaos.rollback.stop_fault", data: { experimentId: action.experimentId } });
        break;
      case "restore_state":
        chaosLogger.log({ level: "info", message: "chaos.rollback.restore_state", data: { experimentId: action.experimentId } });
        break;
      case "notify":
        chaosLogger.log({ level: "info", message: "chaos.rollback.notify", data: { experimentId: action.experimentId } });
        break;
      case "complete":
        chaosLogger.log({ level: "info", message: "chaos.rollback.complete", data: { experimentId: action.experimentId } });
        break;
    }
  }

  /**
   * Completes rollback actions with final status.
   */
  private completeRollbackActions(
    experimentId: string,
    status: "completed" | "failed",
    result: string,
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    for (const action of experiment.rollbackActions) {
      if (action.status === "executing" || action.status === "pending") {
        action.status = status;
        if (action.executedAt && !action.completedAt) {
          action.completedAt = nowIso();
        }
        action.result = result;
      }
    }

    this.rollbackQueue.delete(experimentId);
    this.persistSnapshot();
  }

  /**
   * Checks if rollback is in progress for an experiment.
   */
  public isRollbackInProgress(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    return experiment?.status === "rollback";
  }

  /**
   * Gets rollback actions for an experiment.
   */
  public getRollbackActions(experimentId: string): readonly RollbackAction[] {
    const experiment = this.experiments.get(experimentId);
    return experiment?.rollbackActions ?? [];
  }

  public injectFault(experimentId: string): ChaosFaultInjectionResult | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return null;
    const execution = this.faultExecutor({ experiment, fault: experiment.fault });
    experiment.faultInjectedAt = nowIso();
    experiment.faultExecutionStatus = execution.applied ? "applied" : "failed";
    experiment.faultExecutionMessage = execution.message;
    this.persistSnapshot();
    return {
      ...execution,
      faultType: experiment.fault.faultType,
      intensity: experiment.fault.intensity,
      durationMs: experiment.fault.durationMs,
      parameters: experiment.fault.parameters,
    };
  }

  public autoTerminateIfNeeded(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return false;

    if (experiment.startedAt) {
      const elapsed = Date.now() - new Date(experiment.startedAt).getTime();
      if (elapsed >= experiment.maxDurationMs) {
        experiment.violationDetectedAt = nowIso();
        if (experiment.boundaryControl.autoRollbackOnViolation && experiment.faultExecutionStatus === "applied") {
          experiment.status = "violated";
          experiment.completedAt = nowIso();
          this.persistSnapshot();
          this.initiateRollback(experimentId);
          return true;
        }
        experiment.status = "cancelled";
        experiment.completedAt = nowIso();
        this.persistSnapshot();
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
    this.stopContinuousMonitoring(experimentId);
    this.persistSnapshot();
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
    this.persistSnapshot();
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
    this.persistSnapshot();
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
    if (experiments.some((item) => item.status === "violated" || item.status === "rollback")) {
      gameDay.status = "violated";
      gameDay.completedAt = nowIso();
      this.persistSnapshot();
      return gameDay;
    }
    if (experiments.length > 0 && experiments.every((item) => item.status === "completed")) {
      gameDay.status = "completed";
      gameDay.completedAt = nowIso();
      this.persistSnapshot();
    }
    return gameDay;
  }

  public getGameDay(gameDayId: string): ChaosGameDay | null {
    return this.gameDays.get(gameDayId) ?? null;
  }

  public generatePanicDrillReport(gameDayId: string, ingressBlockTimeMs?: number, executionQuiescenceTimeMs?: number, planeAckSuccessRate?: number): PanicDrillReport | null {
    const gameDay = this.gameDays.get(gameDayId);
    if (!gameDay) return null;
    const experiments = gameDay.experimentIds
      .map((experimentId) => this.experiments.get(experimentId))
      .filter((item): item is ChaosExperiment => item != null);
    const planesContacted = ["P1", "P2", "P3", "P4", "P5"];
    const planesAcknowledged = experiments.length > 0 && experiments.some((e) => e.status === "completed")
      ? planesContacted
      : [];
    return {
      drillId: newId("panic_drill"),
      gameDayId,
      ingress_block_time_ms: ingressBlockTimeMs ?? null,
      execution_quiescence_time_ms: executionQuiescenceTimeMs ?? null,
      plane_ack_success_rate: planeAckSuccessRate ?? null,
      planesContacted,
      planesAcknowledged,
      generatedAt: nowIso(),
    };
  }

  private recordContinuousSteadyStateSample(
    experimentId: string,
    hypothesisName: string,
    measuredValue: number | null,
    passed: boolean,
    message: string,
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") {
      return;
    }
    if (measuredValue != null) {
      this.cacheSteadyStateMetric(experimentId, hypothesisName, measuredValue);
    }
    const result: ExperimentResult = {
      timestamp: nowIso(),
      steadyStateName: hypothesisName,
      passed,
      measuredValue,
      tolerance: experiment.steadyStateHypotheses.find((hypothesis) => hypothesis.name === hypothesisName)?.tolerance ?? 0,
      message,
    };

    // R21-18 fix: Deduplicate steady-state results to prevent premature completion
    const evaluatedKey = `${experimentId}:${hypothesisName}`;
    const alreadyEvaluated = this.evaluatedHypotheses.has(evaluatedKey);
    if (alreadyEvaluated) {
      this.persistSnapshot();
      return;
    }
    this.evaluatedHypotheses.add(evaluatedKey);

    experiment.results = [...experiment.results, result];
    if (!passed) {
      experiment.violationDetectedAt = nowIso();
      experiment.status = "violated";
      experiment.completedAt = nowIso();
      this.persistSnapshot();
      if (experiment.boundaryControl.autoRollbackOnViolation) {
        this.initiateRollback(experimentId);
      }
      return;
    }
    this.persistSnapshot();
  }

  /**
   * Starts continuous monitoring for an experiment.
   * Periodically evaluates steady-state hypotheses at the given interval.
   * R17-72 fix: Continuous monitoring loop for ongoing steady-state validation.
   */
  public startContinuousMonitoring(
    experimentId: string,
    intervalMs: number,
    evaluator: () => Promise<{ passed: boolean; measuredValue: number | null; message: string }>,
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return;

    // Clear any existing interval for this experiment
    this.stopContinuousMonitoring(experimentId);

    const interval = setInterval(() => {
      void (async () => {
        try {
          const currentExp = this.experiments.get(experimentId);
          if (!currentExp || currentExp.status !== "running") {
            this.stopContinuousMonitoring(experimentId);
            return;
          }

          const result = await evaluator();
          this.recordContinuousSteadyStateSample(
            experimentId,
            currentExp.steadyStateHypotheses[0]?.name ?? "default",
            result.measuredValue,
            result.passed,
            result.message,
          );

          const updatedExp = this.experiments.get(experimentId);
          if (!updatedExp || updatedExp.status !== "running") {
            this.stopContinuousMonitoring(experimentId);
          }
        } catch (error) {
          chaosLogger.log({
            level: "error",
            message: "chaos.monitoring.evaluator_failed",
            data: {
              experimentId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          this.stopContinuousMonitoring(experimentId);
        }
      })();
    }, intervalMs);

    this.monitoringIntervals.set(experimentId, interval);
  }

  /**
   * Stops continuous monitoring for an experiment.
   * R17-72 fix: Cleanup interval on stop.
   */
  public stopContinuousMonitoring(experimentId: string): void {
    const interval = this.monitoringIntervals.get(experimentId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(experimentId);
    }
  }

  /**
   * Caches a steady-state metric value with timestamp.
   * R17-62 fix: Richer cache type for tracking historical measurements.
   */
  public cacheSteadyStateMetric(experimentId: string, hypothesisName: string, value: number): void {
    this.steadyStateCache.set(`${experimentId}:${hypothesisName}`, {
      value,
      timestamp: Date.now(),
    });
    this.persistSnapshot();
  }

  /**
   * Gets a cached steady-state metric value.
   * R17-62 fix: Returns richer type with timestamp.
   */
  public getSteadyStateMetric(experimentId: string, hypothesisName: string): { value: number; timestamp: number } | null {
    return this.steadyStateCache.get(`${experimentId}:${hypothesisName}`) ?? null;
  }

  /**
   * Clears all cached steady-state metrics for an experiment.
   * R17-62 fix: Cleanup cache when experiment ends.
   */
  public clearSteadyStateCache(experimentId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.steadyStateCache.keys()) {
      if (key.startsWith(`${experimentId}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.steadyStateCache.delete(key);
    }
    this.persistSnapshot();
  }
}
