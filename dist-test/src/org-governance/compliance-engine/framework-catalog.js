import { z } from "zod";
export const ComplianceFrameworkSchema = z.object({
    frameworkId: z.string().min(1),
    displayName: z.string().min(1),
    controlIds: z.array(z.string().min(1)).default([]),
    minimumPolicies: z.record(z.unknown()).default({}),
});
export const DepartmentComplianceBindingSchema = z.object({
    bindingId: z.string().min(1),
    orgNodeId: z.string().min(1),
    frameworkIds: z.array(z.string().min(1)).default([]),
    attachedAt: z.string().min(1),
    attachedBy: z.string().min(1),
});
export const DEFAULT_COMPLIANCE_FRAMEWORKS = Object.freeze([
    Object.freeze({
        frameworkId: "sox",
        displayName: "Sarbanes-Oxley",
        controlIds: ["access_review", "approval_segregation", "audit_retention"],
        minimumPolicies: {
            segregationOfDuties: true,
            auditRetentionDays: 2555,
            approvalChainRequired: true,
        },
    }),
    Object.freeze({
        frameworkId: "hipaa",
        displayName: "HIPAA",
        controlIds: ["phi_access", "minimum_necessary", "encryption_required"],
        minimumPolicies: {
            dataClassification: "restricted",
            encryptionRequired: true,
            breachNotificationHours: 72,
        },
    }),
    Object.freeze({
        frameworkId: "pci_dss",
        displayName: "PCI DSS",
        controlIds: ["network_segmentation", "key_rotation", "payment_audit"],
        minimumPolicies: {
            cardDataIsolation: true,
            keyRotationDays: 90,
            dualControl: true,
        },
    }),
    Object.freeze({
        frameworkId: "gdpr",
        displayName: "GDPR",
        controlIds: ["lawful_basis", "erasure", "residency", "consent_audit"],
        minimumPolicies: {
            erasureWorkflowRequired: true,
            residencyAwareProcessing: true,
            consentTracking: true,
        },
    }),
]);
//# sourceMappingURL=framework-catalog.js.map