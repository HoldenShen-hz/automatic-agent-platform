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
export declare class HitlRuntime {
    private readonly requests;
    open(input: {
        runId: string;
        domainId: string;
        reason: string;
        evidenceRefs: readonly string[];
    }): HitlRequest;
    resolve(requestId: string, resolution: "approved" | "rejected", actorId: string): HitlRequest;
    get(requestId: string): HitlRequest | null;
}
