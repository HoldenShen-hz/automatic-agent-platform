import type { GatewayStoragePort } from "./storage-port.js";
import { nowIso } from "../../contracts/types/ids.js";
import { PolicyDeniedError, StorageError, ValidationError } from "../../contracts/errors.js";
import { GatewayTargetDirectoryService } from "./gateway-target-directory-service.js";
import type { ChannelGatewayDeliveryService } from "./channel-gateway-delivery-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import {
  SLACK_API_URL,
  TELEGRAM_API_URL,
} from "../../control-plane/config-center/provider-defaults.js";
import {
  parseSafeOutboundUrl,
  sanitizeUrlForTelemetry,
} from "../../control-plane/iam/outbound-url-policy.js";
import {
  GatewayDeliveryError,
  GatewayRateLimitError,
  normalizeGatewayDeliveryFailure,
} from "./errors.js";
import {
  normalizeWebhookRequestEnvelope,
  parseMetadata,
  readTrackedDeliveryPayload,
  requireNonEmpty,
} from "./helpers.js";
import type {
  FetchLike,
  GatewayDeliveryReceipt,
  GatewayRetryQueueSummary,
  SendGatewayMessageInput,
  ChannelGatewayServiceOptions,
} from "./types.js";

export type {
  ChannelGatewayServiceOptions,
  FetchLike,
  GatewayDeliveryReceipt,
  GatewayRetryQueueSummary,
  SendGatewayMessageInput,
  SlackGatewayConfig,
  TelegramGatewayConfig,
  WebhookGatewayConfig,
} from "./types.js";
export { GatewayRateLimitError } from "./errors.js";

/**
 * Interface for channel adapters.
 * R12-12: Pluggable adapter registry to support any channel protocol.
 */
export interface ChannelAdapter {
  /** Unique channel identifier (e.g., "telegram", "slack", "custom") */
  readonly channelType: string;
  /** Sends a message through this channel */
  sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt>;
  /** Checks if this adapter supports the given channel type */
  supports(channel: string): boolean;
}

/**
 * Registry for channel adapters.
 * R12-12: Allows dynamic registration of new channel types.
 */
export class ChannelAdapterRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  /**
   * Registers a channel adapter.
   */
  public register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
  }

  /**
   * Gets an adapter for a channel type.
   */
  public get(channel: string): ChannelAdapter | null {
    return this.adapters.get(channel) ?? null;
  }

  /**
   * Gets all registered channel types.
   */
  public getChannelTypes(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Checks if a channel type is supported.
   */
  public supports(channel: string): boolean {
    return this.adapters.has(channel);
  }
}

/**
 * R12-12: Built-in adapter for Telegram channels.
 */
class TelegramChannelAdapter implements ChannelAdapter {
  public readonly channelType = "telegram";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "telegram";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text);
  }
}

/**
 * R12-12: Built-in adapter for Slack channels.
 */
class SlackChannelAdapter implements ChannelAdapter {
  public readonly channelType = "slack";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "slack";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text);
  }
}

/**
 * R12-12: Built-in adapter for Webhook channels.
 */
class WebhookChannelAdapter implements ChannelAdapter {
  public readonly channelType = "webhook";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
      metadata: Record<string, unknown>,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "webhook";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text, input.metadata ?? {});
  }
}

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
export class ChannelGatewayService {
  private readonly fetchImpl: FetchLike;
  private readonly logger = new StructuredLogger({ retentionLimit: 100 });
  private readonly requestTimeoutMs: number;
  private readonly circuitBreakerFailureThreshold: number;
  private readonly circuitBreakerResetMs: number;
  private readonly circuitBreakerState = new Map<string, { failureCount: number; openUntil: number | null }>();
  // R12-12: Pluggable adapter registry
  private readonly adapterRegistry: ChannelAdapterRegistry;

