/**
 * Failure Classification - L1/L2/L3 Failure Categories
 *
 * Classifies agent failures into levels to determine appropriate
 * remediation strategy.
 */

export type FailureLevel = 'L1' | 'L2' | 'L3';

export type FailureCategory =
  // L1: Auto-repairable
  | 'schema_error'
  | 'type_error'
  | 'unit_test_failure'
  | 'lint_error'
  | 'simple_logic_bug'
  // L2: Model upgrade required
  | 'complex_repair_failure'
  | 'review_validate_conflict'
  | 'planning_inconsistency'
  // L3: Human/agent escalation required
  | 'forbidden_path'
  | 'secret_exposure'
  | 'high_risk_operation'
  | 'migration_failure'
  | 'deployment_failure'
  | 'security_policy_violation';

export interface FailureContext {
  /** Failure category */
  category: FailureCategory;

  /** Failure level */
  level: FailureLevel;

  /** Human-readable description */
  description: string;

  /** Whether this failure can be automatically repaired */
  autoRepairable: boolean;

  /** Whether this requires model upgrade */
  requiresModelUpgrade: boolean;

  /** Whether this requires human escalation */
  requiresHumanEscalation: boolean;

  /** Repair budget consumed */
  repairBudgetUsed: number;

  /**
   * Whether this is a platform-level exception (vs coding-agent specific).
   * Platform exceptions indicate failures in platform capabilities like
   * schema validation, type checking, or other infrastructure services.
   * Coding-agent specific errors (lint_error, test_failure) should be false.
   */
  isPlatformException: boolean;
}

export const FAILURE_CLASSIFICATION: Record<FailureCategory, Omit<FailureContext, 'repairBudgetUsed'>> = {
  // L1: Auto-repairable failures
  // Platform-level exceptions (schema_error, type_error) vs coding-agent specific (lint_error, unit_test_failure)
  schema_error: {
    category: 'schema_error',
    level: 'L1',
    description: 'Output schema mismatch or validation failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true, // Schema validation is a platform capability
  },
  type_error: {
    category: 'type_error',
    level: 'L1',
    description: 'TypeScript type checking failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true, // Type checking is a platform capability
  },
  unit_test_failure: {
    category: 'unit_test_failure',
    level: 'L1',
    description: 'Unit test failed after code change',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false, // Coding-agent specific
  },
  lint_error: {
    category: 'lint_error',
    level: 'L1',
    description: 'Linter errors in generated code',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false, // Coding-agent specific
  },
  simple_logic_bug: {
    category: 'simple_logic_bug',
    level: 'L1',
    description: 'Straightforward logic error easily identifiable',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false, // Coding-agent specific
  },

  // L2: Model upgrade required
  complex_repair_failure: {
    category: 'complex_repair_failure',
    level: 'L2',
    description: 'Repair attempts failed multiple times',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  review_validate_conflict: {
    category: 'review_validate_conflict',
    level: 'L2',
    description: 'Review and validation reports disagree',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  planning_inconsistency: {
    category: 'planning_inconsistency',
    level: 'L2',
    description: 'Generated plan is inconsistent or incomplete',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },

  // L3: Human escalation required
  forbidden_path: {
    category: 'forbidden_path',
    level: 'L3',
    description: 'Attempted to modify forbidden path',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  secret_exposure: {
    category: 'secret_exposure',
    level: 'L3',
    description: 'Secret or credential detected in output',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  high_risk_operation: {
    category: 'high_risk_operation',
    level: 'L3',
    description: 'High-risk operation detected',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  migration_failure: {
    category: 'migration_failure',
    level: 'L3',
    description: 'Database migration failed',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  deployment_failure: {
    category: 'deployment_failure',
    level: 'L3',
    description: 'Deployment or post-deployment check failed',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  security_policy_violation: {
    category: 'security_policy_violation',
    level: 'L3',
    description: 'Security policy violation detected',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
};

export function classifyFailure(
  category: FailureCategory,
  repairBudgetUsed: number
): FailureContext {
  return {
    ...FAILURE_CLASSIFICATION[category],
    repairBudgetUsed,
  };
}

export function shouldEscalate(failure: FailureContext, maxRepairRounds: number): boolean {
  // L3 always escalates
  if (failure.level === 'L3') return true;

  // L2 after one failed repair
  if (failure.level === 'L2' && failure.repairBudgetUsed >= 1) return true;

  // Exhausted repair budget
  if (failure.repairBudgetUsed >= maxRepairRounds) return true;

  return false;
}
