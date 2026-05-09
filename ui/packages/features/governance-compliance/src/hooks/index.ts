export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
  readonly auditTrail: readonly {
    readonly id: string;
    readonly actor: string;
    readonly action: string;
    readonly timestamp: string;
    readonly target: string;
  }[];
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  return {
    items: [
      { title: "Compliance Score", description: "标准、检查项和最近审计结果通过 planned seam 呈现。" },
      { title: "Field Redaction Policy", description: "字段级可见性、PII handling 和审计访问规则。" },
      { title: "Delegated Governance", description: "域治理委托与审批升级路径。" },
    ],
    auditTrail: [
      { id: "audit-1", actor: "admin@example.com", action: "APPROVE", timestamp: new Date(Date.now() - 3_600_000).toISOString(), target: "policy:field-redaction-v2" },
      { id: "audit-2", actor: "system", action: "ENFORCE", timestamp: new Date(Date.now() - 7_200_000).toISOString(), target: "domain:finance" },
      { id: "audit-3", actor: "admin@example.com", action: "DELEGATE", timestamp: new Date(Date.now() - 86_400_000).toISOString(), target: "domain:engineering" },
    ],
  };
}
