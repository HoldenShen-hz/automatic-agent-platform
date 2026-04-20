import { z } from "zod";

export const ComplianceReportTemplateSchema = z.object({
  templateId: z.string().min(1),
  framework: z.string().min(1),
  reportType: z.string().min(1),
});

export type ComplianceReportTemplate = z.infer<typeof ComplianceReportTemplateSchema>;

export function findComplianceTemplate(
  templates: readonly ComplianceReportTemplate[],
  templateId: string,
): ComplianceReportTemplate | null {
  return templates.find((item) => item.templateId === templateId) ?? null;
}
