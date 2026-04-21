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

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";

// ============================================================================
// Migration Types
// ============================================================================

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
export type MigrationStatus =
  | "planned"
  | "validated"
  | "executing"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back";

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

// ============================================================================
// Migration Service
// ============================================================================

/**
 * Pack Migration Service
 *
 * Manages migration between Business Packs:
 * - Create migration plans with steps
 * - Validate migration prerequisites
 * - Execute migrations with rollback support
 * - Track migration history
 */
export class PackMigrationService {
  private readonly plans = new Map<string, MigrationPlan>();
  private readonly executedSteps = new Map<string, string[]>();
  private readonly rollbackHistory = new Map<string, boolean>();

  /**
   * Creates a migration plan from one pack to another.
   */
  public createMigrationPlan(fromPackId: string, toPackId: string): MigrationPlan {
    if (fromPackId === toPackId) {
      throw this.validationError(
        "pack_migration.same_pack",
        "Source and target packs must be different.",
      );
    }

    const planId = `migration_${fromPackId}_to_${toPackId}_${Date.now()}`;
    const plan: MigrationPlan = {
      planId,
      fromPackId,
      toPackId,
      status: "planned",
      steps: this.generateMigrationSteps(fromPackId, toPackId),
      createdAt: nowIso(),
      executedAt: null,
      completedAt: null,
      rolledBackAt: null,
      error: null,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  /**
   * Validates migration prerequisites.
   */
  public validateMigration(planId: string): MigrationValidationResult {
    const plan = this.plans.get(planId);
    if (!plan) {
      return {
        valid: false,
        errors: [`Migration plan ${planId} not found.`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that plan is in valid state for validation
    if (plan.status !== "planned" && plan.status !== "validated") {
      errors.push(`Plan is in ${plan.status} state, cannot validate.`);
    }

    // Validate source pack exists (would check registry in real impl)
    if (!plan.fromPackId) {
      errors.push("Source pack ID is required.");
    }

    // Validate target pack exists (would check registry in real impl)
    if (!plan.toPackId) {
      errors.push("Target pack ID is required.");
    }

    // Check for steps
    if (plan.steps.length === 0) {
      warnings.push("No migration steps defined.");
    }

    // Check for circular dependencies (would do deeper validation in real impl)
    if (plan.fromPackId === plan.toPackId) {
      errors.push("Source and target packs cannot be the same.");
    }

    const updatedPlan: MigrationPlan = {
      ...plan,
      status: errors.length === 0 ? "validated" : plan.status,
    };
    this.plans.set(planId, updatedPlan);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Executes a migration plan.
   */
  public async executeMigration(planId: string): Promise<MigrationExecutionResult> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw this.validationError(
        "pack_migration.plan_not_found",
        `Migration plan ${planId} not found.`,
      );
    }

    if (plan.status !== "planned" && plan.status !== "validated") {
      throw this.validationError(
        "pack_migration.invalid_state",
        `Cannot execute plan in ${plan.status} state.`,
      );
    }

    const updatedPlan: MigrationPlan = {
      ...plan,
      status: "executing",
      executedAt: nowIso(),
    };
    this.plans.set(planId, updatedPlan);

    let executedSteps = 0;
    try {
      // Execute each step
      for (const step of plan.steps) {
        await this.executeStep(planId, step);
        executedSteps++;
      }

      const completedPlan: MigrationPlan = {
        ...updatedPlan,
        status: "completed",
        completedAt: nowIso(),
      };
      this.plans.set(planId, completedPlan);

      return {
        success: true,
        planId,
        executedSteps,
        error: null,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failedPlan: MigrationPlan = {
        ...updatedPlan,
        status: "failed",
        error: errorMsg,
      };
      this.plans.set(planId, failedPlan);

      return {
        success: false,
        planId,
        executedSteps,
        error: errorMsg,
      };
    }
  }

  /**
   * Rolls back a failed or completed migration.
   */
  public async rollbackMigration(planId: string): Promise<MigrationExecutionResult> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw this.validationError(
        "pack_migration.plan_not_found",
        `Migration plan ${planId} not found.`,
      );
    }

    if (plan.status !== "completed" && plan.status !== "failed") {
      throw this.validationError(
        "pack_migration.invalid_state",
        `Cannot rollback plan in ${plan.status} state.`,
      );
    }

    const updatedPlan: MigrationPlan = {
      ...plan,
      status: "rolling_back",
    };
    this.plans.set(planId, updatedPlan);

    const steps = this.executedSteps.get(planId) ?? [];
    let rolledBackSteps = 0;

    try {
      // Rollback in reverse order
      for (const stepId of [...steps].reverse()) {
        await this.rollbackStep(planId, stepId);
        rolledBackSteps++;
      }

      const rolledBackPlan: MigrationPlan = {
        ...updatedPlan,
        status: "rolled_back",
        rolledBackAt: nowIso(),
      };
      this.plans.set(planId, rolledBackPlan);
      this.rollbackHistory.set(planId, true);

      return {
        success: true,
        planId,
        executedSteps: rolledBackSteps,
        error: null,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failedRollbackPlan: MigrationPlan = {
        ...updatedPlan,
        status: "failed",
        error: `Rollback failed: ${errorMsg}`,
      };
      this.plans.set(planId, failedRollbackPlan);

      return {
        success: false,
        planId,
        executedSteps: rolledBackSteps,
        error: errorMsg,
      };
    }
  }

  /**
   * Gets a migration plan by ID.
   */
  public getMigrationPlan(planId: string): MigrationPlan | null {
    return this.plans.get(planId) ?? null;
  }

  /**
   * Lists all migration plans.
   */
  public listMigrationPlans(): MigrationPlan[] {
    return [...this.plans.values()];
  }

  /**
   * Lists migrations for a specific pack.
   */
  public listMigrationsForPack(packId: string): MigrationPlan[] {
    return [...this.plans.values()].filter(
      (plan) => plan.fromPackId === packId || plan.toPackId === packId,
    );
  }

  /**
   * Checks if a migration was rolled back.
   */
  public wasRolledBack(planId: string): boolean {
    return this.rollbackHistory.get(planId) ?? false;
  }

  private generateMigrationSteps(fromPackId: string, toPackId: string): readonly MigrationPlanStep[] {
    // Generate default migration steps
    return [
      {
        stepId: `${fromPackId}_export_state`,
        description: `Export state from ${fromPackId}`,
        order: 1,
        estimatedDurationMinutes: 5,
      },
      {
        stepId: `${toPackId}_validate_target`,
        description: `Validate target ${toPackId} is ready`,
        order: 2,
        estimatedDurationMinutes: 2,
      },
      {
        stepId: `${fromPackId}_to_${toPackId}_transfer`,
        description: `Transfer data from ${fromPackId} to ${toPackId}`,
        order: 3,
        estimatedDurationMinutes: 10,
      },
      {
        stepId: `${toPackId}_verify`,
        description: `Verify ${toPackId} state`,
        order: 4,
        estimatedDurationMinutes: 3,
      },
    ];
  }

  private async executeStep(planId: string, step: MigrationPlanStep): Promise<void> {
    // Track executed step
    const steps = this.executedSteps.get(planId) ?? [];
    steps.push(step.stepId);
    this.executedSteps.set(planId, steps);

    // In a real implementation, this would execute the step
    // For now, we just simulate execution
    await Promise.resolve();
  }

  private async rollbackStep(planId: string, stepId: string): Promise<void> {
    // In a real implementation, this would rollback the step
    // For now, we just simulate rollback
    await Promise.resolve();
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}
