import assert from "node:assert/strict";
import test from "node:test";

import {
  LogAlertChannel,
  WebhookAlertChannel,
  SlackAlertChannel,
  PagerDutyAlertChannel,
  OpsGenieAlertChannel,
  EmailAlertChannel,
  recordAlertDeliveryFailure,
  type AlertDeliveryResult,
  type AlertChannel,
  type ErrorBudgetDegradationResult,
  type BurnRateAlertResult,
  PAGERDUTY_DEFAULT_ENDPOINT,
} from "../../../../../src/platform/shared/observability/slo-alerting-channels.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";
import type { AlertEvent, AlertChannelKind } from "../../../../../src/platform/shared/observability/slo-alerting/types.js";

function createMockAlertEvent(overrides?: Partial<AlertEvent>): AlertEvent {
  return {
    id: "alert_123",
    ruleId: "rule_456",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "Test alert detail message",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-26T10:00:00.000Z",
    ...overrides,
  };
}

function getAlertDeliveryFailureCount(channel: AlertChannelKind): number {
  return runtimeMetricsRegistry
    .getCounters("alert_delivery_failures_total")
    .find((series) => series.labels.channel === channel)?.value ?? 0;
}

// LogAlertChannel tests
test("LogAlertChannel delivers event and returns success", () => {
  const channel = new LogAlertChannel();
  const event = createMockAlertEvent();

  const result = channel.deliver(event);

  assert.equal(result.channelKind, "log");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("LogAlertChannel stores delivered events", () => {
  const channel = new LogAlertChannel();
  const event1 = createMockAlertEvent({ id: "alert_1" });
  const event2 = createMockAlertEvent({ id: "alert_2" });

  channel.deliver(event1);
  channel.deliver(event2);

  const delivered = channel.getDelivered();
  assert.equal(delivered.length, 2);
  assert.equal(delivered[0].id, "alert_1");
  assert.equal(delivered[1].id, "alert_2");
});

test("LogAlertChannel getDelivered returns a copy", () => {
  const channel = new LogAlertChannel();
  channel.deliver(createMockAlertEvent());

  const delivered1 = channel.getDelivered();
  const delivered2 = channel.getDelivered();

  assert.deepStrictEqual(delivered1, delivered2);
  delivered1.push(createMockAlertEvent({ id: "extra" }));
  assert.equal(channel.getDelivered().length, 1);
});

test("LogAlertChannel kind is 'log'", () => {
  const channel = new LogAlertChannel();
  assert.equal(channel.kind, "log");
});

// EmailAlertChannel tests
test("EmailAlertChannel delivers event and returns success", () => {
  const channel = new EmailAlertChannel();
  const event = createMockAlertEvent();

  const result = channel.deliver(event);

  assert.equal(result.channelKind, "email");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("EmailAlertChannel stores delivered events", () => {
  const channel = new EmailAlertChannel();
  const event1 = createMockAlertEvent({ id: "email_1" });
  const event2 = createMockAlertEvent({ id: "email_2" });

  channel.deliver(event1);
  channel.deliver(event2);

  const delivered = channel.getDelivered();
  assert.equal(delivered.length, 2);
});

test("EmailAlertChannel kind is 'email'", () => {
  const channel = new EmailAlertChannel();
  assert.equal(channel.kind, "email");
});

// WebhookAlertChannel tests
test("WebhookAlertChannel requires url config", () => {
  const channel = new WebhookAlertChannel();
  const event = createMockAlertEvent({ channelKind: "webhook" });

  const result = channel.deliver(event, {});

  assert.equal(result.channelKind, "webhook");
  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing webhook url");
});

test("WebhookAlertChannel rejects empty url", () => {
  const channel = new WebhookAlertChannel();
  const event = createMockAlertEvent({ channelKind: "webhook" });

  const result = channel.deliver(event, { url: "   " });

  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing webhook url");
});

test("WebhookAlertChannel delivers with valid url", () => {
  const mockFetch = test.mock.fn(async () => {
    return new Response("ok");
  });
  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "webhook" });

  const result = channel.deliver(event, { url: "https://example.com/webhook" });

  assert.equal(result.channelKind, "webhook");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("WebhookAlertChannel uses custom headers", () => {
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedHeaders = init.headers as Record<string, string>;
    return new Response("ok");
  });
  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "webhook" });

  channel.deliver(event, {
    url: "https://example.com/webhook",
    headers: { "X-Custom-Header": "custom-value" },
  });

  assert.equal(receivedHeaders["X-Custom-Header"], "custom-value");
  assert.equal(receivedHeaders["content-type"], "application/json");
});

