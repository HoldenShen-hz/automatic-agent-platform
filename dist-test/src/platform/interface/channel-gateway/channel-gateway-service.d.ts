import type { GatewayStoragePort } from "./storage-port.js";
import { GatewayTargetDirectoryService } from "./gateway-target-directory-service.js";
import type { ChannelGatewayDeliveryService } from "./channel-gateway-delivery-service.js";
import type { GatewayDeliveryReceipt, GatewayRetryQueueSummary, SendGatewayMessageInput, ChannelGatewayServiceOptions } from "./types.js";
export type { ChannelGatewayServiceOptions, FetchLike, GatewayDeliveryReceipt, GatewayRetryQueueSummary, SendGatewayMessageInput, SlackGatewayConfig, TelegramGatewayConfig, WebhookGatewayConfig, } from "./types.js";
export { GatewayRateLimitError } from "./errors.js";
/**
 * Central service for sending messages through channel gateways (Telegram, Slack, webhooks).
 *
 * This service handles:
 * - Target resolution (by ID or directory query)
 * - Rate limit enforcement per channel
 * - Delivery tracking and retry queue processing
 * - Channel-specific message formatting and API calls
 *
 * It delegates to ChannelGatewayDeliveryService for tracking when available,
 * which provides retry logic, dead letter handling, and delivery receipts.
 */
export declare class ChannelGatewayService {
    /** Storage port for target lookups */
    private readonly store;
    /** Service for resolving targets by query string */
    private readonly targetDirectory;
    /** Optional configuration for channel gateways */
    private readonly options;
    private readonly fetchImpl;
    private readonly logger;
    constructor(
    /** Storage port for target lookups */
    store: GatewayStoragePort, 
    /** Service for resolving targets by query string */
    targetDirectory: GatewayTargetDirectoryService, 
    /** Optional configuration for channel gateways */
    options?: ChannelGatewayServiceOptions);
    /**
     * Returns the configured delivery service, if any.
     * Used by retry executors to access delivery tracking.
     */
    getDeliveryService(): ChannelGatewayDeliveryService | undefined;
    /**
     * Sends a message through the appropriate channel gateway.
     *
     * Resolution order:
     * 1. If targetId provided, use it directly (no directory lookup)
     * 2. Otherwise, query the target directory using the provided query string
     *
     * @param input - Message input with text and either targetId or query
     * @returns Receipt confirming delivery with provider details
     * @throws GatewayRateLimitError if rate limit is exceeded
     * @throws ValidationError if target resolution fails or channel mismatch
     * @throws GatewayDeliveryError if provider rejects the message
     */
    sendMessage(input: SendGatewayMessageInput): Promise<GatewayDeliveryReceipt>;
    /**
     * Processes pending messages in the retry queue.
     *
     * This is called periodically by ChannelGatewayRetryExecutor to attempt
     * delivery of messages that previously failed with retryable errors.
     *
     * @param limit - Maximum messages to process in this pass
     * @returns Summary of processing results
     */
    processRetryQueue(limit?: number): Promise<GatewayRetryQueueSummary>;
    /**
     * Enforces rate limiting for a channel before message delivery.
     * Throws GatewayRateLimitError if the channel is currently over its limit.
     *
     * @param channel - Channel to check
     * @param deliveryService - Delivery service with rate limit config (optional)
     */
    private enforceRateLimit;
    /**
     * Records successful delivery in the delivery tracking service.
     * Updates rate limit counters and marks the message as delivered.
     *
     * @param channel - Channel the message was delivered to
     * @param messageId - Tracking ID for the message (null if tracking disabled)
     * @param receipt - Delivery receipt from the provider
     * @param deliveryService - Service for recording delivery
     */
    private recordSuccessfulDelivery;
    /**
     * Records failed delivery in the delivery tracking service.
     * Determines whether to schedule retry or move to dead letter queue.
     *
     * @param messageId - Tracking ID for the message
     * @param channel - Channel the message was being sent to
     * @param targetId - Target identifier
     * @param deliveryService - Service for recording delivery
     * @param error - The error that caused the failure
     * @returns Outcome: retry_scheduled, dead_lettered, or null if tracking failed
     */
    private recordFailedDelivery;
    /**
     * Routes delivery to the appropriate channel-specific method.
     *
     * @param input - Delivery input with channel, target, and message details
     * @returns Delivery receipt from the channel provider
     */
    private deliverResolvedTarget;
    /**
     * Resolves a target by its internal ID directly from the store.
     * Used for direct target ID sends (bypasses directory search).
     *
     * @param targetId - Internal target identifier
     * @returns Target resolution with entry and match type
     * @throws StorageError if target not found
     */
    private resolveByTargetId;
    /**
     * Sends a message via the Telegram Bot API.
     *
     * @param targetId - Internal target ID (used for tracking)
     * @param externalTargetId - Telegram chat ID to send to
     * @param text - Message text
     * @returns Delivery receipt with Telegram message ID
     * @throws PolicyDeniedError if Telegram is not configured
     * @throws GatewayDeliveryError if API returns error
     */
    private sendTelegramMessage;
    /**
     * Sends a message via the Slack chat.postMessage API.
     *
     * @param targetId - Internal target ID (used for tracking)
     * @param externalTargetId - Slack channel ID to send to
     * @param text - Message text
     * @returns Delivery receipt with Slack timestamp message ID
     * @throws PolicyDeniedError if Slack is not configured
     * @throws GatewayDeliveryError if API returns error or ok=false
     */
    private sendSlackMessage;
    /**
     * Sends a message to a webhook endpoint.
     *
     * The webhook URL is taken from:
     * 1. metadata.webhookUrl if present and valid
     * 2. externalTargetId if it starts with http:// or https://
     *
     * @param targetId - Internal target ID
     * @param externalTargetId - Fallback webhook URL
     * @param text - Message text
     * @param metadata - Metadata including webhookUrl
     * @returns Delivery receipt (providerMessageId is always null for webhooks)
     * @throws ValidationError if no valid webhook URL is found
     * @throws GatewayDeliveryError if webhook returns non-2xx response
     */
    private sendWebhookMessage;
}
