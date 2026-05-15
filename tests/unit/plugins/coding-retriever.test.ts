import test from "node:test";
import assert from "node:assert/strict";
import { createCodingRetrieverPlugin } from "../../../src/plugins/retrievers/coding-retriever.js";
import type { SemanticRepoMapService } from "../../../src/platform/five-plane-execution/tool-executor/semantic-repo-map-service.js";

function createMockRepoMapService(searchResult: {
  symbols?: Array<{ name: string; kind: string; filePath: string; line: number }>;
  files?: Array<{ relativePath: string; filePath: string; imports: string[]; referencedBy: string[] }>;
  relevanceScores?: Map<string, number>;
}) {
  return {
    buildMap() {
      // no-op for mock
    },
    getStatistics() {
      return { totalFiles: 10, totalSymbols: 100 };
    },
    invalidateCache() {
      // no-op for mock
    },
    search(args: { query: string; currentFile?: string; limit: number }) {
      return {
        symbols: searchResult.symbols ?? [],
        files: searchResult.files ?? [],
        relevanceScores: searchResult.relevanceScores ?? new Map(),
      };
    },
  } as unknown as SemanticRepoMapService;
}

test("createCodingRetrieverPlugin returns valid plugin structure", () => {
  const plugin = createCodingRetrieverPlugin();

  assert.equal(plugin.pluginId, "plugin.coding.retriever");
  assert.equal(plugin.domainId, "coding");
  assert.equal(plugin.spiType, "retriever");
  assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "repo.search"]);
});

test("coding retriever returns results from search with symbols", async () => {
  const mockService = createMockRepoMapService({
    symbols: [
      { name: "MyClass", kind: "class", filePath: "/project/src/MyClass.ts", line: 10 },
      { name: "myFunction", kind: "function", filePath: "/project/src/myFunction.ts", line: 5 },
    ],
    relevanceScores: new Map([
      ["MyClass@/project/src/MyClass.ts", 0.95],
      ["myFunction@/project/src/myFunction.ts", 0.85],
    ]),
  });
  const plugin = createCodingRetrieverPlugin({ repoMapService: mockService, rootPath: "/project" });

  const result = await plugin.retrieve({
    taskId: "task_1",
    intent: "find code",
    context: {},
    tokenBudget: 5000,
  });

  assert.ok(result.length >= 2);
});

test("coding retriever returns results from search with files", async () => {
  const mockService = createMockRepoMapService({
    files: [
      {
        relativePath: "src/index.ts",
        filePath: "/project/src/index.ts",
        imports: ["fs", "path"],
        referencedBy: ["src/main.ts"],
      },
    ],
    relevanceScores: new Map([["/project/src/index.ts", 0.7]]),
  });
  const plugin = createCodingRetrieverPlugin({ repoMapService: mockService, rootPath: "/project" });

  const result = await plugin.retrieve({
    taskId: "task_1",
    intent: "find files",
    context: {},
    tokenBudget: 5000,
  });

  assert.ok(result.length >= 1);
});

test("coding retriever handles empty search results", async () => {
  const mockService = createMockRepoMapService({ symbols: [], files: [] });
  const plugin = createCodingRetrieverPlugin({ repoMapService: mockService });

  const result = await plugin.retrieve({
    taskId: "task_1",
    intent: "nothing",
    context: {},
    tokenBudget: 5000,
  });

  assert.equal(result.length, 0);
});

test("coding retriever has initialize method", async () => {
  const plugin = createCodingRetrieverPlugin();

  assert.ok(plugin.initialize !== undefined);
  const result = await plugin.initialize!();
  assert.equal(result, undefined);
});

test("coding retriever has healthCheck method", async () => {
  const plugin = createCodingRetrieverPlugin();

  assert.ok(plugin.healthCheck !== undefined);
  const result = await plugin.healthCheck!();
  assert.equal(result, true);
});

test("coding retriever has shutdown method", async () => {
  const plugin = createCodingRetrieverPlugin();

  assert.ok(plugin.shutdown !== undefined);
  const result = await plugin.shutdown!();
  assert.equal(result, undefined);
});

test("coding retriever caps total results at 12", async () => {
  const symbols = Array.from({ length: 10 }, (_, i) => ({
    name: `Symbol${i}`,
    kind: "function" as const,
    filePath: `/project/src/Symbol${i}.ts`,
    line: i,
  }));
  const files = Array.from({ length: 10 }, (_, i) => ({
    relativePath: `src/File${i}.ts`,
    filePath: `/project/src/File${i}.ts`,
    imports: [],
    referencedBy: [],
  }));

  const mockService = createMockRepoMapService({ symbols, files });
  const plugin = createCodingRetrieverPlugin({ repoMapService: mockService, rootPath: "/project" });

  const result = await plugin.retrieve({
    taskId: "task_1",
    intent: "search",
    context: {},
    tokenBudget: 10000,
  });

  assert.ok(result.length <= 12);
});
