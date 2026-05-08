export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  return {
    items: [
      { title: "Compliance Score", description: "标准、检查项和最近审计结果通过 planned seam 呈现。" },
      { title: "Field Redaction Policy", description: "字段级可见性、PII handling 和审计访问规则。" },
      { title: "Delegated Governance", description: "域治理委托与审批升级路径。" },
    ],
  };
}
