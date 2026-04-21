import { type AgentDefinition, type AgentLifecycleState } from "./agent-registry/index.js";
import { type CanaryProgress, type TrafficSplitConfig } from "./canary-controller/index.js";
import { type AgentRetirementPlan } from "./retirement/index.js";
import { type AgentVersion } from "./version-manager/index.js";
export interface ManagedAgentDefinition extends AgentDefinition {
}
export interface ManagedAgentVersion extends AgentVersion {
}
export interface AgentRolloutBinding {
    readonly bindingId: string;
    readonly agentId: string;
    readonly taskId: string;
    readonly versionId: string;
    readonly boundAt: string;
}
export interface AgentRolloutReceipt {
    readonly agentId: string;
    readonly fromState: ManagedAgentDefinition["lifecycleState"];
    readonly toState: ManagedAgentDefinition["lifecycleState"];
    readonly versionId: string;
    readonly changedAt: string;
    readonly reasonCodes: readonly string[];
}
export interface AgentRollbackReceipt {
    readonly agentId: string;
    readonly fromVersionId: string;
    readonly toVersionId: string;
    readonly rolledBackAt: string;
}
export interface LifecycleTransitionResult {
    readonly allowed: boolean;
    readonly fromState: AgentLifecycleState;
    readonly toState: AgentLifecycleState;
    readonly reason?: string;
}
export declare class AgentLifecycleService {
    private readonly agents;
    private readonly versions;
    private readonly canaryProgress;
    registerAgent(definition: ManagedAgentDefinition): ManagedAgentDefinition;
    addVersion(version: ManagedAgentVersion): ManagedAgentVersion;
    listActive(): ManagedAgentDefinition[];
    /**
     * Transitions agent to a new lifecycle state.
     * Validates transition per §61.3 state machine.
     */
    transition(agentId: string, toState: AgentLifecycleState, changedAt?: string): LifecycleTransitionResult;
    /**
     * Advances canary to next stage or promotes to active.
     * Per §61.4 traffic splitting.
     */
    advanceCanary(agentId: string, progress: CanaryProgress, changedAt?: string): AgentRolloutReceipt;
    /**
     * Gets current traffic split for canary agent.
     */
    getCanaryTrafficSplit(agentId: string): TrafficSplitConfig | null;
    promoteCanary(agentId: string, progress: CanaryProgress, changedAt?: string): AgentRolloutReceipt;
    rollback(agentId: string, rolledBackAt?: string): AgentRollbackReceipt;
    retire(plan: AgentRetirementPlan, now?: string): AgentRolloutReceipt;
    archive(agentId: string, archivedAt?: string): AgentRolloutReceipt;
    bindTask(agentId: string, taskId: string, boundAt?: string): AgentRolloutBinding;
    getAgent(agentId: string): ManagedAgentDefinition | null;
    getLatestVersion(agentId: string): ManagedAgentVersion | null;
    getAllVersions(agentId: string): ManagedAgentVersion[];
    getCanaryProgress(agentId: string): CanaryProgress | null;
    private requireAgent;
    private requireVersions;
}
