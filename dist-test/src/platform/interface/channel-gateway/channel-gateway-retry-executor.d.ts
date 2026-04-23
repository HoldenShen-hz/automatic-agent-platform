import { ChannelGatewayService, type GatewayRetryQueueSummary } from "./channel-gateway-service.js";
/**
 * Configuration options for the retry executor.
 */
export interface ChannelGatewayRetryExecutorOptions {
    /** How often to poll for retryable messages (milliseconds). Default: 15000 */
    pollIntervalMs?: number;
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
export declare class ChannelGatewayRetryExecutor {
    private readonly gatewayService;
    private readonly pollIntervalMs;
    private readonly batchSize;
    private intervalHandle;
    private running;
    /**
     * Creates a new retry executor.
     *
     * @param gatewayService - Service to call for processing the retry queue
     * @param options - Configuration for polling behavior
     */
    constructor(gatewayService: ChannelGatewayService, options?: ChannelGatewayRetryExecutorOptions);
    /**
     * Starts periodic polling of the retry queue.
     * Has no effect if already running.
     */
    start(): void;
    /**
     * Stops periodic polling of the retry queue.
     * Has no effect if not running.
     */
    stop(): void;
    /**
     * Processes one batch of retryable messages.
     *
     * This method can be called manually for testing or to trigger an
     * immediate retry pass. It will not overlap with a running pass.
     *
     * @returns Result summary of the retry pass
     */
    runOnce(): Promise<ChannelGatewayRetryPassResult>;
}
