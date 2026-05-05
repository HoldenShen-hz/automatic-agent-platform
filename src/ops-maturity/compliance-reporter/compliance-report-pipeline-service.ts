import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { EvidenceMapperService, computeEvidenceQualityScore, mapEvidenceByType, analyzeGaps, type EvidenceReference, type GapAnalysisResult } from "./evidence-mapper/index.js";
import { ComplianceReportRendererService, renderComplianceReportMarkdown, type ComplianceReportSection } from "./report-renderer/index.js";
import { ComplianceTemplateRegistryService, findComplianceTemplate } from "./template-registry/index.js";

// Re-export GapAnalysisResult from evidence-mapper for backward compatibility
export type { GapAnalysisResult } from "./evidence-mapper/index.js";

/**
 * §66.3: Framework-specific scheduling requirements.
 * Different compliance frameworks require different reporting frequencies.
 */
export type ComplianceFramework = "SOC2" | "HIPAA" | "ISO27001" | "GDPR" | "PCI-DSS" | "NIST" | "OTHER";

export interface FrameworkSchedulingConfig {
  readonly framework: ComplianceFramework;
  readonly reportingFrequencyDays: number;
  readonly quarterly: boolean;
  readonly monthly: boolean;
  readonly description: string;
}

/**
 * §66.3: Canonical framework scheduling configurations per architecture spec.
 * SOC2 reports quarterly, HIPAA reports monthly, etc.
 */
export const FRAMEWORK_SCHEDULING: Record<ComplianceFramework, FrameworkSchedulingConfig> = {
  SOC2: {
    framework: "SOC2",
    reportingFrequencyDays: 90,
    quarterly: true,
    monthly: false,
    description: "SOC 2 Type II reports typically generated quarterly",
  },
  HIPAA: {
    framework: "HIPAA",
    reportingFrequencyDays: 30,
    quarterly: false,
    monthly: true,
    description: "HIPAA compliance reports required monthly",
  },
  ISO27001: {
    framework: "ISO27001",
    reportingFrequencyDays: 90,
    quarterly: true,
    monthly: false,
    description: "ISO 27001 risk assessment reviews quarterly",
  },
  GDPR: {
    framework: "GDPR",
    reportingFrequencyDays: 30,
    quarterly: false,
    monthly: true,
    description: "GDPR data processing activity reviews monthly",
  },
  "PCI-DSS": {
    framework: "PCI-DSS",
    reportingFrequencyDays: 90,
    quarterly: true,
    monthly: false,
    description: "PCI-DSS compliance assessment quarterly",
  },
  NIST: {
    framework: "NIST",
    reportingFrequencyDays: 90,
    quarterly: true,
    monthly: false,
    description: "NIST framework cybersecurity assessments quarterly",
  },
  OTHER: {
    framework: "OTHER",
    reportingFrequencyDays: 90,
    quarterly: true,
    monthly: false,
    description: "Custom framework with default quarterly schedule",
  },
};

/**
 * §66.4: Auditor access control with PII redaction and per-framework least privilege.
 */
export interface AuditorAccessConfig {
  readonly auditorId: string;
  readonly permittedFrameworks: readonly ComplianceFramework[];
  readonly canAccessPII: boolean;
  readonly canAccessRawEvidence: boolean;
  readonly canInitiateRemediation: boolean;
  readonly redactedFields: readonly string[];
}

/**
 * §66.4: PII redaction patterns for common Personally Identifiable Information.
 */
const PII_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly replacement: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN-REDACTED]" },
  { pattern: /\b\d{16}\b/g, replacement: "[CARD-REDACTED]" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL-REDACTED]" },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE-REDACTED]" },
  { pattern: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi, replacement: "[ADDRESS-REDACTED]" },
];

/**
 * §66.4: PII redaction service for compliance reports.
 */
export class PIIRedactionService {
  public redactPII(content: string, customPatterns?: ReadonlyArray<{ readonly pattern: RegExp; readonly replacement: string }>): string {
    const patterns = customPatterns ?? PII_PATTERNS;
    let redacted = content;
    for (const { pattern, replacement } of patterns) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }

  public redactEvidence<T extends Record<string, unknown>>(evidence: T): T {
    const redacted: Record<string, unknown> = { ...evidence };
    for (const key of Object.keys(redacted)) {
      if (typeof redacted[key] === "string") {
        redacted[key] = this.redactPII(redacted[key] as string);
      }
    }
    return redacted as T;
  }
}

/**
 * §66.4: Per-framework least-privilege access control for auditors.
 */
export class AuditorAccessControlService {
  private readonly auditors = new Map<string, AuditorAccessConfig>();
  private readonly piiRedactor = new PIIRedactionService();

  public registerAuditor(config: AuditorAccessConfig): void {
    this.auditors.set(config.auditorId, config);
  }

  public getAuditorConfig(auditorId: string): AuditorAccessConfig | null {
    return this.auditors.get(auditorId) ?? null;
  }

  public canAccessFramework(auditorId: string, framework: ComplianceFramework): boolean {
    const config = this.auditors.get(auditorId);
    if (!config) return false;
    return config.permittedFrameworks.includes(framework);
  }

