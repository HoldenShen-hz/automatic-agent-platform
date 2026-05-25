import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ChannelGatewayService, type GatewayRetryQueueSummary } from "./channel-gateway-service.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Configuration options for the retry executor.
 */
export interface ChannelGatewayRetryExecutorOptions {
  /** How often to poll for retryable messages (milliseconds). Default: 2000 */
  pollIntervalMs?: number;
  /** Maximum random jitter added to each poll interval. Default: 10% of pollIntervalMs */
  pollJitterMs?: number;
  /** Maximum messages to process per polling pass. Default: 25 */
  batchSize?: number;
  /** If true, starts polling immediately on construction. Default: false */
  autoStart?: boolean;
}

/**
 * Result of a single retry processing pass.
 * Includes timing information and summary statistics.
 */
export interface ChannelGatewayRetryPassResult extends GatewayRetryQueueSummary {
  /** When this pass started */
  startedAt: string;
  /** When this pass completed */
  completedAt: string;
  /** True if a previous pass was still running when this one started */
  busy: boolean;
  /** True when the pass completed without executor-level failure */
  success: boolean;
  /** Populated when the executor failed before producing a valid summary */
  errorMessage?: string;
}

/**
 * Periodically polls the gateway retry queue and attempts to deliver failed messages.
 *
 * This executor runs as a background process that periodically calls
 * ChannelGatewayService.processRetryQueue() to retry delivery of messages
 * that failed with retryable errors (rate limits, transient provider errors).
 *
 * It implements exponential backoff via the delivery service, which tracks
 * attempt counts and schedules retries with increasing delays.
 *
 * Use start() to begin polling and stop() to halt it.
 */
export class ChannelGatewayRetryExecutor {
  private readonly pollIntervalMs: number;
  private readonly pollJitterMs: number;
  private readonly batchSize: number;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private pollingEnabled = false;

  /**
   * Creates a new retry executor.
   *
   * @param gatewayService - Service to call for processing the retry queue
   * @param options - Configuration for polling behavior
   */
  public constructor(
    private readonly gatewayService: ChannelGatewayService,
    options: ChannelGatewayRetryExecutorOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.pollJitterMs = options.pollJitterMs ?? Math.floor(this.pollIntervalMs * 0.1);
    this.batchSize = options.batchSize ?? 25;
    if (options.autoStart) {
      void this.runOnce();
      this.start();
    }
  }

  /**
   * Starts periodic polling of the retry queue.
   * Has no effect if already running.
   */
  public start(): void {
    if (this.intervalHandle != null) {
      return;
    }
    this.pollingEnabled = true;
    this.scheduleNextPoll();
  }

  /**
   * Stops periodic polling of the retry queue.
   * Has no effect if not running.
   */
  public stop(): void {
    this.pollingEnabled = false;
    if (this.intervalHandle != null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private scheduleNextPoll(): void {
    if (!this.pollingEnabled) {
      return;
    }
    const delayMs = this.pollIntervalMs + Math.floor(Math.random() * Math.max(1, this.pollJitterMs + 1));
    this.intervalHandle = setTimeout(() => {
      this.intervalHandle = null;
      void this.runOnce();
      this.scheduleNextPoll();
    }, delayMs);
    this.intervalHandle.unref();
  }

  /**
   * Processes one batch of retryable messages.
   *
   * This method can be called manually for testing or to trigger an
   * immediate retry pass. It will not overlap with a running pass.
   *
   * @returns Result summary of the retry pass
   */
  public async runOnce(): Promise<ChannelGatewayRetryPassResult> {
    const startedAt = nowIso();
    if (this.running) {
      // Return busy result without waiting
      return {
        startedAt,
        completedAt: nowIso(),
        busy: true,
        success: false,
        errorMessage: "channel_gateway.retry_executor_busy",
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }

    this.running = true;
    try {
      const summary = await this.gatewayService.processRetryQueue(this.batchSize);
      return {
        startedAt,
        completedAt: nowIso(),
        busy: false,
        success: true,
        ...summary,
      };
    } catch (error) {
      logger.log({
        level: "warn",
        message: "Channel gateway retry executor pass failed",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      // Return empty summary on error (don't propagate)
      return {
        startedAt,
        completedAt: nowIso(),
        busy: false,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    } finally {
      this.running = false;
    }
  }
}
