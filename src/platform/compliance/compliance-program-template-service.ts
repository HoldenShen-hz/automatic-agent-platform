export interface ComplianceProgramTemplate {
  readonly templateId: string;
  readonly regulation: string;
  readonly reportTemplateRefs: readonly string[];
  readonly requiredControls: readonly string[];
  readonly tenantProgramFlow: readonly string[];
  readonly dataDomains: readonly string[];
}

const DEFAULT_TEMPLATES: readonly ComplianceProgramTemplate[] = [
  {
    templateId: "gdpr-export-erasure",
    regulation: "GDPR",
    reportTemplateRefs: ["compliance_report.gdpr_export", "compliance_report.subject_erasure"],
    requiredControls: ["residency_check", "subject_identity_verification", "lineage_capture"],
    tenantProgramFlow: ["intake", "classification", "residency_decision", "export_or_redact", "evidence_bundle"],
    dataDomains: ["knowledge", "artifacts", "memory"],
  },
  {
    templateId: "soc2-audit-evidence",
    regulation: "SOC2",
    reportTemplateRefs: ["compliance_report.soc2_controls", "compliance_report.audit_lineage"],
    requiredControls: ["audit_retention", "access_review", "change_management", "backup_restore"],
    tenantProgramFlow: ["control_sampling", "evidence_export", "exception_review", "package_finalize"],
    dataDomains: ["audit", "events", "deployments"],
  },
  {
    templateId: "hipaa-cross-region-transfer",
    regulation: "HIPAA",
    reportTemplateRefs: ["compliance_report.hipaa_transfer", "compliance_report.phi_redaction"],
    requiredControls: ["phi_classification", "field_encryption", "residency_check", "approval_gate"],
    tenantProgramFlow: ["classification", "governance_review", "transfer_decision", "report_generation"],
    dataDomains: ["knowledge", "artifacts"],
  },
] as const;

export class ComplianceProgramTemplateService {
  public listTemplates(): ComplianceProgramTemplate[] {
    return [...DEFAULT_TEMPLATES];
  }

  public getTemplate(templateId: string): ComplianceProgramTemplate | null {
    return this.listTemplates().find((template) => template.templateId === templateId) ?? null;
  }

  public buildCoverageMatrix(): Array<{
    templateId: string;
    regulation: string;
    controlCount: number;
    reportTemplateCount: number;
  }> {
    return this.listTemplates().map((template) => ({
      templateId: template.templateId,
      regulation: template.regulation,
      controlCount: template.requiredControls.length,
      reportTemplateCount: template.reportTemplateRefs.length,
    }));
  }
}
