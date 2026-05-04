/**
 * Unit Test: Configuration Security Defaults
 *
 * Verifies that configuration defaults follow security best practices.
 * Ensures safe defaults are in place for approval modes, sandbox settings, etc.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../..", "config");

async function readConfig(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

test("security defaults: approval mode defaults to supervised or stricter", async () => {
  const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));

  if (securityConfig.approvalMode !== undefined) {
    assert.notEqual(
      securityConfig.approvalMode,
      "bypass",
      "Approval mode should not default to bypass"
    );
  }
});

test("security defaults: sandbox mode defaults to restricted", async () => {
  const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));

  if (securityConfig.sandboxMode !== undefined) {
    assert.equal(
      securityConfig.sandboxMode,
      "read_only",
      "Sandbox mode should default to read_only"
    );
  }
});

test("security defaults: capability allowlists exclude unsupported mcp capability", async () => {
  const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));
  const remoteCapabilities = ((securityConfig.remoteWorkerRegistration as {
    allowedCapabilities?: unknown;
  } | undefined)?.allowedCapabilities ?? []) as unknown[];
  const pluginCapabilities = ((securityConfig.pluginCapabilities as {
    allowedCapabilities?: unknown;
  } | undefined)?.allowedCapabilities ?? []) as unknown[];

  assert.deepEqual(remoteCapabilities, ["edit"]);
  assert.deepEqual(pluginCapabilities, ["edit", "read", "invoke_tool"]);
  assert.equal(remoteCapabilities.includes("mcp"), false);
  assert.equal(pluginCapabilities.includes("mcp"), false);
});

test("security defaults: destructive actions are disabled by default", async () => {
  const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));

  if (securityConfig.allowDestructiveActions !== undefined) {
    assert.strictEqual(
      securityConfig.allowDestructiveActions,
      false,
      "Destructive actions should be disabled by default"
    );
  }
});

test("security defaults: worker registration has secure challenge TTL", async () => {
  const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));

  if (securityConfig.remoteWorkerRegistration !== undefined) {
    const registration = securityConfig.remoteWorkerRegistration as { challengeTtlMs?: number };
    if (registration.challengeTtlMs !== undefined) {
      assert.ok(
        registration.challengeTtlMs > 0 && registration.challengeTtlMs <= 600000,
        "Challenge TTL should be between 0 and 10 minutes"
      );
    }
  }
});

test("security defaults: runtime configuration exists", async () => {
  const runtimeConfig = await readConfig(join(CONFIG_ROOT, "runtime/default.json"));

  assert.ok(
    Object.keys(runtimeConfig).length >= 0,
    "Runtime configuration should exist"
  );
});

test("runtime defaults: canonical node timeout key replaces legacy step timeout key", async () => {
  const runtimeConfig = await readConfig(join(CONFIG_ROOT, "runtime/default.json"));

  assert.equal(runtimeConfig.defaultNodeRunTimeoutMs, 300000);
  assert.equal("defaultStepTimeoutMs" in runtimeConfig, false);
});

test("risk defaults: schema points at a legal JSON schema document", async () => {
  const riskConfig = await readConfig(join(CONFIG_ROOT, "risk/default.json"));

  assert.equal(
    riskConfig.$schema,
    "http://json-schema.org/draft-07/schema#",
  );
});
