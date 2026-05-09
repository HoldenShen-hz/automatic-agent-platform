/**
 * HITL Runtime Capabilities Service
 *
 * Implements the §45.18 HITL runtime capabilities:
 * - inspect: Examine task state without modification
 * - patch: Modify task parameters with approval
 * - override: Bypass normal execution flow (high/critical risk only)
 * - takeover: Transfer execution control to human operator
 * - resume: Continue execution from a checkpoint
 *
 * @see docs_zh/contracts/approval_and_hitl_contract.md
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

// =============================================================================
// Inspect Capability
// =============================================================================

export interface InspectTarget {
  readonly targetType: "task" | "workflow" | "execution" | "step";
  readonly targetId: string;
}

export interface InspectResult {
  readonly inspectId: string;
  readonly target: InspectTarget;
  readonly inspectedAt: string;
  readonly inspectedBy: string;
  readonly state: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export class HitlInspectService {
  private readonly inspectionRecords = new Map<string, InspectResult>();

  /**
   * Inspect a target resource and return its current state
   */
  public inspect(
    target: InspectTarget,
    inspectedBy: string,
    stateProvider: (target: InspectTarget) => Readonly<Record<string, unknown>> | null,
  ): InspectResult {
    const state = stateProvider(target);
    if (!state) {
      throw new Error(`hitl_inspect.target_not_found:${target.targetType}:${target.targetId}`);
    }

    const result: InspectResult = {
      inspectId: newId("hitl_inspect"),
      target,
      inspectedAt: nowIso(),
      inspectedBy,
      state,
      metadata: {
        targetType: target.targetType,
        targetId: target.targetId,
      },
    };

    this.inspectionRecords.set(result.inspectId, result);
    return result;
  }

  /**
   * Get a previously recorded inspection
   */
  public getInspection(inspectId: string): InspectResult | null {
    return this.inspectionRecords.get(inspectId) ?? null;
  }

  /**
   * Get all inspections for a target
   */
  public getInspectionsForTarget(targetType: string, targetId: string): readonly InspectResult[] {
    return [...this.inspectionRecords.values()].filter(
      (r) => r.target.targetType === targetType && r.target.targetId === targetId,
    );
  }
}

// =============================================================================
// Patch Capability
// =============================================================================

export interface PatchSpec {
  readonly path: string;
  readonly operation: "add" | "replace" | "remove";
  readonly value: unknown;
}

export interface PatchRequest {
  readonly requestId: string;
  readonly target: InspectTarget;
  readonly patches: readonly PatchSpec[];
  readonly reason: string;
  readonly requestedBy: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
}

export interface PatchResult {
  readonly resultId: string;
  readonly requestId: string;
  readonly target: InspectTarget;
  readonly appliedPatches: readonly PatchSpec[];
  readonly appliedAt: string | null;
  readonly approved: boolean;
  readonly approver: string | null;
  readonly rejected: boolean;
  readonly rejectionReason: string | null;
}

export class HitlPatchService {
  private readonly pendingPatches = new Map<string, PatchRequest>();
  private readonly patchResults = new Map<string, PatchResult>();

  /**
   * Request a patch to be applied to a target
   */
  public requestPatch(request: Omit<PatchRequest, "requestId">): PatchRequest {
    const fullRequest: PatchRequest = {
      ...request,
      requestId: newId("hitl_patch_request"),
    };
    this.pendingPatches.set(fullRequest.requestId, fullRequest);
    return fullRequest;
  }

  /**
   * Approve a pending patch request
   */
  public approvePatch(
    requestId: string,
    approver: string,
    patchExecutor: (target: InspectTarget, patches: readonly PatchSpec[]) => boolean,
  ): PatchResult {
    const request = this.pendingPatches.get(requestId);
    if (!request) {
      throw new Error(`hitl_patch_request.not_found:${requestId}`);
    }

    const success = patchExecutor(request.target, request.patches);

    const result: PatchResult = {
      resultId: newId("hitl_patch_result"),
      requestId,
      target: request.target,
      appliedPatches: request.patches,
      appliedAt: success ? nowIso() : null,
      approved: true,
      approver,
      rejected: false,
      rejectionReason: null,
    };

    this.patchResults.set(result.resultId, result);
    this.pendingPatches.delete(requestId);
    return result;
  }

