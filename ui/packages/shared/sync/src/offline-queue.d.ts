import type { OfflineMutation, OfflineMutationStore } from "./types.js";
export interface OfflineQueueOptions {
    readonly maxCapacity?: number;
    readonly onEvict?: (mutation: OfflineMutation) => void;
}
export declare class OfflineQueue {
    private readonly store;
    private readonly queue;
    private readonly stagedBeforeReady;
    private ready;
    private readonly readyPromise;
    private readonly maxCapacity;
    private readonly onEvict?;
    constructor(store?: OfflineMutationStore, maxCapacityOrOptions?: number | OfflineQueueOptions);
    whenReady(): Promise<void>;
    enqueue(mutation: OfflineMutation): Promise<void>;
    drain(): OfflineMutation[];
    peek(): readonly OfflineMutation[];
    size(): number;
    capacity(): number;
    isFull(): boolean;
    isEmpty(): boolean;
    replace(mutations: readonly OfflineMutation[]): Promise<void>;
    private trimToCapacity;
    private persist;
    private persistCurrentSnapshot;
}
export declare function createPersistentOfflineQueue(store?: OfflineMutationStore): OfflineQueue;
export declare function createMemoryOfflineMutationStore(initial?: readonly OfflineMutation[]): OfflineMutationStore;
export declare function createIndexedDbOfflineMutationStore(databaseName?: string, storeName?: string): OfflineMutationStore;
