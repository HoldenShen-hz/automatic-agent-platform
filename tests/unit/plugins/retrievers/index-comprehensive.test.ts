import assert from "node:assert/strict";
import test from "node:test";

import * as RetrieversIndex from "../../../../src/plugins/retrievers/index.js";

test.describe("RetrieversIndex comprehensive tests", () => {
  test("exports createAssetProductionRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createAssetProductionRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createAssetProductionRetrieverPlugin, "function");
  });

  test("exports createCodingRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createCodingRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createCodingRetrieverPlugin, "function");
  });

  test("exports createGameDevRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createGameDevRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createGameDevRetrieverPlugin, "function");
  });

  test("exports createGrowthRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createGrowthRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createGrowthRetrieverPlugin, "function");
  });

  test("exports createLivestreamRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createLivestreamRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createLivestreamRetrieverPlugin, "function");
  });

  test("exports createOperationsRetrieverPlugin", () => {
    assert.ok(RetrieversIndex.createOperationsRetrieverPlugin !== undefined);
    assert.equal(typeof RetrieversIndex.createOperationsRetrieverPlugin, "function");
  });

  test.describe("all retrievers create valid plugins", () => {
    test("AssetProductionRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createAssetProductionRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.assetproduction.retriever");
      assert.equal(plugin.domainId, "assetproduction");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });

    test("CodingRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createCodingRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.coding.retriever");
      assert.equal(plugin.domainId, "coding");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });

    test("GameDevRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createGameDevRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.gamedev.retriever");
      assert.equal(plugin.domainId, "game-dev");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });

    test("GrowthRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createGrowthRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.growth.retriever");
      assert.equal(plugin.domainId, "growth");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });

    test("LivestreamRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createLivestreamRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.livestream.retriever");
      assert.equal(plugin.domainId, "live-streaming");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });

    test("OperationsRetriever creates valid plugin", () => {
      const plugin = RetrieversIndex.createOperationsRetrieverPlugin();
      assert.ok(plugin !== undefined);
      assert.equal(plugin.pluginId, "plugin.operations.retriever");
      assert.equal(plugin.domainId, "operations");
      assert.equal(plugin.spiType, "retriever");
      assert.ok(Array.isArray(plugin.capabilityIds));
      assert.ok(plugin.capabilityIds.length > 0);
    });
  });

  test.describe("all retrievers have retrieve method", () => {
    const retrievers = [
      { name: "AssetProductionRetriever", create: RetrieversIndex.createAssetProductionRetrieverPlugin },
      { name: "CodingRetriever", create: RetrieversIndex.createCodingRetrieverPlugin },
      { name: "GameDevRetriever", create: RetrieversIndex.createGameDevRetrieverPlugin },
      { name: "GrowthRetriever", create: RetrieversIndex.createGrowthRetrieverPlugin },
      { name: "LivestreamRetriever", create: RetrieversIndex.createLivestreamRetrieverPlugin },
      { name: "OperationsRetriever", create: RetrieversIndex.createOperationsRetrieverPlugin },
    ];

    for (const { name, create } of retrievers) {
      test(`${name} has retrieve method`, () => {
        const plugin = create();
        assert.ok(typeof plugin.retrieve === "function", `${name} should have a retrieve method`);
      });
    }
  });

  test.describe("all retrievers have lifecycle methods", () => {
    const retrievers = [
      { name: "AssetProductionRetriever", create: RetrieversIndex.createAssetProductionRetrieverPlugin },
      { name: "CodingRetriever", create: RetrieversIndex.createCodingRetrieverPlugin },
      { name: "GameDevRetriever", create: RetrieversIndex.createGameDevRetrieverPlugin },
      { name: "GrowthRetriever", create: RetrieversIndex.createGrowthRetrieverPlugin },
      { name: "LivestreamRetriever", create: RetrieversIndex.createLivestreamRetrieverPlugin },
      { name: "OperationsRetriever", create: RetrieversIndex.createOperationsRetrieverPlugin },
    ];

    for (const { name, create } of retrievers) {
      test(`${name} has initialize method`, () => {
        const plugin = create();
        assert.ok(typeof plugin.initialize === "function", `${name} should have an initialize method`);
      });

      test(`${name} has healthCheck method`, () => {
        const plugin = create();
        assert.ok(typeof plugin.healthCheck === "function", `${name} should have a healthCheck method`);
      });

      test(`${name} has shutdown method`, () => {
        const plugin = create();
        assert.ok(typeof plugin.shutdown === "function", `${name} should have a shutdown method`);
      });
    }
  });

  test.describe("all retrievers implement DomainRetrieverPlugin interface", () => {
    const retrievers = [
      { name: "AssetProductionRetriever", create: RetrieversIndex.createAssetProductionRetrieverPlugin },
      { name: "CodingRetriever", create: RetrieversIndex.createCodingRetrieverPlugin },
      { name: "GameDevRetriever", create: RetrieversIndex.createGameDevRetrieverPlugin },
      { name: "GrowthRetriever", create: RetrieversIndex.createGrowthRetrieverPlugin },
      { name: "LivestreamRetriever", create: RetrieversIndex.createLivestreamRetrieverPlugin },
      { name: "OperationsRetriever", create: RetrieversIndex.createOperationsRetrieverPlugin },
    ];

    for (const { name, create } of retrievers) {
      test(`${name} has correct pluginId format`, () => {
        const plugin = create();
        assert.ok(plugin.pluginId.startsWith("plugin."), `${name} should have pluginId starting with "plugin."`);
        assert.ok(plugin.pluginId.includes(".retriever"), `${name} should have pluginId containing ".retriever"`);
      });

      test(`${name} has correct spiType`, () => {
        const plugin = create();
        assert.equal(plugin.spiType, "retriever", `${name} should have spiType "retriever"`);
      });

      test(`${name} has non-empty domainId`, () => {
        const plugin = create();
        assert.ok(plugin.domainId.length > 0, `${name} should have a non-empty domainId`);
      });
    }
  });

  test.describe("all retrievers have knowledge.retrieve capability", () => {
    const retrievers = [
      { name: "AssetProductionRetriever", create: RetrieversIndex.createAssetProductionRetrieverPlugin },
      { name: "CodingRetriever", create: RetrieversIndex.createCodingRetrieverPlugin },
      { name: "GameDevRetriever", create: RetrieversIndex.createGameDevRetrieverPlugin },
      { name: "GrowthRetriever", create: RetrieversIndex.createGrowthRetrieverPlugin },
      { name: "LivestreamRetriever", create: RetrieversIndex.createLivestreamRetrieverPlugin },
      { name: "OperationsRetriever", create: RetrieversIndex.createOperationsRetrieverPlugin },
    ];

    for (const { name, create } of retrievers) {
      test(`${name} includes knowledge.retrieve capability`, () => {
        const plugin = create();
        assert.ok(
          (plugin.capabilityIds as readonly string[]).includes("knowledge.retrieve"),
          `${name} should include "knowledge.retrieve" capability`,
        );
      });

      test(`${name} includes domain.observe capability`, () => {
        const plugin = create();
        assert.ok(
          (plugin.capabilityIds as readonly string[]).includes("domain.observe"),
          `${name} should include "domain.observe" capability`,
        );
      });
    }
  });

  test.describe("all retrievers can retrieve results", () => {
    const retrievers = [
      { name: "AssetProductionRetriever", create: RetrieversIndex.createAssetProductionRetrieverPlugin },
      { name: "GrowthRetriever", create: RetrieversIndex.createGrowthRetrieverPlugin },
      { name: "LivestreamRetriever", create: RetrieversIndex.createLivestreamRetrieverPlugin },
      { name: "OperationsRetriever", create: RetrieversIndex.createOperationsRetrieverPlugin },
      { name: "GameDevRetriever", create: RetrieversIndex.createGameDevRetrieverPlugin },
    ];

    for (const { name, create } of retrievers) {
      test(`${name} retrieve returns array`, async () => {
        const plugin = create();
        const results = await plugin.retrieve({
          taskId: "test_task",
          intent: "test query",
          context: {},
          tokenBudget: 1000,
        });
        assert.ok(Array.isArray(results), `${name} retrieve should return an array`);
      });

      test(`${name} retrieve returns at least 2 results`, async () => {
        const plugin = create();
        const results = await plugin.retrieve({
          taskId: "test_task",
          intent: "test query",
          context: {},
          tokenBudget: 1000,
        });
        assert.ok(results.length >= 2, `${name} retrieve should return at least 2 results`);
      });
    }

    test("CodingRetriever retrieve returns array", async () => {
      const plugin = RetrieversIndex.createCodingRetrieverPlugin();
      const results = await plugin.retrieve({
        taskId: "test_task",
        intent: "test",
        context: {},
        tokenBudget: 1000,
      });
      assert.ok(Array.isArray(results));
    });
  });

  test.describe("domain-specific capabilityIds", () => {
    test("AssetProductionRetriever has assetproduction.figma_search capability", () => {
      const plugin = RetrieversIndex.createAssetProductionRetrieverPlugin();
      assert.ok(
        (plugin.capabilityIds as readonly string[]).includes("assetproduction.figma_search"),
      );
    });

    test("CodingRetriever has repo.search capability", () => {
      const plugin = RetrieversIndex.createCodingRetrieverPlugin();
      assert.ok((plugin.capabilityIds as readonly string[]).includes("repo.search"));
    });

    test("GameDevRetriever has gamedev.unity_search capability", () => {
      const plugin = RetrieversIndex.createGameDevRetrieverPlugin();
      assert.ok(
        (plugin.capabilityIds as readonly string[]).includes("gamedev.unity_search"),
      );
    });

    test("GrowthRetriever has growth.playbook_search capability", () => {
      const plugin = RetrieversIndex.createGrowthRetrieverPlugin();
      assert.ok((plugin.capabilityIds as readonly string[]).includes("growth.playbook_search"));
    });

    test("LivestreamRetriever has livestream.obs_search capability", () => {
      const plugin = RetrieversIndex.createLivestreamRetrieverPlugin();
      assert.ok(
        (plugin.capabilityIds as readonly string[]).includes("livestream.obs_search"),
      );
    });

    test("OperationsRetriever has ops.runbook_search capability", () => {
      const plugin = RetrieversIndex.createOperationsRetrieverPlugin();
      assert.ok((plugin.capabilityIds as readonly string[]).includes("ops.runbook_search"));
    });
  });

  test.describe("export count verification", () => {
    test("index exports exactly 6 retriever create functions", () => {
      const exportKeys = Object.keys(RetrieversIndex);
      const createFunctions = exportKeys.filter((key) => key.startsWith("create") && key.endsWith("RetrieverPlugin"));
      assert.equal(createFunctions.length, 6);
    });
  });
});
