/**
 * [SYS-OBS-5.2] Prometheus Alert Rules Completeness Tests
 *
 * Verifies that Prometheus alert rules cover minimum required alert types.
 * Incomplete alerting leads to undetected production incidents.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";

test("[SYS-OBS-5.2] prometheus rules cover minimum required alert types", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content) as {
    groups?: Array<{ name?: string; rules?: Array<{ alert?: string }> }>;
  };

  const alertNames: string[] = [];
  if (config.groups) {
    for (const group of config.groups) {
      if (group.rules) {
        for (const rule of group.rules) {
          if (rule.alert) {
            alertNames.push(rule.alert);
          }
        }
      }
    }
  }

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

test("[SYS-OBS-5.2] prometheus rules file exists and is valid yaml", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content);
  assert.ok(config !== null, "Prometheus rules file must be valid YAML");
  assert.ok(
    Array.isArray(config.groups),
    "Prometheus rules must have groups array",
  );
});

test("[SYS-OBS-5.2] prometheus rules have at least 3 alerting rules", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content) as {
    groups?: Array<{ name?: string; rules?: Array<{ alert?: string }> }>;
  };

  let alertCount = 0;
  if (config.groups) {
    for (const group of config.groups) {
      if (group.rules) {
        for (const rule of group.rules) {
          if (rule.alert) {
            alertCount++;
          }
        }
      }
    }
  }

  assert.ok(
    alertCount >= 3,
    `Expected at least 3 alert rules, found ${alertCount}`,
  );
});

test("[SYS-OBS-5.2] prometheus alert queries use exporter metric units and current backlog names", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );

  assert.match(content, /http_request_duration_ms_bucket/);
  assert.doesNotMatch(content, /http_request_duration_seconds_bucket/);
  assert.match(content, /queued_tasks/);
  assert.doesNotMatch(content, /\bqueue_depth\b/);
  assert.match(content, /dead_letter_count/);
  assert.doesNotMatch(content, /dlq_entries_total/);
  assert.match(content, /outbox_pending/);
  assert.doesNotMatch(content, /outbox_pending_total/);
});
