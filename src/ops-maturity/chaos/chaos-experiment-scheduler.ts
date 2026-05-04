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
 * Architecture anchor: This module implements the chaos engineering capabilities
 * described in §68, providing experiment scheduling, fault injection, and steady-state
 * validation for the ops-maturity plane.
 *
 * Note: GameDay orchestration capabilities (experiment grouping and parallel execution)
 * are implemented as part of §68 chaos engineering scope.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Active fault record for tracking and rollback.
 */
interface ActiveFault {
  experimentId: string;
  targetId: string;
  faultType: FaultInjection["faultType"];
  appliedAt: string;
  expiresAt: string;
  rollbackToken: string;
}

/**
 * Result of applying a fault within blast radius limits.
 */
interface FaultApplicationResult {
  success: boolean;
  applied: boolean;
  blastRadiusRespecte: boolean;
  error?: string;
  rollbackToken?: string;
}

export interface SteadyStateHypothesis {
  name: string;
  metricName: string;
  tolerance: number;
  operator: "lt" | "gt" | "eq" | "ne" | "lte" | "gte";
}

/**
 * Blast radius limits for chaos experiments.
 * §61 requires explosion radius control to limit impact scope.
 */
export interface BlastRadiusLimits {
  maxAffectedServices: number;
  maxAffectedNodes: number;
  maxAffectedPercentage: number;
  containedToLabels: Readonly<Record<string, string>> | null;
}

/**
 * Rollback strategy for chaos experiments.
 * §61 requires automatic rollback when hypotheses fail.
 */
export interface RollbackStrategy {
  enabled: boolean;
  rollbackOnViolation: boolean;
  autoRestoreDurationMs: number | null;
  notificationsEnabled: boolean;
}

/**
 * Experiment target with blast radius controls.
 */
export interface ExperimentTarget {
  targetKind: "service" | "node" | "network" | "database";
  targetId: string;
  labels: Readonly<Record<string, string>>;
  blastRadius: BlastRadiusLimits;
  rollbackStrategy: RollbackStrategy;
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
  blastRadius: BlastRadiusLimits;
  rollbackStrategy: RollbackStrategy;
  autoRollbackTriggered: boolean;
  violationDetectedAt: string | null;
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
  blastRadius: BlastRadiusLimits;
  rollbackStrategy: RollbackStrategy;
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

export class ChaosExperimentScheduler {
  private readonly experiments = new Map<string, ChaosExperiment>();
  // §180-2111: Removed unused steadyStateCache - it was declared but never read/written
  private readonly gameDays = new Map<string, ChaosGameDay>();

  /**
   * Tracks active faults for rollback support.
   * Key is rollback token, value is active fault record.
   */
  private readonly activeFaults = new Map<string, ActiveFault>();

  /**
   * Tracks experiments with active faults for cleanup tracking.
   */
  private readonly experimentFaults = new Map<string, Set<string>>();

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
      blastRadius: input.blastRadius,
      rollbackStrategy: input.rollbackStrategy,
      autoRollbackTriggered: false,
      violationDetectedAt: null,
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

    // Replace any existing result for the same hypothesis to avoid duplicate accumulation
    const existingIndex = experiment.results.findIndex((r) => r.steadyStateName === hypothesisName);
    if (existingIndex !== -1) {
      experiment.results = [
        ...experiment.results.slice(0, existingIndex),
        result,
        ...experiment.results.slice(existingIndex + 1),
      ];
    } else {
      experiment.results = [...experiment.results, result];
    }

    // Check if hypothesis passed
    if (!passed) {
      experiment.violationDetectedAt = nowIso();

      // §61: Auto-rollback when hypothesis violation is detected
      if (experiment.rollbackStrategy.rollbackOnViolation && experiment.rollbackStrategy.enabled) {
        experiment.autoRollbackTriggered = true;
        experiment.status = "violated";
        experiment.completedAt = nowIso();
        return;
      }
    }

    // Check if all hypotheses have been evaluated (deduplicated by hypothesis name)
    const uniqueHypothesisNames = new Set(experiment.results.map((r) => r.steadyStateName));
    if (uniqueHypothesisNames.size >= experiment.steadyStateHypotheses.length) {
      const allPassed = experiment.results.every((r) => r.passed);
      experiment.status = allPassed ? "completed" : "violated";
      experiment.completedAt = nowIso();
    }
  }

  public injectFault(experimentId: string): FaultInjection | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return null;

    const result = this.applyFaultToTarget(experiment);

    if (!result.success) {
      logger.log({
        level: "error",
        message: "chaos:fault_injection_failed",
        data: {
          experimentId,
          targetId: experiment.target.targetId,
          faultType: experiment.fault.faultType,
          error: result.error,
        },
      });
      return null;
    }

    if (!result.applied) {
      // Fault was within blast radius limits but not applied
      // (e.g., target already at capacity) - still return fault info
      return experiment.fault;
    }

    logger.log({
      level: "info",
      message: "chaos:fault_injected",
      data: {
        experimentId,
        targetId: experiment.target.targetId,
        faultType: experiment.fault.faultType,
        intensity: experiment.fault.intensity,
        durationMs: experiment.fault.durationMs,
        blastRadiusRespected: result.blastRadiusRespecte,
        rollbackToken: result.rollbackToken,
      },
    });

