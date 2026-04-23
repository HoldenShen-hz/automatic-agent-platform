export type DelegationPriority = "low" | "normal" | "high" | "critical";
export interface DelegationRequest {
    requestId: string;
    taskId: string;
    fromAgentId: string;
    toAgentId: string | null;
    capabilityRef: string | null;
    priority: DelegationPriority;
    reason: string;
    contextRef: string | null;
    tenantId: string | null;
    createdAt: string;
}
export declare function createDelegationRequest(input: Omit<DelegationRequest, "requestId" | "createdAt"> & {
    requestId?: string;
    createdAt?: string;
}): DelegationRequest;
