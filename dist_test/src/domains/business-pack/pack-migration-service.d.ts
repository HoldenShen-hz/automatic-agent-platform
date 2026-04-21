/**
 * @fileoverview Pack Migration Service - Pack migration tooling
 *
 * Implements pack migration as defined in architecture doc §30:
 * - Migrate from one pack version to another
 * - Validate migration prerequisites
 * - Execute migration steps with rollback support
 * - Track migration history
 *
 * @see docs_zh/architecture/00-platform-architecture.md §30
 */
/**
 * Migration step for executing changes.
 */
export interface MigrationStep {
    stepId: string;
    description: string;
    order: number;
    execute: () => Promise<void>;
    rollback: () => Promise<void>;
}
/**
 * Migration plan defining source, target, and steps.
 */
export interface MigrationPlan {
    planId: string;
    fromPackId: string;
    toPackId: string;
    status: MigrationStatus;
    steps: readonly MigrationPlanStep[];
    createdAt: string;
    executedAt: string | null;
    completedAt: string | null;
    rolledBackAt: string | null;
    error: string | null;
}
/**
 * A planned step in the migration.
 */
export interface MigrationPlanStep {
    stepId: string;
    description: string;
    order: number;
    estimatedDurationMinutes: number;
}
/**
 * Migration status.
 */
export type MigrationStatus = "planned" | "validated" | "executing" | "completed" | "failed" | "rolling_back" | "rolled_back";
/**
 * Validation result for migration prerequisites.
 */
export interface MigrationValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Migration execution result.
 */
export interface MigrationExecutionResult {
    success: boolean;
    planId: string;
    executedSteps: number;
    error: string | null;
}
/**
 * Pack Migration Service
 *
 * Manages migration between Business Packs:
 * - Create migration plans with steps
 * - Validate migration prerequisites
 * - Execute migrations with rollback support
 * - Track migration history
 */
export declare class PackMigrationService {
    private readonly plans;
    private readonly executedSteps;
    private readonly rollbackHistory;
    /**
     * Creates a migration plan from one pack to another.
     */
    createMigrationPlan(fromPackId: string, toPackId: string): MigrationPlan;
    /**
     * Validates migration prerequisites.
     */
    validateMigration(planId: string): MigrationValidationResult;
    /**
     * Executes a migration plan.
     */
    executeMigration(planId: string): Promise<MigrationExecutionResult>;
    /**
     * Rolls back a failed or completed migration.
     */
    rollbackMigration(planId: string): Promise<MigrationExecutionResult>;
    /**
     * Gets a migration plan by ID.
     */
    getMigrationPlan(planId: string): MigrationPlan | null;
    /**
     * Lists all migration plans.
     */
    listMigrationPlans(): MigrationPlan[];
    /**
     * Lists migrations for a specific pack.
     */
    listMigrationsForPack(packId: string): MigrationPlan[];
    /**
     * Checks if a migration was rolled back.
     */
    wasRolledBack(planId: string): boolean;
    private generateMigrationSteps;
    private executeStep;
    private rollbackStep;
    private validationError;
}
