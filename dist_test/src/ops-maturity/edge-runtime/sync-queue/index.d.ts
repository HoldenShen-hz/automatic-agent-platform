export interface EdgeSyncEnvelope {
    readonly envelopeId: string;
    readonly priority: number;
}
export declare function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[];
