export type OfflineMutationStatus = "pending" | "syncing" | "conflict" | "failed";

export interface OfflineMutation {
  readonly id: string;
  readonly endpoint: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body: unknown;
  readonly createdAt: string;
  /** Unique key for idempotent operations per §5.4.5 */
  readonly idempotencyKey: string;
  /** Number of retry attempts made */
  readonly retryCount: number;
  /** Current status of the mutation */
  readonly status: OfflineMutationStatus;
  /** Optional conflict detection key */
  readonly conflictKey?: string;
  /** Version for optimistic locking */
  readonly version?: number;
  /** Last error message if failed */
  readonly lastError?: string;
  /** Tenant ID for multi-tenant isolation per ContractEnvelope */
  readonly tenantId: string;
  /** Trace ID for observability */
  readonly traceId: string;
  /** Principal making the mutation for authorization */
  readonly principal: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
  };
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
