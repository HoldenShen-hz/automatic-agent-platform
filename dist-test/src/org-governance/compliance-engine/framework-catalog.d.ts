import { z } from "zod";
export declare const ComplianceFrameworkSchema: z.ZodObject<{
    frameworkId: z.ZodString;
    displayName: z.ZodString;
    controlIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    minimumPolicies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    displayName: string;
    frameworkId: string;
    controlIds: string[];
    minimumPolicies: Record<string, unknown>;
}, {
    displayName: string;
    frameworkId: string;
    controlIds?: string[] | undefined;
    minimumPolicies?: Record<string, unknown> | undefined;
}>;
export declare const DepartmentComplianceBindingSchema: z.ZodObject<{
    bindingId: z.ZodString;
    orgNodeId: z.ZodString;
    frameworkIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    attachedAt: z.ZodString;
    attachedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bindingId: string;
    orgNodeId: string;
    frameworkIds: string[];
    attachedAt: string;
    attachedBy: string;
}, {
    bindingId: string;
    orgNodeId: string;
    attachedAt: string;
    attachedBy: string;
    frameworkIds?: string[] | undefined;
}>;
export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;
export type DepartmentComplianceBinding = z.infer<typeof DepartmentComplianceBindingSchema>;
export declare const DEFAULT_COMPLIANCE_FRAMEWORKS: readonly ComplianceFramework[];
