import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { parse as parseYaml } from "yaml";

test("[SYS-OBS-5.3] alertmanager receivers expose dedicated transport configs", () => {
  const content = readFileSync(
    "deploy/prometheus/alertmanager.yml",
    "utf8",
  );
  const config = parseYaml(content) as {
    receivers: Array<{
      name: string;
      webhook_configs?: Array<{ url?: string }>;
      pagerduty_configs?: Array<{ service_key?: string }>;
      slack_configs?: Array<{ url?: string }>;
    }>;
  };
  const receivers = new Map(config.receivers.map((receiver) => [receiver.name, receiver]));

  assert.equal(receivers.has("ops-null"), true);
  assert.equal(receivers.get("slack-warning")?.webhook_configs?.length ?? 0, 0, "slack-warning should not use generic webhook_configs");
  assert.ok((receivers.get("slack-warning")?.slack_configs?.length ?? 0) > 0, "slack-warning should define slack_configs");
  assert.ok((receivers.get("pagerduty-critical")?.pagerduty_configs?.length ?? 0) > 0, "pagerduty-critical should define pagerduty_configs");
});
