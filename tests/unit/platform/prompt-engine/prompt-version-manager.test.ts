import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../helpers/repo-root.js";

import { createAssetProductionAdapterPlugin } from "../../../../src/plugins/adapters/asset-production-adapter.js";
import { createCrmAdapterPlugin } from "../../../../src/plugins/adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";
import { createLivestreamAdapterPlugin } from "../../../../src/plugins/adapters/livestream-adapter.js";
import { ChannelGatewayDeliveryService } from "../../../../src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { PackScaffoldService } from "../../../../src/sdk/pack-sdk/pack-scaffold-service.js";

test("R28-21 adapter healthCheck implementations are not hardcoded to true", async () => {
  const gameDevSource = readFileSync(
    resolveRepoPath("src/plugins/adapters/game-dev-adapter.ts"),
    "utf8",
  );
  const assetSource = readFileSync(
    resolveRepoPath("src/plugins/adapters/asset-production-adapter.ts"),
    "utf8",
  );

  assert.match(gameDevSource, /healthCheck\(\)\s*\{\s*return gameDevPolicy\.evaluate/);
  assert.match(assetSource, /healthCheck\(\)\s*\{\s*return assetProductionPolicy\.evaluate/);

  const livestreamPlugin = createLivestreamAdapterPlugin();
  assert.ok(livestreamPlugin.healthCheck);
  assert.equal(await livestreamPlugin.healthCheck(), false);
  await livestreamPlugin.authenticate({ obsToken: "ABCDEFGHIJKLMNOPQRSTUV==" });
  assert.equal(await livestreamPlugin.healthCheck(), true);
});

test("R28-22 and R28-24 prompt-version-manager has a single VersionLineage declaration and no dead versionCache", () => {
  const source = readFileSync(
    resolveRepoPath("src/platform/prompt-engine/registry/prompt-version-manager.ts"),
    "utf8",
  );

  const lineageMatches = source.match(/export interface VersionLineage/g) ?? [];
  assert.equal(lineageMatches.length, 1);
  assert.doesNotMatch(source, /versionCache/);
});

test("R28-23 and R28-28 pack scaffold rejects packIds that can corrupt templates or paths", () => {
  const service = new PackScaffoldService();

  assert.throws(() => {
    service.scaffold({
      packId: "ops$core",
      name: "Ops Core",
      template: "minimal",
      domain: "ops",
      owner: "platform",
      riskLevel: "low",
    });
  }, /Pack ID must match pattern/);

  assert.throws(() => {
    service.scaffold({
      packId: "ops/../core",
      name: "Ops Core",
      template: "minimal",
      domain: "ops",
      owner: "platform",
      riskLevel: "low",
    });
  }, /Pack ID must match pattern/);
});

test("R28-25 websocket bridge uses subprotocol auth instead of query-string JWTs", () => {
  const source = readFileSync(
    resolveRepoPath("src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts"),
    "utf8",
  );

  assert.match(source, /sec-websocket-protocol/);
  assert.match(source, /extractConnectionParams/);
  assert.doesNotMatch(source, /URLSearchParams/);
  assert.doesNotMatch(source, /token=/);
});

test("R28-26 CRM adapter returns fetched API data instead of a hardcoded stub string", async () => {
  const plugin = createCrmAdapterPlugin({ apiBaseUrl: "https://api.hubspot.com" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ id: "contact-1" }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  try {
    await plugin.authenticate({ token: "crm-secret-token-12345678" });
    const result = await plugin.execute("contacts", { limit: 1 });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected CRM adapter call to succeed");
    }
    const payload = result.data as { result: { results: Array<{ id: string }> } };
    assert.deepEqual(payload.result, { results: [{ id: "contact-1" }] });
    assert.doesNotMatch(JSON.stringify(payload.result), /stub/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R28-27 createDeliveryMessage starts in a pending state before any delivery attempt", () => {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    connection: {
      prepare(sql: string) {
        return {
          run(...params: unknown[]) {
            statements.push({ sql, params });
          },
        };
      },
    },
  } as unknown as ConstructorParameters<typeof ChannelGatewayDeliveryService>[0];

  const service = new ChannelGatewayDeliveryService(db, { maxRetries: 4 });
  const receipt = service.createDeliveryMessage("slack", "channel-1", { text: "hello" });

  assert.equal(statements.length, 1);
  assert.equal(receipt.status, "pending_retry");
  assert.equal(receipt.finalStatus, "pending");
});

test("R28-40 approval web view exposes accessibility labels and descriptions for delegate and decision controls", () => {
  const source = readFileSync(
    resolveRepoPath("ui/packages/features/approval/src/web/index.tsx"),
    "utf8",
  );

  assert.match(source, /aria-label=\{translateMessage\("ui\.approval\.delegateTarget"\)\}/);
  assert.match(source, /aria-describedby=\{approvalActionDescriptionId\}/);
  assert.match(source, /id=\{approvalActionDescriptionId\}/);
  assert.match(source, /id=\{delegateActionDescriptionId\}/);
  assert.match(source, /aria-describedby=\{delegateActionDescriptionId\}/);
});

test("R28-42 telemetry export failures are retained as dead letters instead of being silently dropped", async () => {
  const source = readFileSync(
    resolveRepoPath("ui/packages/shared/telemetry/src/index.ts"),
    "utf8",
  );

  assert.match(source, /private readonly deadLetters(?:: [^=]+)? = \[\]/);
  assert.match(source, /public listDeadLetters\(\)/);
  assert.match(source, /this\.deadLetters\.push\(\{/);
  assert.match(source, /reason: entry\.lastError \?\? "telemetry\.export_failed"/);
});
