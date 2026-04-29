import { ConflictResolver, type ConflictMetadata } from "./conflict-resolver";
import { createPersistentOfflineQueue, OfflineQueue } from "./offline-queue";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types";

/**
 * HTTP replay result for flush operations per §5.4.5.
 */
export interface ReplayResult {
  readonly succeeded: readonly OfflineMutation[];
  readonly failed: readonly { mutation: OfflineMutation; error: string }[];
  readonly conflicts: readonly { mutation: OfflineMutation; serverValue: unknown }[];
}

export class SyncCoordinator {
  private readonly httpClient: HTTPClient;

  public constructor(
    private readonly queue: OfflineQueue = createPersistentOfflineQueue(),
    private readonly resolver: ConflictResolver = new ConflictResolver(),
    httpClient?: HTTPClient,
  ) {
    this.httpClient = httpClient ?? new SimpleHTTPClient();
  }

  public queueMutation(mutation: OfflineMutation): void {
    this.queue.enqueue(mutation);
  }

  public queueMutations(mutations: readonly OfflineMutation[]): void {
    for (const mutation of mutations) {
      this.queue.enqueue(mutation);
    }
  }

  public hasPending(): boolean {
    return !this.queue.isEmpty();
  }

  public pendingCount(): number {
    return this.queue.size();
  }

  public peekPending(): readonly OfflineMutation[] {
    return this.queue.peek();
  }

  /**
   * Flushes pending mutations to the server with retry and conflict detection per §5.4.5.
   * Returns replay result with succeeded, failed, and conflict mutations.
   */
  public async flush(): Promise<ReplayResult> {
    const mutations = this.queue.drain();
    if (mutations.length === 0) {
      return { succeeded: [], failed: [], conflicts: [] };
    }

    const succeeded: OfflineMutation[] = [];
    const failed: { mutation: OfflineMutation; error: string }[] = [];
    const conflicts: { mutation: OfflineMutation; serverValue: unknown }[] = [];

    for (const mutation of mutations) {
      try {
        const response = await this.httpClient.request(mutation);
        if (response.conflict) {
          conflicts.push({ mutation, serverValue: response.serverValue });
          // Re-queue with conflict status for manual resolution
          this.queue.enqueue({ ...mutation, status: "conflict" });
        } else {
          succeeded.push(mutation);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (this.isRetryableError(errorMessage)) {
          // Re-queue for retry with incremented retry count
          this.queue.enqueue({ ...mutation, retryCount: mutation.retryCount + 1, status: "pending" });
          failed.push({ mutation, error: errorMessage });
        } else if (this.isConflictError(errorMessage)) {
          conflicts.push({ mutation, serverValue: undefined });
          this.queue.enqueue({ ...mutation, status: "conflict" });
        } else {
          // Non-retryable error - mark as failed
          this.queue.enqueue({ ...mutation, status: "failed", lastError: errorMessage });
          failed.push({ mutation, error: errorMessage });
        }
      }
    }

    return { succeeded, failed, conflicts };
  }

  public resolveConflict<T>(
    serverValue: T,
    localValue: T,
    strategy: ConflictResolutionStrategy = "server_wins",
    serverMetadata?: ConflictMetadata,
    localMetadata?: ConflictMetadata,
  ): T {
    return this.resolver.resolve(serverValue, localValue, strategy, serverMetadata, localMetadata);
  }

  private isRetryableError(error: string): boolean {
    return error.startsWith("rest.http_error:") && (
      error.includes("429") ||
      error.includes("500") ||
      error.includes("502") ||
      error.includes("503") ||
      error.includes("504")
    );
  }

  private isConflictError(error: string): boolean {
    return error.includes("conflict") || error.includes("409");
  }
}

interface HTTPClient {
  request(mutation: OfflineMutation): Promise<HTTPResponse>;
}

interface HTTPResponse {
  conflict?: boolean;
  serverValue?: unknown;
}

class SimpleHTTPClient implements HTTPClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  public constructor(baseUrl = "", fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = baseUrl;
    this.fetchImplementation = fetchImplementation;
  }

  public async request(mutation: OfflineMutation): Promise<HTTPResponse> {
    const url = mutation.endpoint.startsWith("http")
      ? mutation.endpoint
      : `${this.baseUrl.replace(/\/$/, "")}${mutation.endpoint}`;

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-idempotency-key": mutation.idempotencyKey,
    };
    if (mutation.version != null) {
      headers["x-if-match"] = String(mutation.version);
    }

    const response = await this.fetchImplementation(url, {
      method: mutation.method,
      headers: headers as unknown as HeadersInit,
      body: mutation.body != null ? JSON.stringify(mutation.body) : null,
    } as RequestInit);

    if (response.status === 409) {
      let serverValue: unknown;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serverValue = await (response as any).json();
      } catch {
        serverValue = undefined;
      }
      return {
        conflict: true,
        serverValue,
      };
    }

    if (!response.ok) {
      throw new Error(`rest.http_error:${response.status}`);
    }

    return {};
  }
}
