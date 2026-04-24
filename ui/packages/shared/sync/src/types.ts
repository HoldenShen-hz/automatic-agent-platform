export interface OfflineMutation {
  readonly id: string;
  readonly endpoint: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body: unknown;
  readonly createdAt: string;
  readonly conflictKey?: string;
  readonly version?: number;
}

export type ConflictResolutionStrategy = "server_wins" | "local_wins" | "merge";

export interface SyncFlushResult {
  readonly mutations: readonly OfflineMutation[];
  readonly flushedAt: string;
}

export interface OfflineMutationStore {
  readAll(): Promise<readonly OfflineMutation[]>;
  writeAll(mutations: readonly OfflineMutation[]): Promise<void>;
}