  public constructor(
    /** Storage port for target lookups */
    private readonly store: GatewayStoragePort,
    /** Service for resolving targets by query string */
    private readonly targetDirectory: GatewayTargetDirectoryService,
    /** Optional configuration for channel gateways */
    private readonly options: ChannelGatewayServiceOptions = {},
    /** Optional adapter registry for pluggable channel support */
    adapterRegistry?: ChannelAdapterRegistry,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = Math.max(
      1,
      Math.min(
        Math.trunc(options.requestTimeoutMs ?? 5_000),
        Math.max(1, Math.trunc(options.maxRequestTimeoutMs ?? 30_000)),
      ),
    );
    this.circuitBreakerFailureThreshold = Math.max(1, Math.trunc(options.circuitBreakerFailureThreshold ?? 3));
    this.circuitBreakerResetMs = Math.max(1, Math.trunc(options.circuitBreakerResetMs ?? 30_000));
    // R12-12: Initialize adapter registry with default adapters or provided one
    this.adapterRegistry = adapterRegistry ?? this.createDefaultRegistry();
  }

  /**
   * Creates the default adapter registry with built-in adapters.
   * R12-12: This replaces the hardcoded switch statement.
   */
  private createDefaultRegistry(): ChannelAdapterRegistry {
    const registry = new ChannelAdapterRegistry();

    // R12-12: Register built-in adapters that delegate to internal methods
    registry.register(new TelegramChannelAdapter(
      (targetId, externalTargetId, text) => this.sendTelegramMessage(targetId, externalTargetId, text)
    ));
    registry.register(new SlackChannelAdapter(
      (targetId, externalTargetId, text) => this.sendSlackMessage(targetId, externalTargetId, text)
    ));
    registry.register(new WebhookChannelAdapter(
      (targetId, externalTargetId, text, metadata) => this.sendWebhookMessage(targetId, externalTargetId, text, metadata)
    ));

    return registry;
  }

  /**
   * Gets the adapter registry for custom adapter registration.
   * R12-12: Allows external code to register additional adapters.
   */
  public getAdapterRegistry(): ChannelAdapterRegistry {
    return this.adapterRegistry;
  }

  /**
   * Returns the configured delivery service, if any.
   * Used by retry executors to access delivery tracking.
   */
  public getDeliveryService(): ChannelGatewayDeliveryService | undefined {
    return this.options.deliveryService;
  }

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
  public async sendMessage(input: SendGatewayMessageInput): Promise<GatewayDeliveryReceipt> {
    const text = requireNonEmpty(input.text, "gateway.invalid_text");

    // Resolve target: direct by ID or via directory query
    const resolution = input.targetId != null
      ? this.resolveByTargetId(input.targetId)
      : this.targetDirectory.resolveTarget({
        query: requireNonEmpty(input.query ?? "", "gateway.target_query_required"),
        ...(input.channel ? { channel: input.channel } : {}),
      });

    // Get target record and channel
    const target = this.store.getGatewayTarget(resolution.entry.targetId);
    const channel = input.channel ?? resolution.entry.channel;

    // Verify channel matches if explicitly specified
    if (channel !== resolution.entry.channel) {
      throw new ValidationError("gateway.channel_target_mismatch", "gateway.channel_target_mismatch", {
        retryable: false,
        details: {
          requestedChannel: channel,
          resolvedChannel: resolution.entry.channel,
          targetId: resolution.entry.targetId,
        },
      });
    }

    const deliveryService = this.options.deliveryService;

    // Merge metadata for webhook channel (target metadata + input metadata)
    const metadata = channel === "webhook"
      ? {
        ...parseMetadata(target?.metadataJson ?? null),
        ...(input.metadata ?? {}),
      }
      : undefined;
    const requestEnvelope = channel === "webhook"
      ? normalizeWebhookRequestEnvelope(metadata)
      : undefined;

    // Check rate limits before attempting delivery
    this.enforceRateLimit(channel, deliveryService);

    // Create delivery tracking record if delivery service is configured
    const trackedMessageId = deliveryService != null
      ? deliveryService.createDeliveryMessage(
        channel,
        resolution.entry.targetId,
        {
          targetId: resolution.entry.targetId,
          text,
          ...(metadata != null && Object.keys(metadata).length > 0 ? { metadata } : {}),
          ...(requestEnvelope != null ? { requestEnvelope } : {}),
        },
      ).messageId
      : null;

    try {
      // Build delivery input and send to provider
      const deliveryInput: {
        channel: string;
        targetId: string;
        externalTargetId: string | null;
        text: string;
        metadata?: Record<string, unknown>;
      } = {
        channel,
        targetId: resolution.entry.targetId,
        externalTargetId: resolution.entry.externalTargetId,
        text,
      };
      if (metadata != null) {
        deliveryInput.metadata = metadata;
      }

      const deliveryReceipt = await this.deliverResolvedTarget(deliveryInput);

      // Record success in delivery tracking
      if (deliveryService != null) {
        this.recordSuccessfulDelivery(channel, trackedMessageId, deliveryReceipt, deliveryService);
      }
      return deliveryReceipt;
    } catch (error) {
      // Record failure in delivery tracking before rethrowing
      if (deliveryService != null && trackedMessageId != null) {
        this.recordFailedDelivery(trackedMessageId, channel, resolution.entry.targetId, deliveryService, error);
      }
      throw error;
    }
  }

