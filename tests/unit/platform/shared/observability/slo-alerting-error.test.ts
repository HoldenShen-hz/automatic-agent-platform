import assert from "node:assert/strict";
import test from "node:test";

import {
  PagerDutyAlertChannel,
  SlackAlertChannel,
  OpsGenieAlertChannel,
  type AlertEvent,
} from "../../../../../src/platform/shared/observability/slo-alerting-service.js";

/**
 * SYS-REL-2.5: Alert delivery failures must be logged and increment failure counters.
 *
 * Background: slo-alerting-service.ts has .catch(() => {}) at lines 228/285/343
 * which silently swallow delivery failures for Slack/PagerDuty/OpsGenie.
 *
 * This test verifies that when alert delivery fails, the error is NOT logged
 * (i.e., the bug exists - errors are silently swallowed).
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

test("[SYS-REL-2.5] PagerDuty delivery failure is silently swallowed (BUG VERIFICATION)", async () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ETIMEDOUT");
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "pagerduty" });

    // This should NOT throw even though fetch fails
    const result = channel.deliver(event, { routingKey: "test-key" });

    // The channel returns delivered=true because it fires-and-forgets
    assert.equal(result.delivered, true, "Channel returns delivered=true for fire-and-forget");

    // Wait for the async fetch to complete and catch block to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    // BUG: No error is logged - logs should contain an error but they don't
    // If the bug is fixed, logs.length should be > 0
    assert.equal(
      logs.length,
      0,
      "BUG CONFIRMED: Delivery failure is silently swallowed - no error logged",
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.5] Slack delivery failure is silently swallowed (BUG VERIFICATION)", async () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "slack" });

    const result = channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

    assert.equal(result.delivered, true, "Channel returns delivered=true for fire-and-forget");

    await new Promise((resolve) => setTimeout(resolve, 50));

    // BUG: No error is logged
    assert.equal(
      logs.length,
      0,
      "BUG CONFIRMED: Slack delivery failure is silently swallowed - no error logged",
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.5] OpsGenie delivery failure is silently swallowed (BUG VERIFICATION)", async () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ENOTFOUND");
    };

    const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "opsgenie" });

    const result = channel.deliver(event, { apiKey: "test-api-key" });

    assert.equal(result.delivered, true, "Channel returns delivered=true for fire-and-forget");

    await new Promise((resolve) => setTimeout(resolve, 50));

    // BUG: No error is logged
    assert.equal(
      logs.length,
      0,
      "BUG CONFIRMED: OpsGenie delivery failure is silently swallowed - no error logged",
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.5] After fix: PagerDuty delivery failure should log error", async () => {
  // This test documents the EXPECTED behavior after fixing the bug.
  // Currently this test will FAIL because the bug exists.
  //
  // After fixing the .catch(() => {}) to .catch((err) => { logger.error(...) }),
  // this test should PASS.

  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ETIMEDOUT");
    };

    const channel = new PagerDutyAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "pagerduty" });

    channel.deliver(event, { routingKey: "test-key" });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // EXPECTED: Error should be logged (but currently it is not)
    assert.ok(
      logs.length > 0,
      "EXPECTED BEHAVIOR: Delivery failure must be logged (currently broken)",
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.5] After fix: Slack delivery failure should log error", async () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    const channel = new SlackAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "slack" });

    channel.deliver(event, { webhookUrl: "https://hooks.slack.test/services/abc" });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(
      logs.length > 0,
      "EXPECTED BEHAVIOR: Slack delivery failure must be logged (currently broken)",
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.5] After fix: OpsGenie delivery failure should log error", async () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (msg: string, ...args: unknown[]) => {
    logs.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  };

  try {
    const mockFetch = async () => {
      throw new Error("ENOTFOUND");
    };

    const channel = new OpsGenieAlertChannel({ fetchImpl: mockFetch });
    const event = createTestEvent({ channelKind: "opsgenie" });

    channel.deliver(event, { apiKey: "test-api-key" });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(
      logs.length > 0,
      "EXPECTED BEHAVIOR: OpsGenie delivery failure must be logged (currently broken)",
    );
  } finally {
    console.error = originalConsoleError;
  }
});