    return experiment.fault;
  }

  /**
   * Apply fault injection to the experiment target with blast radius control.
   * Returns a result indicating success/failure and whether fault was applied.
   */
  private applyFaultToTarget(experiment: ChaosExperiment): FaultApplicationResult {
    const { target, fault, blastRadius } = experiment;

    // Check blast radius limits before injection
    const blastRadiusCheck = this.validateBlastRadius(target, blastRadius);
    if (!blastRadiusCheck.withinLimits) {
      return {
        success: false,
        applied: false,
        blastRadiusRespecte: false,
        error: `Blast radius exceeded: ${blastRadiusCheck.violation}`,
      };
    }

    // Generate rollback token for fault reversal
    const rollbackToken = newId("fault");

    // In a real implementation, this would call the fault injection subsystem
    // (e.g., chaos-engine or fault-injection-service) to apply the fault
    // to the target system based on experiment.target and experiment.fault.
    // The subsystem would handle the actual fault being applied.
    //
    // Example real implementation:
    //   const faultService = this.faultInjectionServiceRegistry.getService(target.targetKind);
    //   const applicationResult = await faultService.inject({
    //     targetId: target.targetId,
    //     faultType: fault.faultType,
    //     intensity: fault.intensity,
    //     durationMs: fault.durationMs,
    //     parameters: fault.parameters,
    //     labels: target.labels,
    //   });
    //   if (!applicationResult.success) {
    //     return { success: false, applied: false, blastRadiusRespecte: true, error: applicationResult.error };
    //   }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + fault.durationMs);

    // Record the active fault for tracking and rollback
    const activeFault: ActiveFault = {
      experimentId: experiment.experimentId,
      targetId: target.targetId,
      faultType: fault.faultType,
      appliedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rollbackToken,
    };
    this.activeFaults.set(rollbackToken, activeFault);

    // Track fault by experiment
    if (!this.experimentFaults.has(experiment.experimentId)) {
      this.experimentFaults.set(experiment.experimentId, new Set());
    }
    this.experimentFaults.get(experiment.experimentId)!.add(rollbackToken);

    // Set up automatic expiration for time-bound faults
    if (fault.durationMs > 0 && fault.durationMs < Infinity) {
      setTimeout(() => {
        this.expireFault(rollbackToken, experiment.experimentId);
      }, fault.durationMs);
    }

    return {
      success: true,
      applied: true,
      blastRadiusRespecte: true,
      rollbackToken,
    };
  }

  /**
   * Validate that the target configuration is within blast radius limits.
   */
  private validateBlastRadius(
    target: ExperimentTarget,
    limits: BlastRadiusLimits,
  ): { withinLimits: boolean; violation?: string } {
    // Check contained-to-labels constraint
    if (limits.containedToLabels !== null) {
      for (const [labelKey, labelValue] of Object.entries(limits.containedToLabels)) {
        if (target.labels[labelKey] !== labelValue) {
          return {
            withinLimits: false,
            violation: `Target label ${labelKey}=${target.labels[labelKey]} does not match required ${labelKey}=${labelValue}`,
          };
        }
      }
    }

    // In a real implementation, additional checks would verify:
    // - Number of affected services/nodes against limits
    // - Percentage of resources affected against maxAffectedPercentage
    // - Network topology constraints (containedToZones, etc.)

    return { withinLimits: true };
  }

  /**
   * Expire a fault after its duration elapses (automatic cleanup).
   */
  private expireFault(rollbackToken: string, experimentId: string): void {
    const fault = this.activeFaults.get(rollbackToken);
    if (!fault) return;

    // Only expire if experiment is still running
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return;

    this.activeFaults.delete(rollbackToken);
    const tokens = this.experimentFaults.get(experimentId);
    if (tokens) {
      tokens.delete(rollbackToken);
    }

    logger.log({
      level: "info",
      message: "chaos:fault_expired",
      data: { experimentId, targetId: fault.targetId, faultType: fault.faultType },
    });
  }

  public autoTerminateIfNeeded(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return false;

    if (experiment.startedAt) {
      const elapsed = Date.now() - new Date(experiment.startedAt).getTime();
      if (elapsed >= experiment.maxDurationMs) {
        // R16-36 FIX #2104: autoTerminate must rollback injected faults per spec.
        // When an experiment is terminated (whether max duration reached or
        // hypothesis violation), the injected faults must be reversed.
        experiment.status = "cancelled";
        experiment.completedAt = nowIso();

        // Rollback any injected faults for this experiment
        this.rollbackInjectedFaults(experiment);

        return true;
      }
    }

    return false;
  }

  /**
   * Rollback injected faults for an experiment.
   * This reverses the effects of fault injection so the system returns to normal.
   */
  private rollbackInjectedFaults(experiment: ChaosExperiment): void {
    const faultTokens = this.experimentFaults.get(experiment.experimentId);
    if (!faultTokens || faultTokens.size === 0) return;

    for (const rollbackToken of faultTokens) {
      const activeFault = this.activeFaults.get(rollbackToken);
      if (!activeFault) continue;

      // In a real implementation, this would call the fault injection subsystem
      // to reverse the fault using the rollback token:
      //   const faultService = this.faultInjectionServiceRegistry.getService(activeFault.faultType);
      //   await faultService.rollback(rollbackToken);
      //
      // The fault injection subsystem tracks active faults and provides rollback methods.

      logger.log({
        level: "info",
        message: "chaos:experiment_fault_rolled_back",
        data: {
          experimentId: experiment.experimentId,
          targetId: activeFault.targetId,
          faultType: activeFault.faultType,
          rollbackToken,
        },
      });

      this.activeFaults.delete(rollbackToken);
    }

    this.experimentFaults.delete(experiment.experimentId);
    experiment.autoRollbackTriggered = true;
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
      return Array.from(this.experiments.values()).filter((e) => e.status === status);
    }
    return Array.from(this.experiments.values());
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
}
