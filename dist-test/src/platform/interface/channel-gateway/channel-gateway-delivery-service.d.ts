import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type DeliveryAttempt, type DeliveryFailureResolution, type DeliveryGuaranteeConfig, type DeliveryReceipt, type DeadLetterEntry, type PendingDelivery, type RateLimitConfig, type RateLimitResult, type ReplayProtectionResult, type RetryableDelivery, type SignatureVerificationResult, type WebhookSignatureConfig } from "./channel-gateway-delivery-support.js";
export { CHANNEL_DELIVERY_DDL, type DeliveryAttempt, type DeliveryFailureResolution, type DeliveryGuaranteeConfig, type DeliveryReceipt, type RateLimitConfig, type RateLimitResult, type ReplayProtectionResult, type SignatureVerificationResult, type WebhookSignatureConfig, } from "./channel-gateway-delivery-support.js";
export declare class ChannelGatewayDeliveryService {
    /** SQLite database connection for persistence */
    private readonly db;
    private readonly deliveryConfig;
    private readonly rateLimitConfig;
    constructor(
    /** SQLite database connection for persistence */
    db: AuthoritativeSqlDatabase, 
    /** Override default retry and rate limit configuration */
    config?: Partial<DeliveryGuaranteeConfig> & {
        rateLimit?: Partial<RateLimitConfig>;
    });
    /**
     * Checks whether a message can be sent under rate limits for the given channel.
     *
     * GW-04: Implements per-channel rate limiting to prevent hitting provider limits.
     * Uses a sliding window counter persisted in the database.
     *
     * @param channel - Channel to check
     * @returns Result indicating if allowed and current counts
     */
    checkRateLimit(channel: string): RateLimitResult;
    /**
     * Records a message being sent under rate limits.
     *
     * GW-04: Updates the rate limit counter after successful send.
     * Also performs lazy cleanup of old rate limit windows.
     *
     * @param channel - Channel that was used
     */
    recordRateLimitHit(channel: string): void;
    /**
     * Returns current rate limit status for all configured channels.
     *
     * @returns Current count, limit, and window for each channel
     */
    getRateLimitStatus(): Record<string, {
        currentCount: number;
        limit: number;
        windowMs: number;
    }>;
    /**
     * Verifies an incoming webhook request signature using HMAC-SHA256.
     *
     * Supports both signed payload only and timestamped signature formats.
     * Timestamp validation prevents replay attacks by rejecting old requests.
     *
     * @param payload - Raw request body as string
     * @param signature - Signature from header (with or without sha256= prefix)
     * @param timestamp - Optional timestamp from header
     * @param config - Signature verification configuration
     * @returns Verification result with validity and error details
     */
    verifySignature(payload: string, signature: string | null, timestamp: string | null, config: WebhookSignatureConfig): SignatureVerificationResult;
    /**
     * Generates a webhook signature for outgoing webhook requests.
     *
     * @param payload - Request body as string
     * @param secret - Shared secret for HMAC
     * @param timestamp - Optional timestamp to include in signature
     * @returns Signature in format "sha256=hexsignature"
     */
    generateSignature(payload: string, secret: string, timestamp?: string): string;
    /**
     * Verifies and records a nonce for replay protection.
     *
     * Prevents the same request from being processed multiple times.
     * Nonces expire after ttlSeconds to prevent unbounded storage growth.
     *
     * @param nonce - The nonce value to verify
     * @param ttlSeconds - How long until nonce expires (default: 300 = 5 minutes)
     * @returns Result indicating if nonce is valid and newly recorded
     */
    verifyNonce(nonce: string, ttlSeconds?: number): ReplayProtectionResult;
    /**
     * Generates a new random nonce for replay protection.
     *
     * @param length - Length of nonce in bytes (default: 32, produces 64 hex chars)
     * @returns Random nonce as hex string
     */
    generateNonce(length?: number): string;
    /**
     * Creates a new delivery message with retry tracking.
     *
     * Initializes tracking record before delivery attempt is made.
     * The message will remain in "pending_retry" status until
     * recordDeliverySuccess or recordDeliveryFailure is called.
     *
     * @param channel - Channel for delivery
     * @param targetId - Target identifier
     * @param payload - Message payload to store for retry
     * @param maxRetries - Override default max retries
     * @returns Initial delivery receipt
     */
    createDeliveryMessage(channel: string, targetId: string, payload: Record<string, unknown>, maxRetries?: number): DeliveryReceipt;
    /**
     * Records a delivery attempt with its result.
     *
     * @param messageId - Message being attempted
     * @param attemptNumber - Which attempt this is (1-based)
     * @param status - Outcome of attempt
     * @param responseStatus - HTTP status code if request was sent
     * @param errorMessage - Error description if failed
     * @param providerMessageId - Provider's message ID on success
     * @returns The recorded attempt
     */
    recordAttempt(messageId: string, attemptNumber: number, status: DeliveryAttempt["status"], responseStatus?: number, errorMessage?: string, providerMessageId?: string | null): DeliveryAttempt;
    /**
     * Records a successful delivery.
     *
     * @param messageId - Message that was delivered
     * @param responseStatus - Final HTTP status code
     * @param providerMessageId - Provider's message ID
     * @returns The recorded attempt, or null if message not found
     */
    recordDeliverySuccess(messageId: string, responseStatus: number, providerMessageId?: string | null): DeliveryAttempt | null;
    /**
     * Records a failed delivery and determines whether to retry or dead-letter.
     *
     * If the failure is retryable and attempts remain, schedules a retry.
     * Otherwise, moves the message to the dead letter queue.
     *
     * @param messageId - Message that failed
     * @param options - Failure details including whether it's retryable
     * @returns Resolution indicating outcome, or null if message not found
     */
    recordDeliveryFailure(messageId: string, options: {
        responseStatus?: number | null;
        errorMessage?: string | null;
        retryable: boolean;
        providerMessageId?: string | null;
    }): DeliveryFailureResolution | null;
    /**
     * Determines if an HTTP status code should trigger a retry.
     *
     * @param status - HTTP status code
     * @returns True if the status is retryable
     */
    isRetryableStatus(status: number): boolean;
    /**
     * Retrieves pending delivery messages awaiting processing.
     *
     * @param limit - Maximum messages to return
     * @returns Pending messages with their payloads
     */
    getPendingDeliveries(limit?: number): Array<{} & PendingDelivery>;
    /**
     * Retrieves a delivery receipt for a message.
     *
     * @param messageId - Message to look up
     * @returns Receipt with final status, or null if not found
     */
    getDeliveryReceipt(messageId: string): DeliveryReceipt | null;
    /**
     * Marks a message as permanently failed without retry.
     *
     * @param messageId - Message to mark failed
     * @param errorMessage - Reason for failure
     */
    markPermanentFailure(messageId: string, _errorMessage: string): void;
    /**
     * Moves a message to the dead letter queue after exhausting all retries.
     *
     * GW-03: Implements dead letter queue for gateway delivery failures.
     * The message is removed from active tracking and stored separately
     * for manual inspection and retry.
     *
     * @param messageId - Message to dead-letter
     * @param failureReason - Categorical reason for failure
     * @param lastErrorMessage - Most recent error message
     * @param lastResponseStatus - Most recent HTTP status
     */
    moveToDeadLetter(messageId: string, failureReason: string, lastErrorMessage?: string, lastResponseStatus?: number): void;
    /**
     * Retrieves dead letter messages for inspection or reprocessing.
     *
     * GW-03: Enables querying and processing of dead letter messages.
     *
     * @param channel - Optional channel filter
     * @param limit - Maximum messages to return
     * @returns Dead letter entries with failure details
     */
    getDeadLetters(channel?: string, limit?: number): Array<{} & DeadLetterEntry>;
    /**
     * Retrieves messages that are ready for retry.
     *
     * GW-03: Enables retry processor to find messages needing retry.
     * A message is ready if: status is retrying, attempts < maxRetries,
     * and (nextRetryAt is null OR nextRetryAt <= now).
     *
     * @param limit - Maximum messages to return
     * @returns Retryable messages with their payloads
     */
    getRetryableMessages(limit?: number): Array<{} & RetryableDelivery>;
    /**
     * Returns count of dead letters per channel for monitoring.
     *
     * @param channel - Optional channel filter
     * @returns Map of channel to dead letter count
     */
    getDeadLetterCount(channel?: string): Record<string, number>;
    /**
     * Calculates exponential backoff delay for a given attempt number.
     *
     * @param attemptNumber - 1-based attempt number
     * @returns Delay in milliseconds
     */
    private readDeliveryMessageRecord;
}
