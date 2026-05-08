/**
 * Tenant Lifecycle Management Service
 *
 * Implements tenant lifecycle management for multi-region deployments.
 * Handles tenant provisioning, suspension, migration, and termination.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * Tenant lifecycle stage
 */
export type TenantLifecycleStage =
  | "provisioning"
  | "active"
  | "suspended"
  | "migrating"
  | "deprovisioning"
  | "terminated";

/**
 * Tenant lifecycle event
 */
export interface TenantLifecycleEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly stage: TenantLifecycleStage;
  readonly reason: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Tenant lifecycle state
 */
export interface TenantLifecycleState {
  readonly tenantId: string;
  readonly currentStage: TenantLifecycleStage;
  readonly stageEnteredAt: string;
  readonly previousStage: TenantLifecycleStage | null;
  readonly suspensionReason: string | null;
  readonly migrationTargetRegion: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Tenant lifecycle configuration
 */
export interface TenantLifecycleConfig {
  readonly tenantId: string;
  readonly targetRegionId: string;
  readonly homeRegionId: string;
  readonly dataResidencyRequirements: readonly string[];
  readonly allowCrossBorder: boolean;
  readonly autoSuspendOnPolicyViolation: boolean;
  readonly autoSuspendThresholdDays: number | null;
}

/**
 * Lifecycle transition result
 */
export interface LifecycleTransitionResult {
  readonly allowed: boolean;
  readonly from: TenantLifecycleStage;
  readonly to: TenantLifecycleStage;
  readonly reason?: string;
  readonly events: readonly TenantLifecycleEvent[];
}

/**
 * Valid lifecycle transitions
 */
const VALID_TRANSITIONS: Record<TenantLifecycleStage, TenantLifecycleStage[]> = {
  provisioning: ["active", "deprovisioning"],
  active: ["suspended", "migrating", "deprovisioning"],
  suspended: ["active", "migrating", "deprovisioning"],
  migrating: ["active", "suspended", "deprovisioning"],
  deprovisioning: ["terminated"],
  terminated: [],
};

/**
 * Tenant Lifecycle Service
 */
export class TenantLifecycleService {
  private readonly states = new Map<string, TenantLifecycleState>();
  private readonly eventHistory = new Map<string, TenantLifecycleEvent[]>();
  private readonly configs = new Map<string, TenantLifecycleConfig>();

  /**
   * Register a tenant for lifecycle management
   */
  public registerTenant(config: TenantLifecycleConfig): TenantLifecycleState {
    const state: TenantLifecycleState = {
      tenantId: config.tenantId,
      currentStage: "provisioning",
      stageEnteredAt: nowIso(),
      previousStage: null,
      suspensionReason: null,
      migrationTargetRegion: null,
      metadata: { targetRegionId: config.targetRegionId, homeRegionId: config.homeRegionId },
    };

    this.states.set(config.tenantId, state);
    this.configs.set(config.tenantId, config);
    this.eventHistory.set(config.tenantId, []);

    this.recordEvent(state.tenantId, "provisioning", "system", "Tenant registered");
    return state;
  }

  /**
   * Transition a tenant to a new lifecycle stage
   */
  public transition(
    tenantId: string,
    targetStage: TenantLifecycleStage,
    actor: string,
    reason: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): LifecycleTransitionResult {
    const state = this.states.get(tenantId);
    if (!state) {
      return {
        allowed: false,
        from: "provisioning",
        to: targetStage,
        reason: `Tenant ${tenantId} not found`,
        events: [],
      };
    }

    const allowed = VALID_TRANSITIONS[state.currentStage]?.includes(targetStage) ?? false;
    if (!allowed) {
      return {
        allowed: false,
        from: state.currentStage,
        to: targetStage,
        reason: `Invalid transition from ${state.currentStage} to ${targetStage}`,
        events: [],
      };
    }

    const events: TenantLifecycleEvent[] = [];

    // Create new state
    const newState: TenantLifecycleState = {
      ...state,
      currentStage: targetStage,
      previousStage: state.currentStage,
      stageEnteredAt: nowIso(),
      suspensionReason: targetStage === "suspended" ? reason : state.suspensionReason,
      migrationTargetRegion: targetStage === "migrating" ? (metadata?.targetRegion as string | undefined) ?? null : state.migrationTargetRegion,
      metadata: metadata ? { ...state.metadata, ...metadata } : state.metadata,
    };

    this.states.set(tenantId, newState);

    // Record event
    const event = this.recordEvent(tenantId, targetStage, actor, reason, metadata);
    events.push(event);

    return { allowed: true, from: state.currentStage, to: targetStage, events };
  }

