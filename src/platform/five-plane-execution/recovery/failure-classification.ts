/**
 * Failure Classification - canonical recovery categories
 *
 * Legacy revisions used internal `L1/L2/L3` labels. That naming drifted from the
 * platform recovery contracts, which classify failure handling as
 * `transient/permanent/unknown`. Keep the legacy projection as metadata so older
 * evidence remains readable, but expose the canonical level on the main field.
 */

export type FailureLevel = "transient" | "permanent" | "unknown";
export type LegacyFailureLevel = "L1" | "L2" | "L3";

export type FailureCategory =
  // Platform-level exceptions (generic)
  | 'resource_exhausted'
  | 'timeout_exceeded'
  | 'dependency_unavailable'
  | 'quota_exceeded'
  | 'rate_limit_exceeded'
  | 'circuit_breaker_open'
  | 'concurrency_limit_exceeded'
  | 'validation_error'
  | 'state_transition_error'
  // transient: Auto-repairable (coding-agent + generic)
  | 'schema_error'
  | 'type_error'
  | 'unit_test_failure'
  | 'lint_error'
  | 'simple_logic_bug'
  // unknown: Model upgrade required
  | 'complex_repair_failure'
  | 'review_validate_conflict'
  | 'planning_inconsistency'
  // permanent: Human/agent escalation required
  | 'forbidden_path'
  | 'secret_exposure'
  | 'high_risk_operation'
  | 'migration_failure'
  | 'deployment_failure'
  | 'security_policy_violation'
  // Platform-level permanent escalations
  | 'deadlock_detected'
  | 'data_inconsistency'
  | 'governance_policy_violation'
  | 'budget_exceeded';

export interface FailureContext {
  /** Failure category */
  category: FailureCategory;

  /** Failure level */
  level: FailureLevel;

  /** Legacy compatibility label kept for older repair evidence */
  legacyLevel: LegacyFailureLevel;

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

  /** Whether this is a platform-level exception (vs coding-agent) */
  isPlatformException: boolean;
}

