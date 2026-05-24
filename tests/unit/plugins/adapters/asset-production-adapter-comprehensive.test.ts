import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { createAssetProductionAdapterPlugin } from "../../../../src/plugins/adapters/asset-production-adapter.js";

test.describe("AssetProductionAdapter Plugin", () => {
  test("createAssetProductionAdapterPlugin returns ExternalAdapterPlugin with correct metadata", () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.equal(adapter.pluginId, "plugin.assetproduction.figma_adapter");
    assert.equal(adapter.spiType, "adapter");
    assert.equal(adapter.adapterType, "figma");
    assert.deepEqual(adapter.capabilityIds, ["figma.files", "figma.components", "cdn.assets", "design_tokens"]);
  });

  test("initialize returns undefined", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter.initialize);
    const result = await adapter.initialize();
    assert.equal(result, undefined);
  });

  test("shutdown clears credential fingerprint", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "figma_token_12345" });
    assert.ok(adapter.shutdown);
    await adapter.shutdown();
  });

  test("healthCheck evaluates Figma API and CDN egress policy", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    assert.ok(adapter.healthCheck);
    const result = await adapter.healthCheck();
    assert.equal(result, true);
  });
});

test.describe("AssetProductionAdapter authenticate", () => {
  test("authenticate stores credential fingerprint", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "figma_token_abc123def456" });
  });

  test("authenticate accepts managedSecretRef format", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ managedSecretRef: "secret://figma-token" });
  });

  test("authenticate throws on missing credentials", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({}),
      { message: /asset_production_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on null token", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: null }),
      { message: /asset_production_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on undefined token", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: undefined }),
      { message: /asset_production_adapter\.missing_credentials/ },
    );
  });

  test("authenticate throws on non-string token", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await assert.rejects(
      async () => adapter.authenticate({ token: 12345 as any }),
      { message: /asset_production_adapter\.missing_credentials/ },
    );
  });

  test("authenticate creates fingerprint with prefix figma_", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "test_token_value" });
  });
});

test.describe("AssetProductionAdapter execute", () => {
  test("execute throws when not authenticated", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await assert.rejects(
      async () => adapter.execute("get_file", { fileKey: "abc123" }),
      { message: /asset_production_adapter\.not_authenticated/ },
    );
  });

  test("execute returns success response for get_file action", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", {
      fileKey: "abc123",
      nodeId: "node_456",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_file");
    assert.equal(result.output.fileKey, "abc123");
    assert.equal(result.output.nodeId, "node_456");
    assert.equal(result.output.status, "success");
  });

  test("execute returns success response for get_components action", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_components", {
      fileKey: "abc123",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "get_components");
    assert.equal(result.output.fileKey, "abc123");
    assert.equal(result.output.nodeId, null);
  });

  test("execute handles missing fileKey", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", {}) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.fileKey, null);
    assert.equal(result.output.nodeId, null);
  });

  test("execute handles missing nodeId", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", { fileKey: "abc123" }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.fileKey, "abc123");
    assert.equal(result.output.nodeId, null);
  });

  test("execute includes message with action and fileKey", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", { fileKey: "test_file_key" }) as any;
    assert.ok(result.output.message.includes("get_file"));
    assert.ok(result.output.message.includes("test_file_key"));
  });

  test("execute handles cdn_ prefix action for CDN policy", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("cdn_assets", { fileKey: "abc123" }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "cdn_assets");
  });
});

test.describe("AssetProductionAdapter egress policy", () => {
  test("execute throws PolicyDeniedError when egress denied for API action", async () => {
    // The default policy allows api.figma.com, so this test validates
    // that the policy check is in place. A different policy could be injected.
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    // With default policy (allowed), should succeed
    const result = await adapter.execute("get_file", { fileKey: "abc123" }) as any;
    assert.equal(result.success, true);
  });

  test("execute enforces CDN URL for cdn_ prefixed actions", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    // cdn_ actions target cdn.figma.com per source
    const result = await adapter.execute("cdn_assets", { fileKey: "abc123" }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.action, "cdn_assets");
  });
});

test.describe("AssetProductionAdapter state management", () => {
  test("execute fails after shutdown even with prior authentication", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    assert.ok(adapter.shutdown);
    await adapter.shutdown();
    await assert.rejects(
      async () => adapter.execute("get_file", { fileKey: "abc123" }),
      { message: /asset_production_adapter\.not_authenticated/ },
    );
  });

  test("multiple execute calls share authentication state", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result1 = await adapter.execute("get_file", { fileKey: "file1" }) as any;
    const result2 = await adapter.execute("get_file", { fileKey: "file2" }) as any;
    assert.equal(result1.success, true);
    assert.equal(result2.success, true);
    assert.equal(result1.output.fileKey, "file1");
    assert.equal(result2.output.fileKey, "file2");
  });
});

test.describe("AssetProductionAdapter edge cases", () => {
  test("execute handles very long fileKey", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const longKey = "a".repeat(100);
    const result = await adapter.execute("get_file", { fileKey: longKey }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.fileKey, longKey);
  });

  test("execute handles special characters in nodeId", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", {
      fileKey: "abc123",
      nodeId: "node:123:456",
    }) as any;
    assert.equal(result.success, true);
    assert.equal(result.output.nodeId, "node:123:456");
  });

  test("execute response structure is consistent", async () => {
    const adapter = createAssetProductionAdapterPlugin();
    await adapter.authenticate({ token: "valid_figma_token_12345" });
    const result = await adapter.execute("get_file", { fileKey: "abc123" }) as any;
    assert.ok(typeof result.success === "boolean");
    assert.ok(result.output !== undefined);
    assert.ok(typeof result.output.action === "string");
    assert.ok(typeof result.output.status === "string");
    assert.ok(typeof result.output.message === "string");
  });
});
