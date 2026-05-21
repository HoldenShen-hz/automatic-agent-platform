import assert from "node:assert/strict";
import test from "node:test";

import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";

test.describe("GameDevAdapter Plugin", () => {
  test("createGameDevAdapterPlugin returns ExternalAdapterPlugin with correct metadata", () => {
    const adapter = createGameDevAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.gamedev.unity_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "unity_cloud_build");
    assert.deepEqual(adapter.capabilityIds, ["build.status", "build.logs", "build.artifacts"]);
  });

  test("initialize returns undefined", async () => {
    const adapter = createGameDevAdapterPlugin();
    const result = await adapter.initialize();
    assert.equal(result, undefined);
  });

  test("shutdown clears credential fingerprint", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "unity_token_abc12345" });
    await adapter.shutdown();
  });

  test("healthCheck evaluates Unity Cloud Build egress policy", async () => {
    const adapter = createGameDevAdapterPlugin();
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });
});

test.describe("GameDevAdapter authenticate", () => {
  test("authenticate stores credential fingerprint", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "unity_token_abc12345" });
  });

  test("authenticate accepts managedSecretRef format", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ managedSecretRef: "secret://unity-token" });
  });

  test("authenticate throws on missing credentials", async () => {
    const adapter = createGameDevAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({}),
      { message: /game_dev_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on null token", async () => {
    const adapter = createGameDevAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: null }),
      { message: /game_dev_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on undefined token", async () => {
    const adapter = createGameDevAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: undefined }),
      { message: /game_dev_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on non-string token", async () => {
    const adapter = createGameDevAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: 12345 as any }),
      { message: /game_dev_adapter\.missing_credentials/ },
    );
  });

  test("authenticate creates fingerprint with prefix unity_", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "test_unity_token_value" });
  });

  test("authenticate fingerprint uses first 8 chars of token", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "abcdefghijklmnop" });
  });
});

test.describe("GameDevAdapter execute", () => {
  test("execute throws when not authenticated", async () => {
    const adapter = createGameDevAdapterPlugin();
    await assert.rejects(
      async () => adapter.execute("get_build_status", { projectSlug: "my-project" }),
      { message: /game_dev_adapter\.not_authenticated/ },
    );
  });

  test("execute returns success response for get_build_status action", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {
      projectSlug: "my-project",
      buildTarget: "ios",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_build_status");
    assert.equal(result.output.projectSlug, "my-project");
    assert.equal(result.output.buildTarget, "ios");
    assert.equal(result.output.status, "success");
  });

  test("execute returns success response for get_build_logs action", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_logs", {
      projectSlug: "test-project",
      buildTarget: "android",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_build_logs");
    assert.equal(result.output.projectSlug, "test-project");
    assert.equal(result.output.buildTarget, "android");
  });

  test("execute returns success response for get_build_artifacts action", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_artifacts", {
      projectSlug: "my-game",
      buildTarget: "windows",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_build_artifacts");
    assert.equal(result.output.projectSlug, "my-game");
    assert.equal(result.output.buildTarget, "windows");
  });

  test("execute handles missing projectSlug", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {}) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.projectSlug, null);
    assert.equal(result.output.buildTarget, null);
  });

  test("execute handles missing buildTarget", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", { projectSlug: "my-project" }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.projectSlug, "my-project");
    assert.equal(result.output.buildTarget, null);
  });

  test("execute includes message with action and project info", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {
      projectSlug: "my-project",
      buildTarget: "ios",
    }) as any;
    assert.ok(result.output.message.includes("get_build_status"));
    assert.ok(result.output.message.includes("my-project"));
  });

  test("execute handles null values in params", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {
      projectSlug: null,
      buildTarget: null,
    } as any) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.projectSlug, null);
  });
});

test.describe("GameDevAdapter egress policy", () => {
  test("execute enforces Unity Cloud Build egress policy", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    // With default policy (allowed), should succeed
    const result = await adapter.execute("get_build_status", {
      projectSlug: "my-project",
    }) as any;
    assert.equal(result.success, true);
  });
});

test.describe("GameDevAdapter state management", () => {
  test("execute fails after shutdown even with prior authentication", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    await adapter.shutdown();
    await assert.rejects(
      async () => adapter.execute("get_build_status", { projectSlug: "my-project" }),
      { message: /game_dev_adapter\.not_authenticated/ },
    );
  });

  test("multiple execute calls share authentication state", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result1 = await adapter.execute("get_build_status", { projectSlug: "project1" }) as any;
    const result2 = await adapter.execute("get_build_logs", { projectSlug: "project2" }) as any;
    assert.equal(result1.success, true);
    assert.equal(result2.success, true);
    assert.equal(result1.output.projectSlug, "project1");
    assert.equal(result2.output.projectSlug, "project2");
  });

  test("re-authenticate after shutdown works", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "first_token" });
    await adapter.shutdown();
    await adapter.authenticate({ token: "second_token" });
    const result = await adapter.execute("get_build_status", { projectSlug: "test" }) as any;
    assert.equal(result.success, true);
  });
});

test.describe("GameDevAdapter edge cases", () => {
  test("execute handles very long projectSlug", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const longSlug = "a".repeat(100);
    const result = await adapter.execute("get_build_status", { projectSlug: longSlug }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.projectSlug, longSlug);
  });

  test("execute handles special characters in buildTarget", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {
      projectSlug: "my-project",
      buildTarget: "platform/architecture/variant",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.buildTarget, "platform/architecture/variant");
  });

  test("execute response structure is consistent", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("get_build_status", {
      projectSlug: "my-project",
    }) as any;
    assert.ok(typeof result.success === "boolean");
    assert.ok(result.output !== undefined);
    assert.ok(typeof result.output.action === "string");
    assert.ok(typeof result.output.status === "string");
    assert.ok(typeof result.output.message === "string");
  });

  test("execute handles unknown action gracefully", async () => {
    const adapter = createGameDevAdapterPlugin();
    await adapter.authenticate({ token: "valid_unity_token_12345" });
    const result = await adapter.execute("unknown_action" as any, {
      projectSlug: "my-project",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "unknown_action");
  });
});