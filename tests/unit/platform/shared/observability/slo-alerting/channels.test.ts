import assert from "node:assert/strict";
import test from "node:test";

import type {
  AlertDeliveryResult,
  AlertChannel,
  ErrorBudgetDegradationResult,
  WebhookAlertChannelOptions,
  SlackAlertChannelOptions,
  PagerDutyAlertChannelOptions,
  OpsGenieAlertChannelOptions,
} from "../../../../../../src/platform/shared/observability/slo-alerting/channels.js";
import { PAGERDUTY_DEFAULT_ENDPOINT } from "../../../../../../src/platform/shared/observability/slo-alerting/channels.js";

test("AlertDeliveryResult structure is correct", () => {
  const result: AlertDeliveryResult = {
    channelKind: "webhook",
    delivered: true,
    error: null,
  };
  assert.equal(result.channelKind, "webhook");
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
});

test("AlertDeliveryResult can represent failed delivery", () => {
  const result: AlertDeliveryResult = {
    channelKind: "slack",
    delivered: false,
    error: "Connection timeout",
  };
  assert.equal(result.delivered, false);
  assert.equal(result.error, "Connection timeout");
});

test("AlertChannel interface defines kind and deliver method", () => {
  const mockChannel: AlertChannel = {
    kind: "webhook",
    deliver(event, config) {
      return {
        channelKind: this.kind,
        delivered: true,
        error: null,
      };
    },
  };
  assert.equal(mockChannel.kind, "webhook");
  const result = mockChannel.deliver({} as any, {});
  assert.equal(result.delivered, true);
});

test("ErrorBudgetDegradationResult structure is correct", () => {
  const result: ErrorBudgetDegradationResult = {
    degraded: true,
    sloId: "slo-1",
    sloStatus: "at_risk",
    rolloutFrozen: true,
    alertFired: true,
    alertId: "alert-123",
  };
  assert.equal(result.degraded, true);
  assert.equal(result.sloId, "slo-1");
  assert.equal(result.sloStatus, "at_risk");
  assert.equal(result.rolloutFrozen, true);
  assert.equal(result.alertFired, true);
  assert.equal(result.alertId, "alert-123");
});

test("ErrorBudgetDegradationResult can represent healthy SLO", () => {
  const result: ErrorBudgetDegradationResult = {
    degraded: false,
    sloId: "slo-2",
    sloStatus: "met",
    rolloutFrozen: false,
    alertFired: false,
    alertId: null,
  };
  assert.equal(result.degraded, false);
  assert.equal(result.sloStatus, "met");
  assert.equal(result.alertId, null);
});

test("WebhookAlertChannelOptions has optional fetchImpl", () => {
  const options: WebhookAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    defaultHeaders: { "Content-Type": "application/json" },
    timeoutMs: 5000,
  };
  assert.equal(options.fetchImpl, globalThis.fetch);
  assert.equal(options.defaultHeaders!["Content-Type"], "application/json");
  assert.equal(options.timeoutMs, 5000);
});

test("WebhookAlertChannelOptions all fields are optional", () => {
  const options: WebhookAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.defaultHeaders, undefined);
  assert.equal(options.timeoutMs, undefined);
});

test("SlackAlertChannelOptions has optional fetchImpl and timeoutMs", () => {
  const options: SlackAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 3000,
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 3000);
});

test("SlackAlertChannelOptions all fields are optional", () => {
  const options: SlackAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.timeoutMs, undefined);
});

test("PagerDutyAlertChannelOptions has optional fetchImpl, timeoutMs, and endpoint", () => {
  const options: PagerDutyAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 10000,
    endpoint: "https://custom.pagerduty.com/v2/enqueue",
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 10000);
  assert.equal(options.endpoint, "https://custom.pagerduty.com/v2/enqueue");
});

test("PagerDutyAlertChannelOptions all fields are optional", () => {
  const options: PagerDutyAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.endpoint, undefined);
});

test("OpsGenieAlertChannelOptions has optional fetchImpl, timeoutMs, and endpoint", () => {
  const options: OpsGenieAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 8000,
    endpoint: "https://api.opsgenie.com/v2/alerts",
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 8000);
  assert.equal(options.endpoint, "https://api.opsgenie.com/v2/alerts");
});

test("OpsGenieAlertChannelOptions all fields are optional", () => {
  const options: OpsGenieAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.endpoint, undefined);
});

test("PAGERDUTY_DEFAULT_ENDPOINT is valid HTTPS URL", () => {
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.startsWith("https://"));
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.includes("pagerduty.com"));
});

test("PAGERDUTY_DEFAULT_ENDPOINT ends with enqueue path", () => {
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.endsWith("/v2/enqueue"));
});

test("AlertChannel.deliver signature accepts event and config", () => {
  const mockChannel: AlertChannel = {
    kind: "pagerduty",
    deliver(event, config) {
      // Verify event has expected structure
      assert.equal(typeof event, "object");
      assert.equal(typeof config, "object");
      return {
        channelKind: this.kind,
        delivered: false,
        error: "Test error",
      };
    },
  };
  mockChannel.deliver({} as any, {});
});

test("ErrorBudgetDegradationResult alertId can be string or null", () => {
  const resultWithId: ErrorBudgetDegradationResult = {
    degraded: true,
    sloId: "slo-1",
    sloStatus: "breached",
    rolloutFrozen: true,
    alertFired: true,
    alertId: "alert-456",
  };
  const resultWithNull: ErrorBudgetDegradationResult = {
    degraded: false,
    sloId: "slo-2",
    sloStatus: "met",
    rolloutFrozen: false,
    alertFired: false,
    alertId: null,
  };
  assert.equal(typeof resultWithId.alertId, "string");
  assert.equal(resultWithNull.alertId, null);
});

test("Multiple channel kinds can be represented", () => {
  const kinds = ["log", "webhook", "pagerduty", "slack", "opsgenie", "email"] as const;
  for (const kind of kinds) {
    const channel: AlertChannel = {
      kind,
      deliver() {
        return { channelKind: kind, delivered: true, error: null };
      },
    };
    const result = channel.deliver({} as any, {});
    assert.equal(result.channelKind, kind);
    assert.equal(result.delivered, true);
  }
});