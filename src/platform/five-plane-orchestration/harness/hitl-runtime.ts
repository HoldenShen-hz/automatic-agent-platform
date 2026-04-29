import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export type HitlMode = "inspect" | "patch" | "override" | "takeover" | "resume";
export type HitlRequestStatus = "pending" | "approved" | "rejected" | "expired" | "patched" | "overridden" | "taken_over";

export interface HitlRequest {
  readonly requestId: string;
  readonly runId: string;
  readonly domainId: string;
  readonly mode: HitlMode;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly requestedAt: string;
  readonly status: HitlRequestStatus;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly patchContent?: Readonly<Record<string, unknown>>;
  readonly beforeRef?: string;
  readonly afterRef?: string;
}

export interface HumanResponsibilityRecord {
  readonly recordId: string;
  readonly requestId: string;
  readonly actor: string;
  readonly action: HitlMode;
  readonly scope: string;
  readonly rationale: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly expiresAt: string;
  readonly auditRef: string;
  readonly recordedAt: string;
}

export class HitlRuntime {
  private readonly requests = new Map<string, HitlRequest>();
  private readonly responsibilityRecords = new Map<string, HumanResponsibilityRecord>();

  public hydrate(request: HitlRequest, record?: HumanResponsibilityRecord | null): void {
    this.requests.set(request.requestId, request);
    if (record != null) {
      this.responsibilityRecords.set(request.requestId, record);
    }
  }

  public open(input: {
    runId: string;
    domainId: string;
    mode?: HitlMode;
    reason: string;
    evidenceRefs: readonly string[];
  }): HitlRequest {
    const request: HitlRequest = {
      requestId: newId("hitl"),
      runId: input.runId,
      domainId: input.domainId,
      mode: input.mode ?? "inspect",
      reason: input.reason,
      evidenceRefs: [...input.evidenceRefs],
      requestedAt: nowIso(),
      status: "pending",
      resolvedAt: null,
      resolvedBy: null,
    };
    this.requests.set(request.requestId, request);
    return request;
  }

  public inspect(requestId: string, actorId: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const inspected: HitlRequest = {
      ...request,
      status: "approved",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
    };
    this.requests.set(requestId, inspected);
    const record = this.createResponsibilityRecord(inspected, actorId, "inspect", "observation");
    return { request: inspected, record };
  }

  public patch(
    requestId: string,
    actorId: string,
    patchContent: Readonly<Record<string, unknown>>,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const beforeRef = `patch:before:${requestId}:${nowIso()}`;
    const patched: HitlRequest = {
      ...request,
      status: "patched",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent,
      beforeRef,
    };
    this.requests.set(requestId, patched);
    const record = this.createResponsibilityRecord(patched, actorId, "patch", rationale, beforeRef);
    return { request: patched, record };
  }

  public override(
    requestId: string,
    actorId: string,
    overrideContent: Readonly<Record<string, unknown>>,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const beforeRef = `override:before:${requestId}:${nowIso()}`;
    const afterRef = `override:after:${requestId}:${nowIso()}`;
    const overridden: HitlRequest = {
      ...request,
      status: "overridden",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent: overrideContent,
      beforeRef,
      afterRef,
    };
    this.requests.set(requestId, overridden);
    const record = this.createResponsibilityRecord(overridden, actorId, "override", rationale, beforeRef, afterRef);
    return { request: overridden, record };
  }

  public takeover(requestId: string, actorId: string, rationale: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const beforeRef = `takeover:before:${requestId}:${nowIso()}`;
    const takenOver: HitlRequest = {
      ...request,
      status: "taken_over",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      beforeRef,
    };
    this.requests.set(requestId, takenOver);
    const record = this.createResponsibilityRecord(takenOver, actorId, "takeover", rationale, beforeRef);
    return { request: takenOver, record };
  }

  public resolve(requestId: string, resolution: "approved" | "rejected", actorId: string): HitlRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const resolved: HitlRequest = {
      ...request,
      status: resolution,
      resolvedAt: nowIso(),
      resolvedBy: actorId,
    };
    this.requests.set(requestId, resolved);
    return resolved;
  }

  public resume(requestId: string, actorId: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    const resumed: HitlRequest = {
      ...request,
      status: "approved",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
    };
    this.requests.set(requestId, resumed);
    const record = this.createResponsibilityRecord(resumed, actorId, "resume", "resume_execution");
    return { request: resumed, record };
  }

  public get(requestId: string): HitlRequest | null {
    return this.requests.get(requestId) ?? null;
  }

  public getResponsibilityRecord(requestId: string): HumanResponsibilityRecord | null {
    return this.responsibilityRecords.get(requestId) ?? null;
  }

  private createResponsibilityRecord(
    request: HitlRequest,
    actorId: string,
    action: HitlMode,
    rationale: string,
    beforeRef?: string,
    afterRef?: string,
  ): HumanResponsibilityRecord {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    const record: HumanResponsibilityRecord = {
      recordId: newId("hrr"),
      requestId: request.requestId,
      actor: actorId,
      action,
      scope: request.mode,
      rationale,
      beforeRef: beforeRef ?? "",
      afterRef: afterRef ?? "",
      expiresAt,
      auditRef: `audit://harness/hitl/${request.requestId}/${action}`,
      recordedAt: nowIso(),
    };
    this.responsibilityRecords.set(request.requestId, record);
    return record;
  }
}
