/**
 * Delegation Repository
 *
 * Data access layer for agent delegation tables.
 * Part of §26 storage layer implementation.
 */
export type DelegationStatus = "pending" | "active" | "completed" | "failed" | "cancelled" | "expired";
export interface DelegationRecord {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    delegationChain: readonly string[];
    status: DelegationStatus;
    depth: number;
    expiresAt: string | null;
    resultRef: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface DelegationEventRecord {
    eventId: string;
    delegationId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
}
export interface DelegationRepository {
    create(input: CreateDelegationInput): Promise<DelegationRecord>;
    findById(delegationId: string): Promise<DelegationRecord | null>;
    findByParentAgentId(parentAgentId: string): Promise<DelegationRecord[]>;
    findByStatus(status: DelegationStatus): Promise<DelegationRecord[]>;
    findExpired(now: string): Promise<DelegationRecord[]>;
    updateStatus(delegationId: string, status: DelegationStatus): Promise<void>;
    complete(delegationId: string, resultRef: string): Promise<void>;
    fail(delegationId: string, error: string): Promise<void>;
    delete(delegationId: string): Promise<void>;
}
export interface CreateDelegationInput {
    parentAgentId: string;
    childAgentId: string;
    delegationChain: readonly string[];
    depth: number;
    expiresAt?: string;
}
export interface DelegationEventRepository {
    create(input: CreateEventInput): Promise<DelegationEventRecord>;
    findByDelegationId(delegationId: string): Promise<DelegationEventRecord[]>;
    deleteByDelegationId(delegationId: string): Promise<void>;
}
export interface CreateEventInput {
    delegationId: string;
    eventType: string;
    payload: Record<string, unknown>;
}
/**
 * In-memory implementation of DelegationRepository.
 */
export declare class InMemoryDelegationRepository implements DelegationRepository {
    private readonly delegations;
    create(input: CreateDelegationInput): Promise<DelegationRecord>;
    findById(delegationId: string): Promise<DelegationRecord | null>;
    findByParentAgentId(parentAgentId: string): Promise<DelegationRecord[]>;
    findByStatus(status: DelegationStatus): Promise<DelegationRecord[]>;
    findExpired(now: string): Promise<DelegationRecord[]>;
    updateStatus(delegationId: string, status: DelegationStatus): Promise<void>;
    complete(delegationId: string, resultRef: string): Promise<void>;
    fail(delegationId: string, _error: string): Promise<void>;
    delete(delegationId: string): Promise<void>;
}
/**
 * In-memory implementation of DelegationEventRepository.
 */
export declare class InMemoryDelegationEventRepository implements DelegationEventRepository {
    private readonly events;
    create(input: CreateEventInput): Promise<DelegationEventRecord>;
    findByDelegationId(delegationId: string): Promise<DelegationEventRecord[]>;
    deleteByDelegationId(delegationId: string): Promise<void>;
}
