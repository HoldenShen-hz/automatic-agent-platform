export interface ComplianceProgramTemplate {
    readonly templateId: string;
    readonly regulation: string;
    readonly reportTemplateRefs: readonly string[];
    readonly requiredControls: readonly string[];
    readonly tenantProgramFlow: readonly string[];
    readonly dataDomains: readonly string[];
}
export declare class ComplianceProgramTemplateService {
    listTemplates(): ComplianceProgramTemplate[];
    getTemplate(templateId: string): ComplianceProgramTemplate | null;
    buildCoverageMatrix(): Array<{
        templateId: string;
        regulation: string;
        controlCount: number;
        reportTemplateCount: number;
    }>;
}
