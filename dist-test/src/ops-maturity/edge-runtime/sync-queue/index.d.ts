export interface EdgeSyncEnvelope {
    readonly envelopeId: string;
    readonly priority: number;
    readonly createdAt?: string;
}
export declare function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[];
export declare function dedupeEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[];
