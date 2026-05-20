/**
 * EdgeRiskGate - R21-13
 *
 * Encapsulates risk threshold evaluation for edge offline execution requests.
 * Gate evaluates riskScore threshold (<= 0.5) and blocks high-risk taskTypes
 * from offline execution.
 */

import type { OfflineExecutionRequest } from "./edge-runtime-sync-service.js";

/**
 * Execution request type accepted by EdgeRiskGate.
 * Uses OfflineExecutionRequest from the sync service as the base request shape.
 */
export type EdgeExecutionRequest = OfflineExecutionRequest;

/**
 * Result returned by EdgeRiskGate.check()
 */
export interface EdgeRiskGateResult {
  /** Whether the request is allowed for offline execution */
  readonly allowed: boolean;
  /** Human-readable reason when disallowed */
  readonly reason?: string;
  /** The evaluated risk score */
  readonly riskScore: number;
}

/**
 * High-risk taskTypes that are blocked from offline execution.
 * These operations are too dangerous or irreversible to run without cloud oversight.
 */
const HIGH_RISK_TASK_TYPES = new Set(["delete", "destroy", "terminate", "force_push", "sudo"]);

/**
 * Risk score threshold - requests with riskScore above this value are disallowed.
 */
const RISK_SCORE_THRESHOLD = 0.5;

export class EdgeRiskGate {
  /**
   * Evaluates an execution request against risk threshold and taskType criteria.
   *
   * @param request - The edge execution request to evaluate
   * @returns EdgeRiskGateResult with allowed flag, reason (if disallowed), and risk score
   */
  public check(request: EdgeExecutionRequest): EdgeRiskGateResult {
    if (request.riskScore == null || !Number.isFinite(request.riskScore)) {
      return {
        allowed: false,
        reason: "edge_runtime.risk_score_required:offline_execution_requires_explicit_riskScore",
        riskScore: Number.NaN,
      };
    }
    if (request.taskType == null || request.taskType.trim().length === 0) {
      return {
        allowed: false,
        reason: "edge_runtime.task_type_required:offline_execution_requires_explicit_taskType",
        riskScore: request.riskScore,
      };
    }
    const riskScore = request.riskScore;

    // Check risk score threshold
    if (riskScore > RISK_SCORE_THRESHOLD) {
      return {
        allowed: false,
        reason: `edge_runtime.risk_score_exceeds_limit:offline_requires_riskScore_lte_${RISK_SCORE_THRESHOLD}_got_${riskScore}`,
        riskScore,
      };
    }

    // Check high-risk taskType
    if (HIGH_RISK_TASK_TYPES.has(request.taskType)) {
      return {
        allowed: false,
        reason: `edge_runtime.high_risk_task_type_blocked:offline_execution_denied_for_${request.taskType}`,
        riskScore,
      };
    }

    return {
      allowed: true,
      riskScore,
    };
  }
}