  /**
   * Processes pending messages in the retry queue.
   *
   * This is called periodically by ChannelGatewayRetryExecutor to attempt
   * delivery of messages that previously failed with retryable errors.
   *
   * @param limit - Maximum messages to process in this pass
   * @returns Summary of processing results
   */
  public async processRetryQueue(limit = 100): Promise<GatewayRetryQueueSummary> {
    const deliveryService = this.options.deliveryService;
    if (deliveryService == null) {
      return {
        scanned: 0,
        delivered: 0,
        retryScheduled: 0,
        deadLettered: 0,
        skippedRateLimited: 0,
      };
    }

    // Fetch messages eligible for retry
    const queuedMessages = deliveryService.getRetryableMessages(limit);
    const summary: GatewayRetryQueueSummary = {
      scanned: queuedMessages.length,
      delivered: 0,
      retryScheduled: 0,
      deadLettered: 0,
      skippedRateLimited: 0,
    };

    for (const queuedMessage of queuedMessages) {
      // Check rate limit before retrying
      const rateLimit = deliveryService.checkRateLimit(queuedMessage.channel);
      if (!rateLimit.allowed) {
        summary.skippedRateLimited += 1;
        continue;
      }

      // Validate payload can be reconstructed
      const trackedPayload = readTrackedDeliveryPayload(queuedMessage.payload);
      if (trackedPayload == null) {
        const resolution = deliveryService.recordDeliveryFailure(queuedMessage.messageId, {
          retryable: false,
          errorMessage: "gateway.retry_payload_invalid",
        });
        if (resolution?.outcome === "dead_lettered") {
          summary.deadLettered += 1;
        }
        continue;
      }

      try {
        // Re-resolve target and attempt delivery
        const target = this.resolveByTargetId(trackedPayload.targetId);
        const deliveryInput: {
          channel: string;
          targetId: string;
          externalTargetId: string | null;
          text: string;
          metadata?: Record<string, unknown>;
        } = {
          channel: queuedMessage.channel,
          targetId: target.entry.targetId,
          externalTargetId: target.entry.externalTargetId,
          text: trackedPayload.text,
        };
        if (queuedMessage.channel === "webhook") {
          deliveryInput.metadata = trackedPayload.metadata ?? {};
          if (trackedPayload.requestEnvelope != null && deliveryInput.metadata.requestEnvelope == null) {
            deliveryInput.metadata.requestEnvelope = trackedPayload.requestEnvelope;
          }
        }
        const receipt = await this.deliverResolvedTarget(deliveryInput);
        this.recordSuccessfulDelivery(queuedMessage.channel, queuedMessage.messageId, receipt, deliveryService);
        summary.delivered += 1;
      } catch (error) {
        const outcome = this.recordFailedDelivery(
          queuedMessage.messageId,
          queuedMessage.channel,
          trackedPayload.targetId,
          deliveryService,
          error,
        );
        if (outcome === "retry_scheduled") {
          summary.retryScheduled += 1;
        } else if (outcome === "dead_lettered") {
          summary.deadLettered += 1;
        }
      }
    }

    return summary;
  }

