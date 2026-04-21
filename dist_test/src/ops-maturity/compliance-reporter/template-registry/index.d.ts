import { z } from "zod";
export declare const ComplianceReportTemplateSchema: z.ZodObject<{
    templateId: z.ZodString;
    framework: z.ZodString;
    reportType: z.ZodString;
    requiredEvidenceTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    renderSchema: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    framework: string;
    templateId: string;
    reportType: string;
    requiredEvidenceTypes: string[];
    renderSchema: string[];
}, {
    framework: string;
    templateId: string;
    reportType: string;
    version?: string | undefined;
    requiredEvidenceTypes?: string[] | undefined;
    renderSchema?: string[] | undefined;
}>;
export type ComplianceReportTemplate = z.infer<typeof ComplianceReportTemplateSchema>;
export declare function findComplianceTemplate<T extends {
    templateId: string;
}>(templates: readonly T[], templateId: string): T | null;