  /**
   * Reject a pending patch request
   */
  public rejectPatch(requestId: string, rejectedBy: string, reason: string): PatchResult {
    const request = this.pendingPatches.get(requestId);
    if (!request) {
      throw new Error(`hitl_patch_request.not_found:${requestId}`);
    }

    const result: PatchResult = {
      resultId: newId("hitl_patch_result"),
      requestId,
      target: request.target,
      appliedPatches: [],
      appliedAt: null,
      approved: false,
      approver: null,
      rejected: true,
      rejectionReason: reason,
    };

    this.patchResults.set(result.resultId, result);
    this.pendingPatches.delete(requestId);
    return result;
  }

  /**
   * Get pending patch request
   */
  public getPendingPatch(requestId: string): PatchRequest | null {
    return this.pendingPatches.get(requestId) ?? null;
  }

  /**
   * Get patch result
   */
  public getPatchResult(resultId: string): PatchResult | null {
    return this.patchResults.get(resultId) ?? null;
  }
}

// =============================================================================
// Override Capability
// =============================================================================

export interface OverrideRequest {
  readonly requestId: string;
  readonly target: InspectTarget;
  readonly overrideReason: string;
  readonly requestedBy: string;
  readonly riskLevel: "high" | "critical";
  readonly timeoutPolicy: "reject" | "approve" | "remain_pending";
}

export interface OverrideResult {
  readonly resultId: string;
  readonly requestId: string;
  readonly target: InspectTarget;
  readonly approved: boolean;
  readonly approver: string | null;
  readonly executed: boolean;
  readonly executedAt: string | null;
  readonly effect: Readonly<Record<string, unknown>>;
}

export class HitlOverrideService {
  private readonly overrideRequests = new Map<string, OverrideRequest>();
  private readonly overrideResults = new Map<string, OverrideResult>();

  /**
   * Request an override (requires high or critical risk level)
   */
  public requestOverride(request: Omit<OverrideRequest, "requestId">): OverrideRequest {
    if (request.riskLevel !== "high" && request.riskLevel !== "critical") {
      throw new Error("hitl_override.requires_high_risk");
    }
    if (!request.overrideReason || request.overrideReason.trim().length === 0) {
      throw new Error("hitl_override.requires_reason");
    }

    const fullRequest: OverrideRequest = {
      ...request,
      requestId: newId("hitl_override_request"),
    };
    this.overrideRequests.set(fullRequest.requestId, fullRequest);
    return fullRequest;
  }

  /**
   * Approve and execute an override
   */
  public approveOverride(
    requestId: string,
    approver: string,
    executor: (target: InspectTarget) => Readonly<Record<string, unknown>>,
  ): OverrideResult {
    const request = this.overrideRequests.get(requestId);
    if (!request) {
      throw new Error(`hitl_override_request.not_found:${requestId}`);
    }

    const effect = executor(request.target);
    const result: OverrideResult = {
      resultId: newId("hitl_override_result"),
      requestId,
      target: request.target,
      approved: true,
      approver,
      executed: true,
      executedAt: nowIso(),
      effect,
    };

    this.overrideResults.set(result.resultId, result);
    this.overrideRequests.delete(requestId);
    return result;
  }

  /**
   * Reject an override request
   */
  public rejectOverride(requestId: string, rejectedBy: string): OverrideResult {
    const request = this.overrideRequests.get(requestId);
    if (!request) {
      throw new Error(`hitl_override_request.not_found:${requestId}`);
    }

    const result: OverrideResult = {
      resultId: newId("hitl_override_result"),
      requestId,
      target: request.target,
      approved: false,
      approver: null,
      executed: false,
      executedAt: null,
      effect: {},
    };

    this.overrideResults.set(result.resultId, result);
    this.overrideRequests.delete(requestId);
    return result;
  }

