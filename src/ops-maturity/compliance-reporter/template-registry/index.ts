import { z } from "zod";

/**
 * Compliance Report Template Schema
 *
 * Per §66.1, templates must include:
 * - lockedOnGeneration: whether template is locked at generation time
 * - reportVersionLock: version lock for report reproducibility
 * - requiredDataSources: mandatory data sources for evidence
 * - legal_version: legal/compliance version reference
 * - migration_rule: migration guidance for template version upgrades
 * - effective_date: when the template becomes effective
 * - lastReviewDate: last review date for the template
 */
export const ComplianceReportTemplateSchema = z.object({
  templateId: z.string().min(1),
  framework: z.string().min(1),
  reportType: z.string().min(1),
  requiredEvidenceTypes: z.array(z.string()).default([]),
  renderSchema: z.array(z.string()).default([]),
  version: z.string().default("1.0"),
  // §66.1 required fields - all non-optional per spec
  lockedOnGeneration: z.boolean(),
  reportVersionLock: z.string(),
  requiredDataSources: z.array(z.string()).min(1),
  legalVersion: z.string(),
  migrationRule: z.string(),
  effectiveDate: z.string(),
  lastReviewDate: z.string(),
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
  // §66.1 template governance fields - all required per spec
  readonly lockedOnGeneration: boolean;
  readonly reportVersionLock: string;
  readonly requiredDataSources: readonly string[];
  readonly legalVersion: string;
  readonly migrationRule: string;
  readonly effectiveDate: string;
  readonly lastReviewDate: string;
};

export class ComplianceTemplateRegistryService<T extends ComplianceTemplateLike = ComplianceTemplateLike> {
  private readonly templates: readonly T[];

  public constructor(templates: readonly T[]) {
    // Validate and normalize templates, casting to T after Zod validation
    this.templates = templates.map((item) => {
      const validated = ComplianceReportTemplateSchema.parse(item);
      return validated as unknown as T;
    });
  }

  public find(templateId: string): T | null {
    return this.templates.find((item) => item.templateId === templateId) ?? null;
  }

  public listByFramework(framework: string): T[] {
    return this.templates.filter((item) => item.framework === framework);
  }

  public all(): readonly T[] {
    return this.templates;
  }
}
