import { runtimeMetricsRegistry } from "./runtime-metrics-registry.js";
import { StructuredLogger } from "./structured-logger.js";
import type {
  AlertChannelKind,
  AlertEvent,
  SloStatus,
} from "./slo-alerting/types.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

function recordAlertDeliveryFailure(channel: AlertChannelKind, alertId: string, error: unknown): void {
  runtimeMetricsRegistry.incrementCounter("alert_delivery_failures_total", { channel }, 1);
  logger.error("alert.delivery_failed", {
    alertId,
    channel,
    error: error instanceof Error ? error.message : String(error),
  });
}

export interface AlertDeliveryResult {
  channelKind: AlertChannelKind;
  delivered: boolean;
  error: string | null;
}

export interface AlertChannel {
  readonly kind: AlertChannelKind;
  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}

export interface ErrorBudgetDegradationResult {
  degraded: boolean;
  sloId: string;
  sloStatus: SloStatus;
  rolloutFrozen: boolean;
  alertFired: boolean;
  alertId: string | null;
  gradientLevel: "none" | "degrade" | "freeze" | "full_freeze";
  errorBudgetBurnPercent: number | null;
}

export interface BurnRateAlertResult {
  sloId: string;
  burnRate1h: number | null;
  burnRate6h: number | null;
  alertSeverity: "SEV2" | "SEV3" | null;
  alertFired: boolean;
  alertId: string | null;
}

export class LogAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "log";
  private readonly deliveredEvents: AlertEvent[] = [];

  deliver(event: AlertEvent): AlertDeliveryResult {
    this.deliveredEvents.push(event);
    return { channelKind: "log", delivered: true, error: null };
  }

  getDelivered(): AlertEvent[] {
    return [...this.deliveredEvents];
  }
}

type FetchLike = typeof fetch;

export interface WebhookAlertChannelOptions {
  fetchImpl?: FetchLike;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export class WebhookAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "webhook";
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: WebhookAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const url = typeof config.url === "string" ? config.url.trim() : "";
    if (!url) {
      return { channelKind: "webhook", delivered: false, error: "missing webhook url" };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.defaultHeaders,
      ...(config.headers as Record<string, string> | undefined),
    };

    const body = JSON.stringify({
      id: event.id,
      ruleId: event.ruleId,
      severity: event.severity,
      status: event.status,
      title: event.title,
      detail: event.detail,
      channelKind: event.channelKind,
      deliveredAt: event.deliveredAt,
      acknowledgedBy: event.acknowledgedBy,
      resolvedAt: event.resolvedAt,
      firedAt: event.firedAt,
    });

    this.fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("webhook", event.id, err);
    });

    return { channelKind: "webhook", delivered: true, error: null };
  }
}

export interface SlackAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export class SlackAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "slack";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: SlackAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const webhookUrl = typeof config.webhookUrl === "string" ? config.webhookUrl.trim() : "";
    if (!webhookUrl) {
      return { channelKind: "slack", delivered: false, error: "missing slack webhook url" };
    }

    const payload = {
      text: `[${event.severity.toUpperCase()}] ${event.title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${event.title}*\n${event.detail}`,
          },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `rule: \`${event.ruleId}\`` },
            { type: "mrkdwn", text: `severity: \`${event.severity}\`` },
            { type: "mrkdwn", text: `status: \`${event.status}\`` },
          ],
        },
      ],
    };

    this.fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("slack", event.id, err);
    });

    return { channelKind: "slack", delivered: true, error: null };
  }
}

export interface PagerDutyAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

const PAGERDUTY_DEFAULT_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";

export class PagerDutyAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "pagerduty";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly pagerdutyEndpoint: string;

  constructor(options: PagerDutyAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.pagerdutyEndpoint = options.endpoint ?? process.env.PAGERDUTY_API_URL ?? PAGERDUTY_DEFAULT_ENDPOINT;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const routingKey = typeof config.routingKey === "string" ? config.routingKey.trim() : "";
    if (!routingKey) {
      return { channelKind: "pagerduty", delivered: false, error: "missing pagerduty routing key" };
    }
    const dedupKey = typeof config.dedupKey === "string" && config.dedupKey.trim().length > 0
      ? config.dedupKey.trim()
      : `${event.ruleId}:${event.id}`;

    const payload = {
      routing_key: routingKey,
      event_action: event.status === "resolved" ? "resolve" : "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: event.title,
        severity: event.severity === "page" ? "critical" : event.severity,
        source: "automatic-agent",
        custom_details: {
          ruleId: event.ruleId,
          detail: event.detail,
          status: event.status,
          firedAt: event.firedAt,
        },
      },
    };

    this.fetchImpl(this.pagerdutyEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("pagerduty", event.id, err);
    });

    return { channelKind: "pagerduty", delivered: true, error: null };
  }
}

export interface OpsGenieAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

export class OpsGenieAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "opsgenie";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(options: OpsGenieAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.endpoint = options.endpoint ?? "https://api.opsgenie.com/v2/alerts";
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
    if (!apiKey) {
      return { channelKind: "opsgenie", delivered: false, error: "missing opsgenie api key" };
    }
    const priority = event.severity === "critical" || event.severity === "page"
      ? "P1"
      : event.severity === "warning"
        ? "P3"
        : "P5";
    const payload = {
      message: event.title,
      description: event.detail,
      alias: `${event.ruleId}:${event.id}`,
      priority,
      source: "automatic-agent",
      tags: ["automatic-agent", event.severity, event.status],
      details: {
        ruleId: event.ruleId,
        firedAt: event.firedAt,
        status: event.status,
      },
    };

    this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `GenieKey ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("opsgenie", event.id, err);
    });

    return { channelKind: "opsgenie", delivered: true, error: null };
  }
}

export class EmailAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "email";
  private readonly deliveredEvents: AlertEvent[] = [];

  deliver(event: AlertEvent): AlertDeliveryResult {
    this.deliveredEvents.push(event);
    return { channelKind: "email", delivered: true, error: null };
  }

  getDelivered(): AlertEvent[] {
    return [...this.deliveredEvents];
  }
}
