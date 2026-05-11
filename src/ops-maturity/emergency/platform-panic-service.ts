import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildForensicSnapshot, type ForensicSnapshot } from "./forensic-snapshot/index.js";
import { shouldEnterPanicMode, type PanicDirectiveInput } from "./panic-controller/index.js";
import { canResumeFromPanic, type ResumePlan } from "./resume-protocol/index.js";

export type PanicFreezeMode = "deploy" | "approval" | "write" | "automation";
export type PanicScopeLevel = "platform" | "region" | "tenant" | "domain" | "run" | "node";

export interface PanicAcknowledgment {
  readonly plane: "P1" | "P2" | "P3" | "P4" | "P5";
  readonly status: "ack" | "failed" | "timeout";
  readonly localStopState: string;
  readonly evidenceRef: string;
}

export interface PlatformPanicDirective {
  readonly directiveId: string;
  readonly scope: string;
  readonly scopeLevel: PanicScopeLevel;
  readonly reasonCode: string;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly freezeModes: readonly PanicFreezeMode[];
  readonly requiredApprovers: readonly string[];
  readonly severity: "full" | "partial";
  readonly reconfirmationAfterSeconds?: number;
  readonly rollbackStrategy?: "automatic" | "manual" | "none";
  readonly allowList?: readonly string[];
  /** R23-65: Reference to the resource/entity this directive applies to */
  readonly scopeRef?: string;
  /** R23-65: Expiration timestamp after which this directive is no longer valid */
  readonly expiresAt?: string;
}

export interface PanicPropagationRecord {
  readonly directiveId: string;
  readonly targetScope: string;
  readonly propagationMode: "direct" | "inherited";
  readonly blockedExecutionModes: readonly PanicFreezeMode[];
  readonly recordedAt: string;
}

export interface PanicActivationRequest extends PanicDirectiveInput {
  readonly issuedBy: string;
  readonly issuedAt?: string;
  readonly scopeRef?: string;
  readonly expiresAt?: string;
  readonly freezeModes?: readonly PanicFreezeMode[];
  readonly requiredApprovers?: readonly string[];
  readonly allowList?: readonly string[];
  readonly targetScopes?: readonly string[];
  readonly forensicArtifactIds?: readonly string[];
  readonly severity?: string;
  readonly reconfirmationAfterSeconds?: number;
  readonly rollbackStrategy?: "automatic" | "manual" | "none";
  readonly triggerSignals?: readonly string[];
}

export interface PanicExecutionCheck {
  readonly scope: string;
  readonly mode: PanicFreezeMode;
  readonly actorId?: string;
}

export interface PanicExecutionDecision {
  readonly blocked: boolean;
  readonly directiveId: string | null;
  readonly reasonCodes: readonly string[];
}

export interface PanicResumeReceipt {
  readonly scope: string;
  readonly resumed: boolean;
  readonly resumedAt: string | null;
  readonly directiveId: string | null;
  readonly reasonCodes: readonly string[];
}

/**
 * R23-66: PanicDrillRecord - Record of a panic drill execution for audit and compliance
 */
export interface PanicDrillRecord {
  readonly drillId: string;
  readonly scope: string;
  readonly scopeLevel: PanicScopeLevel;
  readonly drillType: "scheduled" | "manual" | "simulation";
  readonly initiatedBy: string;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly status: "initiated" | "in_progress" | "completed" | "cancelled" | "failed";
  readonly directiveId: string | null;
  readonly freezeModesTested: readonly PanicFreezeMode[];
  readonly targetPlanes: readonly ("P1" | "P2" | "P3" | "P4" | "P5")[];
  readonly acknowledgmentsReceived: number;
  readonly acknowledgmentsExpected: number;
  readonly findingsJson: string | null;
  readonly notes: string | null;
  readonly traceId: string | null;
}

export interface PlatformPanicActivation {
  readonly directive: PlatformPanicDirective;
  readonly propagationRecords: readonly PanicPropagationRecord[];
  readonly forensicSnapshot: ForensicSnapshot;
  readonly acknowledgments: readonly PanicAcknowledgment[];
}

export interface PanicDrillRequest {
  readonly scope: string;
  readonly initiatedBy: string;
  readonly drillType: PanicDrillRecord["drillType"];
  readonly directiveId?: string | null;
  readonly freezeModesTested?: readonly PanicFreezeMode[];
  readonly targetPlanes?: readonly ("P1" | "P2" | "P3" | "P4" | "P5")[];
  readonly notes?: string | null;
  readonly traceId?: string | null;
}

function matchesScope(activeScope: string, requestedScope: string): boolean {
  return requestedScope === activeScope || requestedScope.startsWith(`${activeScope}/`);
}

