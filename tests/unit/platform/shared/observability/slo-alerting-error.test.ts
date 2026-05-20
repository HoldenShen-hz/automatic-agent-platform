/**
 * SYS-REL-2.5: SLO Alert Delivery Failure Handling Tests
 *
 * Verifies that when alert delivery fails (PagerDuty, Slack, OpsGenie, Webhook),
 * the error is properly logged and the failure counter is incremented.
 *
 * Background: slo-alerting-service.ts implements recordAlertDeliveryFailure()
 * which is called in .catch() handlers to log errors and increment failure counters.
 *
 * Requirements:
 * - PagerDuty/HTTP delivery failures must be logged with error details
 * - Failure counters must be incremented on delivery failure
 * - All imports use ESM .js extensions
 * - Uses node:test + assert/strict
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PagerDutyAlertChannel,
  SlackAlertChannel,
  OpsGenieAlertChannel,
  WebhookAlertChannel,
  type AlertEvent,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";
import { StructuredLogger, type StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

/**
 * Gets counter value by name and label filter.
 */
function getCounterValue(name: string, labels: Record<string, string>): number {
  const counters = runtimeMetricsRegistry.getCounters(name);
  const match = counters.find(c =>
    Object.entries(labels).every(([k, v]) => c.labels[k] === v)
  );
  return match?.value ?? 0;
}

/**
 * Creates a test alert event with required fields.
 */
function createTestEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "alert_test_err",
    ruleId: "rule_test_err",
    severity: "critical",
    status: "firing",
    title: "Test Alert",
    detail: "Testing delivery failure",
    channelKind: "pagerduty",
    deliveredAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    firedAt: "2026-04-21T00:00:00.000Z",
    ...overrides,
  };
}

