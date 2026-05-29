import { type DehydratedState, type QueryClient } from "@tanstack/react-query";
export interface QueryCachePersister {
    read(): Promise<DehydratedState | null>;
    write(state: DehydratedState): Promise<void>;
    clear(): Promise<void>;
}
export interface PersistQueryClientOptions {
    readonly persister?: QueryCachePersister;
    readonly debounceMs?: number;
}
export declare function createIndexedDbQueryCachePersister(): QueryCachePersister;
export declare function createMemoryQueryCachePersister(initialState?: DehydratedState | null): QueryCachePersister;
export declare function persistQueryClientSnapshot(queryClient: QueryClient, persister?: QueryCachePersister): Promise<void>;
export declare function restorePersistedQueryClient(queryClient: QueryClient, persister?: QueryCachePersister): Promise<boolean>;
export declare function startPersistingQueryClient(queryClient: QueryClient, options?: PersistQueryClientOptions): () => void;
