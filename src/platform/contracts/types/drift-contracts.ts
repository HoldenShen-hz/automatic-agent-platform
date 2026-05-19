/**
 * Drift Contracts
 *
 * Defines drift detection, alerting, and mitigation types per the architecture §63.
 *
 * @see docs_zh/contracts/drift_detector_contract.md
 * @see docs_zh/contracts/drift_alert_contract.md
 * @see docs_zh/contracts/drift_mitigation_action_contract.md
*/

import { newId, nowIso } from "./ids.js";

// =============================================================================
// DriftDetector Contract
// =============================================================================

export type DriftDetectorType =
  | "statistical_test"
  | "threshold_monitoring"
  | "sequence_comparison"
  | "sliding_window";

export type DriftType =
  | "input_drift"
  | "output_drift"
  | "behavioral_drift"
  | "quality_drift";

export type DriftSeverity = "SEV2" | "SEV3" | "SEV4";

/**
 * DriftDetector configuration
 */
export interface DriftDetectorConfig {
  readonly windowSize: number;
  readonly threshold: number;
  readonly sensitivity: number; // 0-1
  readonly method: string;
}

/**
 * DriftDetector interface
 */
export interface DriftDetector {
  readonly detectorId: string;
  readonly detectorType: DriftDetectorType;
  readonly enabled: boolean;
  readonly config: DriftDetectorConfig;
}

/**
 * DriftDetectionResult
 */
export interface DriftDetectionResult {
  readonly detectorId: string;
  readonly driftDetected: boolean;
  readonly driftType: DriftType;
  readonly confidence: number; // 0-1
  readonly severity: DriftSeverity;
  readonly details: Readonly<Record<string, unknown>>;
  readonly detectedAt: string;
}

// =============================================================================
// DriftAlert Contract
// =============================================================================

export type AlertSeverity = "SEV2" | "SEV3" | "SEV4";

export type SubjectType = "agent" | "workflow" | "task";

/**
 * DriftAlert routing configuration
 */
export interface DriftAlertRouting {
  readonly channel: string;
  readonly target: string;
  readonly handlingTimeoutMs: number;
}

/**
 * DriftAlert structure
 */
export interface DriftAlert {
  readonly alertId: string;
  readonly detectorId: string;
  readonly driftType: DriftType;
  readonly severity: AlertSeverity;
  readonly confidence: number; // 0-1
  readonly subjectId: string;
  readonly subjectType: SubjectType;
  readonly details: Readonly<Record<string, unknown>>;
  readonly recommendedActions: readonly string[];
  readonly triggeredAt: string;
  readonly routing: DriftAlertRouting;
}

/**
 * DriftAlert service for creating and managing drift alerts
 */
export class DriftAlertService {
  private readonly alerts = new Map<string, DriftAlert>();
  private readonly alertDeduplicationKeys = new Map<string, string>();

  /**
   * Create a drift alert from a detection result
   */
  public createAlert(
    detection: DriftDetectionResult,
    subjectId: string,
    subjectType: SubjectType,
    recommendedActions: readonly string[],
  ): DriftAlert {
    const alertId = newId("drift_alert");

    // Determine routing based on severity
    const routing = this.resolveRouting(detection.severity);

    const alert: DriftAlert = {
      alertId,
      detectorId: detection.detectorId,
      driftType: detection.driftType,
      severity: detection.severity,
      confidence: detection.confidence,
      subjectId,
      subjectType,
      details: detection.details,
      recommendedActions,
      triggeredAt: nowIso(),
      routing,
    };

    // Deduplicate based on subject_id + drift_type + time window
    const dedupKey = `${subjectId}:${detection.driftType}:${this.getTimeWindowKey(detection.detectedAt)}`;
    this.alertDeduplicationKeys.set(dedupKey, alertId);
    this.alerts.set(alertId, alert);

    return alert;
  }

  /**
   * Check if an alert should be deduplicated
   */
  public shouldDeduplicate(subjectId: string, driftType: DriftType, timeWindow: string): boolean {
    const dedupKey = `${subjectId}:${driftType}:${this.getTimeWindowKey(timeWindow)}`;
    return this.alertDeduplicationKeys.has(dedupKey);
  }

  /**
   * Get alert by ID
   */
  public getAlert(alertId: string): DriftAlert | null {
    return this.alerts.get(alertId) ?? null;
  }

  /**
   * Get all alerts for a subject
   */
  public getAlertsForSubject(subjectId: string): readonly DriftAlert[] {
    return [...this.alerts.values()].filter((a) => a.subjectId === subjectId);
  }

  /**
   * Get alerts by severity
   */
  public getAlertsBySeverity(severity: AlertSeverity): readonly DriftAlert[] {
    return [...this.alerts.values()].filter((a) => a.severity === severity);
  }

