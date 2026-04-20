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
