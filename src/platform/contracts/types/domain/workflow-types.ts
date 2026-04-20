/**
 * @fileoverview Workflow Types - Compensation, checkpoint, and workflow-level plans.
 *
 * Contains records related to workflow execution planning including
 * compensation plans, checkpoint plans, and workflow-level aggregates.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

// ---------------------------------------------------------------------------
// Compensation plan types
// ---------------------------------------------------------------------------

/**
 * Compensation plan for a workflow step with side effects.
 * Built during static analysis per workflow_static_analysis_and_compensation_contract.md §5.
 */
export interface CompensationPlanEntry {
  /** Step this compensation applies to */
  stepId: string;
  /** Compensation strategy declared on the step */
  compensationModel: "idempotent_replay" | "compare_and_swap_write" | "compensating_action" | "manual_reconciliation_required";
  /** Condition that triggers compensation (e.g., "step_failed", "downstream_cascade_failed") */
  triggerCondition: string;
  /** Role or agent responsible for executing compensation */
  compensationOwner: string;
  /** Maximum time allowed for the compensation action */
  compensationTimeoutMs: number;
  /** Whether the compensation action itself is idempotent */
  compensationIdempotent: boolean;
  /** Artifact kind that records evidence of compensation execution */
  evidenceArtifactKind: string;
}

/**
 * Complete compensation plan for a workflow execution.
 */
export interface CompensationPlan {
  workflowId: string;
  divisionId: string;
  entries: CompensationPlanEntry[];
}

// ---------------------------------------------------------------------------
// Checkpoint plan types
// ---------------------------------------------------------------------------

/**
 * Checkpoint plan for long-running task sharding.
 * Built during static analysis per workflow_static_analysis_and_compensation_contract.md §6.
 */
export interface CheckpointPlanEntry {
  /** Step ID after which a checkpoint boundary exists */
  afterStepId: string;
  /** Whether this checkpoint is at a side-effect boundary */
  sideEffectBoundary: boolean;
  /** Recovery strategy if execution fails after this checkpoint */
  recoveryStrategy: "resume_from_checkpoint" | "replay_from_start" | "manual_reconciliation";
}

/**
 * Complete checkpoint plan for a workflow execution.
 */
export interface CheckpointPlan {
  workflowId: string;
  divisionId: string;
  entries: CheckpointPlanEntry[];
}
