import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultStartupConfigValidator,
  buildEnvironmentProviderReadinessProbe,
  createDefaultStartupConsistencyCheckerOptions,
  deriveProviderApiKeyEnvName,
  deriveProviderApiKeySecretRefEnvNameForStartup,
  deriveProviderApiKeySecretRefsJsonEnvNameForStartup,
  deriveProviderApiKeysJsonEnvNameForStartup,
} from "../../../../src/platform/execution/startup/startup-preflight.js";

test("startup-preflight module exists and exports expected functions", async () => {
  assert.ok(typeof buildDefaultStartupConfigValidator === "function", "Should export buildDefaultStartupConfigValidator function");
  assert.ok(typeof buildEnvironmentProviderReadinessProbe === "function", "Should export buildEnvironmentProviderReadinessProbe function");
  assert.ok(typeof createDefaultStartupConsistencyCheckerOptions === "function", "Should export createDefaultStartupConsistencyCheckerOptions function");
  assert.ok(typeof deriveProviderApiKeyEnvName === "function", "Should export deriveProviderApiKeyEnvName function");
  assert.ok(typeof deriveProviderApiKeysJsonEnvNameForStartup === "function", "Should export deriveProviderApiKeysJsonEnvNameForStartup function");
  assert.ok(typeof deriveProviderApiKeySecretRefEnvNameForStartup === "function", "Should export deriveProviderApiKeySecretRefEnvNameForStartup function");
  assert.ok(typeof deriveProviderApiKeySecretRefsJsonEnvNameForStartup === "function", "Should export deriveProviderApiKeySecretRefsJsonEnvNameForStartup function");
});

test("deriveProviderApiKeyEnvName returns expected env var name", () => {
  const result = deriveProviderApiKeyEnvName("test-provider");
  assert.ok(typeof result === "string", "Should return a string");
  assert.ok(result.includes("test-provider"), "Should contain provider ID");
});

test("buildDefaultStartupConfigValidator returns a function", () => {
  const validator = buildDefaultStartupConfigValidator();
  assert.ok(typeof validator === "function", "Should return a validator function");
});

test("buildEnvironmentProviderReadinessProbe returns a function", () => {
  const probe = buildEnvironmentProviderReadinessProbe();
  assert.ok(typeof probe === "function", "Should return a probe function");
});

test("createDefaultStartupConsistencyCheckerOptions returns an options object", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();
  assert.ok(options !== null && typeof options === "object", "Should return an options object");
  assert.ok(typeof options.configValidator === "function", "Should have configValidator function");
  assert.ok(typeof options.providerReadinessProbe === "function", "Should have providerReadinessProbe function");
});
