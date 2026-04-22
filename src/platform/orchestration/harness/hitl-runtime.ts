import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export type HitlRequestStatus = "pending" | "approved" | "rejected" | "expired";

export interface HitlRequest {
  readonly requestId: string;
  readonly runId: string;
  readonly domainId: string;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly requestedAt: string;
  readonly status: HitlRequestStatus;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
}

export class HitlRuntime {
  private readonly requests = new Map<string, HitlRequest>();

  public open(input: {
    runId: string;
    domainId: string;
    reason: string;
    evidenceRefs: readonly string[];
  }): HitlRequest {
    const request: HitlRequest = {
      requestId: newId("hitl"),
      runId: input.runId,
      domainId: input.domainId,
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

  public get(requestId: string): HitlRequest | null {
    return this.requests.get(requestId) ?? null;
  }
}
