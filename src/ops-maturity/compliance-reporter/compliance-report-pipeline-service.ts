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
  readonly lockedOnGeneration?: boolean;
  readonly reportVersionLock?: string;
  readonly legalVersion?: string;
  readonly effectiveDate?: string;
  readonly migrationRule?: string;
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
  readonly lockedOnGeneration: boolean;
  readonly reportVersionLock: string;
  readonly legalVersion: string;
  readonly effectiveDate: string;
  readonly migrationRule: string;
  readonly status: "generated" | "partial" | "human_signoff" | "attested";
  readonly missingEvidenceTypes: readonly string[];
  readonly evidenceMap: Readonly<Record<string, readonly string[]>>;
  readonly controlPointMap: Readonly<Record<string, import("./evidence-mapper/index.js").ControlPointCoverage>>;
  readonly evidenceQualityScore: number;
  readonly evidenceQualityBreakdown: {
    readonly completeness: number;
    readonly freshness: number;
    readonly trustworthiness: number;
    readonly tamperProof: number;
  };
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

export interface ComplianceReportHumanSignoff {
  readonly artifactId: string;
  readonly signerId: string | null;
  readonly escalationOwner: string | null;
  readonly timeoutAction: "escalate_owner" | "freeze_report" | "expire_report";
  readonly signoffDueAt: string;
  readonly signedAt: string | null;
  readonly status: "signed" | "signoff_overdue" | "not_attested_expired";
}

export interface ControlCoverageReport {
  readonly controlId: string;
  readonly framework: string;
  readonly coverageRatio: number;
  readonly coveredEvidenceTypes: readonly string[];
  readonly missingEvidenceTypes: readonly string[];
  readonly freshness: string;
  readonly owner: string;
  readonly exception?: string;
}

export interface GapAnalysisResult {
  readonly controlId: string;
  readonly gapSeverity: "low" | "medium" | "high" | "critical";
  readonly missingEvidence: readonly string[];
  readonly owner: string | null;
  readonly deadline: string | null;
  readonly recommendation: string;
  readonly remediation: string;
}

export interface ComplianceFrameworkSchedule {
  readonly framework: string;
  readonly frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  readonly intervalDays: number;
}

export class GapAnalyzerService {
  public analyze(
    controls: readonly string[],
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    ownerMap: Readonly<Record<string, string>> = {},
    deadlineMap: Readonly<Record<string, string>> = {},
  ): GapAnalysisResult[] {
    const results: GapAnalysisResult[] = [];
    for (const controlId of controls) {
      const evidenceTypes = evidenceMap[controlId] ?? [];
      const missingEvidence = evidenceTypes.length === 0 ? [controlId] : [];
      const gapSeverity: GapAnalysisResult["gapSeverity"] = missingEvidence.length > 0 ? "high" : "low";
      const hasGap = missingEvidence.length > 0;
      results.push({
        controlId,
        gapSeverity,
        missingEvidence,
        owner: ownerMap[controlId] ?? null,
        deadline: deadlineMap[controlId] ?? null,
        recommendation: hasGap ? `Missing evidence for control ${controlId}` : "Control satisfied",
        remediation: hasGap ? `Collect and attach remediation evidence for control ${controlId}` : "No remediation needed",
      });
    }
    return results;
  }
}

export class ComplianceFrequencySchedulerService {
  private readonly scheduleByFramework: Record<string, ComplianceFrameworkSchedule> = {
    SOC2: { framework: "SOC2", frequency: "quarterly", intervalDays: 90 },
    HIPAA: { framework: "HIPAA", frequency: "monthly", intervalDays: 30 },
    GDPR: { framework: "GDPR", frequency: "monthly", intervalDays: 30 },
    ISO27001: { framework: "ISO27001", frequency: "annual", intervalDays: 365 },
  };

  public resolve(framework: string): ComplianceFrameworkSchedule {
    return this.scheduleByFramework[framework] ?? {
      framework,
      frequency: "annual",
      intervalDays: 365,
    };
  }

  public nextDueAt(framework: string, fromDate: string): string {
    const schedule = this.resolve(framework);
    const dueAt = new Date(fromDate);
    dueAt.setUTCDate(dueAt.getUTCDate() + schedule.intervalDays);
    return dueAt.toISOString();
  }
}

