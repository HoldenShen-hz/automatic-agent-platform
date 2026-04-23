import { nowIso } from "../../platform/contracts/types/ids.js";
const DEFAULT_HEALING_POLICY = {
    maxRetries: 3,
    cooldownPeriodMs: 30_000,
    healthCheckTimeoutMs: 5_000,
    enableAutomaticRollback: true,
};
function simulateHealthCheck(componentId, operation) {
    const checkDelay = 100 + Math.random() * 200;
    const healthCheckPassed = Math.random() > 0.1;
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
function isRollbackAvailable(operation) {
    return operation === "restart" || operation === "rollback";
}
export class SelfHealingService {
    componentHealth = new Map();
    healingHistory = [];
    maxHistoryEntries = 100;
    policy;
    constructor(policy) {
        this.policy = { ...DEFAULT_HEALING_POLICY, ...policy };
    }
    execute(action) {
        const executedAt = nowIso();
        const previousState = this.componentHealth.get(action.targetComponent);
        const consecutiveFailures = previousState?.consecutiveFailures ?? 0;
        if (consecutiveFailures >= this.policy.maxRetries) {
            const lastAttempt = this.healingHistory.find((h) => h.targetComponent === action.targetComponent);
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
        const newStatus = healingSuccess
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
        const receipt = {
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
    getComponentHealth(componentId) {
        return this.componentHealth.get(componentId) ?? null;
    }
    listComponentHealth() {
        return [...this.componentHealth.values()];
    }
    getHealingHistory(componentId, limit = 10) {
        const filtered = componentId
            ? this.healingHistory.filter((h) => h.targetComponent === componentId)
            : this.healingHistory;
        return filtered.slice(-limit).reverse();
    }
    getStatistics() {
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
            .map((h) => h.verificationResult.recoveryTimeMs);
        const averageRecoveryTimeMs = recoveryTimes.length > 0
            ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
            : 0;
        const componentsUnderHealing = [...this.componentHealth.values()].filter((c) => c.status === "degraded" || c.status === "unhealthy").length;
        return {
            totalHealingAttempts: this.healingHistory.length,
            successCount,
            failureCount,
            averageRecoveryTimeMs,
            componentsUnderHealing,
        };
    }
    performHealingOperation(action) {
        const baseSuccessRate = action.operation === "failover" ? 0.95 : 0.85;
        return Math.random() < baseSuccessRate;
    }
    evictOldHistory() {
        if (this.healingHistory.length <= this.maxHistoryEntries)
            return;
        this.healingHistory.splice(0, this.healingHistory.length - this.maxHistoryEntries);
    }
}
//# sourceMappingURL=self-healing-service.js.map