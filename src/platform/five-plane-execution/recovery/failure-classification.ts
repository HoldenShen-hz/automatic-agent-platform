/**
 * Failure Classification - canonical recovery categories
 *
 * Per §9.6 exception classification taxonomy, this module provides a generic
 * platform exception classifier that handles:
 * - Infrastructure errors (network, storage, compute failures)
 * - Resource exhaustion (memory, disk, CPU, GPU)
 * - Auth/authz errors (authentication, authorization failures)
 * - Validation errors (input, output, state validation)
 * - Timeout errors (operation timeouts, deadline exceeded)
 * - Capacity errors (concurrency, rate limiting, quota)
 * - Transient vs permanent failure determination
 *
 * Legacy revisions used internal `L1/L2/L3` labels. That naming drifted from the
 * platform recovery contracts, which classify failure handling as
 * `transient/permanent/unknown`. Keep the legacy projection as metadata so older
 * evidence remains readable, but expose the canonical level on the main field.
 */

export type FailureLevel = "transient" | "permanent" | "unknown";
export type LegacyFailureLevel = "L1" | "L2" | "L3";

/**
 * Recovery strategy determined by failure classification.
 * §9.6 requires explicit mapping from exception type to recovery action.
 */
export type RecoveryStrategy =
  | 'retry'           // Immediate retry for transient failures
  | 'backoff_retry'   // Exponential backoff retry for rate-limited/transient
  | 'escalate'        // Escalate to human agent or higher authority
  | 'fail'            // Fail immediately, no recovery possible
  | 'degrade'         // Continue with reduced functionality
  | 'checkpoint_restore'; // Restore from last known good checkpoint

export type FailureCategory =
  // Platform-level exceptions (generic) - §9.6 taxonomy
  // Infrastructure errors
  | 'infrastructure_error'
  | 'network_error'
  | 'storage_error'
  | 'compute_error'
  // Resource exhaustion
  | 'resource_exhausted'
  | 'memory_exhausted'
  | 'disk_space_exhausted'
  | 'cpu_exhausted'
  // Auth/authz errors
  | 'authentication_error'
  | 'authorization_error'
  | 'session_expired'
  | 'token_invalid'
  // Validation errors
  | 'validation_error'
  | 'input_validation_error'
  | 'output_validation_error'
  | 'schema_error'
  // Timeout errors
  | 'timeout_exceeded'
  | 'deadline_exceeded'
  | 'operation_timed_out'
  // Capacity errors
  | 'concurrency_limit_exceeded'
  | 'rate_limit_exceeded'
  | 'quota_exceeded'
  | 'throughput_limit_exceeded'
  // Transient infrastructure
  | 'dependency_unavailable'
  | 'circuit_breaker_open'
  | 'service_unavailable'
  // State errors
  | 'state_transition_error'
  | 'invalid_state_error'
  // transient: Auto-repairable (coding-agent + generic)
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

  /** Recovery strategy per §9.6 taxonomy */
  recoveryStrategy: RecoveryStrategy;
}