test("WebhookAlertChannel applies default headers", () => {
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedHeaders = init.headers as Record<string, string>;
    return new Response("ok");
  });
  const channel = new WebhookAlertChannel({
    fetchImpl: mockFetch,
    defaultHeaders: { "X-Default-Header": "default-value" },
  });
  const event = createMockAlertEvent({ channelKind: "webhook" });

  channel.deliver(event, { url: "https://example.com/webhook" });

  assert.equal(receivedHeaders["X-Default-Header"], "default-value");
});

test("WebhookAlertChannel uses custom timeout", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch, timeoutMs: 5000 });
  const event = createMockAlertEvent({ channelKind: "webhook" });

  channel.deliver(event, { url: "https://example.com/webhook" });

  assert.equal(mockFetch.mock.calls.length, 1);
});

test("WebhookAlertChannel trims url whitespace", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "webhook" });

  const result = channel.deliver(event, { url: "  https://example.com/webhook  " });

  assert.equal(result.delivered, true);
});

test("WebhookAlertChannel kind is 'webhook'", () => {
  const channel = new WebhookAlertChannel();
  assert.equal(channel.kind, "webhook");
});

// SlackAlertChannel tests
test("SlackAlertChannel requires webhookUrl config", () => {
  const channel = new SlackAlertChannel();
  const event = createMockAlertEvent({ channelKind: "slack" });

  const result = channel.deliver(event, {});

  assert.equal(result.channelKind, "slack");
  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing slack webhook url");
});

test("SlackAlertChannel rejects empty webhookUrl", () => {
  const channel = new SlackAlertChannel();
  const event = createMockAlertEvent({ channelKind: "slack" });

  const result = channel.deliver(event, { webhookUrl: "" });

  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing slack webhook url");
});

test("SlackAlertChannel delivers with valid webhookUrl", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "slack", severity: "critical" });

  const result = channel.deliver(event, { webhookUrl: "https://hooks.slack.com/services/abc" });

  assert.equal(result.channelKind, "slack");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("SlackAlertChannel sends correct slack payload structure", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({
    channelKind: "slack",
    title: "High CPU Alert",
    detail: "CPU usage exceeded 90%",
    severity: "warning",
  });

  channel.deliver(event, { webhookUrl: "https://hooks.slack.com/services/abc" });
  const body = JSON.parse(receivedBody);

  assert.ok(body.text.includes("[WARNING]"));
  assert.ok(body.text.includes("High CPU Alert"));
  assert.ok(body.blocks);
  assert.equal(body.blocks[0].type, "section");
});

test("SlackAlertChannel trims webhookUrl whitespace", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "slack" });

  const result = channel.deliver(event, { webhookUrl: "  https://hooks.slack.com/services/abc  " });

  assert.equal(result.delivered, true);
});

test("SlackAlertChannel kind is 'slack'", () => {
  const channel = new SlackAlertChannel();
  assert.equal(channel.kind, "slack");
});

// PagerDutyAlertChannel tests
test("PagerDutyAlertChannel requires routingKey config", () => {
  const channel = new PagerDutyAlertChannel();
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  const result = channel.deliver(event, {});

  assert.equal(result.channelKind, "pagerduty");
  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing pagerduty routing key");
});

test("PagerDutyAlertChannel rejects empty routingKey", () => {
  const channel = new PagerDutyAlertChannel();
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  const result = channel.deliver(event, { routingKey: "" });

  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing pagerduty routing key");
});

test("PagerDutyAlertChannel delivers with valid routingKey", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  const result = channel.deliver(event, { routingKey: "test_routing_key" });

  assert.equal(result.channelKind, "pagerduty");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("PagerDutyAlertChannel uses custom dedupKey when provided", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  channel.deliver(event, {
    routingKey: "test_key",
    dedupKey: "custom_dedup_123",
  });
  const body = JSON.parse(receivedBody);

  assert.equal(body.dedup_key, "custom_dedup_123");
});

test("PagerDutyAlertChannel generates dedupKey from ruleId and event id when not provided", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ ruleId: "rule_abc", id: "event_xyz", channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.dedup_key, "rule_abc:event_xyz");
});

test("PagerDutyAlertChannel resolves to trigger for firing events", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ status: "firing", channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.event_action, "trigger");
});

