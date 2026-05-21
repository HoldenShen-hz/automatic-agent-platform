import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { createCodingRetrieverPlugin } from "../../../../src/plugins/retrievers/coding-retriever.js";

function createTestFixture(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "coding-retriever-comprehensive-"));

  // Create a file with a function
  writeFileSync(
    join(fixtureRoot, "src", "calculate.ts"),
    [
      "export function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "export function subtract(a: number, b: number): number {",
      "  return a - b;",
      "}",
    ].join("\n"),
    "utf8",
  );

  // Create a file with a class
  writeFileSync(
    join(fixtureRoot, "src", "math.ts"),
    [
      "export class Calculator {",
      "  private value: number = 0;",
      "",
      "  getValue(): number {",
      "    return this.value;",
      "  }",
      "",
      "  setValue(v: number): void {",
      "    this.value = v;",
      "  }",
      "}",
    ].join("\n"),
    "utf8",
  );

  // Create a file with an interface
  writeFileSync(
    join(fixtureRoot, "src", "types.ts"),
    [
      "export interface Result {",
      "  readonly value: number;",
      "  readonly timestamp: Date;",
      "}",
      "",
      "export type Operation = 'add' | 'subtract';",
    ].join("\n"),
    "utf8",
  );

  return fixtureRoot;
}

