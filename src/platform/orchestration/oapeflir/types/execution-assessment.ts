/**
 * ExecutionAssessment — complete post-execution assessment of a plan run.
 *
 * §4.4: Full execution assessment with outcome classification, quality scoring,
 * deviation analysis, and recommendations for replanning or approval.
 */

import type { AssessmentPhase, AssessmentComplexity, AssessmentRisk, ExecutionMode } from "./unified-assessment.js";
import type { SuccessCriterion } from "./success-criterion.js";
import type { FailureMode } from "./failure-mode.js";

export interface ExecutionAssessment {
  /** Unique identifier for this assessment */
  assessmentId: string;
  /** Task this assessment is for */
  taskId: string;
  /** Execution ID this assessment covers */
  executionId: string;
  /** Plan version that was executed */
  planVersion: number;
  /** Timestamp of this assessment */
  timestamp: number;
  /** Execution outcome */
  outcome: ExecutionOutcome;
  /** Execution quality score (0-1) */
  qualityScore: number;
  /** Whether the execution succeeded */
  success: boolean;
  /** Number of steps executed */
  stepsExecuted: number;
  /** Total steps in plan */
  stepsTotal: number;
  /** Whether all steps completed */
  stepsCompleted: boolean;
  /** Duration of execution in milliseconds */
  durationMs: number;
  /** Deviations from the planned workflow */
  deviations: ExecutionDeviation[];
  /** Errors encountered during execution */
  errors: ExecutionError[];
  /** Success criteria assessment results */
  criteriaResults: CriterionResult[];
  /** Primary failure mode if execution failed */
  primaryFailureMode: FailureMode | null;
  /** Confidence in this assessment (0-1) */
  confidence: number;
  /** Recommendations for next steps */
  recommendations: string[];
}

export type ExecutionOutcome = "completed" | "completed_with_deviations" | "repairable" | "failed" | "escalated";

export interface ExecutionDeviation {
  /** Step ID where deviation occurred */
  stepId: string;
  /** Type of deviation */
  deviationType: "skipped" | "reordered" | "modified" | "added" | "substituted";
  /** Description of what changed */
  description: string;
  /** Whether this deviation required repair */
  requiredRepair: boolean;
}

export interface ExecutionError {
  /** Step ID where error occurred */
  stepId: string;
  /** Error code */
  errorCode: string;
  /** Human-readable message */
  message: string;
  /** Severity */
  severity: "warning" | "error" | "critical";
  /** Whether this error is recoverable */
  recoverable: boolean;
}

export interface CriterionResult {
  /** Criterion that was evaluated */
  criterion: SuccessCriterion;
  /** Whether the criterion passed */
  passed: boolean;
  /** Actual value observed */
  actualValue: unknown;
  /** Details if criterion failed */
  failureReason?: string;
}