test("PagerDutyAlertChannel resolves to resolve for resolved events", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ status: "resolved", channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.event_action, "resolve");
});

test("PagerDutyAlertChannel maps critical/page severity to critical", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "page", channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.payload.severity, "critical");
});

test("PagerDutyAlertChannel maps warning severity correctly", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "warning", channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.payload.severity, "warning");
});

test("PagerDutyAlertChannel uses custom endpoint", () => {
  let receivedUrl = "";
  const mockFetch = test.mock.fn(async (url: string) => {
    receivedUrl = url;
    return new Response("ok");
  });
  const channel = new PagerDutyAlertChannel({
    fetchImpl: mockFetch,
    endpoint: "https://custom.endpoint.com/v2/enqueue",
  });
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  channel.deliver(event, { routingKey: "test_key" });

  assert.ok(receivedUrl.includes("custom.endpoint.com"));
});

test("PagerDutyAlertChannel PAGERDUTY_DEFAULT_ENDPOINT is correct", () => {
  assert.equal(PAGERDUTY_DEFAULT_ENDPOINT, "https://events.pagerduty.com/v2/enqueue");
});

test("PagerDutyAlertChannel kind is 'pagerduty'", () => {
  const channel = new PagerDutyAlertChannel();
  assert.equal(channel.kind, "pagerduty");
});

test("PagerDutyAlertChannel rejects invalid endpoint protocol", () => {
  const channel = new PagerDutyAlertChannel({ endpoint: "http://insecure.com" });
  const event = createMockAlertEvent({ channelKind: "pagerduty" });

  assert.throws(
    () => channel.deliver(event, { routingKey: "test_key" }),
    /pagerduty\.invalid_endpoint_protocol/,
  );
});

// OpsGenieAlertChannel tests
test("OpsGenieAlertChannel requires apiKey config", () => {
  const channel = new OpsGenieAlertChannel();
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  const result = channel.deliver(event, {});

  assert.equal(result.channelKind, "opsgenie");
  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing opsgenie api key");
});

test("OpsGenieAlertChannel rejects empty apiKey", () => {
  const channel = new OpsGenieAlertChannel();
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  const result = channel.deliver(event, { apiKey: "" });

  assert.equal(result.delivered, false);
  assert.equal(result.error, "missing opsgenie api key");
});

test("OpsGenieAlertChannel delivers with valid apiKey", () => {
  const mockFetch = test.mock.fn(async () => new Response("ok"));
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  const result = channel.deliver(event, { apiKey: "test_api_key" });

  assert.equal(result.channelKind, "opsgenie");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("OpsGenieAlertChannel maps critical/page severity to P1", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "critical", channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.priority, "P1");
});

test("OpsGenieAlertChannel maps page severity to P1", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "page", channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.priority, "P1");
});

test("OpsGenieAlertChannel maps warning severity to P3", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "warning", channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.priority, "P3");
});

test("OpsGenieAlertChannel maps info severity to P5", () => {
  let receivedBody: string = "";
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedBody = init.body as string;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ severity: "info", channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });
  const body = JSON.parse(receivedBody);

  assert.equal(body.priority, "P5");
});

test("OpsGenieAlertChannel sends authorization header with GenieKey", () => {
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = test.mock.fn(async (url: string, init: RequestInit) => {
    receivedHeaders = init.headers as Record<string, string>;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "my_secret_key" });

  assert.ok(receivedHeaders.authorization.startsWith("GenieKey "));
});

test("OpsGenieAlertChannel uses custom endpoint", () => {
  let receivedUrl = "";
  const mockFetch = test.mock.fn(async (url: string) => {
    receivedUrl = url;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({
    fetchImpl: mockFetch,
    endpoint: "https://custom.opsgenie.com/v2/alerts",
  });
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });

  assert.ok(receivedUrl.includes("custom.opsgenie.com"));
});

test("OpsGenieAlertChannel kind is 'opsgenie'", () => {
  const channel = new OpsGenieAlertChannel();
  assert.equal(channel.kind, "opsgenie");
});

