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
  auditRequirements: z.array(AuditSpecSchema).default([]),
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

export const DEFAULT_COMPLIANCE_FRAMEWORKS: readonly ComplianceFramework[] = Object.freeze([
  Object.freeze({
    frameworkId: "sox",
    type: "sox",
    displayName: "Sarbanes-Oxley",
    controlIds: ["access_review", "approval_segregation", "audit_retention"],
    auditRequirements: [
      { frequency: "quarterly", evidenceType: "access_review_log", retentionPeriod: 2555 },
      { frequency: "quarterly", evidenceType: "dual_approver_audit", retentionPeriod: 2555 },
      { frequency: "annually", evidenceType: "evidence_retention", retentionPeriod: 2555 },
    ],
    reportTemplate: "sox_control_attestation",
    minimumPolicies: {
      segregationOfDuties: true,
      auditRetentionDays: 2555,
      approvalChainRequired: true,
    },
  }),
  Object.freeze({
    frameworkId: "hipaa",
    type: "hipaa",
    displayName: "HIPAA",
    controlIds: ["phi_access", "minimum_necessary", "encryption_required"],
    auditRequirements: [
      { frequency: "monthly", evidenceType: "phi_access_log", retentionPeriod: 2190 },
      { frequency: "annually", evidenceType: "breach_notification", retentionPeriod: 2190 },
      { frequency: "quarterly", evidenceType: "minimum_necessary_review", retentionPeriod: 2190 },
    ],
    reportTemplate: "hipaa_phi_control_report",
    minimumPolicies: {
      dataClassification: "restricted",
      encryptionRequired: true,
      breachNotificationHours: 72,
    },
  }),
  Object.freeze({
    frameworkId: "pci_dss",
    type: "pci_dss",
    displayName: "PCI DSS",
    controlIds: ["network_segmentation", "key_rotation", "payment_audit"],
    auditRequirements: [
      { frequency: "quarterly", evidenceType: "cardholder_data_scan", retentionPeriod: 365 },
      { frequency: "annually", evidenceType: "key_rotation_attestation", retentionPeriod: 365 },
      { frequency: "quarterly", evidenceType: "quarterly_audit", retentionPeriod: 365 },
    ],
    reportTemplate: "pci_dss_attestation",
    minimumPolicies: {
      cardDataIsolation: true,
      keyRotationDays: 90,
      dualControl: true,
    },
  }),
  Object.freeze({
    frameworkId: "gdpr",
    type: "gdpr",
    displayName: "GDPR",
    controlIds: ["lawful_basis", "erasure", "residency", "consent_audit"],
    auditRequirements: [
      { frequency: "annually", evidenceType: "lawful_basis_register", retentionPeriod: 730 },
      { frequency: "annually", evidenceType: "erasure_report", retentionPeriod: 730 },
      { frequency: "monthly", evidenceType: "residency_exception_log", retentionPeriod: 730 },
    ],
    reportTemplate: "gdpr_data_governance_report",
    minimumPolicies: {
      erasureWorkflowRequired: true,
      residencyAwareProcessing: true,
      consentTracking: true,
    },
  }),
  Object.freeze({
    frameworkId: "soc2",
    type: "soc2",
    displayName: "SOC 2",
    controlIds: ["change_management", "access_review", "incident_response"],
    auditRequirements: [
      { frequency: "annually", evidenceType: "control_owner_attestation", retentionPeriod: 365 },
      { frequency: "monthly", evidenceType: "change_audit_trail", retentionPeriod: 365 },
      { frequency: "quarterly", evidenceType: "incident_summary", retentionPeriod: 365 },
    ],
    reportTemplate: "soc2_trust_services_report",
    minimumPolicies: {
      changeApprovalRequired: true,
      incidentResponseRunbook: true,
      evidenceRetentionDays: 365,
    },
  }),
  Object.freeze({
    frameworkId: "pipl",
    type: "pipl",
    displayName: "PIPL",
    controlIds: ["purpose_limitation", "cross_border_transfer", "sensitive_data_protection"],
    auditRequirements: [
      { frequency: "annually", evidenceType: "purpose_limitation_review", retentionPeriod: 1095 },
      { frequency: "monthly", evidenceType: "cross_border_transfer_register", retentionPeriod: 1095 },
      { frequency: "annually", evidenceType: "sensitive_data_audit", retentionPeriod: 1095 },
    ],
    reportTemplate: "pipl_personal_information_report",
    minimumPolicies: {
      erasureWorkflowRequired: true,
      crossBorderTransferApproval: true,
      dataClassification: "restricted",
    },
  }),
]);
