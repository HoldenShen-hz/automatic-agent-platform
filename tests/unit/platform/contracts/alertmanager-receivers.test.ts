import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { parse as parseYaml } from "yaml";

/**
 * [SYS-OBS-5.3] Alertmanager receivers have distinct endpoints
 *
 * Verifies that all three Alertmanager receivers point to distinct endpoints
 * as specified in the observability manual: default-warning (webhook),
 * slack-warning (Slack), and pagerduty-critical (PagerDuty).
 */
test("[SYS-OBS-5.3] alertmanager receivers have distinct endpoints", () => {
  const content = readFileSync(
    "deploy/prometheus/alertmanager.yml",
    "utf8",
  );
  const config = parseYaml(content);
  const urls = config.receivers.map((r) =>
    r.webhook_configs?.[0]?.url ??
    r.pagerduty_configs?.[0]?.service_key ??
    r.slack_configs?.[0]?.url ??
    "none",
  );
  const uniqueUrls = new Set(urls);
  assert.ok(
    uniqueUrls.size >= config.receivers.length,
    `Expected ${config.receivers.length} distinct receiver endpoints, got ${uniqueUrls.size}`,
  );
});