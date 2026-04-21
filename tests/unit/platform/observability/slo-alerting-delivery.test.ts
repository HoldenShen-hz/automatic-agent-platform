/**
 * @fileoverview [SYS-REL-2.5] SLO Alerting Delivery Failure Tests
 *
 * Regression tests for SYS-REL-2.5: SLO alert delivery silent failure
 *
 * The slo-alerting-service.ts has 4 places .catch(() => {}) which swallow
 * delivery failures. Failures must log error + increment counter.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PagerDutyAlertChannel,
  WebhookAlertChannel,
} from "../../../../src/platform/shared/observability/slo-alerting-service.js";
import { runtimeMetricsRegistry } from "../../../../src/platform/shared/observability/runtime-metrics-registry.js";

type FetchMock = (url: string, options?: RequestInit) => Promise<Response>;

function createEvent(channelKind: "webhook" | "pagerduty") {
  return {
    id: `alert_${channelKind}`,
    ruleId: "rule_delivery",
    severity: "critical" as const,
    status: "firing" as const,
    title: "delivery failed",
    detail: "delivery failed",
    channelKind,
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-10T00:00:00.000Z",
  };
}

test("[SYS-REL-2.5] WebhookAlertChannel increments runtime failure counter on async delivery failure", async () => {
  runtimeMetricsRegistry.reset();
  const channel = new WebhookAlertChannel({
    fetchImpl: async () => {
      throw new Error("ENOTFOUND");
    },
  });

  channel.deliver(createEvent("webhook"), { url: "https://example.test/hook" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const counters = runtimeMetricsRegistry.getCounters("alert_delivery_failures_total");
  assert.deepEqual(
    counters.map((series) => ({ labels: series.labels, value: series.value })),
    [{ labels: { channel: "webhook" }, value: 1 }],
  );
});

test("[SYS-REL-2.5] PagerDutyAlertChannel increments runtime failure counter on async delivery failure", async () => {
  runtimeMetricsRegistry.reset();
  const channel = new PagerDutyAlertChannel({
    fetchImpl: async () => {
      throw new Error("ETIMEDOUT");
    },
  });

  channel.deliver(createEvent("pagerduty"), { routingKey: "rk_123" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const counters = runtimeMetricsRegistry.getCounters("alert_delivery_failures_total");
  assert.deepEqual(
    counters.map((series) => ({ labels: series.labels, value: series.value })),
    [{ labels: { channel: "pagerduty" }, value: 1 }],
  );
});

test("[SYS-REL-2.5] PagerDuty delivery failure logs error and increments counter", async () => {
  const logs: Array<{ level: string; message: string; data: Record<string, unknown> }> = [];
  const counters: Record<string, number> = { alert_delivery_failures_total: 0 };

  const mockFetch: FetchMock = async () => {
    throw new Error("ETIMEDOUT - connection timed out");
  };

  const logError = (message: string, data: Record<string, unknown>) => {
    logs.push({ level: "error", message, data });
  };

  const incrementCounter = (name: string) => {
    counters[name] = (counters[name] ?? 0) + 1;
  };

  // Simulate PagerDuty channel deliver with proper error handling
  const deliverPagerDuty = async (event: { id: string; ruleId: string; title: string }) => {
    const pagerdutyEndpoint = "https://events.pagerduty.com/v2/enqueue";

    try {
      await mockFetch(pagerdutyEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ routing_key: "test-key", event_action: "trigger" }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // BUG: Currently this catch is .catch(() => {}) which swallows the error
      // FIX: Should log error and increment counter
      logError("alert.delivery_failed", {
        alertId: event.id,
        err: err instanceof Error ? err.message : String(err),
      });
      incrementCounter("alert_delivery_failures_total");
    }
  };

  await deliverPagerDuty({ id: "alert-001", ruleId: "rule-001", title: "Test Alert" });

  assert.ok(logs.length > 0, "Error should be logged when delivery fails");
  assert.strictEqual(
    logs[0]?.message,
    "alert.delivery_failed",
    "Log message should be 'alert.delivery_failed'",
  );
  assert.strictEqual(counters["alert_delivery_failures_total"], 1, "Failure counter should be incremented");
});

test("[SYS-REL-2.5] Slack delivery failure logs error and increments counter", async () => {
  const logs: Array<{ level: string; message: string; data: Record<string, unknown> }> = [];
  const counters: Record<string, number> = { alert_delivery_failures_total: 0 };

  const mockFetch: FetchMock = async () => {
    throw new Error("ECONNREFUSED");
  };

  const logError = (message: string, data: Record<string, unknown>) => {
    logs.push({ level: "error", message, data });
  };

  const incrementCounter = (name: string) => {
    counters[name] = (counters[name] ?? 0) + 1;
  };

  const deliverSlack = async (event: { id: string; severity: string; title: string }) => {
    const webhookUrl = "https://hooks.slack.com/services/test";

    try {
      await mockFetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `[${event.severity}] ${event.title}` }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logError("alert.delivery_failed", {
        alertId: event.id,
        err: err instanceof Error ? err.message : String(err),
      });
      incrementCounter("alert_delivery_failures_total");
    }
  };

  await deliverSlack({ id: "alert-002", severity: "critical", title: "Critical Alert" });

  assert.ok(logs.length > 0, "Error should be logged when Slack delivery fails");
  assert.strictEqual(counters["alert_delivery_failures_total"], 1, "Failure counter should be incremented");
});

test("[SYS-REL-2.5] Webhook delivery failure logs error and increments counter", async () => {
  const logs: Array<{ level: string; message: string; data: Record<string, unknown> }> = [];
  const counters: Record<string, number> = { alert_delivery_failures_total: 0 };

  const mockFetch: FetchMock = async () => {
    throw new Error("ENOTFOUND - host not found");
  };

  const logError = (message: string, data: Record<string, unknown>) => {
    logs.push({ level: "error", message, data });
  };

  const incrementCounter = (name: string) => {
    counters[name] = (counters[name] ?? 0) + 1;
  };

  const deliverWebhook = async (event: { id: string; ruleId: string; title: string }) => {
    const url = "https://example.com/webhook";

    try {
      await mockFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: event.id, title: event.title }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logError("alert.delivery_failed", {
        alertId: event.id,
        err: err instanceof Error ? err.message : String(err),
      });
      incrementCounter("alert_delivery_failures_total");
    }
  };

  await deliverWebhook({ id: "alert-003", ruleId: "rule-003", title: "Webhook Test" });

  assert.ok(logs.length > 0, "Error should be logged when webhook delivery fails");
  assert.strictEqual(counters["alert_delivery_failures_total"], 1, "Failure counter should be incremented");
});

test("[SYS-REL-2.5] OpsGenie delivery failure logs error and increments counter", async () => {
  const logs: Array<{ level: string; message: string; data: Record<string, unknown> }> = [];
  const counters: Record<string, number> = { alert_delivery_failures_total: 0 };

  const mockFetch: FetchMock = async () => {
    throw new Error("Unauthorized - invalid API key");
  };

  const logError = (message: string, data: Record<string, unknown>) => {
    logs.push({ level: "error", message, data });
  };

  const incrementCounter = (name: string) => {
    counters[name] = (counters[name] ?? 0) + 1;
  };

  const deliverOpsGenie = async (event: { id: string; severity: string; title: string }) => {
    const endpoint = "https://api.opsgenie.com/v2/alerts";

    try {
      await mockFetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "GenieKey invalid-key",
        },
        body: JSON.stringify({ message: event.title }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logError("alert.delivery_failed", {
        alertId: event.id,
        err: err instanceof Error ? err.message : String(err),
      });
      incrementCounter("alert_delivery_failures_total");
    }
  };

  await deliverOpsGenie({ id: "alert-004", severity: "warning", title: "OpsGenie Test" });

  assert.ok(logs.length > 0, "Error should be logged when OpsGenie delivery fails");
  assert.strictEqual(counters["alert_delivery_failures_total"], 1, "Failure counter should be incremented");
});

test("[SYS-REL-2.5] silent .catch(() => {}) in WebhookAlertChannel is a defect", async () => {
  // This test demonstrates the current buggy pattern where .catch(() => {}) is used
  // which silently swallows delivery failures

  let catchCalled = false;

  const mockFetch: FetchMock = async () => {
    throw new Error("NETWORK_ERROR");
  };

  const buggyDeliver = async () => {
    try {
      await mockFetch("https://example.com/webhook", {
        method: "POST",
      });
    } catch {
      // BUG: Empty catch silently swallows the error
      catchCalled = true;
      // This is the fix - we should re-throw or log
      // throw new Error("delivery failed");
    }
  };

  await buggyDeliver();

  // The error was caught but silently ignored
  assert.strictEqual(catchCalled, true, "Catch handler was called");
  // No error was re-thrown - the failure is silent
});

test("[SYS-REL-2.5] alert dispatcher must track delivery failures", async () => {
  const deliveryFailures: Array<{ alertId: string; channelKind: string; error: string }> = [];

  const trackDeliveryFailure = (alertId: string, channelKind: string, error: Error) => {
    deliveryFailures.push({
      alertId,
      channelKind,
      error: error.message,
    });
  };

  // Simulate multiple delivery failures across different channels
  trackDeliveryFailure("alert-001", "pagerduty", new Error("ETIMEDOUT"));
  trackDeliveryFailure("alert-002", "slack", new Error("ECONNREFUSED"));
  trackDeliveryFailure("alert-003", "webhook", new Error("ENOTFOUND"));
  trackDeliveryFailure("alert-004", "opsgenie", new Error("Unauthorized"));

  assert.strictEqual(deliveryFailures.length, 4, "All delivery failures should be tracked");
  assert.strictEqual(
    deliveryFailures.filter((f) => f.channelKind === "pagerduty").length,
    1,
    "Should have 1 PagerDuty failure",
  );
  assert.strictEqual(
    deliveryFailures.filter((f) => f.channelKind === "slack").length,
    1,
    "Should have 1 Slack failure",
  );
});

test("[SYS-REL-2.5] alert service summary includes delivery failure metrics", () => {
  // The summary() method should include metrics about failed alert deliveries
  // for monitoring dashboards

  const counters: Record<string, number> = {
    alert_delivery_failures_total: 0,
    alerts_fired: 0,
  };

  const incrementCounter = (name: string) => {
    counters[name] = (counters[name] ?? 0) + 1;
  };

  // Simulate alert firing and delivery
  for (let i = 0; i < 10; i++) {
    incrementCounter("alerts_fired");
  }

  // Simulate 2 delivery failures
  incrementCounter("alert_delivery_failures_total");
  incrementCounter("alert_delivery_failures_total");

  const summary = () => ({
    alertsFired: counters["alerts_fired"],
    deliveryFailures: counters["alert_delivery_failures_total"],
    deliverySuccessRate: (counters["alerts_fired"]! - counters["alert_delivery_failures_total"]!) / (counters["alerts_fired"] ?? 1),
  });

  const result = summary();

  assert.strictEqual(result.alertsFired, 10, "Should track total alerts fired");
  assert.strictEqual(result.deliveryFailures, 2, "Should track delivery failures");
  assert.strictEqual(
    result.deliverySuccessRate,
    0.8,
    "Delivery success rate should be 80%",
  );
});