  /**
   * Get override request
   */
  public getOverrideRequest(requestId: string): OverrideRequest | null {
    return this.overrideRequests.get(requestId) ?? null;
  }

  /**
   * Get override result
   */
  public getOverrideResult(resultId: string): OverrideResult | null {
    return this.overrideResults.get(resultId) ?? null;
  }
}

// =============================================================================
// Takeover Capability
// =============================================================================

export interface TakeoverSession {
  readonly sessionId: string;
  readonly approvalId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly operatorId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endReason: string | null;
  readonly status: "active" | "completed" | "abandoned";
}

export class HitlTakeoverService {
  private readonly sessions = new Map<string, TakeoverSession>();

  /**
   * Initiate a takeover session
   */
  public initiateTakeover(input: {
    approvalId: string;
    taskId: string;
    executionId?: string | null;
    operatorId: string;
  }): TakeoverSession {
    const session: TakeoverSession = {
      sessionId: newId("takeover_session"),
      approvalId: input.approvalId,
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      operatorId: input.operatorId,
      startedAt: nowIso(),
      endedAt: null,
      endReason: null,
      status: "active",
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * End a takeover session
   */
  public endTakeover(sessionId: string, reason: string): TakeoverSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`takeover_session.not_found:${sessionId}`);
    }

    const ended: TakeoverSession = {
      ...session,
      endedAt: nowIso(),
      endReason: reason,
      status: reason === "completed" ? "completed" : "abandoned",
    };

    this.sessions.set(sessionId, ended);
    return ended;
  }

  /**
   * Get active session for a task
   */
  public getActiveSessionForTask(taskId: string): TakeoverSession | null {
    return [...this.sessions.values()].find(
      (s) => s.taskId === taskId && s.status === "active",
    ) ?? null;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): TakeoverSession | null {
    return this.sessions.get(sessionId) ?? null;
  }
}

// =============================================================================
// Resume Capability
// =============================================================================

export interface ResumeRequest {
  readonly requestId: string;
  readonly taskId: string;
  readonly checkpointRef: string;
  readonly skipCompatibilityCheck: boolean;
  readonly requestedBy: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly timeoutPolicy: "reject" | "approve" | "remain_pending";
}

export interface ResumeResult {
  readonly resultId: string;
  readonly requestId: string;
  readonly taskId: string;
  readonly checkpointRef: string;
  readonly resumed: boolean;
  readonly resumedAt: string | null;
  readonly errorMessage: string | null;
}

export class HitlResumeService {
  private readonly resumeRequests = new Map<string, ResumeRequest>();
  private readonly resumeResults = new Map<string, ResumeResult>();

  /**
   * Request resume from a checkpoint
   */
  public requestResume(input: Omit<ResumeRequest, "requestId">): ResumeRequest {
    if (!input.checkpointRef || input.checkpointRef.trim().length === 0) {
      throw new Error("hitl_resume.requires_checkpoint_ref");
    }

    const fullRequest: ResumeRequest = {
      ...input,
      requestId: newId("hitl_resume_request"),
    };
    this.resumeRequests.set(fullRequest.requestId, fullRequest);
    return fullRequest;
  }

  /**
   * Approve and execute resume
   */
  public approveResume(
    requestId: string,
    approver: string,
    executor: (taskId: string, checkpointRef: string) => boolean,
  ): ResumeResult {
    const request = this.resumeRequests.get(requestId);
    if (!request) {
      throw new Error(`hitl_resume_request.not_found:${requestId}`);
    }

    // Critical risk without skipping compatibility check requires explicit approval
    if (!request.skipCompatibilityCheck && request.riskLevel === "critical") {
      if (request.timeoutPolicy !== "approve") {
        throw new Error("hitl_resume.critical_requires_approval");
      }
    }

    const success = executor(request.taskId, request.checkpointRef);

    const result: ResumeResult = {
      resultId: newId("hitl_resume_result"),
      requestId,
      taskId: request.taskId,
      checkpointRef: request.checkpointRef,
      resumed: success,
      resumedAt: success ? nowIso() : null,
      errorMessage: success ? null : "Resume execution failed",
    };

    this.resumeResults.set(result.resultId, result);
    this.resumeRequests.delete(requestId);
    return result;
  }

