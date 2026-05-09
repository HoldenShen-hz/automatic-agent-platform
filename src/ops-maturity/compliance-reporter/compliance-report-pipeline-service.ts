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
  // Extended fields
  readonly controls?: readonly {
    controlId: string;
    title?: string;
    description?: string;
    owner?: string;
    frequency?: "continuous" | "daily" | "weekly" | "monthly" | "quarterly" | "annually";
    evidenceRequirements?: readonly string[];
  }[];
  readonly controlEvidenceMapping?: Readonly<Record<string, readonly string[]>>;
  readonly qualityThresholds?: {
    minCompleteness?: number;
    minFreshnessHours?: number;
    minTrustworthiness?: number;
    minTamperProof?: number;
  };
  readonly attestation?: {
    requireHumanSignoff?: boolean;
    signoffDueDays?: number;
    escalationOwner?: string;
    timeoutAction?: "escalate_owner" | "freeze_report" | "expire_report";
  };
  readonly auditorAccess?: {
    requiredPermissions?: readonly string[];
    allowPiiAccess?: boolean;
    redactionRequired?: boolean;
  };
  readonly frameworkMetadata?: Readonly<Record<string, unknown>>;
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

export interface ComplianceAuditorAccessRequest {
  readonly auditorId: string;
  readonly framework?: string;
  readonly grantedPermissions: readonly string[];
  readonly allowPiiAccess?: boolean;
}

export interface ComplianceAuditorAccessView {
  readonly artifactId: string;
  readonly framework: string;
  readonly accessorId: string;
  readonly permissions: readonly string[];
  readonly piiRedacted: boolean;
  readonly markdown: string;
  readonly evidenceMap: Readonly<Record<string, readonly string[]>>;
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

export class ComplianceAuditorAccessService {
  private readonly minimumPermissionsByFramework: Readonly<Record<string, readonly string[]>> = {
    SOC2: ["compliance:report:read", "compliance:soc2:read"],
    HIPAA: ["compliance:report:read", "compliance:hipaa:read"],
    GDPR: ["compliance:report:read", "compliance:gdpr:read"],
    ISO27001: ["compliance:report:read", "compliance:iso27001:read"],
  };

  public requiredPermissionsForFramework(framework: string): readonly string[] {
    return this.minimumPermissionsByFramework[framework] ?? ["compliance:report:read"];
  }

  public buildAuditorView(
    artifact: ComplianceReportArtifact,
    request: ComplianceAuditorAccessRequest,
  ): ComplianceAuditorAccessView {
    const framework = request.framework ?? artifact.framework;
    const requiredPermissions = this.requiredPermissionsForFramework(framework);
    const permissionSet = new Set(request.grantedPermissions);
    const missingPermissions = requiredPermissions.filter((permission) => !permissionSet.has(permission));
    if (missingPermissions.length > 0) {
      throw new Error(`compliance_report.auditor_permission_denied:${framework}:${missingPermissions.join(",")}`);
    }
    const piiRedacted = request.allowPiiAccess !== true;

    return {
      artifactId: artifact.artifactId,
      framework,
      accessorId: request.auditorId,
      permissions: [...requiredPermissions],
      piiRedacted,
      markdown: piiRedacted ? redactPiiText(artifact.markdown) : artifact.markdown,
      evidenceMap: piiRedacted ? redactEvidenceMap(artifact.evidenceMap) : artifact.evidenceMap,
    };
  }
}

export class ComplianceReportPipelineService {
  private readonly templates: readonly ComplianceReportTemplateDefinition[];
  private readonly accessLog = new Map<string, ComplianceReportAccessReceipt[]>();
  private readonly evidenceMapper = new EvidenceMapperService();
  private readonly renderer = new ComplianceReportRendererService();
  private readonly registry: ComplianceTemplateRegistryService<ComplianceReportTemplateDefinition>;
  private readonly schedulePolicy = new ComplianceFrequencySchedulerService();
  private readonly auditorAccess = new ComplianceAuditorAccessService();

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

    // Determine initial status: partial if evidence gaps exist
    const baseStatus: ComplianceReportArtifact["status"] =
      missingEvidenceTypes.length === 0 ? "generated" : "partial";

    // If attestation requires human signoff, upgrade to human_signoff regardless of evidence completeness
    const requireSignoff = (template as ComplianceReportTemplateDefinition).attestation?.requireHumanSignoff === true;
    const status: ComplianceReportArtifact["status"] = requireSignoff ? "human_signoff" : baseStatus;

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
      status,
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
    // Use getTime() for deterministic numeric comparison, avoiding timezone interpretation issues
    const signoffDueTime = new Date(input.signoffDueAt).getTime();
    if (signedAt != null && new Date(signedAt).getTime() <= signoffDueTime) {
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
      status: new Date(input.now).getTime() > signoffDueTime ? "not_attested_expired" : "signoff_overdue",
    };
  }

  public getFrameworkSchedule(framework: string): ComplianceFrameworkSchedule {
    return this.schedulePolicy.resolve(framework);
  }

  public nextScheduledReportDueAt(framework: string, fromDate: string): string {
    return this.schedulePolicy.nextDueAt(framework, fromDate);
  }

  public buildAuditorAccessView(
    artifact: ComplianceReportArtifact,
    request: ComplianceAuditorAccessRequest,
  ): ComplianceAuditorAccessView {
    return this.auditorAccess.buildAuditorView(artifact, request);
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

function redactEvidenceMap(
  evidenceMap: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    Object.entries(evidenceMap).map(([key, values]) => [key, values.map((value) => redactPiiText(value))]),
  );
}

function redactPiiText(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    .replace(/\b(?:\+?\d{1,2}\s*)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
}
