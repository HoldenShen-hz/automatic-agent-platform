import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { buildDeadLetterCountQuery, buildDeadLetterQuery, calculateBackoffForAttempt, DEFAULT_DELIVERY_CONFIG, DEFAULT_RATE_LIMIT_CONFIG, toDeliveryMessageRecord, } from "./channel-gateway-delivery-support.js";
export { CHANNEL_DELIVERY_DDL, } from "./channel-gateway-delivery-support.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class ChannelGatewayDeliveryService {
    db;
    deliveryConfig;
    rateLimitConfig;
    constructor(
    /** SQLite database connection for persistence */
    db, 
    /** Override default retry and rate limit configuration */
    config) {
        this.db = db;
        this.deliveryConfig = {
            maxRetries: config?.maxRetries ?? DEFAULT_DELIVERY_CONFIG.maxRetries,
            initialBackoffMs: config?.initialBackoffMs ?? DEFAULT_DELIVERY_CONFIG.initialBackoffMs,
            maxBackoffMs: config?.maxBackoffMs ?? DEFAULT_DELIVERY_CONFIG.maxBackoffMs,
            backoffMultiplier: config?.backoffMultiplier ?? DEFAULT_DELIVERY_CONFIG.backoffMultiplier,
            timeoutMs: config?.timeoutMs ?? DEFAULT_DELIVERY_CONFIG.timeoutMs,
            retryableStatuses: config?.retryableStatuses ?? DEFAULT_DELIVERY_CONFIG.retryableStatuses,
        };
        this.rateLimitConfig = {
            telegram: config?.rateLimit?.telegram ?? DEFAULT_RATE_LIMIT_CONFIG.telegram,
            slack: config?.rateLimit?.slack ?? DEFAULT_RATE_LIMIT_CONFIG.slack,
            webhook: config?.rateLimit?.webhook ?? DEFAULT_RATE_LIMIT_CONFIG.webhook,
            default: config?.rateLimit?.default ?? DEFAULT_RATE_LIMIT_CONFIG.default,
        };
    }
    /**
     * Checks whether a message can be sent under rate limits for the given channel.
     *
     * GW-04: Implements per-channel rate limiting to prevent hitting provider limits.
     * Uses a sliding window counter persisted in the database.
     *
     * @param channel - Channel to check
     * @returns Result indicating if allowed and current counts
     */
    checkRateLimit(channel) {
        const limitConfig = this.rateLimitConfig[channel]
            ?? this.rateLimitConfig.default;
        const now = Date.now();
        const windowStart = new Date(now - (now % limitConfig.windowMs)).toISOString();
        const windowEnd = new Date(windowStart).getTime() + limitConfig.windowMs;
        const row = this.db.connection
            .prepare(`SELECT message_count FROM gateway_rate_limits
         WHERE channel = ? AND window_start = ?`)
            .get(channel, windowStart);
        const currentCount = row?.message_count ?? 0;
        if (currentCount >= limitConfig.limit) {
            return {
                allowed: false,
                currentCount,
                limit: limitConfig.limit,
                windowMs: limitConfig.windowMs,
                retryAfterMs: windowEnd - now,
            };
        }
        return {
            allowed: true,
            currentCount,
            limit: limitConfig.limit,
            windowMs: limitConfig.windowMs,
        };
    }
    /**
     * Records a message being sent under rate limits.
     *
     * GW-04: Updates the rate limit counter after successful send.
     * Also performs lazy cleanup of old rate limit windows.
     *
     * @param channel - Channel that was used
     */
    recordRateLimitHit(channel) {
        const limitConfig = this.rateLimitConfig[channel]
            ?? this.rateLimitConfig.default;
        const now = Date.now();
        const windowStart = new Date(now - (now % limitConfig.windowMs)).toISOString();
        this.db.connection
            .prepare(`INSERT INTO gateway_rate_limits (channel, window_start, message_count)
         VALUES (?, ?, 1)
         ON CONFLICT(channel, window_start)
         DO UPDATE SET message_count = message_count + 1`)
            .run(channel, windowStart);
        const cutoff = new Date(now - 3600000).toISOString();
        this.db.connection
            .prepare(`DELETE FROM gateway_rate_limits WHERE window_start < ?`)
            .run(cutoff);
    }
    /**
     * Returns current rate limit status for all configured channels.
     *
     * @returns Current count, limit, and window for each channel
     */
    getRateLimitStatus() {
        const result = {};
        const now = Date.now();
        for (const [channel, config] of Object.entries(this.rateLimitConfig)) {
            if (!config || channel === "default")
                continue;
            const windowStart = new Date(now - (now % config.windowMs)).toISOString();
            const row = this.db.connection
                .prepare(`SELECT message_count FROM gateway_rate_limits
           WHERE channel = ? AND window_start = ?`)
                .get(channel, windowStart);
            result[channel] = {
                currentCount: row?.message_count ?? 0,
                limit: config.limit,
                windowMs: config.windowMs,
            };
        }
        return result;
    }
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
    verifySignature(payload, signature, timestamp, config) {
        if (!signature) {
            return { valid: false, error: "missing_signature", timestamp: null, signature: null };
        }
        if (timestamp) {
            const timestampNum = parseInt(timestamp, 10);
            const now = Math.floor(Date.now() / 1000);
            const tolerance = config.toleranceSeconds ?? 300; // 5 minutes default
            if (isNaN(timestampNum)) {
                return { valid: false, error: "invalid_timestamp_format", timestamp, signature };
            }
            if (Math.abs(now - timestampNum) > tolerance) {
                return { valid: false, error: "timestamp_outside_tolerance", timestamp, signature };
            }
        }
        const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
        const expectedSignature = createHmac("sha256", config.secret)
            .update(signedPayload, "utf8")
            .digest("hex");
        try {
            const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
            const expectedBuffer = Buffer.from(expectedSignature, "hex");
            if (signatureBuffer.length !== expectedBuffer.length) {
                return { valid: false, error: "signature_mismatch", timestamp, signature };
            }
            if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
                return { valid: false, error: "signature_mismatch", timestamp, signature };
            }
            return { valid: true, error: null, timestamp, signature };
        }
        catch (err) {
            logger.warn("verifyTimestampedSignature failed", { error: err });
            return { valid: false, error: "signature_verification_failed", timestamp, signature };
        }
    }
    /**
     * Generates a webhook signature for outgoing webhook requests.
     *
     * @param payload - Request body as string
     * @param secret - Shared secret for HMAC
     * @param timestamp - Optional timestamp to include in signature
     * @returns Signature in format "sha256=hexsignature"
     */
    generateSignature(payload, secret, timestamp) {
        const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
        return `sha256=${createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex")}`;
    }
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
    verifyNonce(nonce, ttlSeconds = 300) {
        const now = new Date();
        const createdAt = now.toISOString();
        const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
        const existing = this.db.connection
            .prepare(`SELECT nonce FROM replay_nonces WHERE nonce = ?`)
            .get(nonce);
        if (existing) {
            return { valid: false, error: "nonce_already_used", nonce, ageSeconds: null };
        }
        this.db.connection
            .prepare(`INSERT INTO replay_nonces (nonce, created_at, expires_at) VALUES (?, ?, ?)`)
            .run(nonce, createdAt, expiresAt);
        this.db.connection
            .prepare(`DELETE FROM replay_nonces WHERE expires_at < ?`)
            .run(now.toISOString());
        return { valid: true, error: null, nonce, ageSeconds: 0 };
    }
    /**
     * Generates a new random nonce for replay protection.
     *
     * @param length - Length of nonce in bytes (default: 32, produces 64 hex chars)
     * @returns Random nonce as hex string
     */
    generateNonce(length = 32) {
        return randomBytes(length).toString("hex").slice(0, length);
    }
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
    createDeliveryMessage(channel, targetId, payload, maxRetries) {
        const messageId = newId("dlvmsg");
        const now = nowIso();
        this.db.connection
            .prepare(`INSERT INTO delivery_messages
         (message_id, channel, target_id, payload_json, status, attempts, max_retries, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(messageId, channel, targetId, JSON.stringify(payload), "pending", 0, maxRetries ?? this.deliveryConfig.maxRetries, now, now);
        return {
            messageId,
            channel,
            targetId,
            status: "pending_retry",
            attempts: 0,
            finalStatus: "success", // Will be updated
            firstAttemptAt: now,
            lastAttemptAt: now,
            providerMessageId: null,
        };
    }
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
    recordAttempt(messageId, attemptNumber, status, responseStatus, errorMessage, providerMessageId) {
        const now = nowIso();
        const attemptId = newId("dlvatt");
        let nextRetryAt = null;
        if (status === "retrying" && responseStatus) {
            const backoff = calculateBackoffForAttempt(this.deliveryConfig, attemptNumber);
            nextRetryAt = new Date(Date.now() + backoff).toISOString();
        }
        this.db.connection
            .prepare(`INSERT INTO delivery_attempts
         (attempt_id, message_id, attempt_number, status, response_status, error_message, provider_message_id, next_retry_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(attemptId, messageId, attemptNumber, status, responseStatus ?? null, errorMessage ?? null, providerMessageId ?? null, nextRetryAt, now);
        this.db.connection
            .prepare(`UPDATE delivery_messages
         SET status = ?, attempts = ?, updated_at = ?, completed_at = ?
         WHERE message_id = ?`)
            .run(status === "success" ? "delivered" : status === "failed" ? "failed" : "retrying", attemptNumber, now, status === "success" || status === "failed" ? now : null, messageId);
        return {
            attemptId,
            messageId,
            channel: "", // Will be joined
            targetId: "",
            attemptNumber,
            status,
            responseStatus: responseStatus ?? null,
            errorMessage: errorMessage ?? null,
            nextRetryAt,
            createdAt: now,
            completedAt: status === "success" || status === "failed" ? now : null,
        };
    }
    /**
     * Records a successful delivery.
     *
     * @param messageId - Message that was delivered
     * @param responseStatus - Final HTTP status code
     * @param providerMessageId - Provider's message ID
     * @returns The recorded attempt, or null if message not found
     */
    recordDeliverySuccess(messageId, responseStatus, providerMessageId) {
        const record = this.readDeliveryMessageRecord(messageId);
        if (record == null) {
            return null;
        }
        return this.recordAttempt(messageId, record.attempts + 1, "success", responseStatus, undefined, providerMessageId ?? null);
    }
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
    recordDeliveryFailure(messageId, options) {
        const record = this.readDeliveryMessageRecord(messageId);
        if (record == null) {
            return null;
        }
        const attemptNumber = record.attempts + 1;
        const responseStatus = options.responseStatus ?? undefined;
        const errorMessage = options.errorMessage ?? undefined;
        const providerMessageId = options.providerMessageId ?? null;
        if (options.retryable && attemptNumber < record.maxRetries) {
            return {
                attempt: this.recordAttempt(messageId, attemptNumber, "retrying", responseStatus, errorMessage, providerMessageId),
                outcome: "retry_scheduled",
            };
        }
        const attempt = this.recordAttempt(messageId, attemptNumber, "failed", responseStatus, errorMessage, providerMessageId);
        this.moveToDeadLetter(messageId, options.retryable ? "gateway.delivery_retries_exhausted" : "gateway.delivery_non_retryable_failure", errorMessage, responseStatus);
        return {
            attempt,
            outcome: "dead_lettered",
        };
    }
    /**
     * Determines if an HTTP status code should trigger a retry.
     *
     * @param status - HTTP status code
     * @returns True if the status is retryable
     */
    isRetryableStatus(status) {
        return this.deliveryConfig.retryableStatuses.includes(status);
    }
    /**
     * Retrieves pending delivery messages awaiting processing.
     *
     * @param limit - Maximum messages to return
     * @returns Pending messages with their payloads
     */
    getPendingDeliveries(limit = 100) {
        const rows = this.db.connection
            .prepare(`SELECT message_id, channel, target_id, payload_json, attempts, max_retries, created_at
         FROM delivery_messages
         WHERE status = 'pending' OR status = 'retrying'
         ORDER BY created_at ASC
         LIMIT ?`)
            .all(limit);
        return rows.map((row) => ({
            messageId: String(row.message_id),
            channel: String(row.channel),
            targetId: String(row.target_id),
            payload: JSON.parse(String(row.payload_json)),
            attempts: Number(row.attempts),
            maxRetries: Number(row.max_retries),
            createdAt: String(row.created_at),
        }));
    }
    /**
     * Retrieves a delivery receipt for a message.
     *
     * @param messageId - Message to look up
     * @returns Receipt with final status, or null if not found
     */
    getDeliveryReceipt(messageId) {
        const row = this.db.connection
            .prepare(`SELECT message_id, channel, target_id, status, attempts, created_at, completed_at
         FROM delivery_messages
         WHERE message_id = ?`)
            .get(messageId);
        if (!row)
            return null;
        const attempts = this.db.connection
            .prepare(`SELECT response_status, provider_message_id
         FROM delivery_attempts
         WHERE message_id = ?
         ORDER BY attempt_number DESC
         LIMIT 1`)
            .get(messageId);
        return {
            messageId: String(row.message_id),
            channel: String(row.channel),
            targetId: String(row.target_id),
            status: row.status === "delivered" ? "delivered" : row.status === "failed" ? "failed" : "pending_retry",
            attempts: Number(row.attempts),
            finalStatus: row.status === "delivered" ? "success" : row.status === "failed" ? "permanent_failure" : "exhausted_retries",
            firstAttemptAt: String(row.created_at),
            lastAttemptAt: String(row.completed_at ?? row.created_at),
            providerMessageId: attempts ? String(attempts.provider_message_id ?? "") : null,
        };
    }
    /**
     * Marks a message as permanently failed without retry.
     *
     * @param messageId - Message to mark failed
     * @param errorMessage - Reason for failure
     */
    markPermanentFailure(messageId, _errorMessage) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE delivery_messages
         SET status = 'failed', updated_at = ?, completed_at = ?
         WHERE message_id = ?`)
            .run(now, now, messageId);
    }
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
    moveToDeadLetter(messageId, failureReason, lastErrorMessage, lastResponseStatus) {
        const now = nowIso();
        const row = this.db.connection
            .prepare(`SELECT * FROM delivery_messages WHERE message_id = ?`)
            .get(messageId);
        if (!row) {
            return; // Message not found, nothing to do
        }
        const lastAttempt = this.db.connection
            .prepare(`SELECT * FROM delivery_attempts
         WHERE message_id = ?
         ORDER BY attempt_number DESC
         LIMIT 1`)
            .get(messageId);
        this.db.connection
            .prepare(`INSERT OR REPLACE INTO gateway_dead_letters
         (message_id, channel, target_id, payload_json, failure_reason, last_error_message,
          last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
          original_request_url, provider_message_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(messageId, String(row.channel), String(row.target_id), String(row.payload_json), failureReason, lastErrorMessage ?? null, lastResponseStatus ?? (lastAttempt?.response_status ?? null), Number(row.attempts), String(row.created_at), now, (() => {
            try {
                const payload = JSON.parse(String(row.payload_json));
                return payload.requestUrl ?? null;
            }
            catch (err) {
                logger.warn("extractRequestUrl failed", { error: err });
                return null;
            }
        })(), lastAttempt?.provider_message_id ?? null);
        this.db.connection
            .prepare(`DELETE FROM delivery_attempts WHERE message_id = ?`)
            .run(messageId);
        this.db.connection
            .prepare(`DELETE FROM delivery_messages WHERE message_id = ?`)
            .run(messageId);
    }
    /**
     * Retrieves dead letter messages for inspection or reprocessing.
     *
     * GW-03: Enables querying and processing of dead letter messages.
     *
     * @param channel - Optional channel filter
     * @param limit - Maximum messages to return
     * @returns Dead letter entries with failure details
     */
    getDeadLetters(channel, limit = 100) {
        const { query, params } = buildDeadLetterQuery(channel, limit);
        const rows = this.db.connection.prepare(query).all(...params);
        return rows.map((row) => ({
            messageId: String(row.message_id),
            channel: String(row.channel),
            targetId: String(row.target_id),
            payload: JSON.parse(String(row.payload_json)),
            failureReason: String(row.failure_reason),
            lastErrorMessage: row.last_error_message,
            lastResponseStatus: row.last_response_status,
            attempts: Number(row.attempts),
            firstFailedAt: String(row.first_failed_at),
            movedToDeadLetterAt: String(row.moved_to_dead_letter_at),
        }));
    }
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
    getRetryableMessages(limit = 100) {
        const now = nowIso();
        const rows = this.db.connection
            .prepare(`SELECT m.message_id, m.channel, m.target_id, m.payload_json, m.attempts, m.max_retries,
                a.next_retry_at
         FROM delivery_messages m
         LEFT JOIN delivery_attempts a
           ON a.message_id = m.message_id
          AND a.attempt_number = (
            SELECT MAX(latest.attempt_number)
            FROM delivery_attempts latest
            WHERE latest.message_id = m.message_id
          )
         WHERE m.status = 'retrying'
           AND m.attempts < m.max_retries
           AND (a.next_retry_at IS NULL OR a.next_retry_at <= ?)
         ORDER BY m.created_at ASC
         LIMIT ?`)
            .all(now, limit);
        return rows.map((row) => ({
            messageId: String(row.message_id),
            channel: String(row.channel),
            targetId: String(row.target_id),
            payload: JSON.parse(String(row.payload_json)),
            attempts: Number(row.attempts),
            maxRetries: Number(row.max_retries),
            nextRetryAt: row.next_retry_at ?? null,
        }));
    }
    /**
     * Returns count of dead letters per channel for monitoring.
     *
     * @param channel - Optional channel filter
     * @returns Map of channel to dead letter count
     */
    getDeadLetterCount(channel) {
        const { query, params } = buildDeadLetterCountQuery(channel);
        const rows = this.db.connection.prepare(query).all(...params);
        const result = {};
        for (const row of rows) {
            result[row.channel] = row.count;
        }
        return result;
    }
    /**
     * Calculates exponential backoff delay for a given attempt number.
     *
     * @param attemptNumber - 1-based attempt number
     * @returns Delay in milliseconds
     */
    readDeliveryMessageRecord(messageId) {
        const row = this.db.connection
            .prepare(`SELECT attempts, max_retries
         FROM delivery_messages
         WHERE message_id = ?`)
            .get(messageId);
        return toDeliveryMessageRecord(row);
    }
}
//# sourceMappingURL=channel-gateway-delivery-service.js.map