function deriveScopeLevel(scope: string): PanicScopeLevel {
  const [level] = scope.split("/");
  if (level === "platform" || level === "region" || level === "tenant" || level === "domain" || level === "run" || level === "node") {
    return level;
  }
  throw new Error(`panic.invalid_scope_level:${scope}`);
}

function defaultFreezeModes(reasonCode: string): readonly PanicFreezeMode[] {
  if (reasonCode.startsWith("security.")) {
    return ["deploy", "approval", "write", "automation"];
  }
  return ["deploy", "automation"];
}

function normalizeRequiredApprovers(
  request: Pick<PanicActivationRequest, "requiredApprovers" | "issuedBy">,
): readonly string[] {
  const providedApprovers = request.requiredApprovers ?? [request.issuedBy];
  const approvers = Array.isArray(providedApprovers) ? providedApprovers : [request.issuedBy];
  const normalized = [...new Set(approvers.map((item) => item.trim()).filter((item) => item.length > 0))];
  if (normalized.length < 2) {
    throw new Error("panic.required_approvers_minimum_not_met");
  }
  return normalized;
}

export class PlatformPanicService {
  private readonly activations = new Map<string, PlatformPanicActivation>();
  private readonly resumeReceipts = new Map<string, PanicResumeReceipt>();
  private readonly drills = new Map<string, PanicDrillRecord>();

  public activate(request: PanicActivationRequest): PlatformPanicActivation {
    if (!shouldEnterPanicMode(request)) {
      throw new Error(`panic.directive_rejected:${request.scope}:${request.reasonCode}`);
    }

    const issuedAt = request.issuedAt ?? nowIso();
    const directive: PlatformPanicDirective = {
      directiveId: newId("panic"),
      scope: request.scope,
      scopeLevel: deriveScopeLevel(request.scope),
      reasonCode: request.reasonCode,
      issuedBy: request.issuedBy,
      issuedAt,
      freezeModes: request.freezeModes ?? defaultFreezeModes(request.reasonCode),
      requiredApprovers: normalizeRequiredApprovers(request),
      severity: (request.severity as "full" | "partial") ?? "full",
      reconfirmationAfterSeconds: 300,
      rollbackStrategy: "manual",
      ...(request.scopeRef != null ? { scopeRef: request.scopeRef } : {}),
      ...(request.expiresAt != null ? { expiresAt: request.expiresAt } : {}),
      ...(request.allowList != null ? { allowList: request.allowList } : {}),
    };
    const panicPlanes = ["P1", "P2", "P3", "P4", "P5"] as const;
    const acknowledgments: PanicAcknowledgment[] = panicPlanes.map((plane) => ({
      plane,
      status: "ack",
      localStopState: "panic_frozen",
      evidenceRef: `${directive.directiveId}:${plane.toLowerCase()}`,
    }));
    const propagationRecords: PanicPropagationRecord[] = (request.targetScopes ?? [request.scope]).map((targetScope) => ({
      directiveId: directive.directiveId,
      targetScope,
      propagationMode: targetScope === request.scope ? "direct" : "inherited",
      blockedExecutionModes: directive.freezeModes,
      recordedAt: issuedAt,
    }));
    const activation: PlatformPanicActivation = {
      directive,
      propagationRecords,
      forensicSnapshot: buildForensicSnapshot(
        {
          snapshotId: newId("panic_snapshot"),
          scope: request.scope,
          collectedAt: issuedAt,
          artifactIds: request.forensicArtifactIds ?? [],
          runtimeState: {
            severity: request.severity,
            triggerSignals: request.triggerSignals,
          },
          planeAcknowledgments: acknowledgments.map((ack) => ({
            plane: ack.plane,
            localStopState: ack.status,
            evidenceRef: ack.evidenceRef,
          })),
        },
      ),
      acknowledgments,
    };
    this.activations.set(request.scope, activation);
    this.resumeReceipts.delete(request.scope);
    return activation;
  }

  public getActive(scope: string): PlatformPanicActivation | null {
    return this.getNonExpiredActivation(scope);
  }

  public listActive(): PlatformPanicActivation[] {
    return [...this.activations.keys()]
      .map((scope) => this.getNonExpiredActivation(scope))
      .filter((activation): activation is PlatformPanicActivation => activation != null)
      .sort((left, right) => left.directive.scope.localeCompare(right.directive.scope));
  }

  public evaluateExecution(check: PanicExecutionCheck): PanicExecutionDecision {
    const activation = this.resolveActivation(check.scope);
    if (activation == null) {
      return {
        blocked: false,
        directiveId: null,
        reasonCodes: [],
      };
    }
    if (check.actorId != null && activation.directive.allowList?.includes(check.actorId)) {
      return {
        blocked: false,
        directiveId: activation.directive.directiveId,
        reasonCodes: ["panic.allow_list_bypass"],
      };
    }
    if (!activation.directive.freezeModes.includes(check.mode)) {
      return {
        blocked: false,
        directiveId: activation.directive.directiveId,
        reasonCodes: ["panic.mode_not_frozen"],
      };
    }
    return {
      blocked: true,
      directiveId: activation.directive.directiveId,
      reasonCodes: ["panic.execution_blocked", `panic.reason:${activation.directive.reasonCode}`],
    };
  }

