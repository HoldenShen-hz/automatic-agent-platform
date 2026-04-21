/**
 * Failure Classification - L1/L2/L3 Failure Categories
 *
 * Classifies agent failures into levels to determine appropriate
 * remediation strategy.
 */
export type FailureLevel = 'L1' | 'L2' | 'L3';
export type FailureCategory = 'schema_error' | 'type_error' | 'unit_test_failure' | 'lint_error' | 'simple_logic_bug' | 'complex_repair_failure' | 'review_validate_conflict' | 'planning_inconsistency' | 'forbidden_path' | 'secret_exposure' | 'high_risk_operation' | 'migration_failure' | 'deployment_failure' | 'security_policy_violation';
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
}
export declare const FAILURE_CLASSIFICATION: Record<FailureCategory, Omit<FailureContext, 'repairBudgetUsed'>>;
export declare function classifyFailure(category: FailureCategory, repairBudgetUsed: number): FailureContext;
export declare function shouldEscalate(failure: FailureContext, maxRepairRounds: number): boolean;