async function captureErrorLogs(action: () => Promise<void>): Promise<StructuredLogEntry[]> {
  const entries: StructuredLogEntry[] = [];
  const transportName = `test-slo-alert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  StructuredLogger.addTransport({
    name: transportName,
    write(entry) {
      if (entry.level === "error") {
        entries.push(entry);
      }
    },
  });
  try {
    await action();
    await StructuredLogger.flushTransports();
    return entries;
  } finally {
    StructuredLogger.removeTransport(transportName);
  }
}

function findDeliveryFailureLog(entries: StructuredLogEntry[], channel: string, alertId?: string): StructuredLogEntry | undefined {
  return entries.find((entry) =>
    entry.message === "alert.delivery_failed"
    && entry.data?.channel === channel
    && (alertId == null || entry.data?.alertId === alertId)
  );
}

async function flushAlertDeliveryFailure(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function waitForFailureCounter(channel: string, expectedValue: number): Promise<void> {
  const deadline = Date.now() + 250;
  while (Date.now() <= deadline) {
    if (getCounterValue("alert_delivery_failures_total", { channel }) >= expectedValue) {
      return;
    }
    await flushAlertDeliveryFailure();
  }
  assert.fail(`Timed out waiting for alert_delivery_failures_total(${channel}) >= ${expectedValue}`);
}

// ── PagerDuty Delivery Failure Tests ─────────────────────────────────

test("[SYS-REL-2.5] PagerDuty delivery failure increments failure counter", async () => {
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  const mockFetch = async () => {
    throw new Error("ETIMEDOUT");
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "pagerduty" });

  // Trigger delivery (fire-and-forget, but async handler will run)
  channel.deliver(event, { routingKey: "test-key" });

  await waitForFailureCounter("pagerduty", 1);
  assert.equal(getCounterValue("alert_delivery_failures_total", { channel: "pagerduty" }), 1);
});

test("[SYS-REL-2.5] PagerDuty delivery failure logs error via StructuredLogger", async () => {
  const logs = await captureErrorLogs(async () => {
    const mockFetch = async () => {
      throw new Error("ETIMEDOUT");
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "pagerduty" });

    channel.deliver(event, { routingKey: "test-key" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(
    findDeliveryFailureLog(logs, "pagerduty"),
    "PagerDuty delivery failure must be logged via StructuredLogger",
  );
});

test("[SYS-REL-2.5] PagerDuty delivery returns delivered=true despite async failure", () => {
  const mockFetch = async () => {
    throw new Error("ETIMEDOUT");
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "pagerduty" });

  // Fire-and-forget returns immediately with delivered=true
  const result = channel.deliver(event, { routingKey: "test-key" });
  assert.equal(result.delivered, true, "PagerDuty deliver() returns delivered=true immediately");
});

// ── Slack Delivery Failure Tests ────────────────────────────────────

test("[SYS-REL-2.5] Slack delivery failure increments failure counter", async () => {
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  const mockFetch = async () => {
    throw new Error("ECONNREFUSED");
  };

  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "slack" });

  channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

  await waitForFailureCounter("slack", 1);
  assert.equal(getCounterValue("alert_delivery_failures_total", { channel: "slack" }), 1);
});

test("[SYS-REL-2.5] Slack delivery failure logs error", async () => {
  const logs = await captureErrorLogs(async () => {
    const mockFetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "slack" });

    channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(findDeliveryFailureLog(logs, "slack"), "Slack delivery failure must be logged");
});

test("[SYS-REL-2.5] Slack delivery returns delivered=true immediately", () => {
  const mockFetch = async () => {
    throw new Error("ECONNREFUSED");
  };

  const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "slack" });

  const result = channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });
  assert.equal(result.delivered, true, "Slack deliver() returns delivered=true immediately");
});

// ── OpsGenie Delivery Failure Tests ──────────────────────────────────

test("[SYS-REL-2.5] OpsGenie delivery failure increments failure counter", async () => {
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  const mockFetch = async () => {
    throw new Error("ENOTFOUND");
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "opsgenie" });

  channel.deliver(event, { apiKey: "test-api-key" });

  await waitForFailureCounter("opsgenie", 1);
  assert.equal(getCounterValue("alert_delivery_failures_total", { channel: "opsgenie" }), 1);
});

test("[SYS-REL-2.5] OpsGenie delivery failure logs error", async () => {
  const logs = await captureErrorLogs(async () => {
    const mockFetch = async () => {
      throw new Error("ENOTFOUND");
    };

    const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "opsgenie" });

    channel.deliver(event, { apiKey: "test-api-key" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(findDeliveryFailureLog(logs, "opsgenie"), "OpsGenie delivery failure must be logged");
});

test("[SYS-REL-2.5] OpsGenie delivery returns delivered=true immediately", () => {
  const mockFetch = async () => {
    throw new Error("ENOTFOUND");
  };

  const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "opsgenie" });

  const result = channel.deliver(event, { apiKey: "test-api-key" });
  assert.equal(result.delivered, true, "OpsGenie deliver() returns delivered=true immediately");
});

// ── Webhook Delivery Failure Tests ──────────────────────────────────

test("[SYS-REL-2.5] Webhook delivery failure increments failure counter", async () => {
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  const mockFetch = async () => {
    throw new Error("ECONNRESET");
  };

  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "webhook" });

  channel.deliver(event, { url: "https://webhook.example.com/test" });

  await waitForFailureCounter("webhook", 1);
  assert.equal(getCounterValue("alert_delivery_failures_total", { channel: "webhook" }), 1);
});

test("[SYS-REL-2.5] Webhook delivery failure logs error", async () => {
  const logs = await captureErrorLogs(async () => {
    const mockFetch = async () => {
      throw new Error("ECONNRESET");
    };

    const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "webhook" });

    channel.deliver(event, { url: "https://webhook.example.com/test" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(findDeliveryFailureLog(logs, "webhook"), "Webhook delivery failure must be logged");
});

test("[SYS-REL-2.5] Webhook delivery returns delivered=true immediately", () => {
  const mockFetch = async () => {
    throw new Error("ECONNRESET");
  };

  const channel = new WebhookAlertChannel({ fetchImpl: mockFetch });
  const event = createTestEvent({ channelKind: "webhook" });

  const result = channel.deliver(event, { url: "https://webhook.example.com/test" });
  assert.equal(result.delivered, true, "Webhook deliver() returns delivered=true immediately");
});

// ── Error Context Verification Tests ────────────────────────────────

test("[SYS-REL-2.5] PagerDuty error log contains alertId and channel info", async () => {
  const logs = await captureErrorLogs(async () => {
    const mockFetch = async () => {
      throw new Error("ETIMEDOUT");
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({
      id: "alert-pd-123",
      channelKind: "pagerduty"
    });

    channel.deliver(event, { routingKey: "test-key" });

    await flushAlertDeliveryFailure();
  });

  const relevantLog = findDeliveryFailureLog(logs, "pagerduty", "alert-pd-123");
  assert.ok(relevantLog, "Error log must contain alertId and channel context");
});

test("[SYS-REL-2.5] HTTP 4xx errors are logged as delivery failures", async () => {
  const logs = await captureErrorLogs(async () => {
    // Simulate HTTP 400 Bad Request
    const mockFetch = async () => {
      throw Object.assign(new Error("HTTP 400 Bad Request"), { status: 400 });
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "pagerduty" });

    channel.deliver(event, { routingKey: "invalid-key" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(findDeliveryFailureLog(logs, "pagerduty"), "HTTP 4xx errors must be logged as delivery failures");
});

test("[SYS-REL-2.5] HTTP 5xx errors are logged as delivery failures", async () => {
  const logs = await captureErrorLogs(async () => {
    // Simulate HTTP 500 Internal Server Error
    const mockFetch = async () => {
      throw Object.assign(new Error("HTTP 500 Internal Server Error"), { status: 500 });
    };

    const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "slack" });

    channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

    await flushAlertDeliveryFailure();
  });

  assert.ok(findDeliveryFailureLog(logs, "slack"), "HTTP 5xx errors must be logged as delivery failures");
});

// ── Concurrent Delivery Failures Test ──────────────────────────────

test("[SYS-REL-2.5] Multiple concurrent delivery failures all increment counter", async () => {
  runtimeMetricsRegistry.reset(["alert_delivery_failures_total"]);

  const mockFetch = async () => {
    throw new Error("CONCURRENT_FAILURE");
  };

  const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });

  // Trigger multiple concurrent deliveries
  const events = Array.from({ length: 5 }, (_, i) =>
    createTestEvent({ id: `concurrent-${i}`, channelKind: "pagerduty" })
  );

  events.forEach(event => {
    channel.deliver(event, { routingKey: "test-key" });
  });

  await waitForFailureCounter("pagerduty", 5);
  assert.equal(getCounterValue("alert_delivery_failures_total", { channel: "pagerduty" }), 5);
});
