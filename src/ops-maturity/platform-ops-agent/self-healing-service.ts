import { nowIso } from "../../platform/contracts/types/ids.js";

export interface SelfHealingAction {
  readonly actionId: string;
  readonly targetComponent: string;
  readonly operation: "restart" | "throttle" | "failover" | "rollback";
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
  const checkDelay = 100 + componentId.length * 10 + action.operation.length * 5;
  const profile = OPERATION_PROFILES[action.operation];
  const recoveryTimeMs = Math.round(checkDelay);
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

  public constructor(policy?: Partial<HealingPolicy>) {
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

    if (consecutiveFailures >= this.policy.maxRetries) {
      const lastAttempt = this.healingHistory.find(
        (h) => h.targetComponent === action.targetComponent,
      );
      if (lastAttempt) {
        const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.executedAt).getTime();
        if (timeSinceLastAttempt < this.computeCooldownMs(consecutiveFailures)) {
          return this.recordFailedAttempt(
            action,
            executedAt,
            previousState,
            "Healing cooldown is active after repeated failures; operator intervention is required before retry.",
          );
        }
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
      .filter((h) => h.verificationResult)
      .map((h) => h.verificationResult!.recoveryTimeMs);
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
    return receipt;
  }

  private computeCooldownMs(consecutiveFailures: number): number {
    const penaltyMultiplier = Math.max(1, consecutiveFailures - this.policy.maxRetries + 1);
    return this.policy.cooldownPeriodMs * penaltyMultiplier;
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
