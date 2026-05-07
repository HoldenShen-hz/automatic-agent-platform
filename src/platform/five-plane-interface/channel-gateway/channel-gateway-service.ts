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
 * Circuit breaker states per §9.1/§7.1.
 */
type CircuitBreakerState = "closed" | "open" | "half_open";

/**
 * Circuit breaker configuration for external provider calls.
 */
interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before attempting half-open */
  resetTimeoutMs: number;
  /** Whether circuit breaker is enabled */
  enabled?: boolean;
}

/**
 * Circuit breaker for external HTTP provider calls.
 * Prevents cascading failures when external providers are unavailable.
 */
class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private consecutiveFailures: number = 0;
  private nextAttemptAt: number | null = null;

  constructor(private readonly config: CircuitBreakerConfig) {}

  /**
   * Check if the circuit allows the request to proceed.
   * @returns true if request should proceed, false if circuit is open
   */
  public isRequestAllowed(): boolean {
    if (this.config.enabled === false) {
      return true;
    }
    if (this.state === "closed") {
      return true;
    }
    if (this.state === "open") {
      if (this.nextAttemptAt != null && Date.now() >= this.nextAttemptAt) {
        this.state = "half_open";
        return true;
      }
      return false;
    }
    // half_open state - allow single request to test
    return true;
  }

  /**
   * Record a successful request - resets the circuit to closed.
   */
  public recordSuccess(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.nextAttemptAt = null;
  }

  /**
   * Record a failed request - may open the circuit.
   */
  public recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "open";
      this.nextAttemptAt = Date.now() + this.config.resetTimeoutMs;
    }
  }

  /**
   * Get current circuit state for observability.
   */
  public getState(): CircuitBreakerState {
    return this.state;
  }
}

/**
 * Default circuit breaker configuration per §9.1.
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000, // 30 seconds
  enabled: true,
};

/**
 * Channel adapter interface for pluggable protocol support.
 * Each adapter handles the specifics of sending messages via a particular channel.
 */
export interface ChannelAdapter {
  /** The channel name this adapter handles (e.g., "telegram", "slack", "webhook") */
  readonly channel: string;

  /**
   * Sends a message via this channel.
   *
   * @param input - Delivery input with channel, target, and message details
   * @returns Delivery receipt from the channel provider
   * @throws PolicyDeniedError if channel is not configured
   * @throws GatewayDeliveryError if provider rejects the message
   */
  send(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
    fetchImpl: FetchLike;
    options: ChannelGatewayServiceOptions;
  }): Promise<GatewayDeliveryReceipt>;
}

/**
 * Registry for channel adapters.
 * Supports pluggable protocol adapters as required by §6.
 */
