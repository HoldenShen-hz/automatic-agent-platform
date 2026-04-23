import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";
const REPO_ROOT = "/Users/holden/Project/automatic_agent/automatic_agent_platform";
function loadReceivers() {
    const config = parseYaml(readFileSync(join(REPO_ROOT, "deploy/prometheus/alertmanager.yml"), "utf8"));
    return new Map(config.receivers.map((receiver) => [receiver.name, receiver]));
}
test("[SYS-OBS-5.3] alertmanager keeps internal webhook fallback", () => {
    const receivers = loadReceivers();
    assert.match(receivers.get("default-warning")?.webhook_configs?.[0]?.url ?? "", /api-server:3000\/v1\/alerts\/webhook/);
});
test("[SYS-OBS-5.3] alertmanager slack and pagerduty routes have external transports", () => {
    const receivers = loadReceivers();
    assert.ok((receivers.get("slack-warning")?.slack_configs?.length ?? 0) > 0, "slack-warning should define slack transport");
    assert.ok((receivers.get("pagerduty-critical")?.pagerduty_configs?.length ?? 0) > 0, "pagerduty-critical should define pagerduty transport");
});
test("[SYS-OBS-5.3] alertmanager receiver names remain unique", () => {
    const receivers = loadReceivers();
    assert.equal(receivers.size, 3);
});
//# sourceMappingURL=alertmanager-receivers.test.js.map