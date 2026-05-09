export type PanicScope = "global" | "tenant" | "domain" | "run" | "node" | "region" | "platform";
export type PanicAcknowledgmentStatus = "ack" | "failed" | "timeout";
export type DriftSeverity = "low" | "medium" | "high";
export type AgentLifecycleState = "draft" | "testing" | "staging" | "canary" | "active" | "paused" | "deprecated" | "archived" | "removed";

export interface PlatformPanicDirective {
  readonly directiveId: string;
  readonly scope: string;
  readonly scopeLevel: string;
  readonly reasonCode: string;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly freezeModes: readonly string[];
  readonly requiredApprovers: readonly string[];
  readonly severity: "full" | "partial";
  readonly reconfirmationAfterSeconds?: number;
  readonly rollbackStrategy?: "automatic" | "manual" | "none";
  readonly allowList?: readonly string[];
}

export interface PanicAcknowledgment {
  readonly plane: string;
  readonly localStopState: "stopped" | "failed" | "timeout" | "panic_frozen";
  readonly status: PanicAcknowledgmentStatus;
  readonly evidenceRef: string;
}

export interface ResumePlan {
  readonly resumePlanId: string;
  readonly approvedBy: readonly [string, string, ...string[]];
  readonly approverRoles: readonly string[];
  readonly forensicSnapshotRef: string;
}

export interface BehaviorFingerprintInput {
  readonly window: { readonly from: string; readonly to: string };
  readonly toolUsageDistribution: Readonly<Record<string, number>>;
  readonly successRate: number;
  readonly riskDistribution: Readonly<Record<string, number>>;
  readonly driftScore: number;
}

export interface StageRationale {
  readonly rationaleId: string;
  readonly taskId: string;
  readonly stageId: string;
  readonly decision: string;
  readonly summary: string;
  readonly recordedFacts: readonly string[];
  readonly modelRationales: readonly string[];
  readonly inferredSummary: string;
  readonly decisionFactors: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly riskNotes: readonly string[];
  readonly alternatives?: readonly string[];
  readonly confidence?: number;
  readonly decisionInputRef?: string;
  readonly versionLockRef?: string;
  readonly visibilityLabels?: readonly string[];
  readonly renderedExplanation?: string;
  readonly generatedAt: string;
}

export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly device_id?: string;
  readonly sequence_no?: number;
  readonly priority: number;
  readonly createdAt?: string;
  readonly local_time_offset?: number;
  readonly prev_hash?: string;
  readonly side_effect_dependency_refs?: readonly string[];
  readonly signature?: string;
}

export interface ComplianceReportLifecycle {
  readonly reportId: string;
  readonly status: "generated" | "human_signoff" | "attested";
  readonly evidenceQualityScore: number;
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

export interface PanicDrillReport {
  readonly drillId: string;
  readonly gameDayId: string;
  readonly ingress_block_time_ms: number | null;
  readonly execution_quiescence_time_ms: number | null;
  readonly plane_ack_success_rate: number | null;
  readonly planesContacted: readonly string[];
  readonly planesAcknowledged: readonly string[];
  readonly generatedAt: string;
}

export function validatePanicDirective(directive: PlatformPanicDirective): readonly string[] {
  const findings: string[] = [];
  if ((directive.requiredApprovers as unknown as string[]).length < 2) {
    findings.push("panic.two_approvers_required");
  }
  const effectiveScope = directive.scopeLevel ?? directive.scope;
  if (!["global", "tenant", "domain", "run", "node", "region", "platform"].includes(effectiveScope)) {
    findings.push("panic.invalid_scope");
  }
  return findings;
}

export function validateResumePlan(plan: ResumePlan): readonly string[] {
  return plan.approvedBy.length >= 2 && plan.approverRoles.every((role) => role === "platform_admin")
    ? []
    : ["resume.platform_admin_two_person_rule_required"];
}

export function transitionAgentLifecycle(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  const allowed: Record<AgentLifecycleState, readonly AgentLifecycleState[]> = {
    draft: ["testing", "canary", "archived"],
    testing: ["staging", "draft"],
    staging: ["canary", "testing"],
    canary: ["active", "staging", "paused", "deprecated"],
    active: ["paused", "deprecated"],
    paused: ["active", "deprecated"],
    deprecated: ["archived"],
    archived: [],
    removed: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function driftResponse(severity: DriftSeverity): "alert" | "require_review" | "pause_agent" {
  if (severity === "high") {
    return "pause_agent";
  }
  if (severity === "medium") {
    return "require_review";
  }
  return "alert";
}

export function buildOpsMaturityRemediationEvidence(): readonly string[] {
  return Array.from({ length: 20 }, (_value, index) => `M-${index + 1}`);
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
