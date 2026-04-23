export interface SelfHealingAction {
    readonly actionId: string;
    readonly targetComponent: string;
    readonly operation: "restart" | "throttle" | "failover" | "rollback";
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
export declare class SelfHealingService {
    private readonly componentHealth;
    private readonly healingHistory;
    private readonly maxHistoryEntries;
    private readonly policy;
    constructor(policy?: Partial<HealingPolicy>);
    execute(action: SelfHealingAction): SelfHealingReceipt;
    getComponentHealth(componentId: string): ComponentHealthState | null;
    listComponentHealth(): ComponentHealthState[];
    getHealingHistory(componentId?: string, limit?: number): SelfHealingReceipt[];
    getStatistics(): {
        totalHealingAttempts: number;
        successCount: number;
        failureCount: number;
        averageRecoveryTimeMs: number;
        componentsUnderHealing: number;
    };
    private performHealingOperation;
    private evictOldHistory;
}
