import { createHash } from "node:crypto";
import { z } from "zod";

export const ComplianceReportTemplateSchema = z.object({
  templateId: z.string().min(1),
  framework: z.string().min(1),
  reportType: z.string().min(1),
  requiredEvidenceTypes: z.array(z.string()).default([]),
  renderSchema: z.array(z.string()).default([]),
  version: z.string().default("1.0"),
  lockedOnGeneration: z.boolean().default(true),
  reportVersionLock: z.string().optional(),
  legalVersion: z.string().default("current"),
  effectiveDate: z.string().default("1970-01-01"),
  migrationRule: z.string().default("no_migration_required"),
  // Extended fields for comprehensive compliance reporting
  /** Controls that must be covered by this report. */
  controls: z.array(z.object({
    controlId: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    owner: z.string().optional(),
    frequency: z.enum(["continuous", "daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
    evidenceRequirements: z.array(z.string()).default([]),
  })).default([]),
  /** Evidence types required per control. */
  controlEvidenceMapping: z.record(z.string(), z.array(z.string())).default({}),
  /** Required evidence quality thresholds. */
  qualityThresholds: z.object({
    minCompleteness: z.number().min(0).max(1).default(0.8),
    minFreshnessHours: z.number().min(0).default(72),
    minTrustworthiness: z.number().min(0).max(1).default(0.7),
    minTamperProof: z.number().min(0).max(1).default(0.7),
  }).default({}),
  /** Attestation requirements. */
  attestation: z.object({
    requireHumanSignoff: z.boolean().default(false),
    signoffDueDays: z.number().min(0).default(7),
    escalationOwner: z.string().optional(),
    timeoutAction: z.enum(["escalate_owner", "freeze_report", "expire_report"]).default("escalate_owner"),
  }).default({}),
  /** Auditor access requirements. */
  auditorAccess: z.object({
    requiredPermissions: z.array(z.string()).default([]),
    allowPiiAccess: z.boolean().default(false),
    redactionRequired: z.boolean().default(true),
  }).default({}),
  /** Framework-specific metadata. */
  frameworkMetadata: z.record(z.string(), z.unknown()).default({}),
});

export type ComplianceReportTemplate = z.infer<typeof ComplianceReportTemplateSchema>;
export type ComplianceReportTemplateInput = z.input<typeof ComplianceReportTemplateSchema>;

function buildReportVersionLock(template: ComplianceReportTemplateInput): string {
  const digest = createHash("sha256")
    .update(JSON.stringify({
      templateId: template.templateId,
      framework: template.framework,
      reportType: template.reportType,
      version: template.version ?? "1.0",
      legalVersion: template.legalVersion ?? "current",
      effectiveDate: template.effectiveDate ?? "1970-01-01",
    }))
    .digest("hex")
    .slice(0, 24);
  return `report_vlock:${digest}`;
}

export function normalizeComplianceTemplate<T extends ComplianceReportTemplateInput>(template: T): ComplianceReportTemplate {
  const parsed = ComplianceReportTemplateSchema.parse(template);
  return {
    ...parsed,
    reportVersionLock: parsed.reportVersionLock ?? buildReportVersionLock(parsed),
  };
}

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
  readonly lockedOnGeneration?: boolean;
  readonly reportVersionLock?: string;
  readonly legalVersion?: string;
  readonly effectiveDate?: string;
  readonly migrationRule?: string;
};

// @ts-ignore - generic constraint issue with ComplianceTemplateLike
export class ComplianceTemplateRegistryService<T extends ComplianceTemplateLike = ComplianceReportTemplate> {
  private readonly templates: readonly T[];

  public constructor(templates: readonly T[]) {
    // @ts-ignore - generic type conversion issue
    this.templates = templates.map((item) => normalizeComplianceTemplate(item) as unknown as T);
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