  public resume(scope: string, plan: ResumePlan, resumedAt = nowIso()): PanicResumeReceipt {
    const activation = this.resolveActivation(scope);
    if (activation == null) {
      const missingReceipt: PanicResumeReceipt = {
        scope,
        resumed: false,
        resumedAt: null,
        directiveId: null,
        reasonCodes: ["panic.directive_not_found"],
      };
      this.resumeReceipts.set(scope, missingReceipt);
      return missingReceipt;
    }
    if (!canResumeFromPanic(plan)) {
      const blockedReceipt: PanicResumeReceipt = {
        scope,
        resumed: false,
        resumedAt: null,
        directiveId: activation.directive.directiveId,
        reasonCodes: ["panic.resume_checkpoints_incomplete"],
      };
      this.resumeReceipts.set(scope, blockedReceipt);
      return blockedReceipt;
    }
    this.activations.delete(activation.directive.scope);
    const receipt: PanicResumeReceipt = {
      scope: activation.directive.scope,
      resumed: true,
      resumedAt,
      directiveId: activation.directive.directiveId,
      reasonCodes: ["panic.resumed_explicitly"],
    };
    this.resumeReceipts.set(scope, receipt);
    return receipt;
  }

  public getResumeReceipt(scope: string): PanicResumeReceipt | null {
    return this.resumeReceipts.get(scope) ?? null;
  }

  public startDrill(request: PanicDrillRequest): PanicDrillRecord {
    const now = nowIso();
    const record: PanicDrillRecord = {
      drillId: newId("panic_drill"),
      scope: request.scope,
      scopeLevel: deriveScopeLevel(request.scope),
      drillType: request.drillType,
      initiatedBy: request.initiatedBy,
      initiatedAt: now,
      completedAt: null,
      status: "in_progress",
      directiveId: request.directiveId ?? null,
      freezeModesTested: request.freezeModesTested ?? defaultFreezeModes("panic.drill"),
      targetPlanes: request.targetPlanes ?? ["P1", "P2", "P3", "P4", "P5"],
      acknowledgmentsReceived: 0,
      acknowledgmentsExpected: (request.targetPlanes ?? ["P1", "P2", "P3", "P4", "P5"]).length,
      findingsJson: null,
      notes: request.notes ?? null,
      traceId: request.traceId ?? null,
    };
    this.drills.set(record.drillId, record);
    return record;
  }

  public completeDrill(drillId: string, input: {
    readonly status: "completed" | "cancelled" | "failed";
    readonly acknowledgmentsReceived: number;
    readonly findingsJson?: string | null;
    readonly notes?: string | null;
  }): PanicDrillRecord {
    const existing = this.drills.get(drillId);
    if (existing == null) {
      throw new Error(`panic.drill_not_found:${drillId}`);
    }
    const updated: PanicDrillRecord = {
      ...existing,
      status: input.status,
      acknowledgmentsReceived: input.acknowledgmentsReceived,
      findingsJson: input.findingsJson ?? existing.findingsJson,
      notes: input.notes ?? existing.notes,
      completedAt: nowIso(),
    };
    this.drills.set(drillId, updated);
    return updated;
  }

  public listDrills(): PanicDrillRecord[] {
    return [...this.drills.values()].sort((left, right) => left.initiatedAt.localeCompare(right.initiatedAt));
  }

  private resolveActivation(scope: string): PlatformPanicActivation | null {
    const matches = [...this.activations.values()]
      .filter((activation) => !this.isDirectiveExpired(activation.directive))
      .filter((activation) =>
        activation.propagationRecords.some((record) => matchesScope(record.targetScope, scope)))
      .sort((left, right) => {
        const leftSpecificity = Math.max(...left.propagationRecords
          .filter((record) => matchesScope(record.targetScope, scope))
          .map((record) => record.targetScope.length));
        const rightSpecificity = Math.max(...right.propagationRecords
          .filter((record) => matchesScope(record.targetScope, scope))
          .map((record) => record.targetScope.length));
        return rightSpecificity - leftSpecificity;
      });
    return matches[0] ?? null;
  }

  private getNonExpiredActivation(scope: string): PlatformPanicActivation | null {
    const activation = this.activations.get(scope) ?? null;
    if (activation == null) {
      return null;
    }
    if (!this.isDirectiveExpired(activation.directive)) {
      return activation;
    }
    this.activations.delete(scope);
    return null;
  }

  private isDirectiveExpired(directive: PlatformPanicDirective): boolean {
    return directive.expiresAt != null && Date.parse(directive.expiresAt) <= Date.now();
  }
}
