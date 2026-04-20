export type FetchLike = typeof fetch;

/**
 * Configuration for the Telegram gateway channel.
 * @see https://core.telegram.org/bots/api
 */
export interface TelegramGatewayConfig {
  /** Bot token obtained from @BotFather */
  botToken: string;
  /** Optional custom API base URL for Telegram (defaults to official API) */
  baseUrl?: string;
}

/**
 * Configuration for the Slack gateway channel.
 * @see https://api.slack.com/methods/chat.postMessage
 */
export interface SlackGatewayConfig {
  /** OAuth bot token with chat:write scope */
  botToken: string;
  /** Optional custom API base URL for Slack (defaults to official API) */
  baseUrl?: string;
}

/**
 * Configuration for the webhook gateway channel.
 * Webhooks are used for sending messages to arbitrary HTTP endpoints.
 */
export interface WebhookGatewayConfig {
  /** Default headers to include in all webhook requests (e.g., Authorization) */
  defaultHeaders?: Record<string, string>;
}

/**
 * Runtime options for configuring the ChannelGatewayService.
 */
export interface ChannelGatewayServiceOptions {
  /** Optional custom fetch implementation (defaults to global fetch) */
  fetchImpl?: FetchLike;
  /** Telegram channel configuration */
  telegram?: TelegramGatewayConfig;
  /** Slack channel configuration */
  slack?: SlackGatewayConfig;
  /** Webhook channel configuration */
  webhook?: WebhookGatewayConfig;
  /** Optional delivery service for tracking and retrying messages */
  deliveryService?: import("./channel-gateway-delivery-service.js").ChannelGatewayDeliveryService;
}

/**
 * Input for sending a gateway message.
 * Either targetId (direct) or query (lookup) must be provided.
 */
export interface SendGatewayMessageInput {
  /** Channel to send to (telegram, slack, webhook). If omitted, resolved from query. */
  channel?: string;
  /** Query string to lookup target in directory (used when targetId not provided) */
  query?: string;
  /** Direct target identifier (bypasses directory lookup) */
  targetId?: string;
  /** Message text to send */
  text: string;
  /** Optional metadata passed to webhook payloads */
  metadata?: Record<string, unknown> | null;
}

/**
 * Receipt confirming successful message delivery to a channel provider.
 */
export interface GatewayDeliveryReceipt {
  /** ISO timestamp when delivery was confirmed */
  deliveredAt: string;
  /** Channel type (telegram, slack, webhook) */
  channel: string;
  /** Internal target identifier */
  targetId: string;
  /** External/provider target identifier (chat ID, channel ID, webhook URL) */
  externalTargetId: string | null;
  /** Actual URL that was called (may differ from target for webhooks) */
  requestUrl: string;
  /** HTTP response status code from the provider */
  responseStatus: number;
  /** Provider-assigned message ID (Telegram message_id, Slack ts, null for webhooks) */
  providerMessageId: string | null;
}

/**
 * Summary statistics from processing the gateway retry queue.
 * Used for monitoring and alerting on delivery performance.
 */
export interface GatewayRetryQueueSummary {
  /** Total messages scanned in this pass */
  scanned: number;
  /** Messages successfully delivered */
  delivered: number;
  /** Messages scheduled for retry */
  retryScheduled: number;
  /** Messages moved to dead letter queue */
  deadLettered: number;
  /** Messages skipped due to rate limiting */
  skippedRateLimited: number;
}

/**
 * Internal payload stored with tracked delivery messages.
 * Used for reconstructing delivery attempts during retry processing.
 */
export interface TrackedGatewayDeliveryPayload {
  targetId: string;
  text: string;
  metadata?: Record<string, unknown>;
}
