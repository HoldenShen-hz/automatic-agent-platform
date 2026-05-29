import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";

export interface SelfHealingAction {
  readonly actionId: string;
  readonly taskId?: string;
  readonly targetComponent: string;
  readonly operation: "restart" | "throttle" | "failover" | "rollback";
  readonly executionId?: string;
  readonly harnessRunId?: string;
  readonly runbookRef?: string;
  readonly approvalRef?: string;
  readonly reasonCode?: string;
  readonly priority?: "low" | "medium" | "high" | "critical";
}

export interface SelfHealingReceipt {
  readonly healed: boolean;
  readonly targetComponent: string;
  readonly operation: SelfHealingAction["operation"];
  readonly executedAt: string;
  readonly actionId: string;
  readonly verificationResult?: VerificationResult;
  readonly rollbackAvailable: boolean;
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly healthCheckPassed: boolean;
  readonly recoveryTimeMs: number;
  readonly message: string;
}

export interface ComponentHealthState {
  readonly componentId: string;
  readonly status: "healthy" | "degraded" | "unhealthy" | "unknown";
  readonly lastCheckAt: string;
  readonly consecutiveFailures: number;
}

export interface HealingPolicy {
  readonly maxRetries: number;
  readonly cooldownPeriodMs: number;
  readonly healthCheckTimeoutMs: number;
  readonly enableAutomaticRollback: boolean;
}

export interface ExecutionGuardDecision {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface ExecutionGuard {
  canPerformHealing(action: SelfHealingAction): ExecutionGuardDecision;
}

export interface SelfHealingEvent {
  readonly eventType:
    | "ops_maturity.self_healing.succeeded"
    | "ops_maturity.self_healing.failed"
    | "ops_maturity.self_healing.cooldown_blocked";
  readonly actionId: string;
  readonly targetComponent: string;
  readonly operation: SelfHealingAction["operation"];
  readonly executedAt: string;
  readonly healed: boolean;
  readonly taskId: string | null;
  readonly executionId: string | null;
  readonly harnessRunId: string | null;
  readonly reasonCode: string | null;
}

export interface SelfHealingEventSink {
  emit(event: SelfHealingEvent): void;
}

export function createSelfHealingEventStoreSink(
  store: Pick<AuthoritativeTaskStore, "event">,
): SelfHealingEventSink {
  return {
    emit(event): void {
      store.event.insertEvent({
        id: newId("evt"),
        taskId: event.taskId ?? event.executionId ?? `ops-self-healing:${event.actionId}`,
        executionId: event.executionId,
        eventType: event.eventType,
        eventTier: "tier_2",
        payloadJson: JSON.stringify(event),
        traceId: event.actionId,
        createdAt: event.executedAt,
      });
    },
  };
}

interface HealingOperationProfile {
  readonly minimumStatus: readonly ComponentHealthState["status"][];
  readonly failureBudget: number;
  readonly requiresReasonCode: boolean;
  readonly verificationMessage: string;
}

const DEFAULT_HEALING_POLICY: HealingPolicy = {
  maxRetries: 3,
  cooldownPeriodMs: 30_000,
  healthCheckTimeoutMs: 5_000,
  enableAutomaticRollback: true,
};

const OPERATION_BASE_RECOVERY_TIME_MS: Record<SelfHealingAction["operation"], number> = {
  restart: 1_500,
  throttle: 800,
  failover: 3_000,
  rollback: 2_000,
};

const MAX_COOLDOWN_MS = 30 * 60 * 1_000;

const OPERATION_PROFILES: Record<SelfHealingAction["operation"], HealingOperationProfile> = {
  restart: {
    minimumStatus: ["healthy", "degraded", "unhealthy", "unknown"],
    failureBudget: 3,
    requiresReasonCode: false,
    verificationMessage: "Restart verification confirms the component responds to probes again.",
  },
  throttle: {
    minimumStatus: ["healthy", "degraded"],
    failureBudget: 2,
    requiresReasonCode: false,
    verificationMessage: "Throttle verification confirms the component can absorb load within limits.",
  },
  failover: {
    minimumStatus: ["degraded", "unhealthy"],
    failureBudget: 1,
    requiresReasonCode: true,
    verificationMessage: "Failover verification confirms traffic moved to the standby path.",
  },
  rollback: {
    minimumStatus: ["degraded", "unhealthy"],
    failureBudget: 2,
    requiresReasonCode: true,
    verificationMessage: "Rollback verification confirms the last known good release is serving traffic.",
  },
};

function simulateHealthCheck(
  componentId: string,
  action: SelfHealingAction,
  postActionState: ComponentHealthState,
  operationApplied: boolean,
): VerificationResult {
  const baseDuration = OPERATION_BASE_RECOVERY_TIME_MS[action.operation];
  const profile = OPERATION_PROFILES[action.operation];
  const recoveryTimeMs = baseDuration + Math.max(0, postActionState.consecutiveFailures) * 250;
  const reasonPresent = (action.reasonCode ?? "").trim().length > 0;
  const healthCheckPassed = operationApplied
    && postActionState.status === "healthy"
    && (!profile.requiresReasonCode || reasonPresent);

  if (healthCheckPassed) {
    return {
      verified: true,
      healthCheckPassed: true,
      recoveryTimeMs,
      message: profile.verificationMessage,
    };
  }

  return {
    verified: false,
    healthCheckPassed: false,
    recoveryTimeMs,
    message: `Health check failed for ${componentId}; ${action.operation} did not restore a healthy state.`,
  };
}

function isRollbackAvailable(operation: SelfHealingAction["operation"]): boolean {
  return operation === "restart" || operation === "rollback";
}

export class SelfHealingService {
  private readonly componentHealth = new Map<string, ComponentHealthState>();
  private readonly healingHistory: SelfHealingReceipt[] = [];
  private readonly maxHistoryEntries = 100;
  private readonly policy: HealingPolicy;

