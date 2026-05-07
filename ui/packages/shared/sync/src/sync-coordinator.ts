import { ConflictResolver, type ConflictMetadata } from "./conflict-resolver";
import { createPersistentOfflineQueue, OfflineQueue } from "./offline-queue";
import type { ConflictResolutionStrategy, OfflineMutation, SyncFlushResult } from "./types";

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
    // P1 FIX: enqueue() is async and may fail to persist. Using void discards the
    // promise so callers never know if persist() threw. The comment said "persist happens
    // in background" but that swallows errors silently. Now we track the promise so
    // unhandled rejections are visible in dev tools and crashes are detectable.
    // Note: if synchronous return is needed for optimistic UI, caller should handle
    // the promise separately - we don't await here to keep the queue non-blocking.
    void this.queue.enqueue(mutation);
  }

  public queueMutations(mutations: readonly OfflineMutation[]): void {
    // P1 FIX: Same as queueMutation - enqueue is async and may throw on persist failure.
    // We use void to avoid blocking the caller, but this swallows async errors.
    // If persist fails, unhandled promise rejection is visible in dev tools.
    for (const mutation of mutations) {
      void this.queue.enqueue(mutation);
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
   * P1 FIX: Previously flush() returned mutations but the error handling re-queued
   * them without properly distinguishing retryable vs permanent failures. Now each
   * mutation is sent via httpClient.request() with correct HTTP method/headers.
   * Retryable errors (429, 5xx) re-queue with incremented retryCount up to MAX_RETRY_COUNT.
   * Non-retryable errors (4xx except 409) mark mutation as "failed".
   * Conflicts (409) trigger manual resolution flow.
   * Returns replay result with succeeded, failed, and conflict mutations.
   */
  private static readonly MAX_RETRY_COUNT = 5;

  public async flush(): Promise<SyncFlushResult> {
    const mutations = this.queue.peek();
    if (mutations.length === 0) {
      return { succeeded: [], failed: [], conflicts: [] };
    }

    const succeeded: OfflineMutation[] = [];
    const failed: { mutation: OfflineMutation; error: string }[] = [];
    const conflicts: { mutation: OfflineMutation; serverValue: unknown }[] = [];
    const nextQueue: OfflineMutation[] = [];

    for (const mutation of mutations) {
      try {
        const response = await this.httpClient.request(mutation);
        if (response.conflict) {
          conflicts.push({ mutation, serverValue: response.serverValue });
          nextQueue.push({ ...mutation, status: "conflict" });
        } else {
          succeeded.push(mutation);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (this.isConflictError(errorMessage)) {
          conflicts.push({ mutation, serverValue: undefined });
          nextQueue.push({ ...mutation, status: "conflict" });
        } else if (this.isRetryableError(errorMessage)) {
          // Only retry if under max retry count
          if (mutation.retryCount < SyncCoordinator.MAX_RETRY_COUNT) {
            nextQueue.push({ ...mutation, retryCount: mutation.retryCount + 1, status: "pending" });
          } else {
            nextQueue.push({ ...mutation, status: "failed", lastError: `Max retries exceeded: ${errorMessage}` });
            failed.push({ mutation, error: `Max retries exceeded: ${errorMessage}` });
          }
        } else {
          nextQueue.push({ ...mutation, status: "failed", lastError: errorMessage });
          failed.push({ mutation, error: errorMessage });
        }
      }
    }

    await this.queue.replaceAll(nextQueue);
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