export const FAILURE_CLASSIFICATION: Record<FailureCategory, Omit<FailureContext, "repairBudgetUsed">> = {
  // ============================================================================
  // Platform-level exceptions (generic) - §9.6 taxonomy
  // ============================================================================

  // Infrastructure errors
  infrastructure_error: {
    category: 'infrastructure_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Generic infrastructure failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  network_error: {
    category: 'network_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Network connectivity or communication failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  storage_error: {
    category: 'storage_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Storage read/write failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  compute_error: {
    category: 'compute_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Compute resource failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },

  // Resource exhaustion
  resource_exhausted: {
    category: 'resource_exhausted',
    level: "transient",
    legacyLevel: "L1",
    description: 'System resource (memory, disk, CPU) exhausted',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  memory_exhausted: {
    category: 'memory_exhausted',
    level: "transient",
    legacyLevel: "L1",
    description: 'Memory limit exceeded',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  disk_space_exhausted: {
    category: 'disk_space_exhausted',
    level: "transient",
    legacyLevel: "L1",
    description: 'Disk space exhausted',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  cpu_exhausted: {
    category: 'cpu_exhausted',
    level: "transient",
    legacyLevel: "L1",
    description: 'CPU limit exceeded',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },

  // Auth/authz errors
  authentication_error: {
    category: 'authentication_error',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Authentication failed (invalid credentials)',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
    recoveryStrategy: 'escalate',
  },
  authorization_error: {
    category: 'authorization_error',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Authorization failed (insufficient permissions)',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: true,
    recoveryStrategy: 'escalate',
  },
  session_expired: {
    category: 'session_expired',
    level: "transient",
    legacyLevel: "L1",
    description: 'User session has expired',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  token_invalid: {
    category: 'token_invalid',
    level: "transient",
    legacyLevel: "L1",
    description: 'Invalid or expired token',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },

  // Validation errors
  validation_error: {
    category: 'validation_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Input validation failed',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  input_validation_error: {
    category: 'input_validation_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Input parameter validation failed',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  output_validation_error: {
    category: 'output_validation_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Output validation failed',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'retry',
  },
  schema_error: {
    category: 'schema_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Output schema mismatch or validation failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
    recoveryStrategy: 'retry',
  },

  // Timeout errors
  timeout_exceeded: {
    category: 'timeout_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Operation exceeded configured timeout',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  deadline_exceeded: {
    category: 'deadline_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Deadline exceeded for operation',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },
  operation_timed_out: {
    category: 'operation_timed_out',
    level: "transient",
    legacyLevel: "L1",
    description: 'Operation timed out',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },

  // Capacity errors
  concurrency_limit_exceeded: {
    category: 'concurrency_limit_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Concurrency limit reached for resource',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
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
    recoveryStrategy: 'backoff_retry',
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
    recoveryStrategy: 'backoff_retry',
  },
  throughput_limit_exceeded: {
    category: 'throughput_limit_exceeded',
    level: "transient",
    legacyLevel: "L1",
    description: 'Throughput limit exceeded',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },

  // Transient infrastructure
  dependency_unavailable: {
    category: 'dependency_unavailable',
    level: "transient",
    legacyLevel: "L1",
    description: 'Required dependency service unavailable',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
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
    recoveryStrategy: 'backoff_retry',
  },
  service_unavailable: {
    category: 'service_unavailable',
    level: "transient",
    legacyLevel: "L1",
    description: 'Target service is temporarily unavailable',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'backoff_retry',
  },

  // State errors
  state_transition_error: {
    category: 'state_transition_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Invalid state transition attempted',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'checkpoint_restore',
  },
  invalid_state_error: {
    category: 'invalid_state_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'Invalid state detected',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: true,
    recoveryStrategy: 'checkpoint_restore',
  },

  // ============================================================================
  // Coding-agent specific transient failures
  // ============================================================================
  type_error: {
    category: 'type_error',
    level: "transient",
    legacyLevel: "L1",
    description: 'TypeScript type checking failure',
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    isPlatformException: false,
    recoveryStrategy: 'retry',
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
    recoveryStrategy: 'retry',
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
    recoveryStrategy: 'retry',
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
    recoveryStrategy: 'retry',
  },

  // ============================================================================
  // Unknown: Model upgrade required
  // ============================================================================
  complex_repair_failure: {
    category: 'complex_repair_failure',
    level: "unknown",
    legacyLevel: "L2",
    description: 'Repair attempts failed multiple times',
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    isPlatformException: false,
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
  },

  // ============================================================================
  // Permanent: Human escalation required
  // ============================================================================
  forbidden_path: {
    category: 'forbidden_path',
    level: "permanent",
    legacyLevel: "L3",
    description: 'Attempted to modify forbidden path',
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    isPlatformException: false,
    recoveryStrategy: 'fail',
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
    recoveryStrategy: 'fail',
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
    recoveryStrategy: 'fail',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'fail',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
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
    recoveryStrategy: 'escalate',
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

  // Platform-level patterns - Infrastructure errors
  if (normalized.includes('network') || normalized.includes('connectivity') || normalized.includes('connection_error')) {
    return 'network_error';
  }
  if (normalized.includes('storage') || normalized.includes('disk') || normalized.includes('io_error')) {
    return 'storage_error';
  }
  if (normalized.includes('compute') || normalized.includes('cpu')) {
    return 'compute_error';
  }

  // Auth/authz errors
  if (normalized.includes('authentication_error') || normalized.includes('auth_error') || normalized.includes('invalid_credentials') || normalized.includes('login_failed')) {
    return 'authentication_error';
  }
  if (normalized.includes('authorization_error') || normalized.includes('access_denied') || normalized.includes('permission_denied') || normalized.includes('forbidden')) {
    return 'authorization_error';
  }
  if (normalized.includes('session_expired') || normalized.includes('session_invalid')) {
    return 'session_expired';
  }
  if (normalized.includes('token_invalid') || normalized.includes('token_expired') || normalized.includes('jwt')) {
    return 'token_invalid';
  }

  // Resource exhaustion - specific types
  if (normalized.includes('memory_exhaust') || normalized.includes('out_of_memory') || normalized.includes('oom')) {
    return 'memory_exhausted';
  }
  if (normalized.includes('disk_space') || normalized.includes('disk_full') || normalized.includes('no_space')) {
    return 'disk_space_exhausted';
  }
  if (normalized.includes('cpu_exhaust') || normalized.includes('cpu_limit')) {
    return 'cpu_exhausted';
  }
  if (normalized.includes('resource_exhaust') || normalized.includes('out_of_resource')) {
    return 'resource_exhausted';
  }

  // Validation errors
  if (normalized.includes('input_validation') || normalized.includes('invalid_input')) {
    return 'input_validation_error';
  }
  if (normalized.includes('output_validation')) {
    return 'output_validation_error';
  }

  // Timeout errors
  if (normalized.includes('deadline') || normalized.includes('deadline_exceeded')) {
    return 'deadline_exceeded';
  }
  if (normalized.includes('operation_timed_out') || normalized.includes('operation_timeout')) {
    return 'operation_timed_out';
  }

  // Capacity errors
  if (normalized.includes('throughput') || normalized.includes('throughput_limit')) {
    return 'throughput_limit_exceeded';
  }

  // Transient infrastructure
  if (normalized.includes('service_unavailable') || normalized.includes('service_down')) {
    return 'service_unavailable';
  }

  // State errors
  if (normalized.includes('invalid_state') && !normalized.includes('state_transition')) {
    return 'invalid_state_error';
  }

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
