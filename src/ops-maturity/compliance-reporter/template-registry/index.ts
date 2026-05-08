import { z } from "zod";

export const ComplianceReportTemplateSchema = z.object({
  templateId: z.string().min(1),
  framework: z.string().min(1),
  reportType: z.string().min(1),
  requiredEvidenceTypes: z.array(z.string()).default([]),
  renderSchema: z.array(z.string()).default([]),
  version: z.string().default("1.0"),
});

export type ComplianceReportTemplate = z.infer<typeof ComplianceReportTemplateSchema>;

export function findComplianceTemplate<T extends { templateId: string }>(
  templates: readonly T[],
  templateId: string,
): T | null {
  return templates.find((item) => item.templateId === templateId) ?? null;
}

type ComplianceTemplateLike = {
  readonly templateId: string;
  readonly framework: string;
  readonly reportType: string;
  readonly requiredEvidenceTypes: readonly string[];
  readonly renderSchema: readonly string[];
  readonly version: string;
};

export class ComplianceTemplateRegistryService<T extends ComplianceTemplateLike = ComplianceReportTemplate> {
  private readonly templates: readonly T[];

  public constructor(templates: readonly T[]) {
    this.templates = templates.map((item) => ComplianceReportTemplateSchema.parse(item) as T);
  }

  public find(templateId: string): T | null {
    return findComplianceTemplate(this.templates, templateId);
  }

  public listByFramework(framework: string): T[] {
    return this.templates.filter((item) => item.framework === framework);
  }

  public all(): readonly T[] {
    return this.templates;
  }
}
