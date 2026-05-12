import { z } from "zod";

export const AuditSpecSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  evidenceType: z.string().min(1),
  retentionPeriod: z.number().int().positive(),
});

export type AuditSpec = z.infer<typeof AuditSpecSchema>;

export const ComplianceFrameworkTypeSchema = z.enum(["gdpr", "soc2", "pipl", "hipaa", "sox", "pci_dss"]);

export const ComplianceFrameworkSchema = z.object({
  frameworkId: z.string().min(1),
  type: ComplianceFrameworkTypeSchema,
  displayName: z.string().min(1),
  controlIds: z.array(z.string().min(1)).default([]),
  auditRequirements: z.array(z.string().min(1)).default([]),
  reportTemplate: z.string().min(1),
  minimumPolicies: z.record(z.unknown()).default({}),
});

export const DepartmentComplianceBindingSchema = z.object({
  bindingId: z.string().min(1),
  orgNodeId: z.string().min(1),
  frameworkIds: z.array(z.string().min(1)).default([]),
  attachedAt: z.string().min(1),
  attachedBy: z.string().min(1),
});

export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;
export type DepartmentComplianceBinding = z.infer<typeof DepartmentComplianceBindingSchema>;

export const DEFAULT_COMPLIANCE_FRAMEWORKS = Object.freeze([
  Object.freeze({
    frameworkId: "sox",
    type: "sox" as const,
    displayName: "Sarbanes-Oxley",
    controlIds: Object.freeze(["access_review", "approval_segregation", "audit_retention"] as const),
    auditRequirements: Object.freeze(["quarterly_access_review", "dual_approver_audit", "evidence_retention"] as const),
    reportTemplate: "sox_control_attestation",
    minimumPolicies: Object.freeze({
      segregationOfDuties: true,
      auditRetentionDays: 2555,
      approvalChainRequired: true,
    }),
  }),
  Object.freeze({
    frameworkId: "hipaa",
    type: "hipaa" as const,
    displayName: "HIPAA",
    controlIds: Object.freeze(["phi_access", "minimum_necessary", "encryption_required"] as const),
    auditRequirements: Object.freeze(["phi_access_log", "breach_notification", "minimum_necessary_review"] as const),
    reportTemplate: "hipaa_phi_control_report",
    minimumPolicies: Object.freeze({
      dataClassification: "restricted",
      encryptionRequired: true,
      breachNotificationHours: 72,
    }),
  }),
  Object.freeze({
    frameworkId: "pci_dss",
    type: "pci_dss" as const,
    displayName: "PCI DSS",
    controlIds: Object.freeze(["network_segmentation", "key_rotation", "payment_audit"] as const),
    auditRequirements: Object.freeze(["cardholder_data_scan", "key_rotation_attestation", "quarterly_audit"] as const),
    reportTemplate: "pci_dss_attestation",
    minimumPolicies: Object.freeze({
      cardDataIsolation: true,
      keyRotationDays: 90,
      dualControl: true,
    }),
  }),
  Object.freeze({
    frameworkId: "gdpr",
    type: "gdpr" as const,
    displayName: "GDPR",
    controlIds: Object.freeze(["lawful_basis", "erasure", "residency", "consent_audit"] as const),
    auditRequirements: Object.freeze(["lawful_basis_register", "erasure_report", "residency_exception_log"] as const),
    reportTemplate: "gdpr_data_governance_report",
    minimumPolicies: Object.freeze({
      erasureWorkflowRequired: true,
      residencyAwareProcessing: true,
      consentTracking: true,
    }),
  }),
  Object.freeze({
    frameworkId: "soc2",
    type: "soc2" as const,
    displayName: "SOC 2",
    controlIds: Object.freeze(["change_management", "access_review", "incident_response"] as const),
    auditRequirements: Object.freeze(["control_owner_attestation", "change_audit_trail", "incident_summary"] as const),
    reportTemplate: "soc2_trust_services_report",
    minimumPolicies: Object.freeze({
      changeApprovalRequired: true,
      incidentResponseRunbook: true,
      evidenceRetentionDays: 365,
    }),
  }),
  Object.freeze({
    frameworkId: "pipl",
    type: "pipl" as const,
    displayName: "PIPL",
    controlIds: Object.freeze(["purpose_limitation", "cross_border_transfer", "sensitive_data_protection"] as const),
    auditRequirements: Object.freeze(["purpose_limitation_review", "cross_border_transfer_register", "sensitive_data_audit"] as const),
    reportTemplate: "pipl_personal_information_report",
    minimumPolicies: Object.freeze({
      erasureWorkflowRequired: true,
      crossBorderTransferApproval: true,
      dataClassification: "restricted",
    }),
  }),
] as const) as unknown as readonly ComplianceFramework[];

/**
 * Looks up a compliance framework by its type identifier.
 * Returns undefined if no matching framework exists.
 */
export function getComplianceFrameworkByType(
  type: ComplianceFramework["type"],
): ComplianceFramework | undefined {
  return DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.type === type);
}

/**
 * Returns all framework types available in the catalog.
 */
export function getAvailableFrameworkTypes(): readonly ComplianceFramework["type"][] {
  return DEFAULT_COMPLIANCE_FRAMEWORKS.map((f) => f.type);
}
