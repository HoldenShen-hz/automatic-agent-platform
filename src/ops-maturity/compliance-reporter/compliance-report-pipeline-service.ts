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
  // §66.1: Template governance fields
  readonly lockedOnGeneration?: boolean;
  readonly reportVersionLock?: string | null;
  readonly requiredDataSources?: readonly string[];
  readonly legalVersion?: string | null;
  readonly migrationRule?: string | null;
  // §66.2: Human signoff enforcement
  readonly signoffRequired?: boolean;
  readonly signoffDueAtDays?: number;
  readonly escalationOwner?: string | null;
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
  readonly status: "generated" | "partial" | "pending_signoff" | "human_signoff" | "attested";
  readonly missingEvidenceTypes: readonly string[];
  readonly evidenceMap: Readonly<Record<string, readonly string[]>>;
  readonly evidenceQualityScore: number;
  readonly markdown: string;
  readonly readOnly: true;
  readonly generatedAt: string;
  readonly generatedBy: string;
  // §66.2: Human signoff enforcement fields
  readonly signoffRequired: boolean;
  readonly signoffDueAt: string | null;
  readonly escalationOwner: string | null;
  // §66.2: Attestation tracking
  readonly attestedAt: string | null;
  readonly attestedBy: string | null;
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
  readonly signoffDueAt: string;
  readonly signedAt: string | null;
  readonly status: "signed" | "signoff_overdue" | "not_attested_expired";
  // §66.2: Escalation fields
  readonly escalationOwner: string | null;
  readonly timeoutAction: "escalate" | "auto_approve" | "auto_reject" | null;
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

// §66.2: GapAnalysisResult with remediation, owner, deadline
export interface GapAnalysisResult {
  readonly controlId: string;
  readonly gapSeverity: "low" | "medium" | "high" | "critical";
  readonly missingEvidence: readonly string[];
  readonly recommendation: string;
  readonly remediation: string;
  readonly owner: string | null;
  readonly deadline: string | null;
}

export class GapAnalyzerService {
  public analyze(
    controls: readonly string[],
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    ownerMap?: Readonly<Record<string, string>>,
    deadlineMap?: Readonly<Record<string, string>>,
  ): GapAnalysisResult[] {
    const results: GapAnalysisResult[] = [];
    for (const controlId of controls) {
      const evidenceTypes = evidenceMap[controlId] ?? [];
      const missingEvidence = evidenceTypes.length === 0 ? [controlId] : [];
      const gapSeverity: GapAnalysisResult["gapSeverity"] = missingEvidence.length > 0 ? "high" : "low";
      results.push({
        controlId,
        gapSeverity,
        missingEvidence,
        recommendation: missingEvidence.length > 0 ? `Missing evidence for control ${controlId}` : "Control satisfied",
        remediation: missingEvidence.length > 0 ? `Obtain and provide evidence for ${controlId}` : "No remediation needed",
        owner: ownerMap?.[controlId] ?? null,
        deadline: deadlineMap?.[controlId] ?? null,
      });
    }
    return results;
  }
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

    // §66.2: Human signoff is required for attestation
    const signoffRequired = template.signoffRequired ?? true;
    const signoffDueAtDays = template.signoffDueAtDays ?? 7;
    const generatedAt = request.generatedAt ?? nowIso();
    const signoffDueAt = signoffRequired
      ? new Date(generatedAt).setDate(new Date(generatedAt).getDate() + signoffDueAtDays) as unknown as string
      : null;

    // §66.2: Determine initial status - reports requiring signoff start as pending_signoff
    // They cannot be attested until human signoff is obtained
    let status: ComplianceReportArtifact["status"];
    if (missingEvidenceTypes.length > 0) {
      status = "partial";
    } else if (signoffRequired) {
      // Report is complete but requires human signoff before attestation
      status = "pending_signoff";
    } else {
      status = "generated";
    }

    return {
      artifactId: newId("compliance_report"),
      templateId: template.templateId,
      framework: template.framework,
      reportType: template.reportType,
      version: template.version,
      status,
      missingEvidenceTypes,
      evidenceMap,
      evidenceQualityScore: Number((coverage.coverageRatio * 100).toFixed(2)),
      markdown: this.renderer.renderMarkdown(
        `${template.framework} ${template.reportType} report`,
        sections,
      ),
      readOnly: true,
      generatedAt,
      generatedBy: request.requestedBy,
      // §66.2: Human signoff enforcement
      signoffRequired,
      signoffDueAt,
      escalationOwner: template.escalationOwner ?? null,
      // §66.2: Attestation tracking - initially null until attested
      attestedAt: null,
      attestedBy: null,
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
    readonly signoffDueAt: string;
    readonly signedAt?: string | null;
    readonly now: string;
    readonly escalationOwner?: string | null;
    readonly timeoutAction?: "escalate" | "auto_approve" | "auto_reject";
  }): ComplianceReportHumanSignoff {
    const signedAt = input.signedAt ?? null;
    const escalationOwner = input.escalationOwner ?? input.artifact.escalationOwner ?? null;
    const timeoutAction = input.timeoutAction ?? (input.now > input.signoffDueAt ? "escalate" : null);

    if (signedAt != null && signedAt <= input.signoffDueAt) {
      return {
        artifactId: input.artifact.artifactId,
        signerId: input.signerId ?? null,
        signoffDueAt: input.signoffDueAt,
        signedAt,
        status: "signed",
        escalationOwner,
        timeoutAction,
      };
    }

    return {
      artifactId: input.artifact.artifactId,
      signerId: input.signerId ?? null,
      signoffDueAt: input.signoffDueAt,
      signedAt,
      status: input.now > input.signoffDueAt ? "not_attested_expired" : "signoff_overdue",
      escalationOwner,
      timeoutAction,
    };
  }

  /**
   * Attests a compliance report artifact after human signoff is obtained.
   * Per §66.2, reports must undergo HumanSignoff before being marked as attested.
   *
   * @param artifact - The artifact to attest
   * @param signoff - The human signoff result confirming signoff was obtained
   * @returns A new artifact with status "attested" and attestation metadata
   * @throws Error if artifact does not require signoff or signoff is invalid
   */
  public attestArtifact(
    artifact: ComplianceReportArtifact,
    signoff: ComplianceReportHumanSignoff,
  ): ComplianceReportArtifact {
    // §66.2: Can only attest artifacts that require signoff
    if (!artifact.signoffRequired) {
      throw new Error("compliance_report.attestation_not_required: Cannot attest a report that does not require signoff");
    }

    // §66.2: Can only attest if signoff was actually obtained
    if (signoff.status !== "signed") {
      throw new Error(`compliance_report.signoff_not_obtained: Cannot attest - signoff status is ${signoff.status}`);
    }

    // §66.2: Signoff must be for this specific artifact
    if (signoff.artifactId !== artifact.artifactId) {
      throw new Error("compliance_report.signoff_mismatch: Signoff artifact ID does not match");
    }

    // §66.2: Verify signoff was obtained before due date
    if (signoff.signedAt != null && artifact.signoffDueAt != null && signoff.signedAt > artifact.signoffDueAt) {
      throw new Error("compliance_report.signoff_overdue: Cannot attest - signoff was obtained after due date");
    }

    const attestedAt = signoff.signedAt ?? nowIso();

    // §66.2: Return new artifact with attested status - this is a new immutable artifact
    return {
      ...artifact,
      status: "attested",
      attestedAt,
      attestedBy: signoff.signerId,
    };
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
