import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
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
    gatewayService;
    pollIntervalMs;
    batchSize;
    intervalHandle = null;
    running = false;
    /**
     * Creates a new retry executor.
     *
     * @param gatewayService - Service to call for processing the retry queue
     * @param options - Configuration for polling behavior
     */
    constructor(gatewayService, options = {}) {
        this.gatewayService = gatewayService;
        this.pollIntervalMs = options.pollIntervalMs ?? 15_000;
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
    start() {
        if (this.intervalHandle != null) {
            return;
        }
        this.intervalHandle = setInterval(() => {
            void this.runOnce();
        }, this.pollIntervalMs);
        // Allow the timer to not keep the process alive
        this.intervalHandle.unref();
    }
    /**
     * Stops periodic polling of the retry queue.
     * Has no effect if not running.
     */
    stop() {
        if (this.intervalHandle != null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
    /**
     * Processes one batch of retryable messages.
     *
     * This method can be called manually for testing or to trigger an
     * immediate retry pass. It will not overlap with a running pass.
     *
     * @returns Result summary of the retry pass
     */
    async runOnce() {
        const startedAt = nowIso();
        if (this.running) {
            // Return busy result without waiting
            return {
                startedAt,
                completedAt: nowIso(),
                busy: true,
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
                ...summary,
            };
        }
        catch (error) {
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
                scanned: 0,
                delivered: 0,
                retryScheduled: 0,
                deadLettered: 0,
                skippedRateLimited: 0,
            };
        }
        finally {
            this.running = false;
        }
    }
}
//# sourceMappingURL=channel-gateway-retry-executor.js.map