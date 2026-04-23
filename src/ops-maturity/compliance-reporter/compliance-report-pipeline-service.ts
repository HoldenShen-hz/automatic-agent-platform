import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { EvidenceMapperService, mapEvidenceByType, type EvidenceReference } from "./evidence-mapper/index.js";
import { ComplianceReportRendererService, renderComplianceReportMarkdown, type ComplianceReportSection } from "./report-renderer/index.js";
import { ComplianceTemplateRegistryService, findComplianceTemplate } from "./template-registry/index.js";

export interface ComplianceReportTemplateDefinition {
  readonly templateId: string;
  readonly framework: string;
  readonly reportType: string;
  readonly requiredEvidenceTypes: readonly string[];
  readonly renderSchema: readonly string[];
  readonly version: string;
}

export interface ComplianceReportRequest {
  readonly templateId: string;
  readonly evidence: readonly EvidenceReference[];
  readonly requestedBy: string;
  readonly generatedAt?: string;
}

export interface ComplianceReportArtifact {
  readonly artifactId: string;
  readonly templateId: string;
  readonly framework: string;
  readonly reportType: string;
  readonly version: string;
  readonly status: "complete" | "partial";
  readonly missingEvidenceTypes: readonly string[];
  readonly evidenceMap: Readonly<Record<string, readonly string[]>>;
  readonly markdown: string;
  readonly readOnly: true;
  readonly generatedAt: string;
  readonly generatedBy: string;
}

export interface ComplianceReportAccessReceipt {
  readonly artifactId: string;
  readonly accessorId: string;
  readonly accessMode: "read_only";
  readonly accessedAt: string;
}

export class ComplianceReportPipelineService {
  private readonly templates: readonly ComplianceReportTemplateDefinition[];
  private readonly accessLog = new Map<string, ComplianceReportAccessReceipt[]>();
  private readonly evidenceMapper = new EvidenceMapperService();
  private readonly renderer = new ComplianceReportRendererService();
  private readonly registry: ComplianceTemplateRegistryService<ComplianceReportTemplateDefinition>;

  public constructor(templates: readonly ComplianceReportTemplateDefinition[]) {
    this.templates = templates;
    this.registry = new ComplianceTemplateRegistryService(templates);
  }

  public generate(request: ComplianceReportRequest): ComplianceReportArtifact {
    const template = this.registry.find(request.templateId) ?? findComplianceTemplate(this.templates, request.templateId);
    if (template == null) {
      throw new Error(`compliance_report.template_not_found:${request.templateId}`);
    }

    const evidenceMap = this.evidenceMapper.map(request.evidence);
    const coverage = this.evidenceMapper.summarizeCoverage(request.evidence, template.requiredEvidenceTypes);
    const missingEvidenceTypes = coverage.missingTypes;
    const sections = this.buildSections(template, evidenceMap, missingEvidenceTypes);

    return {
      artifactId: newId("compliance_report"),
      templateId: template.templateId,
      framework: template.framework,
      reportType: template.reportType,
      version: template.version,
      status: missingEvidenceTypes.length === 0 ? "complete" : "partial",
      missingEvidenceTypes,
      evidenceMap,
      markdown: this.renderer.renderMarkdown(
        `${template.framework} ${template.reportType} report`,
        sections,
      ),
      readOnly: true,
      generatedAt: request.generatedAt ?? nowIso(),
      generatedBy: request.requestedBy,
    };
  }

  public recordReadAccess(artifact: ComplianceReportArtifact, accessorId: string, accessedAt = nowIso()): ComplianceReportAccessReceipt {
    const receipt: ComplianceReportAccessReceipt = {
      artifactId: artifact.artifactId,
      accessorId,
      accessMode: "read_only",
      accessedAt,
    };
    this.accessLog.set(artifact.artifactId, [...(this.accessLog.get(artifact.artifactId) ?? []), receipt]);
    return receipt;
  }

  public getAccessLog(artifactId: string): ComplianceReportAccessReceipt[] {
    return [...(this.accessLog.get(artifactId) ?? [])];
  }

  private buildSections(
    template: ComplianceReportTemplateDefinition,
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    missingEvidenceTypes: readonly string[],
  ): ComplianceReportSection[] {
    const coverageLines = template.requiredEvidenceTypes.map((evidenceType) => {
      const evidenceIds = evidenceMap[evidenceType] ?? [];
      return evidenceIds.length > 0
        ? `${evidenceType}: ${evidenceIds.join(", ")}`
        : `${evidenceType}: MISSING`;
    });
    const gapLines = missingEvidenceTypes.length === 0
      ? ["All required evidence types are present."]
      : missingEvidenceTypes.map((item) => `Gap: missing required evidence type ${item}`);

    return [
      {
        title: "Template",
        lines: [
          `template_id=${template.templateId}`,
          `framework=${template.framework}`,
          `report_type=${template.reportType}`,
          `version=${template.version}`,
        ],
      },
      {
        title: "Evidence Coverage",
        lines: coverageLines,
      },
      {
        title: "Completeness",
        lines: [...gapLines, `coverage_ratio=${missingEvidenceTypes.length === 0 ? "1" : ((template.requiredEvidenceTypes.length - missingEvidenceTypes.length) / Math.max(1, template.requiredEvidenceTypes.length)).toFixed(2)}`],
      },
    ];
  }
}
