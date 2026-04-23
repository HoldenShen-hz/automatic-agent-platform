import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { parse as parseYaml } from "yaml";
test("[SYS-OBS-5.3] alertmanager receivers expose dedicated transport configs", () => {
    const content = readFileSync("deploy/prometheus/alertmanager.yml", "utf8");
    const config = parseYaml(content);
    const receivers = new Map(config.receivers.map((receiver) => [receiver.name, receiver]));
    assert.match(receivers.get("default-warning")?.webhook_configs?.[0]?.url ?? "", /api-server:3000\/v1\/alerts\/webhook/);
    assert.ok((receivers.get("slack-warning")?.slack_configs?.length ?? 0) > 0, "slack-warning should define slack_configs");
    assert.ok((receivers.get("pagerduty-critical")?.pagerduty_configs?.length ?? 0) > 0, "pagerduty-critical should define pagerduty_configs");
});
//# sourceMappingURL=alertmanager-receivers.test.js.map