  /**
   * Activate a tenant (transition from provisioning, suspended, or migrating)
   */
  public activate(tenantId: string, actor: string, reason = "Tenant activated"): LifecycleTransitionResult {
    return this.transition(tenantId, "active", actor, reason);
  }

  /**
   * Suspend a tenant
   */
  public suspend(
    tenantId: string,
    actor: string,
    reason: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): LifecycleTransitionResult {
    return this.transition(tenantId, "suspended", actor, reason, metadata);
  }

  /**
   * Start migrating a tenant to a new region
   */
  public startMigration(
    tenantId: string,
    actor: string,
    targetRegion: string,
  ): LifecycleTransitionResult {
    return this.transition(tenantId, "migrating", actor, `Migration to ${targetRegion}`, {
      targetRegion,
    });
  }

  /**
   * Complete migration and activate tenant
   */
  public completeMigration(
    tenantId: string,
    actor: string,
    newRegionId: string,
  ): LifecycleTransitionResult {
    const config = this.configs.get(tenantId);
    if (config) {
      this.configs.set(tenantId, {
        ...config,
        targetRegionId: newRegionId,
        homeRegionId: config.homeRegionId === config.targetRegionId ? newRegionId : config.homeRegionId,
      });
    }
    return this.transition(tenantId, "active", actor, `Migration completed to ${newRegionId}`);
  }

  /**
   * Start deprovisioning a tenant
   */
  public startDeprovisioning(
    tenantId: string,
    actor: string,
    reason: string,
  ): LifecycleTransitionResult {
    return this.transition(tenantId, "deprovisioning", actor, reason);
  }

  /**
   * Complete deprovisioning and terminate tenant
   */
  public terminate(tenantId: string, actor: string): LifecycleTransitionResult {
    return this.transition(tenantId, "terminated", actor, "Tenant terminated");
  }

  /**
   * Get current lifecycle state for a tenant
   */
  public getState(tenantId: string): TenantLifecycleState | null {
    return this.states.get(tenantId) ?? null;
  }

  /**
   * Get event history for a tenant
   */
  public getHistory(tenantId: string, limit = 100): readonly TenantLifecycleEvent[] {
    const events = this.eventHistory.get(tenantId);
    if (!events) {
      return [];
    }
    return events.slice(-limit);
  }

  /**
   * Get tenant lifecycle configuration
   */
  public getConfig(tenantId: string): TenantLifecycleConfig | null {
    return this.configs.get(tenantId) ?? null;
  }

  /**
   * Check if a tenant is in a given stage
   */
  public isInStage(tenantId: string, stage: TenantLifecycleStage): boolean {
    const state = this.states.get(tenantId);
    return state?.currentStage === stage;
  }

  /**
   * Check if a tenant is active
   */
  public isActive(tenantId: string): boolean {
    return this.isInStage(tenantId, "active");
  }

  /**
   * Check if a tenant is suspended
   */
  public isSuspended(tenantId: string): boolean {
    return this.isInStage(tenantId, "suspended");
  }

  /**
   * Check if a tenant is terminated
   */
  public isTerminated(tenantId: string): boolean {
    return this.isInStage(tenantId, "terminated");
  }

  /**
   * Record a lifecycle event
   */
  private recordEvent(
    tenantId: string,
    stage: TenantLifecycleStage,
    actor: string,
    reason: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): TenantLifecycleEvent {
    const event: TenantLifecycleEvent = {
      eventId: newId("tenant_event"),
      tenantId,
      stage,
      reason,
      timestamp: nowIso(),
      actor,
      ...(metadata !== undefined ? { metadata } : {}),
    };

    const events = this.eventHistory.get(tenantId) ?? [];
    events.push(event);
    this.eventHistory.set(tenantId, events);

    return event;
  }
}

/**
 * Singleton instance
 */
let GLOBAL_TENANT_LIFECYCLE_SERVICE: TenantLifecycleService | null = null;

export function getTenantLifecycleService(): TenantLifecycleService {
  if (!GLOBAL_TENANT_LIFECYCLE_SERVICE) {
    GLOBAL_TENANT_LIFECYCLE_SERVICE = new TenantLifecycleService();
  }
  return GLOBAL_TENANT_LIFECYCLE_SERVICE;
}

export function resetTenantLifecycleService(): void {
  GLOBAL_TENANT_LIFECYCLE_SERVICE = null;
}