  /**
   * Enforces rate limiting for a channel before message delivery.
   * Throws GatewayRateLimitError if the channel is currently over its limit.
   *
   * @param channel - Channel to check
   * @param deliveryService - Delivery service with rate limit config (optional)
   */
  private enforceRateLimit(
    channel: string,
    deliveryService: ChannelGatewayDeliveryService | undefined,
  ): void {
    if (deliveryService == null) {
      return;
    }
    const result = deliveryService.checkRateLimit(channel);
    if (!result.allowed) {
      throw new GatewayRateLimitError(
        channel,
        result.retryAfterMs ?? result.windowMs,
        result.limit,
        result.currentCount,
      );
    }
  }

  /**
   * Records successful delivery in the delivery tracking service.
   * Updates rate limit counters and marks the message as delivered.
   *
   * @param channel - Channel the message was delivered to
   * @param messageId - Tracking ID for the message (null if tracking disabled)
   * @param receipt - Delivery receipt from the provider
   * @param deliveryService - Service for recording delivery
   */
  private recordSuccessfulDelivery(
    channel: string,
    messageId: string | null,
    receipt: GatewayDeliveryReceipt,
    deliveryService: ChannelGatewayDeliveryService,
  ): void {
    // Record rate limit hit to maintain accurate counters
    try {
      deliveryService.recordRateLimitHit(channel);
    } catch (error) {
      this.logger.log({
        level: "warn",
        message: "Gateway rate limit accounting failed",
        data: {
          channel,
          targetId: receipt.targetId,
          error: error instanceof Error ? error.message : String(error),
        } as Record<string, unknown>,
      });
    }
    if (messageId == null) {
      return;
    }
    // Record successful delivery with provider response
    try {
      deliveryService.recordDeliverySuccess(messageId, receipt.responseStatus, receipt.providerMessageId);
    } catch (error) {
      this.logger.log({
        level: "warn",
        message: "Gateway delivery tracking failed",
        data: {
          channel: receipt.channel,
          targetId: receipt.targetId,
          error: error instanceof Error ? error.message : String(error),
        } as Record<string, unknown>,
      });
    }
  }

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
  private recordFailedDelivery(
    messageId: string,
    channel: string,
    targetId: string,
    deliveryService: ChannelGatewayDeliveryService,
    error: unknown,
  ): "retry_scheduled" | "dead_lettered" | null {
    const normalized = normalizeGatewayDeliveryFailure(error, deliveryService);
    try {
      const resolution = deliveryService.recordDeliveryFailure(messageId, normalized);
      if (resolution?.outcome === "dead_lettered") {
        this.logger.log({
          level: "warn",
          message: "Gateway delivery escalated to dead letter",
          data: {
            channel,
            targetId,
            messageId,
            error: normalized.errorMessage ?? null,
            responseStatus: normalized.responseStatus ?? null,
          } as Record<string, unknown>,
        });
      }
      return resolution?.outcome ?? null;
    } catch (trackingError) {
      this.logger.log({
        level: "warn",
        message: "Gateway delivery failure tracking failed",
        data: {
          channel,
          targetId,
          messageId,
          error: trackingError instanceof Error ? trackingError.message : String(trackingError),
        } as Record<string, unknown>,
      });
      return null;
    }
  }