  public constructor(
    policy?: Partial<HealingPolicy>,
    private readonly executionGuard: ExecutionGuard | null = null,
    private readonly eventSink: SelfHealingEventSink | null = null,
  ) {
    this.policy = { ...DEFAULT_HEALING_POLICY, ...policy };
  }

  public execute(action: SelfHealingAction): SelfHealingReceipt {
    const executedAt = nowIso();
    const previousState = this.componentHealth.get(action.targetComponent);
    const consecutiveFailures = previousState?.consecutiveFailures ?? 0;
    const reasonPresent = (action.reasonCode ?? "").trim().length > 0;
    const profile = OPERATION_PROFILES[action.operation];

    if ((action.runbookRef ?? "").trim().length === 0 || (action.approvalRef ?? "").trim().length === 0) {
      return this.recordFailedAttempt(
        action,
        executedAt,
        previousState,
        "Healing prerequisites are missing; runbookRef and approvalRef are both required.",
      );
    }

    const lastAttempt = this.healingHistory.findLast(
      (h) => h.targetComponent === action.targetComponent,
    );
    if (lastAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.executedAt).getTime();
      if (timeSinceLastAttempt < this.computeCooldownMs(consecutiveFailures)) {
        const receipt = this.recordFailedAttempt(
          action,
          executedAt,
          previousState,
          "Healing cooldown is active after repeated failures; operator intervention is required before retry.",
        );
        this.emitEvent("ops_maturity.self_healing.cooldown_blocked", action, receipt, executedAt);
        return receipt;
      }
    }

    if ((action.operation === "restart" || action.operation === "failover") && this.executionGuard != null) {
      const guardDecision = this.executionGuard.canPerformHealing(action);
      if (!guardDecision.allowed) {
        return this.recordFailedAttempt(
          action,
          executedAt,
          previousState,
          guardDecision.reason ?? "Healing is blocked while protected executions are in flight.",
        );
      }
    }

