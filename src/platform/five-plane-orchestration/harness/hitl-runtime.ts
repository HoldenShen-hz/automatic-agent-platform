import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../../platform/shared/observability/structured-logger.js";

const hitlRuntimeLogger = new StructuredLogger({ retentionLimit: 100 });

export type HitlMode = "inspect" | "patch" | "override" | "takeover" | "resume" | "edit" | "delegate" | "escalate";
export type HitlRequestStatus = "pending" | "pending_approval" | "approved" | "rejected" | "paused" | "completed";

export interface HitlRequest {
  readonly requestId: string;
  readonly runId: string;
  readonly domainId: string;
  readonly mode: HitlMode;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly requestedAt: string;
  readonly expiresAt?: string;
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

/**
 * R9-21 fix: Persistence store interface for HITL requests.
 * Allows HitlRuntime to persist requests to durable storage so they survive process restart.
 */
export interface HitlPersistenceStore {
  saveRequest(request: HitlRequest): void;
  loadRequests(): HitlRequest[];
  deleteRequest(requestId: string): void;
  saveResponsibilityRecord?(record: HumanResponsibilityRecord): void;
  loadResponsibilityRecords?(): HumanResponsibilityRecord[];
}

/**
 * In-memory fallback store used when no persistent store is provided or when persistence fails.
 * R9-21 fix: This is now a fallback, not the primary store.
 */
export class InMemoryHitlStore implements HitlPersistenceStore {
  private readonly requests = new Map<string, HitlRequest>();
  private readonly responsibilityRecords = new Map<string, HumanResponsibilityRecord[]>();

  public saveRequest(request: HitlRequest): void {
    this.requests.set(request.requestId, request);
  }

  public loadRequests(): HitlRequest[] {
    return Array.from(this.requests.values());
  }

  public deleteRequest(requestId: string): void {
    this.requests.delete(requestId);
  }

  public saveResponsibilityRecord(record: HumanResponsibilityRecord): void {
    const existing = this.responsibilityRecords.get(record.requestId) ?? [];
    this.responsibilityRecords.set(record.requestId, [...existing, record]);
  }

  public loadResponsibilityRecords(): HumanResponsibilityRecord[] {
    return [...this.responsibilityRecords.values()].flatMap((records) => [...records]);
  }
}

export class HitlRuntime {
  private static readonly DEFAULT_REQUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly store: HitlPersistenceStore;
  private readonly memoryFallback = new Map<string, HitlRequest>();
  private readonly responsibilityRecords = new Map<string, HumanResponsibilityRecord[]>();
  private readonly requestTtlMs: number;

