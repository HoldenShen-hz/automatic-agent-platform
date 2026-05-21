/**
 * Unit tests for slo-alerting/channels.ts
 *
 * Tests the re-exports from slo-alerting-channels.js including:
 * - AlertChannel interface and types
 * - AlertDeliveryResult interface
 * - ErrorBudgetDegradationResult interface
 * - BurnRateAlertResult interface
 * - FetchLike type
 * - Channel option interfaces (Webhook, Slack, PagerDuty, OpsGenie)
 * - PAGERDUTY_DEFAULT_ENDPOINT constant
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  AlertDeliveryResult,
  AlertChannel,
  AlertChannelKind,
  ErrorBudgetDegradationResult,
  BurnRateAlertResult,
  FetchLike,
  WebhookAlertChannelOptions,
  SlackAlertChannelOptions,
  PagerDutyAlertChannelOptions,
  OpsGenieAlertChannelOptions,
  AlertEvent,
} from "../../../../../../src/platform/shared/observability/slo-alerting-channels.js";
import {
  PAGERDUTY_DEFAULT_ENDPOINT,
  LogAlertChannel,
  WebhookAlertChannel,
  SlackAlertChannel,
  PagerDutyAlertChannel,
  OpsGenieAlertChannel,
  EmailAlertChannel,
} from "../../../../../../src/platform/shared/observability/slo-alerting-channels.js";

// ── Type Alias Tests ──────────────────────────────────────────────────

test("AlertChannelKind type includes all expected channel types", () => {
  const channelKinds: AlertChannelKind[] = [
    "log",
    "webhook",
    "pagerduty",
    "slack",
    "opsgenie",
    "email",
  ];
  channelKinds.forEach((kind) => assert.equal(typeof kind, "string"));
});

// ── AlertDeliveryResult Tests ────────────────────────────────────────

test("AlertDeliveryResult with delivered true and no error", () => {
  const result: AlertDeliveryResult = {
    channelKind: "webhook",
    delivered: true,
    error: null,
  };
  assert.equal(result.delivered, true);
  assert.equal(result.error, null);
  assert.equal(result.channelKind, "webhook");
});

test("AlertDeliveryResult with delivered false and error message", () => {
  const result: AlertDeliveryResult = {
    channelKind: "slack",
    delivered: false,
    error: "Connection timeout",
  };
  assert.equal(result.delivered, false);
  assert.equal(result.error, "Connection timeout");
  assert.equal(result.channelKind, "slack");
});

test("AlertDeliveryResult channelKind can be any AlertChannelKind", () => {
  const kinds: AlertChannelKind[] = ["log", "webhook", "pagerduty", "slack", "opsgenie", "email"];
  kinds.forEach((kind) => {
    const result: AlertDeliveryResult = { channelKind: kind, delivered: true, error: null };
    assert.equal(result.channelKind, kind);
  });
});

// ── AlertChannel Interface Tests ────────────────────────────────────

test("AlertChannel requires readonly kind property", () => {
  const channel: AlertChannel = {
    kind: "log",
    deliver(event, config) {
      return { channelKind: this.kind, delivered: true, error: null };
    },
  };
  assert.equal(channel.kind, "log");
});

test("AlertChannel.deliver returns AlertDeliveryResult", () => {
  const channel: AlertChannel = {
    kind: "webhook",
    deliver(event, config) {
      return {
        channelKind: "webhook",
        delivered: true,
        error: null,
      };
    },
  };
  const mockEvent = createMockAlertEvent();
  const result = channel.deliver(mockEvent, { url: "https://example.com" });
  assert.equal(result.delivered, true);
  assert.equal(result.channelKind, "webhook");
});

test("AlertChannel can implement custom delivery logic", () => {
  let delivered = false;
  const channel: AlertChannel = {
    kind: "slack",
    deliver(event, config) {
      delivered = true;
      return { channelKind: this.kind, delivered: true, error: null };
    },
  };
  channel.deliver(createMockAlertEvent(), {});
  assert.equal(delivered, true);
});

// ── ErrorBudgetDegradationResult Tests ───────────────────────────────

test("ErrorBudgetDegradationResult full structure", () => {
  const result: ErrorBudgetDegradationResult = {
    degraded: true,
    sloId: "slo-1",
    sloStatus: "at_risk",
    rolloutFrozen: true,
    alertFired: true,
    alertId: "alert-123",
    gradientLevel: "degrade",
    errorBudgetBurnPercent: 50.5,
  };
  assert.equal(result.degraded, true);
  assert.equal(result.sloId, "slo-1");
  assert.equal(result.sloStatus, "at_risk");
  assert.equal(result.rolloutFrozen, true);
  assert.equal(result.alertFired, true);
  assert.equal(result.alertId, "alert-123");
  assert.equal(result.gradientLevel, "degrade");
  assert.equal(result.errorBudgetBurnPercent, 50.5);
});

test("ErrorBudgetDegradationResult with null alertId when no alert fired", () => {
  const result: ErrorBudgetDegradationResult = {
    degraded: false,
    sloId: "slo-2",
    sloStatus: "met",
    rolloutFrozen: false,
    alertFired: false,
    alertId: null,
    gradientLevel: "none",
    errorBudgetBurnPercent: null,
  };
  assert.equal(result.alertFired, false);
  assert.equal(result.alertId, null);
  assert.equal(result.gradientLevel, "none");
});

test("ErrorBudgetDegradationResult gradientLevel accepts all values", () => {
  const levels: ErrorBudgetDegradationResult["gradientLevel"][] = [
    "none",
    "degrade",
    "freeze",
    "full_freeze",
  ];
  levels.forEach((level) => {
    const result: ErrorBudgetDegradationResult = {
      degraded: false,
      sloId: "slo-test",
      sloStatus: "met",
      rolloutFrozen: false,
      alertFired: false,
      alertId: null,
      gradientLevel: level,
      errorBudgetBurnPercent: null,
    };
    assert.equal(result.gradientLevel, level);
  });
});

test("ErrorBudgetDegradationResult sloStatus accepts all expected values", () => {
  const statuses: ErrorBudgetDegradationResult["sloStatus"][] = [
    "met",
    "at_risk",
    "breached",
    "unknown",
  ];
  statuses.forEach((status) => {
    const result: ErrorBudgetDegradationResult = {
      degraded: false,
      sloId: "slo-test",
      sloStatus: status,
      rolloutFrozen: false,
      alertFired: false,
      alertId: null,
      gradientLevel: "none",
      errorBudgetBurnPercent: null,
    };
    assert.equal(result.sloStatus, status);
  });
});

// ── BurnRateAlertResult Tests ─────────────────────────────────────────

test("BurnRateAlertResult full structure", () => {
  const result: BurnRateAlertResult = {
    sloId: "slo-1",
    burnRate1h: 2.5,
    burnRate6h: 1.8,
    alertSeverity: "SEV2",
    alertFired: true,
    alertId: "alert-456",
  };
  assert.equal(result.sloId, "slo-1");
  assert.equal(result.burnRate1h, 2.5);
  assert.equal(result.burnRate6h, 1.8);
  assert.equal(result.alertSeverity, "SEV2");
  assert.equal(result.alertFired, true);
  assert.equal(result.alertId, "alert-456");
});

test("BurnRateAlertResult with null burn rates", () => {
  const result: BurnRateAlertResult = {
    sloId: "slo-2",
    burnRate1h: null,
    burnRate6h: null,
    alertSeverity: null,
    alertFired: false,
    alertId: null,
  };
  assert.equal(result.burnRate1h, null);
  assert.equal(result.burnRate6h, null);
  assert.equal(result.alertSeverity, null);
  assert.equal(result.alertFired, false);
});

test("BurnRateAlertResult alertSeverity accepts SEV2 and SEV3", () => {
  const severities: BurnRateAlertResult["alertSeverity"][] = ["SEV2", "SEV3", null];
  severities.forEach((sev) => {
    const result: BurnRateAlertResult = {
      sloId: "slo-test",
      burnRate1h: 1.0,
      burnRate6h: 1.0,
      alertSeverity: sev,
      alertFired: sev !== null,
      alertId: sev !== null ? "alert-test" : null,
    };
    assert.equal(result.alertSeverity, sev);
  });
});

// ── FetchLike Type Tests ────────────────────────────────────────────

test("FetchLike is typeof fetch", () => {
  const fetchImpl: FetchLike = globalThis.fetch;
  assert.equal(typeof fetchImpl, "function");
});

// ── WebhookAlertChannelOptions Tests ─────────────────────────────────

test("WebhookAlertChannelOptions with all fields", () => {
  const options: WebhookAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    defaultHeaders: { "Content-Type": "application/json" },
    timeoutMs: 5000,
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.defaultHeaders!["Content-Type"], "application/json");
  assert.equal(options.timeoutMs, 5000);
});

test("WebhookAlertChannelOptions with minimal fields", () => {
  const options: WebhookAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.defaultHeaders, undefined);
  assert.equal(options.timeoutMs, undefined);
});

test("WebhookAlertChannelOptions defaultHeaders can be empty object", () => {
  const options: WebhookAlertChannelOptions = {
    defaultHeaders: {},
  };
  assert.ok(options.defaultHeaders !== undefined);
  assert.equal(Object.keys(options.defaultHeaders!).length, 0);
});

// ── SlackAlertChannelOptions Tests ─────────────────────────────────────

test("SlackAlertChannelOptions with all fields", () => {
  const options: SlackAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 3000,
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 3000);
});

test("SlackAlertChannelOptions with minimal fields", () => {
  const options: SlackAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.timeoutMs, undefined);
});

test("SlackAlertChannelOptions timeoutMs can be zero", () => {
  const options: SlackAlertChannelOptions = {
    timeoutMs: 0,
  };
  assert.equal(options.timeoutMs, 0);
});

// ── PagerDutyAlertChannelOptions Tests ────────────────────────────────

test("PagerDutyAlertChannelOptions with all fields", () => {
  const options: PagerDutyAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 10000,
    endpoint: "https://custom.pagerduty.com/v2/enqueue",
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 10000);
  assert.equal(options.endpoint, "https://custom.pagerduty.com/v2/enqueue");
});

test("PagerDutyAlertChannelOptions with minimal fields", () => {
  const options: PagerDutyAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.endpoint, undefined);
  assert.equal(options.timeoutMs, undefined);
});

test("PagerDutyAlertChannelOptions endpoint can be empty string", () => {
  const options: PagerDutyAlertChannelOptions = {
    endpoint: "",
  };
  assert.equal(options.endpoint, "");
});

// ── OpsGenieAlertChannelOptions Tests ────────────────────────────────

test("OpsGenieAlertChannelOptions with all fields", () => {
  const options: OpsGenieAlertChannelOptions = {
    fetchImpl: globalThis.fetch,
    timeoutMs: 8000,
    endpoint: "https://api.opsgenie.com/v2/alerts",
  };
  assert.ok(options.fetchImpl);
  assert.equal(options.timeoutMs, 8000);
  assert.equal(options.endpoint, "https://api.opsgenie.com/v2/alerts");
});

test("OpsGenieAlertChannelOptions with minimal fields", () => {
  const options: OpsGenieAlertChannelOptions = {};
  assert.equal(options.fetchImpl, undefined);
  assert.equal(options.endpoint, undefined);
  assert.equal(options.timeoutMs, undefined);
});

// ── PAGERDUTY_DEFAULT_ENDPOINT Tests ─────────────────────────────────

test("PAGERDUTY_DEFAULT_ENDPOINT is valid HTTPS URL", () => {
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.startsWith("https://"));
});

test("PAGERDUTY_DEFAULT_ENDPOINT contains pagerduty domain", () => {
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.includes("pagerduty.com"));
});

test("PAGERDUTY_DEFAULT_ENDPOINT ends with enqueue path", () => {
  assert.ok(PAGERDUTY_DEFAULT_ENDPOINT.endsWith("/v2/enqueue"));
});

test("PAGERDUTY_DEFAULT_ENDPOINT is parseable as URL", () => {
  const url = new URL(PAGERDUTY_DEFAULT_ENDPOINT);
  assert.equal(url.protocol, "https:");
  assert.ok(url.hostname.includes("pagerduty"));
});

// ── Channel Classes Basic Tests ──────────────────────────────────────

test("LogAlertChannel has correct kind", () => {
  const channel = new LogAlertChannel();
  assert.equal(channel.kind, "log");
});

test("WebhookAlertChannel has correct kind", () => {
  const channel = new WebhookAlertChannel();
  assert.equal(channel.kind, "webhook");
});

test("SlackAlertChannel has correct kind", () => {
  const channel = new SlackAlertChannel();
  assert.equal(channel.kind, "slack");
});

test("PagerDutyAlertChannel has correct kind", () => {
  const channel = new PagerDutyAlertChannel();
  assert.equal(channel.kind, "pagerduty");
});

test("OpsGenieAlertChannel has correct kind", () => {
  const channel = new OpsGenieAlertChannel();
  assert.equal(channel.kind, "opsgenie");
});

test("EmailAlertChannel has correct kind", () => {
  const channel = new EmailAlertChannel();
  assert.equal(channel.kind, "email");
});

// ── Helper ────────────────────────────────────────────────────────────

function createMockAlertEvent(): AlertEvent {
  return {
    id: "alert_test_" + Math.random().toString(36).slice(2),
    ruleId: "rule_test",
    severity: "warning",
    status: "firing",
    title: "Test Alert",
    detail: "Test alert detail",
    channelKind: "log",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: new Date().toISOString(),
  };
}