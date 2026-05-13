export interface OfflineMutation {
  readonly id: string;
  readonly endpoint: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body: unknown;
  readonly createdAt: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly principal: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
  };
  readonly conflictKey?: string;
  readonly version?: number;
  readonly idempotencyKey?: string;
  readonly retryCount?: number;
  readonly status?: "pending" | "conflict" | "succeeded" | "failed";
}

export interface ConflictMetadata {
  readonly lamportTimestamp: number;
  readonly vectorClock: Readonly<Record<string, { readonly actorId: string; readonly timestamp: number }>>;
}

export type ConflictResolutionStrategy = "server_wins" | "local_wins" | "merge";

export interface SyncFlushResult {
  readonly succeeded: readonly OfflineMutation[];
  readonly failed: readonly OfflineMutation[];
  readonly conflicts: readonly Array<{
    readonly mutation: OfflineMutation;
    readonly serverValue: unknown;
  }>;
  readonly mutations: readonly OfflineMutation[];
  readonly flushedAt: string;
}

export interface OfflineMutationStore {
  readAll(): Promise<readonly OfflineMutation[]>;
  writeAll(mutations: readonly OfflineMutation[]): Promise<void>;
}