  /**
   * R9-21 fix: Constructor accepts optional persistence store.
   * If no store provided, uses in-memory fallback (requests won't survive restart).
   * All mutating operations persist to the store immediately.
   */
  public constructor(options: { store?: HitlPersistenceStore; requestTtlMs?: number } = {}) {
    this.store = options.store ?? new InMemoryHitlStore();
    this.requestTtlMs = options.requestTtlMs ?? HitlRuntime.DEFAULT_REQUEST_TTL_MS;
    // R9-21 fix: Load any previously persisted requests on startup.
    // Failing open here preserves in-memory operation even if durable storage is unavailable.
    try {
      for (const request of this.store.loadRequests()) {
        const normalized = this.normalizeRequest(request);
        this.memoryFallback.set(normalized.requestId, normalized);
      }
      for (const record of this.store.loadResponsibilityRecords?.() ?? []) {
        const existing = this.responsibilityRecords.get(record.requestId) ?? [];
        this.responsibilityRecords.set(record.requestId, [...existing, record]);
      }
    } catch (error) {
      hitlRuntimeLogger.error("hitl.load_requests_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * R9-21 fix: Persist request to durable storage.
   * Also updates in-memory Map as fallback for current process.
   * If persistence fails, in-memory Map still retains the request.
   */
  public persistRequest(request: HitlRequest): void {
    const normalized = this.normalizeRequest(request);
    // Always update in-memory Map first (fallback)
    this.memoryFallback.set(normalized.requestId, normalized);
    // Then persist to durable store (primary)
    try {
      this.store.saveRequest(normalized);
    } catch (error) {
      hitlRuntimeLogger.error("hitl.persist_request_failed", {
        requestId: normalized.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** R9-21 fix: Load previously persisted requests from store. Called on initialization. */
  public loadRequests(requests: readonly HitlRequest[]): void {
    for (const request of requests) {
      const normalized = this.normalizeRequest(request);
      this.memoryFallback.set(normalized.requestId, normalized);
      try {
        this.store.saveRequest(normalized);
      } catch (error) {
        hitlRuntimeLogger.error("hitl.load_request_persist_failed", {
          requestId: normalized.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  public hydrate(request: HitlRequest, record?: HumanResponsibilityRecord | null): void {
    const normalized = this.normalizeRequest(request);
    this.memoryFallback.set(normalized.requestId, normalized);
    try {
      this.store.saveRequest(normalized);
    } catch (error) {
      hitlRuntimeLogger.error("hitl.hydrate_request_failed", {
        requestId: normalized.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (record != null) {
      const existing = this.responsibilityRecords.get(normalized.requestId) ?? [];
      this.responsibilityRecords.set(normalized.requestId, [...existing, record]);
      this.store.saveResponsibilityRecord?.(record);
    }
  }

  public open(input: {
    runId: string;
    domainId: string;
    mode?: HitlMode;
    reason: string;
    evidenceRefs: readonly string[];
    expiresAt?: string;
  }): HitlRequest {
    const requestedAt = nowIso();
    const request: HitlRequest = {
      requestId: newId("hitl_request"),
      runId: input.runId,
      domainId: input.domainId,
      mode: input.mode ?? "inspect",
      reason: input.reason,
      evidenceRefs: [...input.evidenceRefs],
      requestedAt,
      expiresAt: input.expiresAt ?? this.computeExpiryIso(requestedAt),
      status: "pending",
      resolvedAt: null,
      resolvedBy: null,
    };
    this.persistRequest(request);
    return request;
  }

  public inspect(requestId: string, actorId: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "paused"]);
    const inspected: HitlRequest = {
      ...request,
      mode: "inspect",
    };
    this.persistRequest(inspected);
    const record = this.createResponsibilityRecord(inspected, actorId, "inspect", "observation");
    return { request: inspected, record };
  }

  public patch(
    requestId: string,
    actorId: string,
    patchContent: Readonly<Record<string, unknown>>,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `patch:before:${requestId}:${nowIso()}`;
    const patched: HitlRequest = {
      ...request,
      mode: "patch",
      status: "completed",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent,
      beforeRef,
    };
    this.persistRequest(patched);
    const record = this.createResponsibilityRecord(patched, actorId, "patch", rationale, beforeRef);
    return { request: patched, record };
  }

  public override(
    requestId: string,
    actorId: string,
    overrideContent: Readonly<Record<string, unknown>>,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `override:before:${requestId}:${nowIso()}`;
    const afterRef = `override:after:${requestId}:${nowIso()}`;
    const overridden: HitlRequest = {
      ...request,
      mode: "override",
      status: "completed",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent: overrideContent,
      beforeRef,
      afterRef,
    };
    this.persistRequest(overridden);
    const record = this.createResponsibilityRecord(overridden, actorId, "override", rationale, beforeRef, afterRef);
    return { request: overridden, record };
  }

  public takeover(requestId: string, actorId: string, rationale: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `takeover:before:${requestId}:${nowIso()}`;
    const takenOver: HitlRequest = {
      ...request,
      mode: "takeover",
      status: "completed",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      beforeRef,
    };
    this.persistRequest(takenOver);
    const record = this.createResponsibilityRecord(takenOver, actorId, "takeover", rationale, beforeRef);
    return { request: takenOver, record };
  }

  public resolve(requestId: string, resolution: "approved" | "rejected", actorId: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "paused"]);
    const resolved: HitlRequest = {
      ...request,
      status: resolution,
      resolvedAt: nowIso(),
      resolvedBy: actorId,
    };
    this.persistRequest(resolved);
    // R3-3 fix: Produce HumanResponsibilityRecord for every HITL operation including resolve()
    const action: HitlMode = resolution === "approved" ? "resume" : "override";
    const rationale = `hitl_resolution:${resolution}`;
    const record = this.createResponsibilityRecord(resolved, actorId, action, rationale);
    return { request: resolved, record };
  }

  public edit(
    requestId: string,
    actorId: string,
    patchContent: Readonly<Record<string, unknown>>,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `edit:before:${requestId}:${nowIso()}`;
    const afterRef = `edit:after:${requestId}:${nowIso()}`;
    const edited: HitlRequest = {
      ...request,
      mode: "edit",
      status: "completed",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent,
      beforeRef,
      afterRef,
    };
    this.persistRequest(edited);
    const record = this.createResponsibilityRecord(edited, actorId, "edit", rationale, beforeRef, afterRef);
    return { request: edited, record };
  }

  public delegate(
    requestId: string,
    actorId: string,
    delegateTo: string,
    rationale: string,
  ): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `delegate:before:${requestId}:${nowIso()}`;
    const afterRef = `delegate:after:${requestId}:${delegateTo}:${nowIso()}`;
    const delegated: HitlRequest = {
      ...request,
      mode: "delegate",
      status: "paused",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      patchContent: {
        delegateTo,
      },
      beforeRef,
      afterRef,
    };
    this.persistRequest(delegated);
    const record = this.createResponsibilityRecord(delegated, actorId, "delegate", rationale, beforeRef, afterRef);
    return { request: delegated, record };
  }

  public escalate(requestId: string, actorId: string, rationale: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved", "paused"]);
    const beforeRef = `escalate:before:${requestId}:${nowIso()}`;
    const escalated: HitlRequest = {
      ...request,
      mode: "escalate",
      status: "paused",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      beforeRef,
    };
    this.persistRequest(escalated);
    const record = this.createResponsibilityRecord(escalated, actorId, "escalate", rationale, beforeRef);
    return { request: escalated, record };
  }

  /**
   * R3-2 fix: Implement pause() method to transition request to "paused" status.
   * §45.18 requires 5 HITL states including paused for workflow suspension.
   */
  public pause(requestId: string, actorId: string, rationale: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["pending", "pending_approval", "approved"]);
    const beforeRef = `pause:before:${requestId}:${nowIso()}`;
    const paused: HitlRequest = {
      ...request,
      status: "paused",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
      beforeRef,
    };
    this.persistRequest(paused);
    const record = this.createResponsibilityRecord(paused, actorId, "override", rationale, beforeRef);
    return { request: paused, record };
  }

  public resume(requestId: string, actorId: string): { request: HitlRequest; record: HumanResponsibilityRecord } {
    const request = this.requireMutableRequest(requestId, ["approved", "paused", "pending_approval"]);
    const resumed: HitlRequest = {
      ...request,
      mode: "resume",
      status: "approved",
      resolvedAt: nowIso(),
      resolvedBy: actorId,
    };
    this.persistRequest(resumed);
    const record = this.createResponsibilityRecord(resumed, actorId, "resume", "resume_execution");
    return { request: resumed, record };
  }

  public get(requestId: string): HitlRequest | null {
    return this.requireRequest(requestId) ?? null;
  }

  public getResponsibilityRecord(requestId: string): HumanResponsibilityRecord | null {
    const records = this.responsibilityRecords.get(requestId) ?? [];
    return records.length === 0 ? null : records[records.length - 1] ?? null;
  }

  public getResponsibilityRecords(requestId: string): readonly HumanResponsibilityRecord[] {
    return [...(this.responsibilityRecords.get(requestId) ?? [])];
  }

  private requireRequest(requestId: string): HitlRequest | null {
    const request = this.memoryFallback.get(requestId);
    if (request == null) {
      return null;
    }
    return this.expirePendingRequestIfNeeded(request);
  }

  private requireMutableRequest(
    requestId: string,
    allowedStatuses: readonly HitlRequestStatus[],
  ): HitlRequest {
    const request = this.requireRequest(requestId);
    if (request == null) {
      throw new Error(`harness.hitl.request_not_found:${requestId}`);
    }
    if (!allowedStatuses.includes(request.status)) {
      throw new Error(`harness.hitl.request_already_resolved:${requestId}:${request.status}`);
    }
    return request;
  }

  private normalizeRequest(request: HitlRequest): HitlRequest {
    if (request.expiresAt != null) {
      return request;
    }
    return {
      ...request,
      expiresAt: this.computeExpiryIso(request.requestedAt),
    };
  }

  private computeExpiryIso(baseIso: string): string {
    return new Date(Date.parse(baseIso) + this.requestTtlMs).toISOString();
  }

  private expirePendingRequestIfNeeded(request: HitlRequest): HitlRequest {
    const normalized = this.normalizeRequest(request);
    if (
      (normalized.status !== "pending" && normalized.status !== "pending_approval")
      || normalized.expiresAt == null
      || Date.parse(normalized.expiresAt) > Date.now()
    ) {
      return normalized;
    }
    const expired: HitlRequest = {
      ...normalized,
      status: "rejected",
      resolvedAt: nowIso(),
      resolvedBy: "system:hitl_timeout",
    };
    this.persistRequest(expired);
    if (!this.responsibilityRecords.has(expired.requestId)) {
      this.createResponsibilityRecord(expired, "system:hitl_timeout", "override", "hitl_request_expired");
    }
    return expired;
  }

  private createResponsibilityRecord(
    request: HitlRequest,
    actorId: string,
    action: HitlMode,
    rationale: string,
    beforeRef?: string,
    afterRef?: string,
  ): HumanResponsibilityRecord {
    const expiresAt = this.computeExpiryIso(nowIso());
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
    const existingRecords = this.responsibilityRecords.get(request.requestId) ?? [];
    this.responsibilityRecords.set(request.requestId, [...existingRecords, record]);
    try {
      this.store.saveResponsibilityRecord?.(record);
    } catch (error) {
      hitlRuntimeLogger.error("hitl.persist_responsibility_record_failed", {
        requestId: request.requestId,
        recordId: record.recordId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return record;
  }
}