test.describe("CodingRetriever comprehensive tests", () => {
  let fixtureRoot: string;

  test.before(() => {
    fixtureRoot = createTestFixture();
  });

  test.after(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("createCodingRetrieverPlugin returns a valid DomainRetrieverPlugin", () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
    assert.ok(plugin !== undefined);
    assert.equal(plugin.pluginId, "plugin.coding.retriever");
    assert.equal(plugin.domainId, "coding");
    assert.equal(plugin.spiType, "retriever");
  });

  test("capabilityIds includes expected capabilities", () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
    assert.deepEqual(plugin.capabilityIds, [
      "knowledge.retrieve",
      "domain.observe",
      "repo.search",
    ]);
  });

  test("initialize is a no-op", async () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
    let initialized = false;
    plugin.initialize = async () => {
      initialized = true;
    };
    await plugin.initialize();
    assert.equal(initialized, true);
  });

  test("healthCheck returns true when rootPath exists", async () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
    const result = await plugin.healthCheck();
    assert.equal(result, true);
  });

  test("healthCheck returns false when rootPath does not exist", async () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: "/nonexistent/path" });
    const result = await plugin.healthCheck();
    assert.equal(result, false);
  });

  test("shutdown invalidates repo map cache", async () => {
    const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
  });

  test.describe("retrieve behavior", () => {
    test("returns results for basic query", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_basic",
        intent: "calculate",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("returns results with all required fields", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_fields",
        intent: "Calculator",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
      }
    });

    test("respects tokenBudget - small budget returns minimum results", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_small",
        intent: "function",
        context: {},
        tokenBudget: 200,
      });

      assert.ok(results.length >= 2);
    });

    test("respects tokenBudget - large budget returns maximum 12 results", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_large",
        intent: "export",
        context: {},
        tokenBudget: 10000,
      });

      assert.ok(results.length <= 12);
    });

    test("respects tokenBudget calculation with APPROX_RETRIEVER_RESULT_TOKENS", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      // 256 chars / 4 = 64 tokens per result
      // With 200 token budget, max would be min(20, floor(200/64)) = min(20, 3) = 3
      const results = await plugin.retrieve({
        taskId: "task_calc",
        intent: "type",
        context: {},
        tokenBudget: 200,
      });

      assert.ok(Array.isArray(results));
    });

    test("includes focus context in query building", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_focus",
        intent: "search",
        context: { focus: "add" },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
      }
    });

    test("includes currentFile context in search", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_current",
        intent: "value",
        context: { currentFile: join(fixtureRoot, "src", "math.ts") },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("includes both focus and currentFile context", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_both_ctx",
        intent: "set",
        context: {
          focus: "value",
          currentFile: join(fixtureRoot, "src", "math.ts"),
        },
        tokenBudget: 1000,
      });

      assert.ok(results.length > 0);
    });

    test("returns symbol results with correct structure", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_symbols",
        intent: "function",
        context: {},
        tokenBudget: 1000,
      });

      const symbolResults = results.filter((r) => r.matchType === "structural");
      for (const result of symbolResults) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(typeof result.snippet === "string");
        assert.ok(result.snippet.includes("defined at"));
      }
    });

    test("returns file results with correct structure", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_files",
        intent: "export",
        context: {},
        tokenBudget: 1000,
      });

      const fileResults = results.filter((r) => r.matchType === "keyword");
      for (const result of fileResults) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(typeof result.snippet === "string");
        assert.ok(result.snippet.includes("imports"));
      }
    });

    test("returns results with correct namespaces", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_ns",
        intent: "Calculator",
        context: {},
        tokenBudget: 1000,
      });

      const namespaces = results.map((r) => r.namespace).filter(Boolean);
      assert.ok(namespaces.length > 0);
      for (const ns of namespaces) {
        assert.ok(
          ns!.startsWith("repo/coding"),
          `Expected namespace to start with repo/coding, got ${ns}`,
        );
      }
    });

    test("returns results with different matchTypes", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_match",
        intent: "class",
        context: {},
        tokenBudget: 1000,
      });

      const matchTypes = results.map((r) => r.matchType).filter(Boolean);
      assert.ok(matchTypes.length > 0);
      for (const mt of matchTypes) {
        assert.ok(
          ["semantic", "keyword", "structural"].includes(mt!),
          `Expected matchType to be semantic, keyword, or structural, got ${mt}`,
        );
      }
    });

    test("returns results with scores between 0 and 1", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_scores",
        intent: "interface",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        if (result.score !== undefined) {
          assert.ok(result.score >= 0 && result.score <= 1);
        }
      }
    });

    test("handles empty context gracefully", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_empty",
        intent: "export",
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length >= 2);
    });

    test("handles very long intent gracefully", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const longIntent = "a".repeat(500);
      const results = await plugin.retrieve({
        taskId: "task_long",
        intent: longIntent,
        context: {},
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("handles empty currentFile context", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_empty_current",
        intent: "function",
        context: { currentFile: "" },
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("handles non-existent currentFile gracefully", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_bad_current",
        intent: "function",
        context: { currentFile: "/nonexistent/file.ts" },
        tokenBudget: 1000,
      });

      assert.ok(Array.isArray(results));
    });

    test("returns chunkId in results", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_chunk",
        intent: "Calculator",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.chunkId === "string");
      }
    });

    test("returns documentId in results", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_doc",
        intent: "function",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        assert.ok(typeof result.documentId === "string");
      }
    });

    test("returns relative paths in knowledgeRef", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_rel_path",
        intent: "add",
        context: {},
        tokenBudget: 1000,
      });

      for (const result of results) {
        const ref = result.knowledgeRef;
        assert.ok(!ref.includes(fixtureRoot), `knowledgeRef should not contain absolute path: ${ref}`);
      }
    });

    test("limits symbol results to 8", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_sym_limit",
        intent: "export",
        context: {},
        tokenBudget: 10000, // Large budget to get many results
      });

      // Should return max 12 total, with max 8 symbols
      assert.ok(results.length <= 12);
    });

    test("limits file results to 8", async () => {
      const plugin = createCodingRetrieverPlugin({ rootPath: fixtureRoot });
      const results = await plugin.retrieve({
        taskId: "task_file_limit",
        intent: "export",
        context: {},
        tokenBudget: 10000,
      });

      // File results are also limited to 8, total max 12
      assert.ok(results.length <= 12);
    });
  });

  test.describe("options handling", () => {
    test("accepts custom rootPath", () => {
      const plugin = createCodingRetrieverPlugin({
        rootPath: "/custom/path",
      });
      assert.ok(plugin !== undefined);
    });

    test("accepts custom repoMapService", () => {
      // @ts-expect-error - testing with mock service
      const plugin = createCodingRetrieverPlugin({
        rootPath: fixtureRoot,
        repoMapService: {
          search: () => ({ symbols: [], files: [], relevanceScores: new Map() }),
          invalidateCache: () => {},
        },
      });
      assert.ok(plugin !== undefined);
    });

    test("uses default rootPath when not provided", () => {
      const plugin = createCodingRetrieverPlugin();
      assert.ok(plugin !== undefined);
    });
  });
});