export class ChannelAdapterRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  /**
   * Registers a channel adapter.
   *
   * @param adapter - The adapter to register
   * @throws Error if an adapter for this channel is already registered
   */
  register(adapter: ChannelAdapter): void {
    if (this.adapters.has(adapter.channel)) {
      throw new Error(`channel_adapter.already_registered:${adapter.channel}`);
    }
    this.adapters.set(adapter.channel, adapter);
  }

  /**
   * Gets an adapter for a channel.
   *
   * @param channel - The channel name
   * @returns The adapter, or undefined if not registered
   */
  get(channel: string): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  /**
   * Checks if an adapter is registered for a channel.
   */
  has(channel: string): boolean {
    return this.adapters.has(channel);
  }

  /**
   * Returns all registered channel names.
   */
  registeredChannels(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Telegram channel adapter.
 */
class TelegramChannelAdapter implements ChannelAdapter {
  readonly channel = "telegram";
  private readonly circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

  async send(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
    fetchImpl: FetchLike;
    options: ChannelGatewayServiceOptions;
  }): Promise<GatewayDeliveryReceipt> {
    if (!this.circuitBreaker.isRequestAllowed()) {
      throw new GatewayDeliveryError("gateway.telegram_circuit_open", 503, true);
    }
    const config = input.options.telegram;
    if (config == null) {
      throw new PolicyDeniedError("gateway.telegram_not_configured", "gateway.telegram_not_configured", {
        retryable: false,
      });
    }
    const chatId = requireNonEmpty(input.externalTargetId ?? "", "gateway.invalid_telegram_target");
    const requestUrl = parseSafeOutboundUrl(
      `${config.baseUrl ?? TELEGRAM_API_URL}/bot${config.botToken}/sendMessage`,
      {
        invalid: "gateway.telegram_url_invalid",
        blocked: "gateway.telegram_url_blocked",
      },
    ).toString();
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await input.fetchImpl(requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: input.text,
        }),
      });
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
    if (!response.ok) {
      this.circuitBreaker.recordFailure();
      throw new GatewayDeliveryError(`gateway.telegram_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    this.circuitBreaker.recordSuccess();
    const body = await response.json() as { result?: { message_id?: number | string } };
    return {
      deliveredAt: nowIso(),
      channel: "telegram",
      targetId: input.targetId,
      externalTargetId: input.externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(requestUrl),
      responseStatus: response.status,
      providerMessageId: body.result?.message_id != null ? String(body.result.message_id) : null,
    };
  }
}

/**
 * Slack channel adapter.
 */
class SlackChannelAdapter implements ChannelAdapter {
  readonly channel = "slack";
  private readonly circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

  async send(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
    fetchImpl: FetchLike;
    options: ChannelGatewayServiceOptions;
  }): Promise<GatewayDeliveryReceipt> {
    if (!this.circuitBreaker.isRequestAllowed()) {
      throw new GatewayDeliveryError("gateway.slack_circuit_open", 503, true);
    }
    const config = input.options.slack;
    if (config == null) {
      throw new PolicyDeniedError("gateway.slack_not_configured", "gateway.slack_not_configured", {
        retryable: false,
      });
    }
    const channelId = requireNonEmpty(input.externalTargetId ?? "", "gateway.invalid_slack_target");
    const requestUrl = parseSafeOutboundUrl(
      `${config.baseUrl ?? SLACK_API_URL}/chat.postMessage`,
      {
        invalid: "gateway.slack_url_invalid",
        blocked: "gateway.slack_url_blocked",
      },
    ).toString();
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await input.fetchImpl(requestUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.botToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel: channelId,
          text: input.text,
        }),
      });
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
    if (!response.ok) {
      this.circuitBreaker.recordFailure();
      throw new GatewayDeliveryError(`gateway.slack_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    this.circuitBreaker.recordSuccess();
    const body = await response.json() as { ok?: boolean; ts?: string };
    if (body.ok !== true) {
      throw new GatewayDeliveryError("gateway.slack_delivery_failed:provider_rejected", response.status, false);
    }
    return {
      deliveredAt: nowIso(),
      channel: "slack",
      targetId: input.targetId,
      externalTargetId: input.externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(requestUrl),
      responseStatus: response.status,
      providerMessageId: body.ts ?? null,
    };
  }
}

/**
 * Webhook channel adapter.
 */
class WebhookChannelAdapter implements ChannelAdapter {
  readonly channel = "webhook";
  private readonly circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

  async send(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
    fetchImpl: FetchLike;
    options: ChannelGatewayServiceOptions;
  }): Promise<GatewayDeliveryReceipt> {
    if (!this.circuitBreaker.isRequestAllowed()) {
      throw new GatewayDeliveryError("gateway.webhook_circuit_open", 503, true);
    }
    const requestUrl = typeof input.metadata?.webhookUrl === "string" && input.metadata.webhookUrl.trim().length > 0
      ? input.metadata.webhookUrl.trim()
      : (input.externalTargetId?.startsWith("http://") || input.externalTargetId?.startsWith("https://") ? input.externalTargetId : null);
    if (requestUrl == null) {
      throw new ValidationError("gateway.webhook_url_required", "gateway.webhook_url_required", {
        retryable: false,
        details: { targetId: input.targetId, externalTargetId: input.externalTargetId },
      });
    }

    const validatedRequestUrl = parseSafeOutboundUrl(requestUrl, {
      invalid: "gateway.webhook_url_invalid",
      blocked: "gateway.webhook_url_blocked_ssrf",
    }).toString();

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await input.fetchImpl(validatedRequestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(input.options.webhook?.defaultHeaders ?? {}),
        },
        body: JSON.stringify({
          targetId: input.targetId,
          text: input.text,
          metadata: input.metadata,
        }),
      });
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
    if (!response.ok) {
      this.circuitBreaker.recordFailure();
      throw new GatewayDeliveryError(`gateway.webhook_delivery_failed:${response.status}`, response.status, response.status >= 500 || response.status === 429 || response.status === 408);
    }
    this.circuitBreaker.recordSuccess();
    return {
      deliveredAt: nowIso(),
      channel: "webhook",
      targetId: input.targetId,
      externalTargetId: input.externalTargetId,
      requestUrl: sanitizeUrlForTelemetry(validatedRequestUrl),
      responseStatus: response.status,
      providerMessageId: null,
    };
  }
}

