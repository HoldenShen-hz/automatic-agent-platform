import { z } from "zod";
export const ComplianceReportTemplateSchema = z.object({
    templateId: z.string().min(1),
    framework: z.string().min(1),
    reportType: z.string().min(1),
    requiredEvidenceTypes: z.array(z.string()).default([]),
    renderSchema: z.array(z.string()).default([]),
    version: z.string().default("1.0"),
});
export function findComplianceTemplate(templates, templateId) {
    return templates.find((item) => item.templateId === templateId) ?? null;
}
export class ComplianceTemplateRegistryService {
    templates;
    constructor(templates) {
        this.templates = templates.map((item) => ComplianceReportTemplateSchema.parse(item));
    }
    find(templateId) {
        return findComplianceTemplate(this.templates, templateId);
    }
    listByFramework(framework) {
        return this.templates.filter((item) => item.framework === framework);
    }
    all() {
        return this.templates;
    }
}
//# sourceMappingURL=index.js.map