  /**
   * §66.3: Gets the next scheduled report date based on framework requirements.
   */
  public getNextScheduledDate(framework: ComplianceFramework, fromDate?: string): string {
    const config = FRAMEWORK_SCHEDULING[framework];
    const baseDate = fromDate ? new Date(fromDate) : new Date();
    const nextDate = new Date(baseDate.getTime() + config.reportingFrequencyDays * 24 * 60 * 60 * 1000);
    return nextDate.toISOString();
  }

  /**
   * §66.4: Redacts content based on auditor's permitted access level.
   */
  public redactForAuditor<T extends Record<string, unknown>>(
    auditorId: string,
    content: T,
    framework: ComplianceFramework,
  ): T {
    const config = this.auditors.get(auditorId);
    if (!config) {
      return {} as T;
    }

    if (!this.canAccessFramework(auditorId, framework)) {
      throw new Error(`compliance.access_denied:auditor_${auditorId}_not_permitted_for_${framework}`);
    }

    if (!config.canAccessPII) {
      return this.piiRedactor.redactEvidence(content);
    }

    const result: Record<string, unknown> = { ...content };
    for (const field of config.redactedFields) {
      if (field in result && typeof result[field] === "string") {
        result[field] = "[REDACTED]";
      }
    }
    return result as T;
  }
}

export interface ComplianceReportTemplateDefinition {
  readonly templateId: string;
  readonly framework: string;
  readonly reportType: string;
  readonly requiredEvidenceTypes: readonly string[];
  readonly renderSchema: readonly string[];
  readonly version: string;
  // §66.1: Template governance fields - required per spec
  readonly lockedOnGeneration: boolean;
  readonly reportVersionLock: string;
  readonly requiredDataSources: readonly string[];
  readonly legalVersion: string;
  readonly migrationRule: string;
  // §66.1: Effective and review dates for template lifecycle
  readonly effectiveDate: string;
  readonly lastReviewDate: string;
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
  readonly status: "signed" | "signed_late" | "signoff_overdue" | "not_attested_expired";
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

/**
 * §66.2: GapAnalyzerService delegates to the evidence-mapper implementation.
 * This class provides compliance-specific gap analysis orchestration.
 */
export class GapAnalyzerService {
  public analyze(
    controls: readonly string[],
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    ownerMap?: Readonly<Record<string, string>>,
    deadlineMap?: Readonly<Record<string, string>>,
  ): GapAnalysisResult[] {
    // §66.2: Delegate to the evidence-mapper's analyzeGaps function
    return analyzeGaps(controls, evidenceMap, ownerMap, deadlineMap);
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
    // §180-2114: Removed redundant second lookup - registry.find() already searches this.templates
    const template = this.registry.find(request.templateId);
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
      evidenceQualityScore: computeEvidenceQualityScore(request.evidence, coverage.coverageRatio),
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
    // §66.2: escalationOwner must be resolved - template default or system fallback
    const escalationOwner = input.escalationOwner ?? input.artifact.escalationOwner ?? "compliance_admin";
    // §66.2: timeoutAction must be defined - default to "escalate" when overdue
    const timeoutAction = input.timeoutAction ?? (input.now > input.signoffDueAt ? "escalate" : "escalate");

    // R16-36 FIX #2107: ISO string comparison fails for non-UTC formats (e.g., +08:00).
    // Lexicographic comparison of "2026-05-01T12:00:00+08:00" vs "2026-05-01T04:00:00Z"
    // would incorrectly indicate the first is earlier. Parse as Date for correct comparison.
    const signoffDueAtMs = new Date(input.signoffDueAt).getTime();
    const signedAtMs = signedAt != null ? new Date(signedAt).getTime() : null;
    const nowMs = new Date(input.now).getTime();

    if (signedAtMs != null && signedAtMs <= signoffDueAtMs) {
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

    if (signedAtMs != null && signedAtMs > signoffDueAtMs) {
      return {
        artifactId: input.artifact.artifactId,
        signerId: input.signerId ?? null,
        signoffDueAt: input.signoffDueAt,
        signedAt,
        status: "signed_late",
        escalationOwner,
        timeoutAction,
      };
    }

    return {
      artifactId: input.artifact.artifactId,
      signerId: input.signerId ?? null,
      signoffDueAt: input.signoffDueAt,
      signedAt,
      status: nowMs > signoffDueAtMs ? "not_attested_expired" : "signoff_overdue",
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
    if (signoff.status !== "signed" && signoff.status !== "signed_late") {
      throw new Error(`compliance_report.signoff_not_obtained: Cannot attest - signoff status is ${signoff.status}`);
    }

    // §66.2: Signoff must be for this specific artifact
    if (signoff.artifactId !== artifact.artifactId) {
      throw new Error("compliance_report.signoff_mismatch: Signoff artifact ID does not match");
    }

    // §66.2: Verify signoff was obtained before due date (only enforced for on-time signoffs)
    if (signoff.status === "signed" && signoff.signedAt != null && artifact.signoffDueAt != null && signoff.signedAt > artifact.signoffDueAt) {
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
