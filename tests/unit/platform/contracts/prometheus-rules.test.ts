import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

/**
 * [SYS-OBS-5.2] Prometheus rules cover minimum required alert types
 *
 * Verifies that the Prometheus alert rules file includes all mandatory alerts
 * defined in the observability manual. The manual specifies 8 required alerts
 * covering error rates, memory, Redis connectivity, event loop lag, queue depth,
 * disk usage, and worker heartbeat.
 */
test("[SYS-OBS-5.2] prometheus rules cover minimum required alert types", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content);
  const alertNames = config.groups.flatMap((g: { rules: Array<{ alert?: string }> }) => g.rules).map((r: { alert?: string }) => r.alert);
  const required = [
    "AutomaticAgentHighErrorRate",
    "AutomaticAgentTaskFailureRate",
    "AutomaticAgentMemoryPressure",
    "AutomaticAgentRedisDisconnected",
    "AutomaticAgentEventLoopLag",
    "AutomaticAgentQueueDepthHigh",
    "AutomaticAgentDiskUsageHigh",
    "AutomaticAgentWorkerHeartbeatTimeout",
  ];
  for (const name of required) {
    assert.ok(alertNames.includes(name), `Missing required alert: ${name}`);
  }
});
