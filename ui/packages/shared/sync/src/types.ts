export interface OfflineMutation {
  readonly id: string;
  readonly endpoint: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body: unknown;
  readonly createdAt: string;
}

export type ConflictResolutionStrategy = "server_wins" | "local_wins";

export interface SyncFlushResult {
  readonly mutations: readonly OfflineMutation[];
  readonly flushedAt: string;
}