test("OpsGenieAlertChannel uses default endpoint", () => {
  let receivedUrl = "";
  const mockFetch = test.mock.fn(async (url: string) => {
    receivedUrl = url;
    return new Response("ok");
  });
  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createMockAlertEvent({ channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test_key" });

  assert.ok(receivedUrl.includes("api.opsgenie.com"));
});

// recordAlertDeliveryFailure tests
test("recordAlertDeliveryFailure increments failure counter", () => {
  const channel: AlertChannelKind = "webhook";
  const alertId = "alert_failure_test";
  const error = new Error("network error");

  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);
  const initialCount = getAlertDeliveryFailureCount(channel);

  recordAlertDeliveryFailure(channel, alertId, error);

  const updatedCount = getAlertDeliveryFailureCount(channel);
  assert.equal(updatedCount, initialCount + 1);
});

test("recordAlertDeliveryFailure handles non-Error objects", () => {
  const channel: AlertChannelKind = "slack";
  const alertId = "alert_non_error";
  const error = "string error";
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  assert.doesNotThrow(() => {
    recordAlertDeliveryFailure(channel, alertId, error);
  });

  const updatedCount = getAlertDeliveryFailureCount(channel);
  assert.ok(updatedCount >= 1);
});

test("recordAlertDeliveryFailure handles null error", () => {
  const channel: AlertChannelKind = "pagerduty";
  const alertId = "alert_null_error";

  assert.doesNotThrow(() => {
    recordAlertDeliveryFailure(channel, alertId, null);
  });
});

test("recordAlertDeliveryFailure handles undefined error", () => {
  const channel: AlertChannelKind = "opsgenie";
  const alertId = "alert_undefined_error";

  assert.doesNotThrow(() => {
    recordAlertDeliveryFailure(channel, alertId, undefined);
  });
});

// AlertChannel interface compliance tests
test("LogAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new LogAlertChannel();
  assert.equal(channel.kind, "log");
  assert.ok(typeof channel.deliver === "function");
});

test("WebhookAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new WebhookAlertChannel();
  assert.equal(channel.kind, "webhook");
  assert.ok(typeof channel.deliver === "function");
});

test("SlackAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new SlackAlertChannel();
  assert.equal(channel.kind, "slack");
  assert.ok(typeof channel.deliver === "function");
});

test("PagerDutyAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new PagerDutyAlertChannel();
  assert.equal(channel.kind, "pagerduty");
  assert.ok(typeof channel.deliver === "function");
});

test("OpsGenieAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new OpsGenieAlertChannel();
  assert.equal(channel.kind, "opsgenie");
  assert.ok(typeof channel.deliver === "function");
});

test("EmailAlertChannel implements AlertChannel interface", () => {
  const channel: AlertChannel = new EmailAlertChannel();
  assert.equal(channel.kind, "email");
  assert.ok(typeof channel.deliver === "function");
});

// AlertDeliveryResult structure tests
test("AlertDeliveryResult has correct structure for log channel", () => {
  const channel = new LogAlertChannel();
  const result = channel.deliver(createMockAlertEvent());

  assert.ok(typeof result.channelKind === "string");
  assert.ok(typeof result.delivered === "boolean");
  assert.ok(result.error === null || typeof result.error === "string");
});

test("AlertDeliveryResult has correct structure for failed webhook", () => {
  const channel = new WebhookAlertChannel();
  const result = channel.deliver(createMockAlertEvent(), {});

  assert.equal(result.channelKind, "webhook");
  assert.equal(result.delivered, false);
  assert.ok(typeof result.error === "string");
});

// ErrorBudgetDegradationResult interface tests
test("ErrorBudgetDegradationResult structure is correct", () => {
  const result: ErrorBudgetDegradationResult = {
    degraded: false,
    sloId: "slo_test",
    sloStatus: "met",
    rolloutFrozen: false,
    alertFired: false,
    alertId: null,
    gradientLevel: "none",
    errorBudgetBurnPercent: null,
  };

  assert.equal(result.sloId, "slo_test");
  assert.equal(result.gradientLevel, "none");
});

// BurnRateAlertResult interface tests
test("BurnRateAlertResult structure is correct", () => {
  const result: BurnRateAlertResult = {
    sloId: "slo_test",
    burnRate1h: 1.5,
    burnRate6h: 2.0,
    alertSeverity: "SEV2",
    alertFired: true,
    alertId: "alert_test",
  };

  assert.equal(result.sloId, "slo_test");
  assert.equal(result.alertSeverity, "SEV2");
});

// FetchLike type tests
test("FetchLike type is typeof fetch", () => {
  const fetchImpl: FetchLike = globalThis.fetch;
  assert.ok(typeof fetchImpl === "function");
});
