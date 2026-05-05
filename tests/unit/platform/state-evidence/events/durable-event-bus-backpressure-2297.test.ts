import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const busSource = readFileSync(
  join(process.cwd(), "src", "platform", "state-evidence", "events", "durable-event-bus.ts"),
  "utf8",
);
const metricsSource = readFileSync(
  join(process.cwd(), "src", "platform", "shared", "observability", "runtime-metrics-registry.ts"),
  "utf8",
);

test("2297: DurableEventBus uses adaptive polling and queue-depth backpressure controls", () => {
  assert.match(busSource, /const ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS = 100/);
  assert.match(busSource, /private calculatePollingInterval\(consumerId: string, queueDepth: number\): number/);
  assert.match(busSource, /if \(queueDepth > 100\)/);
  assert.match(busSource, /else if \(queueDepth > 50\)/);
  assert.match(busSource, /else if \(queueDepth > 10\)/);
  assert.match(busSource, /runtimeMetricsRegistry\.recordEventBackpressure\(consumerId, queueDepth, queueDepth >= highWaterMark\)/);
  assert.match(metricsSource, /public recordEventBackpressure\(consumerId: string, pendingCount: number, isHighWaterMark: boolean\): void/);
  assert.match(metricsSource, /event_bus_backpressure_pending/);
  assert.match(metricsSource, /event_bus_backpressure_high_water/);
});
