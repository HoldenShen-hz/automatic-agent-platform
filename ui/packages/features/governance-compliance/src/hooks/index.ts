export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
  readonly hasAuditTrailViewer: boolean;
  readonly hasExceptionManagement: boolean;
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  return {
    items: [
      { title: "Compliance Score", description: "标准、检查项和最近审计结果通过 planned seam 呈现。" },
      { title: "Field Redaction Policy", description: "字段级可见性、PII handling 和审计访问规则。" },
      { title: "Audit Trail", description: "审计轨迹查看器 - 合规性相关操作的完整历史记录。" },
      { title: "Delegated Governance", description: "域治理委托与审批升级路径。" },
      { title: "Exception Management", description: "异常管理面板 - 豁免申请、审批和追踪。" },
    ],
    hasAuditTrailViewer: true,
    hasExceptionManagement: true,
  };
}
