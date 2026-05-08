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
  nodeId?: string;
  /** @deprecated legacy migration label; use nodeId */
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
  nodeId?: string;
  /** @deprecated legacy migration label; use nodeId */
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

export interface MigrationStepExecutionRecord {
  readonly planId: string;
  readonly nodeId?: string;
  readonly stepId: string;
  readonly phase: "execute" | "rollback";
  readonly status: "completed";
  readonly detail: string;
  readonly occurredAt: string;
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
  private readonly packStates = new Map<string, Record<string, unknown>>();
  private readonly exportedSnapshots = new Map<string, Record<string, unknown>>();
  private readonly executionTrace = new Map<string, MigrationStepExecutionRecord[]>();

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

  public seedPackState(packId: string, state: Record<string, unknown>): void {
    this.packStates.set(packId, { ...state });
  }

  public getPackState(packId: string): Record<string, unknown> | null {
    const record = this.packStates.get(packId);
    return record == null ? null : { ...record };
  }

  public listExecutionTrace(planId: string): MigrationStepExecutionRecord[] {
    return [...(this.executionTrace.get(planId) ?? [])];
  }

  private generateMigrationSteps(fromPackId: string, toPackId: string): readonly MigrationPlanStep[] {
    // Generate default migration steps
    return [
      {
        nodeId: `${fromPackId}_export_state`,
        stepId: `${fromPackId}_export_state`,
        description: `Export state from ${fromPackId}`,
        order: 1,
        estimatedDurationMinutes: 5,
      },
      {
        nodeId: `${toPackId}_validate_target`,
        stepId: `${toPackId}_validate_target`,
        description: `Validate target ${toPackId} is ready`,
        order: 2,
        estimatedDurationMinutes: 2,
      },
      {
        nodeId: `${fromPackId}_to_${toPackId}_transfer`,
        stepId: `${fromPackId}_to_${toPackId}_transfer`,
        description: `Transfer data from ${fromPackId} to ${toPackId}`,
        order: 3,
        estimatedDurationMinutes: 10,
      },
      {
        nodeId: `${toPackId}_verify`,
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
    const plan = this.requirePlan(planId);
    const detail = this.applyStep(plan, step);
    this.appendTrace(planId, {
      planId,
      nodeId: step.nodeId ?? step.stepId,
      stepId: step.stepId,
      phase: "execute",
      status: "completed",
      detail,
      occurredAt: nowIso(),
    });
    await Promise.resolve();
  }

  private async rollbackStep(planId: string, stepId: string): Promise<void> {
    const plan = this.requirePlan(planId);
    const detail = this.revertStep(plan, stepId);
    this.appendTrace(planId, {
      planId,
      nodeId: stepId,
      stepId,
      phase: "rollback",
      status: "completed",
      detail,
      occurredAt: nowIso(),
    });
    await Promise.resolve();
  }

  private requirePlan(planId: string): MigrationPlan {
    const plan = this.plans.get(planId);
    if (plan == null) {
      throw this.validationError("pack_migration.plan_not_found", `Migration plan ${planId} not found.`);
    }
    return plan;
  }

  private applyStep(plan: MigrationPlan, step: MigrationPlanStep): string {
    if (step.stepId.endsWith("_export_state")) {
      const snapshot = { ...(this.packStates.get(plan.fromPackId) ?? { packId: plan.fromPackId, exportedAt: nowIso() }) };
      this.exportedSnapshots.set(plan.planId, snapshot);
      return `exported_state:${plan.fromPackId}`;
    }
    if (step.stepId.endsWith("_validate_target")) {
      const target = this.packStates.get(plan.toPackId);
      if (target?.["migrationLocked"] === true) {
        throw this.validationError("pack_migration.target_locked", `Target pack ${plan.toPackId} is locked for migration.`);
      }
      return `validated_target:${plan.toPackId}`;
    }
    if (step.stepId.endsWith("_transfer")) {
      const snapshot = this.exportedSnapshots.get(plan.planId) ?? { sourcePackId: plan.fromPackId };
      this.packStates.set(plan.toPackId, {
        ...snapshot,
        migratedFromPackId: plan.fromPackId,
        migratedByPlanId: plan.planId,
      });
      return `transferred_state:${plan.fromPackId}->${plan.toPackId}`;
    }
    if (step.stepId.endsWith("_verify")) {
      const target = this.packStates.get(plan.toPackId);
      if (target == null) {
        throw this.validationError("pack_migration.target_missing", `Target pack ${plan.toPackId} has no migrated state.`);
      }
      return `verified_target:${plan.toPackId}`;
    }
    return `executed_step:${step.stepId}`;
  }

  private revertStep(plan: MigrationPlan, stepId: string): string {
    if (stepId.endsWith("_verify")) {
      return `reverted_verification:${plan.toPackId}`;
    }
    if (stepId.endsWith("_transfer")) {
      this.packStates.delete(plan.toPackId);
      return `reverted_transfer:${plan.toPackId}`;
    }
    if (stepId.endsWith("_validate_target")) {
      return `reverted_validation:${plan.toPackId}`;
    }
    if (stepId.endsWith("_export_state")) {
      this.exportedSnapshots.delete(plan.planId);
      return `reverted_export:${plan.fromPackId}`;
    }
    return `reverted_step:${stepId}`;
  }

  private appendTrace(planId: string, record: MigrationStepExecutionRecord): void {
    const trace = this.executionTrace.get(planId) ?? [];
    trace.push(record);
    this.executionTrace.set(planId, trace);
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}
