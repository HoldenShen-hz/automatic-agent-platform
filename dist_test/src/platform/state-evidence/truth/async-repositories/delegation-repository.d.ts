/**
 * AsyncDelegationRepository - Async data access for agent delegation tables.
 *
 * Implements §26 storage layer - missing tables: delegations, delegation_events
 */
import type { AsyncSqlConnection } from "../async-sql-database.js";
export interface DelegationRecord {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    delegationChainJson: string;
    status: string;
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
    payloadJson: string;
    createdAt: string;
}
export declare class AsyncDelegationRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertDelegation(delegation: DelegationRecord): Promise<void>;
    updateDelegation(input: {
        delegationId: string;
        status?: string;
        resultRef?: string | null;
        updatedAt: string;
    }): Promise<number>;
    getDelegation(delegationId: string): Promise<DelegationRecord | null>;
    listDelegationsByParent(parentAgentId: string): Promise<DelegationRecord[]>;
    listDelegationsByStatus(status: string): Promise<DelegationRecord[]>;
    listExpiredDelegations(): Promise<DelegationRecord[]>;
    deleteDelegation(delegationId: string): Promise<number>;
    insertDelegationEvent(event: DelegationEventRecord): Promise<void>;
    listDelegationEvents(delegationId: string): Promise<DelegationEventRecord[]>;
    countDelegationEvents(delegationId: string): Promise<number>;
}