  /**
   * Reject a resume request
   */
  public rejectResume(requestId: string): ResumeResult {
    const request = this.resumeRequests.get(requestId);
    if (!request) {
      throw new Error(`hitl_resume_request.not_found:${requestId}`);
    }

    const result: ResumeResult = {
      resultId: newId("hitl_resume_result"),
      requestId,
      taskId: request.taskId,
      checkpointRef: request.checkpointRef,
      resumed: false,
      resumedAt: null,
      errorMessage: "Resume request rejected",
    };

    this.resumeResults.set(result.resultId, result);
    this.resumeRequests.delete(requestId);
    return result;
  }

  /**
   * Get resume request
   */
  public getResumeRequest(requestId: string): ResumeRequest | null {
    return this.resumeRequests.get(requestId) ?? null;
  }

  /**
   * Get resume result
   */
  public getResumeResult(resultId: string): ResumeResult | null {
    return this.resumeResults.get(resultId) ?? null;
  }
}

// =============================================================================
// Force Terminate Capability
// =============================================================================

export interface ForceTerminateRequest {
  readonly requestId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly requestedBy: string;
  readonly reason: string;
  readonly riskLevel: "high" | "critical";
}

export interface ForceTerminateResult {
  readonly resultId: string;
  readonly requestId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly terminated: boolean;
  readonly terminatedAt: string | null;
  readonly approvedBy: string | null;
  readonly errorMessage: string | null;
}

export class HitlForceTerminateService {
  private readonly requests = new Map<string, ForceTerminateRequest>();
  private readonly results = new Map<string, ForceTerminateResult>();

  public requestForceTerminate(input: Omit<ForceTerminateRequest, "requestId">): ForceTerminateRequest {
    if (input.reason.trim().length === 0) {
      throw new Error("hitl_force_terminate.requires_reason");
    }
    const request: ForceTerminateRequest = {
      ...input,
      requestId: newId("hitl_force_terminate_request"),
    };
    this.requests.set(request.requestId, request);
    return request;
  }

  public approveForceTerminate(
    requestId: string,
    approvedBy: string,
    executor: (taskId: string, executionId: string | null) => boolean,
  ): ForceTerminateResult {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`hitl_force_terminate_request.not_found:${requestId}`);
    }
    const terminated = executor(request.taskId, request.executionId);
    const result: ForceTerminateResult = {
      resultId: newId("hitl_force_terminate_result"),
      requestId,
      taskId: request.taskId,
      executionId: request.executionId,
      terminated,
      terminatedAt: terminated ? nowIso() : null,
      approvedBy,
      errorMessage: terminated ? null : "Force terminate execution failed",
    };
    this.results.set(result.resultId, result);
    this.requests.delete(requestId);
    return result;
  }

  public rejectForceTerminate(requestId: string): ForceTerminateResult {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`hitl_force_terminate_request.not_found:${requestId}`);
    }
    const result: ForceTerminateResult = {
      resultId: newId("hitl_force_terminate_result"),
      requestId,
      taskId: request.taskId,
      executionId: request.executionId,
      terminated: false,
      terminatedAt: null,
      approvedBy: null,
      errorMessage: "Force terminate request rejected",
    };
    this.results.set(result.resultId, result);
    this.requests.delete(requestId);
    return result;
  }

  public getRequest(requestId: string): ForceTerminateRequest | null {
    return this.requests.get(requestId) ?? null;
  }

  public getResult(resultId: string): ForceTerminateResult | null {
    return this.results.get(resultId) ?? null;
  }
}
