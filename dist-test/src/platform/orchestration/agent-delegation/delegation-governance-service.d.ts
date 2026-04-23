/**
 * Delegation Governance Service
 *
 * Implements governance rules for agent delegation:
 * - Delegation authorization based on policies
 * - Permission boundary enforcement
 * - Delegation audit trail
 *
 * Architecture: §51 Delegation Governance
 */
import type { AgentContext, DelegationSpec } from "./delegation-types.js";
export type GovernanceDecision = "allow" | "deny" | "allow_with_constraints" | "require_approval";
export interface GovernanceRule {
    ruleId: string;
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    condition: GovernanceCondition;
    effect: GovernanceEffect;
}
export interface GovernanceCondition {
    subjectType?: "user" | "agent" | "system";
    targetAgentType?: string;
    delegationDepth?: number;
    permissionActions?: string[];
    riskLevel?: "low" | "medium" | "high" | "critical";
}
export interface GovernanceEffect {
    decision: GovernanceDecision;
    reasonCode: string;
    constraints?: Record<string, unknown>;
}
export interface DelegationGovernanceRequest {
    parentContext: AgentContext;
    delegationSpec: DelegationSpec;
    riskLevel?: "low" | "medium" | "high" | "critical";
}
export interface DelegationGovernanceDecision {
    decision: GovernanceDecision;
    reasonCode: string;
    evaluatedRules: string[];
    constraints: Record<string, unknown>;
    requiresApproval: boolean;
}
export interface DelegationGovernanceAuditRecord {
    id: string;
    request: DelegationGovernanceRequest;
    decision: GovernanceDecision;
    reasonCode: string;
    evaluatedRules: readonly string[];
    approvedBy: string | null;
    createdAt: string;
}
export declare class DelegationGovernanceService {
    private readonly rules;
    private readonly auditRecords;
    constructor(rules?: GovernanceRule[]);
    evaluate(request: DelegationGovernanceRequest): DelegationGovernanceDecision;
    recordDecision(request: DelegationGovernanceRequest, decision: DelegationGovernanceDecision, approvedBy?: string): DelegationGovernanceAuditRecord;
    getAuditRecords(agentId?: string): DelegationGovernanceAuditRecord[];
    getRules(): GovernanceRule[];
    addRule(rule: GovernanceRule): void;
    removeRule(ruleId: string): boolean;
    enableRule(ruleId: string): boolean;
    disableRule(ruleId: string): boolean;
    private matchesCondition;
}
export declare const defaultDelegationGovernanceService: DelegationGovernanceService;