  /**
   * Resolve routing based on severity
   */
  private resolveRouting(severity: DriftSeverity): DriftAlertRouting {
    switch (severity) {
      case "SEV2":
        return { channel: "on-call", target: "on-call-engineer", handlingTimeoutMs: 5 * 60 * 1000 };
      case "SEV3":
        return { channel: "dashboard", target: "dashboard-alerts", handlingTimeoutMs: 30 * 60 * 1000 };
      case "SEV4":
        return { channel: "log", target: "log-aggregator", handlingTimeoutMs: 24 * 60 * 60 * 1000 };
    }
  }

  /**
   * Get time window key for deduplication
   */
  private getTimeWindowKey(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
  }
}

// =============================================================================
// DriftMitigationAction Contract
// =============================================================================

export type MitigationActionType =
  | "observe_only"
  | "throttle"
  | "downgrade"
  | "rollback"
  | "freeze";

export type MitigationStatus =
  | "proposed"
  | "approved"
  | "executing"
  | "completed"
  | "failed";

/**
 * MitigationPolicy defines default responses for drift types
 */
export const MITIGATION_POLICY: Readonly<Record<DriftType, MitigationActionType>> = {
  input_drift: "observe_only",
  output_drift: "throttle",
  behavioral_drift: "downgrade",
  quality_drift: "rollback",
} as const;

/**
 * DriftMitigationAction
 */
export interface DriftMitigationAction {
  readonly actionId: string;
  readonly alertId: string;
  readonly actionType: MitigationActionType;
  readonly targetSubjectId: string;
  readonly targetSubjectType: SubjectType;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly status: MitigationStatus;
  readonly executedBy: string | null;
  readonly executedAt: string | null;
  readonly createdAt: string;
  readonly rollbackCheckpointRef: string | null;
}

/**
 * MitigationResult
 */
export interface MitigationResult {
  readonly actionId: string;
  readonly success: boolean;
  readonly executedAt: string;
  readonly effect: Readonly<Record<string, unknown>>;
  readonly errorMessage: string | null;
}

/**
 * DriftMitigationService
 */
export class DriftMitigationService {
  private readonly actions = new Map<string, DriftMitigationAction>();
  private readonly results = new Map<string, MitigationResult>();

  /**
   * Propose a mitigation action for an alert
   */
  public proposeAction(input: {
    alertId: string;
    driftType: DriftType;
    targetSubjectId: string;
    targetSubjectType: SubjectType;
    parameters?: Readonly<Record<string, unknown>>;
  }): DriftMitigationAction {
    const defaultActionType = MITIGATION_POLICY[input.driftType];

    const action: DriftMitigationAction = {
      actionId: newId("mitigation_action"),
      alertId: input.alertId,
      actionType: defaultActionType,
      targetSubjectId: input.targetSubjectId,
      targetSubjectType: input.targetSubjectType,
      parameters: input.parameters ?? {},
      status: "proposed",
      executedBy: null,
      executedAt: null,
      createdAt: nowIso(),
      rollbackCheckpointRef: null,
    };

    this.actions.set(action.actionId, action);
    return action;
  }

  /**
   * Approve a proposed action
   */
  public approveAction(actionId: string): DriftMitigationAction {
    const action = this.requireAction(actionId);
    if (action.status !== "proposed") {
      throw new Error(`mitigation_action.not_in_proposed_state:${actionId}`);
    }

    const updated: DriftMitigationAction = { ...action, status: "approved" };
    this.actions.set(actionId, updated);
    return updated;
  }

  /**
   * Execute an approved action
   */
  public executeAction(
    actionId: string,
    executedBy: string,
    rollbackCheckpointRef?: string | null,
  ): MitigationResult {
    const action = this.requireAction(actionId);
    if (action.status !== "approved") {
      throw new Error(`mitigation_action.not_approved:${actionId}`);
    }

    const executing: DriftMitigationAction = {
      ...action,
      status: "executing",
      executedBy,
      executedAt: nowIso(),
      rollbackCheckpointRef: rollbackCheckpointRef ?? action.rollbackCheckpointRef,
    };
    this.actions.set(actionId, executing);

    // Simulate execution (in real implementation, this would call appropriate handlers)
    const success = true;
    const result: MitigationResult = {
      actionId,
      success,
      executedAt: nowIso(),
      effect: { actionType: action.actionType, targetSubjectId: action.targetSubjectId },
      errorMessage: null,
    };

    // Update action status based on result
    const completedAction: DriftMitigationAction = {
      ...executing,
      status: success ? "completed" : "failed",
    };
    this.actions.set(actionId, completedAction);
    this.results.set(actionId, result);

    return result;
  }

  /**
   * Get action by ID
   */
  public getAction(actionId: string): DriftMitigationAction | null {
    return this.actions.get(actionId) ?? null;
  }

  /**
   * Get all actions for an alert
   */
  public getActionsForAlert(alertId: string): readonly DriftMitigationAction[] {
    return [...this.actions.values()].filter((a) => a.alertId === alertId);
  }

  /**
   * Get action result
   */
  public getResult(actionId: string): MitigationResult | null {
    return this.results.get(actionId) ?? null;
  }

  private requireAction(actionId: string): DriftMitigationAction {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`mitigation_action.not_found:${actionId}`);
    }
    return action;
  }
}
