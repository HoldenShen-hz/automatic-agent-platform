type PolicySummary = {
    readonly id: string;
    readonly name: string;
    readonly severity: string;
};
type ComplianceExceptionRecord = {
    readonly id: string;
    readonly reason: string;
    readonly policyId: string;
    readonly status: "pending" | "approved" | "rejected";
};
type AuditLogEntry = {
    readonly id: string;
    readonly timestamp: string;
    readonly action: string;
};
export interface ComplianceVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly rows: readonly {
        key: string;
        value: string;
    }[];
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly loading: boolean;
    readonly loadError: string | null;
}
export declare function buildComplianceSummary(input: {
    readonly policies: readonly PolicySummary[];
    readonly exceptions: readonly ComplianceExceptionRecord[];
    readonly auditLogs: readonly AuditLogEntry[];
}): Pick<ComplianceVm, "metrics" | "rows" | "items">;
export declare function useComplianceVm(): ComplianceVm;
