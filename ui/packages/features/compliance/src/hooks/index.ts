import { translateMessage } from "@aa/shared-i18n";

export interface ComplianceVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly rows: readonly { key: string; value: string }[];
  readonly items: readonly { title: string; description: string }[];
}

export function useComplianceVm(): ComplianceVm {
  return {
    metrics: [
      { label: translateMessage("ui.compliance.metric.standards"), value: 5 },
      { label: translateMessage("ui.compliance.metric.checks"), value: 12 },
      { label: translateMessage("ui.compliance.metric.passing"), value: "87%" },
    ],
    rows: [
      { key: translateMessage("ui.compliance.row.mode"), value: "GDPR / SOX / HIPAA" },
      { key: translateMessage("ui.compliance.row.fieldPolicy"), value: translateMessage("ui.compliance.row.fieldPolicy.value") },
      { key: translateMessage("ui.compliance.row.auditTrail"), value: translateMessage("ui.compliance.row.auditTrail.value") },
    ],
    items: [
      {
        title: translateMessage("ui.compliance.item.runChecks.title"),
        description: translateMessage("ui.compliance.item.runChecks.description"),
      },
      {
        title: translateMessage("ui.compliance.item.exportReport.title"),
        description: translateMessage("ui.compliance.item.exportReport.description"),
      },
      {
        title: translateMessage("ui.compliance.item.escalate.title"),
        description: translateMessage("ui.compliance.item.escalate.description"),
      },
    ],
  };
}