  /**
   * Routes delivery to the appropriate channel-specific method.
   * R12-12: Uses adapter registry for pluggable channel support.
   *
   * @param input - Delivery input with channel, target, and message details
   * @returns Delivery receipt from the channel provider
   */
  private async deliverResolvedTarget(input: {
    channel: string;
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.executeProtectedDelivery(input.channel, async () => {
      // R12-12: Try adapter registry first for pluggable adapters
      const adapter = this.adapterRegistry.get(input.channel);
      if (adapter) {
        return adapter.sendMessage({
          targetId: input.targetId,
          externalTargetId: input.externalTargetId,
          text: input.text,
          metadata: input.metadata ?? {},
        });
      }

      // Fall back to built-in adapters for backward compatibility
      switch (input.channel) {
        case "telegram":
          return this.sendTelegramMessage(input.targetId, input.externalTargetId, input.text);
        case "slack":
          return this.sendSlackMessage(input.targetId, input.externalTargetId, input.text);
        case "webhook":
          return this.sendWebhookMessage(input.targetId, input.externalTargetId, input.text, input.metadata ?? {});
        default:
          throw new ValidationError(`gateway.unsupported_channel:${input.channel}`, `gateway.unsupported_channel:${input.channel}`, {
            retryable: false,
            details: { channel: input.channel },
          });
      }
    });
  }

  private async executeProtectedDelivery<T>(channel: string, operation: () => Promise<T>): Promise<T> {
    this.assertCircuitClosed(channel);
    try {
      const result = await operation();
      this.resetCircuitBreaker(channel);
      return result;
    } catch (error) {
      this.recordCircuitBreakerFailure(channel, error);
      throw error;
    }
  }

  private assertCircuitClosed(channel: string): void {
    const state = this.circuitBreakerState.get(channel);
    if (state?.openUntil != null && state.openUntil > Date.now()) {
      throw new GatewayDeliveryError(`gateway.${channel}_circuit_open`, 503, true);
    }
    if (state?.openUntil != null && state.openUntil <= Date.now()) {
      this.circuitBreakerState.set(channel, { failureCount: 0, openUntil: null });
    }
  }

  private resetCircuitBreaker(channel: string): void {
    this.circuitBreakerState.set(channel, { failureCount: 0, openUntil: null });
  }

  private recordCircuitBreakerFailure(channel: string, error: unknown): void {
    const retryable = error instanceof GatewayDeliveryError ? error.retryable : true;
    if (!retryable) {
      return;
    }
    const previous = this.circuitBreakerState.get(channel) ?? { failureCount: 0, openUntil: null };
    const failureCount = previous.failureCount + 1;
    this.circuitBreakerState.set(channel, {
      failureCount,
      openUntil: failureCount >= this.circuitBreakerFailureThreshold ? Date.now() + this.circuitBreakerResetMs : null,
    });
  }

  private async fetchWithTimeout(input: string, init: RequestInit, timeoutCode: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new GatewayDeliveryError(timeoutCode, 504, true);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolves a target by its internal ID directly from the store.
   * Used for direct target ID sends (bypasses directory search).
   *
   * @param targetId - Internal target identifier
   * @returns Target resolution with entry and match type
   * @throws StorageError if target not found
   */
  private resolveByTargetId(targetId: string) {
    const record = this.store.getGatewayTarget(targetId);
    if (record == null) {
      throw new StorageError(`gateway.target_not_found:${targetId}`, `gateway.target_not_found:${targetId}`, {
        statusCode: 404,
        retryable: false,
        details: { targetId },
      });
    }
    return {
      entry: {
        targetId: record.targetId,
        channel: record.channel,
        targetKind: record.targetKind,
        source: record.source,
        displayName: record.displayName,
        aliases: [],
        externalTargetId: record.externalTargetId,
        sessionId: null,
        taskId: null,
        lastSeenAt: record.lastSeenAt,
        latestMessagePreview: null,
      },
      matchedBy: "target_id_exact" as const,
    };
  }

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
  private async sendTelegramMessage(
    targetId: string,
    externalTargetId: string | null,
    text: string,
  ): Promise<GatewayDeliveryReceipt> {
    const config = this.options.telegram;
    if (config == null) {
      throw new PolicyDeniedError("gateway.telegram_not_configured", "gateway.telegram_not_configured", {
        retryable: false,
      });
    }
    const chatId = requireNonEmpty(externalTargetId ?? "", "gateway.invalid_telegram_target");
    const requestUrl = parseSafeOutboundUrl(
      `${config.baseUrl ?? TELEGRAM_API_URL}/bot${config.botToken}/sendMessage`,
      {
        invalid: "gateway.telegram_url_invalid",
        blocked: "gateway.telegram_url_blocked",
      },
    ).toString();
    const response = await this.fetchWithTimeout(requestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }, "gateway.telegram_timeout");
    if (!response.ok) {
      throw new GatewayDeliveryError(`gateway.telegram_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    const body = await response.json() as { result?: { message_id?: number | string } };
    return {
      deliveredAt: nowIso(),
      channel: "telegram",
      targetId,
      externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(requestUrl),
      responseStatus: response.status,
      providerMessageId: body.result?.message_id != null ? String(body.result.message_id) : null,
    };
  }

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
  private async sendSlackMessage(
    targetId: string,
    externalTargetId: string | null,
    text: string,
  ): Promise<GatewayDeliveryReceipt> {
    const config = this.options.slack;
    if (config == null) {
      throw new PolicyDeniedError("gateway.slack_not_configured", "gateway.slack_not_configured", {
        retryable: false,
      });
    }
    const channelId = requireNonEmpty(externalTargetId ?? "", "gateway.invalid_slack_target");
    const requestUrl = parseSafeOutboundUrl(
      `${config.baseUrl ?? SLACK_API_URL}/chat.postMessage`,
      {
        invalid: "gateway.slack_url_invalid",
        blocked: "gateway.slack_url_blocked",
      },
    ).toString();
    const response = await this.fetchWithTimeout(requestUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.botToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text,
      }),
    }, "gateway.slack_timeout");
    if (!response.ok) {
      throw new GatewayDeliveryError(`gateway.slack_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    const body = await response.json() as { ok?: boolean; ts?: string };
    if (body.ok !== true) {
      throw new GatewayDeliveryError("gateway.slack_delivery_failed:provider_rejected", response.status, false);
    }
    return {
      deliveredAt: nowIso(),
      channel: "slack",
      targetId,
      externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(requestUrl),
      responseStatus: response.status,
      providerMessageId: body.ts ?? null,
    };
  }

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
  private async sendWebhookMessage(
    targetId: string,
    externalTargetId: string | null,
    text: string,
    metadata: Record<string, unknown>,
  ): Promise<GatewayDeliveryReceipt> {
    const requestUrl = typeof metadata.webhookUrl === "string" && metadata.webhookUrl.trim().length > 0
      ? metadata.webhookUrl.trim()
      : (externalTargetId?.startsWith("http://") || externalTargetId?.startsWith("https://") ? externalTargetId : null);
    if (requestUrl == null) {
      throw new ValidationError("gateway.webhook_url_required", "gateway.webhook_url_required", {
        retryable: false,
        details: { targetId, externalTargetId },
      });
    }

    const validatedRequestUrl = parseSafeOutboundUrl(requestUrl, {
      invalid: "gateway.webhook_url_invalid",
      blocked: "gateway.webhook_url_blocked_ssrf",
    }).toString();

    const response = await this.fetchWithTimeout(validatedRequestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.webhook?.defaultHeaders ?? {}),
      },
      body: JSON.stringify({
        targetId,
        text,
        metadata,
        ...(normalizeWebhookRequestEnvelope(metadata) != null
          ? { requestEnvelope: normalizeWebhookRequestEnvelope(metadata) }
          : {}),
      }),
    }, "gateway.webhook_timeout");
    if (!response.ok) {
      throw new GatewayDeliveryError(`gateway.webhook_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    return {
      deliveredAt: nowIso(),
      channel: "webhook",
      targetId,
      externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(validatedRequestUrl),
      responseStatus: response.status,
      providerMessageId: null,
    };
  }
}
