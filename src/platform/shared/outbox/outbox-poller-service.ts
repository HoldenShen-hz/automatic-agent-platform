/**
 * OutboxPollerService - Asynchronous poller for the transactional outbox pattern.
 *
 * ## Architecture
 *
 * The OutboxPollerService runs on a periodic interval, polling the outbox table
 * for unpublished entries and publishing them to the event bus. This enables
 * reliable event delivery without requiring the caller to manage event publishing.
 *
 * ## Key Properties
 *
 * - Runs at a configurable interval (default: 100ms)
 * - Uses exponential backoff for failed entries
 * - Supports batch publishing for efficiency
 * - Graceful shutdown with in-flight completion
 *
 * @see OutboxService for the main outbox coordination logic
 * @see OutboxRepository for data access
 */

import { nowIso } from "../../contracts/types/ids.js";
import { OutboxService } from "./outbox-service.js";
import { StructuredLogger } from "../observability/structured-logger.js";

export interface OutboxPollerConfig {
  /** Polling interval in milliseconds (default: 100ms) */
  intervalMs: number;
  /** Maximum entries to process per poll cycle (default: 100) */
  batchSize: number;
  /** Maximum retry attempts before marking entry as failed (default: 5) */
  maxRetries: number;
  /** Initial backoff delay in milliseconds (default: 1000ms) */
  initialBackoffMs: number;
  /** Maximum backoff delay in milliseconds (default: 30000ms) */
  maxBackoffMs: number;
}

const DEFAULT_POLLER_CONFIG: OutboxPollerConfig = {
  intervalMs: 100,
  batchSize: 100,
  maxRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
};

const logger = new StructuredLogger({ retentionLimit: 200 });

export interface OutboxPollerMetrics {
  isRunning: boolean;
  lastPollAt: string | null;
  lastPollDurationMs: number;
  totalPublished: number;
  totalFailed: number;
  pendingCount: number;
  failedCount: number;
  consecutiveEmptyPolls: number;
}

export class OutboxPollerService {
  private readonly config: OutboxPollerConfig;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private stopped = false;

  private lastPollAt: string | null = null;
  private lastPollDurationMs = 0;
  private totalPublished = 0;
  private totalFailed = 0;
  private consecutiveEmptyPolls = 0;

  public constructor(
    private readonly outboxService: OutboxService,
    config: Partial<OutboxPollerConfig> = {},
  ) {
    this.config = { ...DEFAULT_POLLER_CONFIG, ...config };
  }

  /**
   * Starts the poller service. The poller will begin polling at the configured interval.
   */
  public start(): void {
    if (this.disposed) {
      throw new Error("OutboxPollerService is disposed");
    }
    if (this.intervalHandle !== null) {
      return;
    }

    this.stopped = false;
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.config.intervalMs);

    // Don't prevent process exit
    this.intervalHandle.unref();

    logger.log({
      level: "info",
      message: "outbox_poller.started",
      data: { intervalMs: this.config.intervalMs, batchSize: this.config.batchSize },
    });
  }

  /**
   * Stops the poller service gracefully. Completes in-flight publishing before stopping.
   * @param timeoutMs - Maximum time to wait for in-flight operations
   */
  public async stop(timeoutMs: number = 5000): Promise<void> {
    if (this.intervalHandle === null) {
      return;
    }

    this.stopped = true;
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;

    // Give in-flight operations time to complete
    const startWait = Date.now();
    while (Date.now() - startWait < timeoutMs) {
      if (this.lastPollDurationMs === 0) {
        break;
      }
      await sleep(10);
    }

    logger.log({
      level: "info",
      message: "outbox_poller.stopped",
      data: {
        totalPublished: this.totalPublished,
        totalFailed: this.totalFailed,
      },
    });
  }

  /**
   * Disposes the poller service. Cannot be restarted after disposal.
   */
  public dispose(): void {
    this.disposed = true;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Performs a single poll cycle, publishing pending outbox entries.
   */
  public async poll(): Promise<{ published: number; failed: number }> {
    if (this.disposed || this.stopped) {
      return { published: 0, failed: 0 };
    }

    const startTime = Date.now();
    const pendingCount = this.outboxService.getPendingCount();

    if (pendingCount === 0) {
      this.consecutiveEmptyPolls++;
      this.lastPollAt = nowIso();
      this.lastPollDurationMs = Date.now() - startTime;
      return { published: 0, failed: 0 };
    }

    this.consecutiveEmptyPolls = 0;

    const entries = this.outboxService.getPendingEntries(this.config.batchSize);
    let published = 0;
    let failed = 0;

    for (const entry of entries) {
      if (this.disposed || this.stopped) {
        break;
      }

      if (entry.retryCount >= this.config.maxRetries) {
        // Skip entries that have exhausted retries
        failed++;
        continue;
      }

      if (entry.retryCount > 0) {
        // Apply exponential backoff
        const backoffDelay = this.calculateBackoff(entry.retryCount);
        const timeSinceLastAttempt =
          new Date(nowIso()).getTime() - new Date(entry.createdAt).getTime();
        if (timeSinceLastAttempt < backoffDelay) {
          continue;
        }
      }

      const success = await this.outboxService.publishEntry(entry);
      if (success) {
        published++;
      } else {
        failed++;
      }
    }

    this.lastPollAt = nowIso();
    this.lastPollDurationMs = Date.now() - startTime;
    this.totalPublished += published;
    this.totalFailed += failed;

    if (published > 0 || failed > 0) {
      logger.log({
        level: "debug",
        message: "outbox_poller.poll_completed",
        data: {
          published,
          failed,
          pendingCount: this.outboxService.getPendingCount(),
          durationMs: this.lastPollDurationMs,
        },
      });
    }

    return { published, failed };
  }

  /**
   * Gets current poller metrics.
   */
  public getMetrics(): OutboxPollerMetrics {
    return {
      isRunning: this.intervalHandle !== null && !this.stopped,
      lastPollAt: this.lastPollAt,
      lastPollDurationMs: this.lastPollDurationMs,
      totalPublished: this.totalPublished,
      totalFailed: this.totalFailed,
      pendingCount: this.outboxService.getPendingCount(),
      failedCount: this.outboxService.getFailedCount(),
      consecutiveEmptyPolls: this.consecutiveEmptyPolls,
    };
  }

  /**
   * Calculates exponential backoff delay with jitter.
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = Math.min(
      this.config.initialBackoffMs * Math.pow(2, retryCount - 1),
      this.config.maxBackoffMs,
    );
    const jitter = Math.random() * exponentialDelay * 0.1;
    return Math.round(exponentialDelay + jitter);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
