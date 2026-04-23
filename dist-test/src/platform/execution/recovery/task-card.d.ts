/**
 * TaskCard - Structured Task Definition
 *
 * A structured representation of a task that constrains the agent's
 * decision space and enables verification. Every task entering the
 * system must be represented as a TaskCard.
 */
export type TaskRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TaskStage = 'plan' | 'build' | 'review' | 'validate' | 'release';
export interface TaskCard {
    /** Unique task identifier */
    taskId: string;
    /** Human-readable task title */
    title: string;
    /** Task objective */
    objective: string;
    /** Risk classification */
    riskLevel: TaskRiskLevel;
    /** Current execution stage */
    stage: TaskStage;
    /** Paths the agent is allowed to modify */
    allowedPaths: readonly string[];
    /** Paths the agent is forbidden from modifying */
    forbiddenPaths: readonly string[];
    /** Maximum number of files that can be changed */
    maxChangedFiles: number;
    /** Maximum diff lines allowed */
    maxDiffLines: number;
    /** Required verification checks */
    requiredChecks: readonly TaskCheck[];
    /** Release strategy */
    releaseStrategy: ReleaseStrategy;
    /** Repair budget (max repair rounds before escalation) */
    maxRepairRounds: number;
    /** Creation timestamp */
    createdAt: string;
    /** Deadline if any */
    deadlineAt?: string;
}
export interface TaskCheck {
    /** Check identifier */
    id: string;
    /** Check name */
    name: string;
    /** Whether this check is required for completion */
    required: boolean;
    /** Check type */
    type: 'typecheck' | 'lint' | 'test' | 'security' | 'review' | 'custom';
}
export interface ReleaseStrategy {
    /** Whether feature flag is required */
    requireFeatureFlag: boolean;
    /** Whether human gate is required */
    requireHumanGate: boolean;
    /** Allowed release environments */
    allowedEnvironments: readonly string[];
    /** Rollback plan */
    rollbackPlan?: string;
}
export declare function createTaskCard(input: {
    taskId: string;
    title: string;
    objective: string;
    riskLevel: TaskRiskLevel;
    allowedPaths?: readonly string[];
    forbiddenPaths?: readonly string[];
    maxChangedFiles?: number;
    maxDiffLines?: number;
    requiredChecks?: readonly TaskCheck[];
    releaseStrategy?: ReleaseStrategy;
    maxRepairRounds?: number;
    deadlineAt?: string;
}): TaskCard;
export declare function validateTaskCard(card: TaskCard): ValidationResult;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
