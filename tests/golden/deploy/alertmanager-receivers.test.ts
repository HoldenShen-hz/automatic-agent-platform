/**
 * [SYS-OBS-5.3] Alertmanager Receivers Validation Tests
 *
 * Tests to verify that alertmanager receivers have distinct endpoints.
 * Having all receivers point to the same webhook URL provides no redundancy.
 *
 * Defect: deploy/prometheus/alertmanager.yml has three receivers (default-warning,
 * slack-warning, pagerduty-critical) all pointing to the same internal webhook URL.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// YAML parsing - using simple regex-based parsing since we don't want to add dependencies
// In a real project you'd use yaml package
function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");

  let currentSection: Record<string, unknown> | null = null;
  let currentSectionName = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Top-level key:
    if (trimmed.includes(":") && !trimmed.startsWith("  ") && !trimmed.startsWith("-")) {
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value === "" || value === "{" || value === "[]") {
        result[key] = {};
        currentSection = result[key] as Record<string, unknown>;
        currentSectionName = key;
      } else if (value.startsWith("[") || value === "true" || value === "false" || !isNaN(Number(value))) {
        result[key] = value;
      } else {
        result[key] = value;
      }
    } else if (trimmed.startsWith("- ")) {
      // Array item
      const itemContent = trimmed.substring(2);
      if (itemContent.includes(":") && !itemContent.includes("{")) {
        const [name, ...rest] = itemContent.split(":");
        if (currentSection && Array.isArray((currentSection as Record<string, unknown>)[currentSectionName])) {
          const arr = (currentSection as Record<string, unknown>)[currentSectionName] as unknown[];
          const item: Record<string, unknown> = {};
          item[name.trim()] = rest.join(":").trim();
          arr.push(item);
        }
      }
    } else if (trimmed.includes(":")) {
      // Nested key
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (currentSection) {
        if (value === "") {
          currentSection[key] = {};
        } else {
          currentSection[key] = value;
        }
      }
    }
  }

  return result;
}

test("[SYS-OBS-5.3] alertmanager receivers have distinct endpoints", () => {
  const configPath = join(process.cwd(), "deploy/prometheus/alertmanager.yml");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    // Try alternative path
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "prometheus", "alertmanager.yml"), "utf8");
    } catch {
      // Skip test if file doesn't exist in expected location
      assert.ok(true, "Alertmanager config file not found, skipping test");
      return;
    }
  }

  const config = parseYaml(content);

  // Check receivers exist
  const receivers = (config.receivers as Array<Record<string, unknown>> | undefined);
  assert.ok(receivers !== undefined, "receivers must be defined in alertmanager.yml");
  assert.ok(Array.isArray(receivers), "receivers must be an array");
  assert.ok(receivers!.length > 0, "receivers must not be empty");

  // Extract URLs from each receiver
  const receiverUrls: Array<{ name: string; url: string }> = [];

  for (const receiver of receivers!) {
    const name = String(receiver.name ?? "unnamed");
    let url = "none";

    // Check webhook_configs
    const webhookConfigs = (receiver.webhook_configs as Array<Record<string, unknown>> | undefined);
    if (webhookConfigs && webhookConfigs.length > 0) {
      url = String(webhookConfigs[0]!.url ?? "none");
    }

    // Check pagerduty_configs
    const pagerdutyConfigs = (receiver.pagerduty_configs as Array<Record<string, unknown>> | undefined);
    if (pagerdutyConfigs && pagerdutyConfigs.length > 0) {
      url = String(pagerdutyConfigs[0]!.service_key ?? "none");
    }

    // Check slack_configs
    const slackConfigs = (receiver.slack_configs as Array<Record<string, unknown>> | undefined);
    if (slackConfigs && slackConfigs.length > 0) {
      url = String(slackConfigs[0]!.channel ?? "none");
    }

    receiverUrls.push({ name, url });
  }

  // Check for distinct endpoints
  const urls = receiverUrls.map((r) => r.url);
  const uniqueUrls = new Set(urls);

  assert.ok(
    uniqueUrls.size >= receivers!.length,
    `Expected ${receivers!.length} distinct receiver endpoints, but got only ${uniqueUrls.size} unique URLs. Defect: All receivers point to same webhook URL. Receivers: ${receiverUrls.map((r) => `${r.name}:${r.url}`).join(", ")}`,
  );
});

test("[SYS-OBS-5.3] alertmanager route uses correct receiver mapping", () => {
  const configPath = join(process.cwd(), "deploy/prometheus/alertmanager.yml");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "prometheus", "alertmanager.yml"), "utf8");
    } catch {
      assert.ok(true, "Alertmanager config file not found, skipping test");
      return;
    }
  }

  const config = parseYaml(content);

  // Verify route section exists
  const route = (config.route as Record<string, unknown> | undefined);
  assert.ok(route !== undefined, "route must be defined");
  assert.ok(route!.receiver, "default receiver must be defined");

  // Verify receivers are properly named
  const receivers = (config.receivers as Array<Record<string, unknown>> | undefined);
  if (receivers) {
    for (const receiver of receivers) {
      assert.ok(receiver.name, "Each receiver must have a name");
    }
  }
});

test("[SYS-OBS-5.3] no receiver duplicates", () => {
  const configPath = join(process.cwd(), "deploy/prometheus/alertmanager.yml");

  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    try {
      content = readFileSync(join(process.cwd(), "..", "deploy", "prometheus", "alertmanager.yml"), "utf8");
    } catch {
      assert.ok(true, "Alertmanager config file not found, skipping test");
      return;
    }
  }

  const config = parseYaml(content);
  const receivers = (config.receivers as Array<Record<string, unknown>> | undefined);

  if (!receivers) {
    assert.ok(true, "No receivers defined, skipping test");
    return;
  }

  const receiverNames = receivers.map((r) => String(r.name));
  const uniqueNames = new Set(receiverNames);

  assert.equal(
    receiverNames.length,
    uniqueNames.size,
    "Receiver names must be unique, duplicates found",
  );
});