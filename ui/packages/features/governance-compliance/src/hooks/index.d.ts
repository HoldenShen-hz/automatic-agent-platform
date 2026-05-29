export interface CompliancePolicyVm {
    readonly id: string;
    readonly name: string;
    readonly severity: string;
}
export interface ComplianceAuditVm {
    readonly id: string;
    readonly timestamp: string;
    readonly actor: string;
    readonly action: string;
    readonly resource: string;
    readonly outcome: string;
}
export interface ComplianceExceptionVm {
    readonly id: string;
    readonly reason: string;
    readonly status: "pending" | "approved" | "rejected";
}
export interface GovernanceComplianceVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly selectedPolicyId: string | null;
    readonly policies: readonly CompliancePolicyVm[];
    readonly auditTrail: readonly ComplianceAuditVm[];
    readonly exceptionQueue: readonly ComplianceExceptionVm[];
    selectPolicy(policyId: string): void;
    updatePolicy(policyId: string, patch: Record<string, unknown>): Promise<void>;
    submitExceptionRequest(reason: string, policyId: string): Promise<void>;
    approveException(exceptionId: string): Promise<void>;
    rejectException(exceptionId: string, rationale: string): Promise<void>;
    filterAuditTrail(): void;
}
export declare function useGovernanceComplianceVm(): GovernanceComplianceVm;