/**
 * Creates a new channel adapter registry with built-in adapters registered.
 */
export function createDefaultChannelAdapterRegistry(): ChannelAdapterRegistry {
  const registry = new ChannelAdapterRegistry();
  registry.register(new TelegramChannelAdapter());
  registry.register(new SlackChannelAdapter());
  registry.register(new WebhookChannelAdapter());
  return registry;
}

/**
 * Central service for sending messages through channel gateways (Telegram, Slack, webhooks).
 *
 * This service handles:
 * - Target resolution (by ID or directory query)
 * - Rate limit enforcement per channel
 * - Delivery tracking and retry queue processing
 * - Channel-specific message formatting and API calls via pluggable adapters
 *
 * It delegates to ChannelGatewayDeliveryService for tracking when available,
 * which provides retry logic, dead letter handling, and delivery receipts.
 *
 * Supports pluggable protocol adapters as required by §6. The service uses a
 * ChannelAdapterRegistry to look up the appropriate adapter for each channel,
 * allowing new protocols to be added without modifying the core service.
 */
export class ChannelGatewayService {
  private readonly fetchImpl: FetchLike;
  private readonly logger = new StructuredLogger({ retentionLimit: 100 });
  private readonly adapterRegistry: ChannelAdapterRegistry;
  /** §7.1: Default fetch timeout (5s per §7.1) */
  private static readonly DEFAULT_FETCH_TIMEOUT_MS = 5_000;
  /** §7.1: Maximum fetch timeout (30s max per §7.1) */
  private static readonly MAX_FETCH_TIMEOUT_MS = 30_000;

  public constructor(
    /** Storage port for target lookups */
    private readonly store: GatewayStoragePort,
    /** Service for resolving targets by query string */
    private readonly targetDirectory: GatewayTargetDirectoryService,
    /** Optional configuration for channel gateways */
    private readonly options: ChannelGatewayServiceOptions = {},
    /** Optional custom adapter registry (defaults to built-in adapters) */
    adapterRegistry?: ChannelAdapterRegistry,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.adapterRegistry = adapterRegistry ?? createDefaultChannelAdapterRegistry();
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

    // Build metadata for all channels - each adapter decides if it needs specific fields
    // This supports the pluggable adapter pattern per §6
    const metadata = {
      ...parseMetadata(target?.metadataJson ?? null),
      ...(input.metadata ?? {}),
    };

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
      if (Object.keys(metadata).length > 0) {
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
      const rateLimit = deliveryService.checkRateLimit(undefined, queuedMessage.channel);
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
        // Always pass metadata if available - adapter decides if it needs specific fields
        // This supports the pluggable adapter pattern per §6
        if (trackedPayload.metadata != null && Object.keys(trackedPayload.metadata).length > 0) {
          deliveryInput.metadata = trackedPayload.metadata;
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
    const result = deliveryService.checkRateLimit(undefined, channel);
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
      deliveryService.recordRateLimitHit(undefined, channel);
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
   * Routes delivery to the appropriate channel adapter.
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
    const adapter = this.adapterRegistry.get(input.channel);
    if (adapter == null) {
      throw new ValidationError(`gateway.unsupported_channel:${input.channel}`, `gateway.unsupported_channel:${input.channel}`, {
        retryable: false,
        details: { channel: input.channel },
      });
    }
    return adapter.send({
      targetId: input.targetId,
      externalTargetId: input.externalTargetId,
      text: input.text,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      fetchImpl: this.createTimedFetch(),
      options: this.options,
    });
  }

  /**
   * Creates a fetch implementation with §7.1 timeout (default 5s, max 30s).
   * Wraps the stored fetchImpl with an AbortController timeout.
   */
  private createTimedFetch(): FetchLike {
    const timeout = ChannelGatewayService.MAX_FETCH_TIMEOUT_MS;
    return (url: URL | string | Request, init?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        return this.fetchImpl(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };
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
}
