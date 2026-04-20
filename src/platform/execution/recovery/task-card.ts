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

export function createTaskCard(input: {
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
}): TaskCard {
  const {
    taskId,
    title,
    objective,
    riskLevel,
    allowedPaths = ['*'],
    forbiddenPaths = ['**/secrets/**', '**/auth/**', '**/billing/**'],
    maxChangedFiles = riskLevel === 'critical' ? 1 : riskLevel === 'high' ? 3 : 10,
    maxDiffLines = riskLevel === 'critical' ? 50 : riskLevel === 'high' ? 100 : 300,
    requiredChecks = [],
    releaseStrategy = defaultReleaseStrategy(riskLevel),
    maxRepairRounds = riskLevel === 'critical' ? 0 : riskLevel === 'high' ? 1 : 2,
    deadlineAt,
  } = input;

  return {
    taskId,
    title,
    objective,
    riskLevel,
    stage: 'plan',
    allowedPaths,
    forbiddenPaths,
    maxChangedFiles,
    maxDiffLines,
    requiredChecks,
    releaseStrategy,
    maxRepairRounds,
    createdAt: new Date().toISOString(),
    ...(deadlineAt !== undefined && { deadlineAt }),
  };
}

function defaultReleaseStrategy(riskLevel: TaskRiskLevel): ReleaseStrategy {
  return {
    requireFeatureFlag: riskLevel !== 'low',
    requireHumanGate: riskLevel === 'critical' || riskLevel === 'high',
    allowedEnvironments: riskLevel === 'low' ? ['development', 'staging', 'production']
      : riskLevel === 'medium' ? ['development', 'staging']
      : ['development'],
  };
}

export function validateTaskCard(card: TaskCard): ValidationResult {
  const errors: string[] = [];

  if (!card.taskId) errors.push('taskId is required');
  if (!card.objective) errors.push('objective is required');
  if (!card.riskLevel) errors.push('riskLevel is required');
  if (card.maxChangedFiles < 1) errors.push('maxChangedFiles must be >= 1');
  if (card.maxDiffLines < 1) errors.push('maxDiffLines must be >= 1');
  if (card.maxRepairRounds < 0) errors.push('maxRepairRounds must be >= 0');

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