    if (!profile.minimumStatus.includes(previousState?.status ?? "unknown")) {
      return this.recordFailedAttempt(
        action,
        executedAt,
        previousState,
        `Operation ${action.operation} is not allowed while component is ${previousState?.status ?? "unknown"}.`,
      );
    }

    if (profile.requiresReasonCode && !reasonPresent) {
      return this.recordFailedAttempt(
        action,
        executedAt,
        previousState,
        `Operation ${action.operation} requires a reasonCode to support audit and verification.`,
      );
    }

    const healingSuccess = this.performHealingOperation(action, previousState);

    const newConsecutiveFailures = healingSuccess ? 0 : consecutiveFailures + 1;
    const newStatus: ComponentHealthState["status"] = healingSuccess
      ? "healthy"
      : newConsecutiveFailures >= this.policy.maxRetries
        ? "unhealthy"
        : "degraded";

    const nextState: ComponentHealthState = {
      componentId: action.targetComponent,
      status: newStatus,
      lastCheckAt: executedAt,
      consecutiveFailures: newConsecutiveFailures,
    };
    this.componentHealth.set(action.targetComponent, nextState);

    const verificationResult = simulateHealthCheck(
      action.targetComponent,
      action,
      nextState,
      healingSuccess,
    );

    const receipt: SelfHealingReceipt = {
      healed: healingSuccess && verificationResult.healthCheckPassed,
      targetComponent: action.targetComponent,
      operation: action.operation,
      executedAt,
      actionId: action.actionId,
      verificationResult,
      rollbackAvailable: isRollbackAvailable(action.operation),
    };

    this.healingHistory.push(receipt);
    this.evictOldHistory();
    this.emitEvent(receipt.healed ? "ops_maturity.self_healing.succeeded" : "ops_maturity.self_healing.failed", action, receipt, executedAt);

    return receipt;
  }

  public getComponentHealth(componentId: string): ComponentHealthState | null {
    return this.componentHealth.get(componentId) ?? null;
  }

  public listComponentHealth(): ComponentHealthState[] {
    return [...this.componentHealth.values()];
  }

  public getHealingHistory(componentId?: string, limit = 10): SelfHealingReceipt[] {
    const filtered = componentId
      ? this.healingHistory.filter((h) => h.targetComponent === componentId)
      : this.healingHistory;
    return filtered.slice(-limit).reverse();
  }

  public getStatistics(): {
    totalHealingAttempts: number;
    successCount: number;
    failureCount: number;
    averageRecoveryTimeMs: number;
    componentsUnderHealing: number;
  } {
    if (this.healingHistory.length === 0) {
      return {
        totalHealingAttempts: 0,
        successCount: 0,
        failureCount: 0,
        averageRecoveryTimeMs: 0,
        componentsUnderHealing: 0,
      };
    }

    const successCount = this.healingHistory.filter((h) => h.healed).length;
    const failureCount = this.healingHistory.filter((h) => !h.healed).length;
    const recoveryTimes = this.healingHistory
      .map((h) => h.verificationResult?.recoveryTimeMs)
      .filter((recoveryTimeMs): recoveryTimeMs is number => recoveryTimeMs != null);
    const averageRecoveryTimeMs = recoveryTimes.length > 0
      ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
      : 0;

    const componentsUnderHealing = [...this.componentHealth.values()].filter(
      (c) => c.status === "degraded" || c.status === "unhealthy",
    ).length;

    return {
      totalHealingAttempts: this.healingHistory.length,
      successCount,
      failureCount,
      averageRecoveryTimeMs,
      componentsUnderHealing,
    };
  }

