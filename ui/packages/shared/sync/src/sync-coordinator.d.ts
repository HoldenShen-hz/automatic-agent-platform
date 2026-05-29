import { ConflictResolver } from "./conflict-resolver.js";
import { OfflineQueue } from "./offline-queue.js";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types.js";
export interface SyncMutationDispatcher {
    dispatch?(mutation: OfflineMutation): Promise<unknown>;
    request?(mutation: OfflineMutation): Promise<unknown>;
}
export declare class SyncCoordinator {
    private readonly queue;
    private readonly resolver;
    private readonly dispatcher;
    constructor(queue?: OfflineQueue, resolver?: ConflictResolver, dispatcher?: SyncMutationDispatcher);
    queueMutation(mutation: OfflineMutation): Promise<void>;
    queueMutations(mutations: readonly OfflineMutation[]): Promise<void>;
    hasPending(): boolean;
    pendingCount(): number;
    peekPending(): readonly OfflineMutation[];
    flush(flushedAt?: string): Promise<SyncFlushResult>;
    resolveConflict<T>(serverValue: T, localValue: T, strategy?: ConflictResolutionStrategy): T;
    private send;
}
export declare class FetchSyncMutationDispatcher implements SyncMutationDispatcher {
    private readonly fetchImplementation;
    constructor(fetchImplementation?: typeof fetch);
    dispatch(mutation: OfflineMutation): Promise<void>;
}
