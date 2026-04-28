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

const DEFAULT_HEALING_POLICY: HealingPolicy = {
  maxRetries: 3,
  cooldownPeriodMs: 30_000,
  healthCheckTimeoutMs: 5_000,
  enableAutomaticRollback: true,
};

function simulateHealthCheck(componentId: string, operation: SelfHealingAction["operation"]): VerificationResult {
  const checkDelay = 100 + componentId.length * 10 + operation.length * 5;
  const healthCheckPassed = !/(rollback|failover)/.test(operation) || componentId.length % 2 === 0;
  const recoveryTimeMs = Math.round(checkDelay);

  if (healthCheckPassed) {
    return {
      verified: true,
      healthCheckPassed: true,
      recoveryTimeMs,
      message: `Health check passed for \${componentId} after \${operation}`,
    };
  }

  return {
    verified: false,
    healthCheckPassed: false,
    recoveryTimeMs,
    message: `Health check failed for \${componentId} - healing may need more time`,
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
    if ((action.runbookRef ?? "").trim().length === 0 || (action.approvalRef ?? "").trim().length === 0) {
      return {
        healed: false,
        targetComponent: action.targetComponent,
        operation: action.operation,
        executedAt: nowIso(),
        actionId: action.actionId,
        rollbackAvailable: isRollbackAvailable(action.operation),
      };
    }
    const executedAt = nowIso();

    const previousState = this.componentHealth.get(action.targetComponent);
    const consecutiveFailures = previousState?.consecutiveFailures ?? 0;

    if (consecutiveFailures >= this.policy.maxRetries) {
      const lastAttempt = this.healingHistory.find(
        (h) => h.targetComponent === action.targetComponent,
      );
      if (lastAttempt) {
        const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.executedAt).getTime();
        if (timeSinceLastAttempt < this.policy.cooldownPeriodMs) {
          return {
            healed: false,
            targetComponent: action.targetComponent,
            operation: action.operation,
            executedAt,
            actionId: action.actionId,
            rollbackAvailable: isRollbackAvailable(action.operation),
          };
        }
      }
    }

    const healingSuccess = this.performHealingOperation(action);

    const newConsecutiveFailures = healingSuccess ? 0 : consecutiveFailures + 1;
    const newStatus: ComponentHealthState["status"] = healingSuccess
      ? "healthy"
      : newConsecutiveFailures >= this.policy.maxRetries
        ? "unhealthy"
        : "degraded";

    this.componentHealth.set(action.targetComponent, {
      componentId: action.targetComponent,
      status: newStatus,
      lastCheckAt: executedAt,
      consecutiveFailures: newConsecutiveFailures,
    });

    const verificationResult = simulateHealthCheck(action.targetComponent, action.operation);

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

  private performHealingOperation(action: SelfHealingAction): boolean {
    const deterministicScore = action.targetComponent.length + action.operation.length + (action.reasonCode?.length ?? 0);
    return deterministicScore % (action.operation === "failover" ? 5 : 4) !== 0;
  }

  private evictOldHistory(): void {
    if (this.healingHistory.length <= this.maxHistoryEntries) return;
    this.healingHistory.splice(0, this.healingHistory.length - this.maxHistoryEntries);
  }
}
