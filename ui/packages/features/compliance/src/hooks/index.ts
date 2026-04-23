export interface ComplianceVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly rows: readonly { key: string; value: string }[];
  readonly items: readonly { title: string; description: string }[];
}

export function useComplianceVm(): ComplianceVm {
  return {
    metrics: [
      { label: "Standards", value: 5 },
      { label: "Open Checks", value: 12 },
      { label: "Passing", value: "87%" },
    ],
    rows: [
      { key: "Mode", value: "GDPR / SOX / HIPAA" },
      { key: "Field Policy", value: "Field-level redaction + export watermark" },
      { key: "Audit Trail", value: "Immutable audit timeline via planned seam" },
    ],
    items: [
      { title: "Run Check", description: "按标准批量运行检查并回看最近审计结果。" },
      { title: "Export Report", description: "导出合规报告与证据包，保留脱敏与审批信息。" },
      { title: "Escalation", description: "高风险不合规项升级给治理负责人和域管理员。" },
    ],
  };
}
