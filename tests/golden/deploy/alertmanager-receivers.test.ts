import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import { resolveRepoPath } from "../../helpers/repo-root.js";

function loadReceivers(): Map<string, {
  webhook_configs?: Array<{ url?: string }>;
  pagerduty_configs?: Array<{ service_key?: string }>;
  slack_configs?: Array<{ url?: string }>;
}> {
  const config = parseYaml(
    readFileSync(resolveRepoPath("deploy", "prometheus", "alertmanager.yml"), "utf8"),
  ) as {
    receivers: Array<{
      name: string;
      webhook_configs?: Array<{ url?: string }>;
      pagerduty_configs?: Array<{ service_key?: string }>;
      slack_configs?: Array<{ url?: string }>;
    }>;
  };

  return new Map(config.receivers.map((receiver) => [receiver.name, receiver]));
}

test("[SYS-OBS-5.3] alertmanager keeps an explicit null/default receiver", () => {
  const receivers = loadReceivers();
  assert.equal(receivers.has("ops-null"), true);
  assert.equal(receivers.get("ops-null")?.webhook_configs?.length ?? 0, 0);
  assert.equal(receivers.has("slack-default"), true);
});

test("[SYS-OBS-5.3] alertmanager slack and pagerduty routes have external transports", () => {
  const receivers = loadReceivers();
  assert.ok((receivers.get("slack-warning")?.slack_configs?.length ?? 0) > 0, "slack-warning should define slack transport");
  assert.ok((receivers.get("pagerduty-critical")?.pagerduty_configs?.length ?? 0) > 0, "pagerduty-critical should define pagerduty transport");
});

test("[SYS-OBS-5.3] alertmanager receiver names remain unique", () => {
  const receivers = loadReceivers();
  assert.equal(receivers.size, 4);
});

test("[SYS-OBS-5.3] alertmanager defines inhibit rules and severity-aware routing", () => {
  const config = parseYaml(
    readFileSync(resolveRepoPath("deploy", "prometheus", "alertmanager.yml"), "utf8"),
  ) as {
    inhibit_rules?: unknown[];
    route?: { receiver?: string; routes?: Array<{ receiver?: string }> };
  };

  assert.ok((config.inhibit_rules?.length ?? 0) >= 1, "Alertmanager should suppress duplicate warning noise beneath critical alerts");
  assert.equal(config.route?.receiver, "slack-default");
  assert.deepEqual(
    config.route?.routes?.map((route) => route.receiver),
    ["pagerduty-critical", "slack-warning", "pagerduty-critical"],
  );
});