export const FAILURE_CLASSIFICATION: Record<FailureCategory, Omit<FailureContext, "repairBudgetUsed">> = {
  // Platform-level transient: Auto-repairable generic errors
  resource_exhausted: {
    category: 'resource_exhausted',
    level: "transient",
    legacyLevel: "L1",
    description: 'System resource (memory, disk, CPU) exhausted',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  timeout_exceeded: {
    category: 'timeout_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Operation exceeded configured timeout',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  dependency_unavailable: {
    category: 'dependency_unavailable',
    level: "transient",
    legacyLevel: "L1",
    description: 'Required dependency service unavailable',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  quota_exceeded: {
    category: 'quota_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Resource quota limit reached',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  rate_limit_exceeded: {
    category: 'rate_limit_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'API rate limit exceeded',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  circuit_breaker_open: {
    category: 'circuit_breaker_open',
    level: "transient",
    legacyLevel: "L1",
    description: 'Circuit breaker prevented request',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  concurrency_limit_exceeded: {
    category: 'concurrency_limit_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Concurrency limit reached for resource',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  validation_error: {
    category: 'validation_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Input validation failed',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },
  state_transition_error: {
    category: 'state_transition_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Invalid state transition attempted',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
  },

  // transient: Auto-repairable failures (coding-agent specific)
  schema_error: {
    category: 'schema_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Output schema mismatch or validation failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  type_error: {
    category: 'type_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'TypeScript type checking failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  unit_test_failure: {
    category: 'unit_test_failure',
    level: "transient",
    legacyLevel: "L1",
    description: 'Unit test failed after code change',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  lint_error: {
    category: 'lint_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Linter errors in generated code',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  simple_logic_bug: {
    category: 'simple_logic_bug',
    level: "transient",
    legacyLevel: "L1",
    description: 'Straightforward logic error easily identifiable',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },

  // unknown: Model upgrade required
  complex_repair_failure: {
    category: 'complex_repair_failure',
    level: "unknown",
    legacyLevel: "L2",
    description: 'Repair attempts failed multiple times',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  review_validate_conflict: {
    category: 'review_validate_conflict',
    level: "unknown",
    legacyLevel: "L2",
    description: 'Review and validation reports disagree',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },
  planning_inconsistency: {
    category: 'planning_inconsistency',
    level: "unknown",
    legacyLevel: "L2",
    description: 'Generated plan is inconsistent or incomplete',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
  },

  // permanent: Human escalation required
  forbidden_path: {
    category: 'forbidden_path',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Attempted to modify forbidden path',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  secret_exposure: {
    category: 'secret_exposure',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Secret or credential detected in output',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  high_risk_operation: {
    category: 'high_risk_operation',
    level: "permanent",
    legacyLevel: "L3",
    description: 'High-risk operation detected',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  migration_failure: {
    category: 'migration_failure',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Database migration failed',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },
  deployment_failure: {
    category: 'deployment_failure',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Deployment or post-deployment check failed',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
  },
  security_policy_violation: {
    category: 'security_policy_violation',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Security policy violation detected',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },

  // Platform-level permanent escalations
  deadlock_detected: {
    category: 'deadlock_detected',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Deadlock detected in resource contention',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },
  data_inconsistency: {
    category: 'data_inconsistency',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Data inconsistency detected between systems',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },
  governance_policy_violation: {
    category: 'governance_policy_violation',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Governance policy violation detected',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },
  budget_exceeded: {
    category: 'budget_exceeded',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Budget limit exceeded during execution',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
  },
};

/**
 * Classifies an error code into a failure category using pattern matching.
 * Supports both platform-level error codes and coding-agent error codes.
 */
export function classifyErrorCode(errorCode: string | null): FailureCategory {
  if (errorCode == null) {
    return 'validation_error';
  }

  const normalized = errorCode
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[.\-]/g, "_");

  // Coding-agent specific runtime prefixes must be resolved before generic
  // keyword matching, otherwise strings like E7_LockTimeout get swallowed by
  // the timeout classifier before the lock/concurrency mapping can apply.
  if (errorCode.startsWith('E7')) {
    return 'concurrency_limit_exceeded'; // E7 = LockingError
  }
  if (errorCode.startsWith('E8')) {
    return 'resource_exhausted'; // E8 = MemoryError
  }
  if (errorCode.startsWith('EC')) {
    return 'state_transition_error'; // EC = RuntimeError
  }

  // Platform-level patterns
  if (normalized.includes('resource_exhaust') || normalized.includes('out_of_memory') || normalized.includes('memory')) {
    return 'resource_exhausted';
  }
  if (normalized.includes('timeout') || normalized.includes('timed_out') || normalized.includes('time_out')) {
    return 'timeout_exceeded';
  }
  if (normalized.includes('dependency') && (normalized.includes('unavailable') || normalized.includes('not_found'))) {
    return 'dependency_unavailable';
  }
  if (normalized.includes('quota') || normalized.includes('limit_reached') || normalized.includes('cap_reached')) {
    return 'quota_exceeded';
  }
  if (normalized.includes('rate_limit') || normalized.includes('too_many_requests')) {
    return 'rate_limit_exceeded';
  }
  if (normalized.includes('circuit_breaker') || normalized.includes('breaker')) {
    return 'circuit_breaker_open';
  }
  if (normalized.includes('concurrency') || normalized.includes('parallel')) {
    return 'concurrency_limit_exceeded';
  }
  if (normalized.includes('validation') || normalized.includes('invalid_input')) {
    return 'validation_error';
  }
  if (normalized.includes('state_transition') || normalized.includes('invalid_state')) {
    return 'state_transition_error';
  }
  if (normalized.includes('deadlock') || normalized.includes('dead_lock')) {
    return 'deadlock_detected';
  }
  if (normalized.includes('governance')) {
    return 'governance_policy_violation';
  }
  if (normalized.includes('budget') || normalized.includes('cost_exceed')) {
    return 'budget_exceeded';
  }
  if (normalized.includes('type_mismatch') || normalized.includes('typemismatch')) {
    return 'type_error';
  }

  if (normalized.includes('migration') || normalized.includes('schema_change')) {
    return 'migration_failure';
  }
  if (normalized.includes('security') || normalized.includes('policy')) {
    return 'security_policy_violation';
  }
  if (normalized.includes('data_inconsist') || normalized.includes('mismatch')) {
    return 'data_inconsistency';
  }

  // transient coding patterns
  if (normalized.includes('schema') || normalized.includes('parse')) {
    return 'schema_error';
  }
  if (
    (normalized.includes('type') && normalized.includes('error'))
    || normalized.includes('type_mismatch')
    || normalized.includes('typemismatch')
  ) {
    return 'type_error';
  }
  if (normalized.includes('test') && (normalized.includes('fail') || normalized.includes('error'))) {
    return 'unit_test_failure';
  }
  if (normalized.includes('lint')) {
    return 'lint_error';
  }

  // permanent patterns
  if (normalized.includes('forbidden') || normalized.includes('access_denied')) {
    return 'forbidden_path';
  }
  if (normalized.includes('secret') || normalized.includes('credential') || normalized.includes('api_key')) {
    return 'secret_exposure';
  }
  if (normalized.includes('high_risk') || normalized.includes('dangerous')) {
    return 'high_risk_operation';
  }
  if (normalized.includes('deploy') || normalized.includes('rollback')) {
    return 'deployment_failure';
  }

  // Default to validation error for unknown codes
  return 'validation_error';
}

export function classifyFailure(
  category: FailureCategory,
  repairBudgetUsed: number
): FailureContext {
  return {
    ...FAILURE_CLASSIFICATION[category],
    repairBudgetUsed,
  };
}

export function classifyFailureFromErrorCode(
  errorCode: string | null,
  repairBudgetUsed: number
): FailureContext {
  const category = classifyErrorCode(errorCode);
  return classifyFailure(category, repairBudgetUsed);
}

export function shouldEscalate(failure: FailureContext, maxRepairRounds: number): boolean {
  // permanent failures always escalate
  if (failure.level === "permanent") return true;

  // unknown failures escalate after one failed repair
  if (failure.level === "unknown" && failure.repairBudgetUsed >= 1) return true;

  // Exhausted repair budget
  if (failure.repairBudgetUsed >= maxRepairRounds) return true;

  return false;
}
