export type PanicScope = "global" | "tenant" | "domain";
export type PanicAcknowledgmentStatus = "ack" | "failed" | "timeout";
export type DriftSeverity = "low" | "medium" | "high";
export type AgentLifecycleState = "draft" | "canary" | "active" | "paused" | "deprecated" | "archived" | "removed";

// R3-34 FIX: §63.1 PlatformPanicDirective requires additional fields
// R9-48 FIX: Removed expirationTime TTL field - §2.4 invariant says Panic cannot auto-relieve via TTL
export interface PlatformPanicDirective {
  readonly directiveId: string;
  readonly scope: PanicScope;
  readonly requiredApprovers: readonly [string, string, ...string[]];
  readonly reason: string;
  readonly issuedAt: string;
  // R9-48 fix: Removed expirationTime - Panic requires explicit reconfirmation, not TTL auto-relief
  readonly pausedResources: readonly string[];
  readonly auditRef: string;
}

export interface PanicAcknowledgment {
  readonly plane: string;
  readonly localStopState: "stopped" | "failed" | "timeout";
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
  readonly stageId: string;
  readonly decision: string;
  readonly evidenceRefs: readonly string[];
  readonly cacheTtlHours: 24 | 0;
}

export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly payloadHash: string;
  readonly previousHash: string;
  readonly signature: string;
}

export interface ComplianceReportLifecycle {
  readonly reportId: string;
  readonly status: "generated" | "human_signoff" | "attested";
  readonly evidenceQualityScore: number;
}

export function validatePanicDirective(directive: PlatformPanicDirective): readonly string[] {
  const findings: string[] = [];
  if (directive.requiredApprovers.length < 2) {
    findings.push("panic.two_approvers_required");
  }
  if (!["global", "tenant", "domain"].includes(directive.scope)) {
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
    draft: ["canary", "archived"],
    canary: ["active", "deprecated"],
    active: ["paused", "deprecated"],
    paused: ["active", "deprecated"],
    deprecated: ["archived"],
    archived: [],
    removed: [],
  };
  return allowed[from].includes(to);
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
