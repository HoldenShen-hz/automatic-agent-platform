export type PolicySubjectType = "user" | "agent" | "system";
export type PolicyAction = "invoke_model" | "invoke_tool" | "write_file" | "exec_command" | "network_access" | "install_extension" | "org_change" | "dispatch_execution" | "set_isolation_level" | "promote_improvement" | "advance_rollout" | "modify_knowledge_trust" | "promote_memory_layer";
export type PolicyRiskCategory = "destructive" | "irreversible" | "prod_affecting" | "cost_sensitive" | "org_changing" | "sensitive_data" | "strategy_affecting" | "governance_sensitive";
export type PolicyMode = "supervised" | "auto" | "full-auto" | "read-only" | "maintenance" | "incident-mode" | "degraded" | "emergency";
export type OapeflirStage = "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
export type PolicyDecision = "allow" | "deny" | "allow_with_constraints" | "escalate_for_approval";
export interface PolicyDecisionRequest {
    decisionId: string;
    taskId: string;
    executionId?: string | null;
    sessionId?: string | null;
    subjectType: PolicySubjectType;
    subjectId: string;
    action: PolicyAction;
    resourceRef?: string | null;
    riskCategory: PolicyRiskCategory;
    mode: PolicyMode;
    stage: OapeflirStage;
    estimatedCostUsd?: number;
    metadata?: Record<string, unknown>;
}
export interface PolicyDecisionResult {
    decision: PolicyDecision;
    reasonCode: string;
    requiresApproval: boolean;
    enforcedConstraints: Record<string, unknown>;
    killSwitchApplied: boolean;
    auditPayload: Record<string, unknown>;
    evaluatedPolicyVersion: string;
    decisionTtlMs: number | null;
    matchedRuleRefs: string[];
    explainSummary: string;
}
export interface PolicyCenterOptions {
    policyVersion?: string;
    killSwitchEnabled?: boolean;
    frozenActions?: PolicyAction[];
    allowedActionsByRole?: Record<string, PolicyAction[]>;
    subjectRoles?: Record<string, string[]>;
    maxEstimatedCostUsd?: number;
    budgetWarningCostUsd?: number;
    allowedPathPrefixes?: string[];
    allowedNetworkHosts?: string[];
    enabledGovernanceActions?: PolicyAction[];
    approvalRequiredRiskCategories?: PolicyRiskCategory[];
}
export declare class PolicyCenterService {
    private readonly options;
    constructor(options?: PolicyCenterOptions);
    evaluate(input: PolicyDecisionRequest): PolicyDecisionResult;
    private isActionAllowedByRole;
    private evaluateConstraints;
    private evaluateModePolicy;
    private mustEscalate;
    private result;
}
