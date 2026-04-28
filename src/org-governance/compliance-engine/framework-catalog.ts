import { z } from "zod";

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

export const DEFAULT_COMPLIANCE_FRAMEWORKS: readonly ComplianceFramework[] = Object.freeze([
  Object.freeze({
    frameworkId: "sox",
    type: "sox",
    displayName: "Sarbanes-Oxley",
    controlIds: ["access_review", "approval_segregation", "audit_retention"],
    auditRequirements: ["quarterly_access_review", "dual_approver_audit", "evidence_retention"],
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
    auditRequirements: ["phi_access_log", "breach_notification", "minimum_necessary_review"],
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
    auditRequirements: ["cardholder_data_scan", "key_rotation_attestation", "quarterly_audit"],
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
    auditRequirements: ["lawful_basis_register", "erasure_report", "residency_exception_log"],
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
    auditRequirements: ["control_owner_attestation", "change_audit_trail", "incident_summary"],
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
    auditRequirements: ["purpose_limitation_review", "cross_border_transfer_register", "sensitive_data_audit"],
    reportTemplate: "pipl_personal_information_report",
    minimumPolicies: {
      erasureWorkflowRequired: true,
      crossBorderTransferApproval: true,
      dataClassification: "restricted",
    },
  }),
]);