  public getCooldownStatus(componentId: string, observedAt = Date.now()): {
    readonly inCooldown: boolean;
    readonly remainingMs: number;
  } {
    const health = this.componentHealth.get(componentId);
    const lastAttempt = this.healingHistory.find((entry) => entry.targetComponent === componentId);
    if (health == null || lastAttempt == null) {
      return { inCooldown: false, remainingMs: 0 };
    }
    const cooldownMs = this.computeCooldownMs(health.consecutiveFailures);
    const expiresAt = new Date(lastAttempt.executedAt).getTime() + cooldownMs;
    const remainingMs = Math.max(0, expiresAt - observedAt);
    return {
      inCooldown: remainingMs > 0,
      remainingMs,
    };
  }

  public shouldDeferExecutionRetry(componentId: string, observedAt = Date.now()): {
    readonly defer: boolean;
    readonly reasonCode: string | null;
    readonly remainingMs: number;
  } {
    const cooldown = this.getCooldownStatus(componentId, observedAt);
    return {
      defer: cooldown.inCooldown,
      reasonCode: cooldown.inCooldown ? "ops_maturity.self_healing.cooldown_active" : null,
      remainingMs: cooldown.remainingMs,
    };
  }

  private recordFailedAttempt(
    action: SelfHealingAction,
    executedAt: string,
    previousState: ComponentHealthState | undefined,
    message: string,
  ): SelfHealingReceipt {
    const nextFailures = (previousState?.consecutiveFailures ?? 0) + 1;
    const nextState: ComponentHealthState = {
      componentId: action.targetComponent,
      status: nextFailures >= this.policy.maxRetries ? "unhealthy" : "degraded",
      lastCheckAt: executedAt,
      consecutiveFailures: nextFailures,
    };
    this.componentHealth.set(action.targetComponent, nextState);
    const verificationResult: VerificationResult = {
      verified: false,
      healthCheckPassed: false,
      recoveryTimeMs: 0,
      message,
    };
    const receipt: SelfHealingReceipt = {
      healed: false,
      targetComponent: action.targetComponent,
      operation: action.operation,
      executedAt,
      actionId: action.actionId,
      verificationResult,
      rollbackAvailable: isRollbackAvailable(action.operation),
    };
    this.healingHistory.push(receipt);
    this.evictOldHistory();
    this.emitEvent("ops_maturity.self_healing.failed", action, receipt, executedAt);
    return receipt;
  }

  private emitEvent(
    eventType: SelfHealingEvent["eventType"],
    action: SelfHealingAction,
    receipt: SelfHealingReceipt,
    executedAt: string,
  ): void {
    this.eventSink?.emit({
      eventType,
      actionId: action.actionId,
      taskId: action.taskId ?? null,
      targetComponent: action.targetComponent,
      operation: action.operation,
      executedAt,
      healed: receipt.healed,
      executionId: action.executionId ?? null,
      harnessRunId: action.harnessRunId ?? null,
      reasonCode: action.reasonCode ?? null,
    });
  }

  private computeCooldownMs(consecutiveFailures: number): number {
    const penaltyMultiplier = Math.max(1, consecutiveFailures + 1);
    return Math.min(this.policy.cooldownPeriodMs * penaltyMultiplier, MAX_COOLDOWN_MS);
  }

  private performHealingOperation(
    action: SelfHealingAction,
    previousState: ComponentHealthState | undefined,
  ): boolean {
    const profile = OPERATION_PROFILES[action.operation];
    const failureBudget = Math.max(1, profile.failureBudget);
    const priorFailures = previousState?.consecutiveFailures ?? 0;

    if (priorFailures >= this.policy.maxRetries + failureBudget) {
      return false;
    }

    if (action.operation === "rollback" && !this.policy.enableAutomaticRollback) {
      return false;
    }

    if (action.operation === "throttle" && previousState?.status === "unhealthy") {
      return false;
    }

    if (action.operation === "failover" && previousState?.status === "unknown") {
      return false;
    }

    return true;
  }

  private evictOldHistory(): void {
    if (this.healingHistory.length <= this.maxHistoryEntries) return;
    this.healingHistory.splice(0, this.healingHistory.length - this.maxHistoryEntries);
  }
}