export class ComplianceReportPipelineService {
  private readonly templates: readonly ComplianceReportTemplateDefinition[];
  private readonly accessLog = new Map<string, ComplianceReportAccessReceipt[]>();
  private readonly evidenceMapper = new EvidenceMapperService();
  private readonly renderer = new ComplianceReportRendererService();
  private readonly registry: ComplianceTemplateRegistryService<ComplianceReportTemplateDefinition>;
  private readonly schedulePolicy = new ComplianceFrequencySchedulerService();

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
    const controlPointMap = this.evidenceMapper.mapControlPoints(request.evidence);
    const coverage = this.evidenceMapper.summarizeCoverage(request.evidence, template.requiredEvidenceTypes);
    const quality = this.evidenceMapper.summarizeQuality(request.evidence, template.requiredEvidenceTypes);
    const missingEvidenceTypes = coverage.missingTypes;
    const sections = this.buildSections(template, evidenceMap, missingEvidenceTypes, quality);

    return {
      artifactId: newId("compliance_report"),
      templateId: template.templateId,
      framework: template.framework,
      reportType: template.reportType,
      version: template.version,
      lockedOnGeneration: template.lockedOnGeneration ?? true,
      reportVersionLock: template.reportVersionLock ?? "report_vlock:missing",
      legalVersion: template.legalVersion ?? "current",
      effectiveDate: template.effectiveDate ?? "1970-01-01",
      migrationRule: template.migrationRule ?? "no_migration_required",
      status: missingEvidenceTypes.length === 0 ? "generated" : "partial",
      missingEvidenceTypes,
      evidenceMap,
      controlPointMap,
      evidenceQualityScore: Number((quality.overallScore * 100).toFixed(2)),
      evidenceQualityBreakdown: {
        completeness: Number((quality.completenessScore * 100).toFixed(2)),
        freshness: Number((quality.freshnessScore * 100).toFixed(2)),
        trustworthiness: Number((quality.trustworthinessScore * 100).toFixed(2)),
        tamperProof: Number((quality.tamperProofScore * 100).toFixed(2)),
      },
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

  public evaluateHumanSignoff(input: {
    readonly artifact: ComplianceReportArtifact;
    readonly signerId?: string | null;
    readonly escalationOwner?: string | null;
    readonly timeoutAction?: "escalate_owner" | "freeze_report" | "expire_report";
    readonly signoffDueAt: string;
    readonly signedAt?: string | null;
    readonly now: string;
  }): ComplianceReportHumanSignoff {
    const signedAt = input.signedAt ?? null;
    if (signedAt != null && signedAt <= input.signoffDueAt) {
      return {
        artifactId: input.artifact.artifactId,
        signerId: input.signerId ?? null,
        escalationOwner: input.escalationOwner ?? null,
        timeoutAction: input.timeoutAction ?? "escalate_owner",
        signoffDueAt: input.signoffDueAt,
        signedAt,
        status: "signed",
      };
    }

    return {
      artifactId: input.artifact.artifactId,
      signerId: input.signerId ?? null,
      escalationOwner: input.escalationOwner ?? null,
      timeoutAction: input.timeoutAction ?? "escalate_owner",
      signoffDueAt: input.signoffDueAt,
      signedAt,
      status: input.now > input.signoffDueAt ? "not_attested_expired" : "signoff_overdue",
    };
  }

  public getFrameworkSchedule(framework: string): ComplianceFrameworkSchedule {
    return this.schedulePolicy.resolve(framework);
  }

  public nextScheduledReportDueAt(framework: string, fromDate: string): string {
    return this.schedulePolicy.nextDueAt(framework, fromDate);
  }

  private buildSections(
    template: ComplianceReportTemplateDefinition,
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    missingEvidenceTypes: readonly string[],
    quality: {
      readonly completenessScore: number;
      readonly freshnessScore: number;
      readonly trustworthinessScore: number;
      readonly tamperProofScore: number;
      readonly overallScore: number;
    },
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
          `locked_on_generation=${String(template.lockedOnGeneration ?? true)}`,
          `report_version_lock=${template.reportVersionLock ?? "report_vlock:missing"}`,
          `legal_version=${template.legalVersion ?? "current"}`,
          `effective_date=${template.effectiveDate ?? "1970-01-01"}`,
          `migration_rule=${template.migrationRule ?? "no_migration_required"}`,
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
      {
        title: "Evidence Quality",
        lines: [
          `completeness=${quality.completenessScore.toFixed(2)}`,
          `freshness=${quality.freshnessScore.toFixed(2)}`,
          `trustworthiness=${quality.trustworthinessScore.toFixed(2)}`,
          `tamper_proof=${quality.tamperProofScore.toFixed(2)}`,
          `overall=${quality.overallScore.toFixed(2)}`,
          `schedule_frequency=${this.schedulePolicy.resolve(template.framework).frequency}`,
        ],
      },
    ];
  }
}
