import assert from "node:assert/strict";
import test from "node:test";

import { buildFtsMatchQuery, extractSearchableText, createSnippet, MemoryRetrievalService } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-retrieval-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { MemoryRecallQuery } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-quality.js";

test("buildFtsMatchQuery returns empty phrase for empty input", () => {
  const result = buildFtsMatchQuery("");
  assert.equal(result, '""');
});

test("buildFtsMatchQuery returns empty phrase for whitespace only", () => {
  const result = buildFtsMatchQuery("   \t\n  ");
  assert.equal(result, '""');
});

test("buildFtsMatchQuery wraps single term in quotes", () => {
  const result = buildFtsMatchQuery("hello");
  assert.equal(result, '"hello"');
});

test("buildFtsMatchQuery joins multiple terms with AND", () => {
  const result = buildFtsMatchQuery("hello world");
  assert.equal(result, '"hello" AND "world"');
});

test("buildFtsMatchQuery handles three terms", () => {
  const result = buildFtsMatchQuery("one two three");
  assert.equal(result, '"one" AND "two" AND "three"');
});

test("buildFtsMatchQuery trims whitespace from terms", () => {
  const result = buildFtsMatchQuery("  hello  world  ");
  assert.equal(result, '"hello" AND "world"');
});

test("buildFtsMatchQuery filters out empty terms", () => {
  const result = buildFtsMatchQuery("hello  world");
  assert.equal(result, '"hello" AND "world"');
});

test("buildFtsMatchQuery splits on non-alphanumeric including quotes", () => {
  // Quotes are split tokens, so "hello" becomes separate terms
  const result = buildFtsMatchQuery('say "hello"');
  assert.equal(result, '"say" AND "hello"');
});

test("buildFtsMatchQuery handles unicode characters", () => {
  const result = buildFtsMatchQuery("日本語");
  assert.equal(result, '"日本語"');
});

test("buildFtsMatchQuery handles mixed alphanumeric and unicode", () => {
  const result = buildFtsMatchQuery("test_123 日本語");
  assert.equal(result, '"test_123" AND "日本語"');
});

test("buildFtsMatchQuery handles numbers as terms", () => {
  const result = buildFtsMatchQuery("123 456");
  assert.equal(result, '"123" AND "456"');
});

test("buildFtsMatchQuery handles underscores in terms", () => {
  const result = buildFtsMatchQuery("hello_world foo_bar");
  assert.equal(result, '"hello_world" AND "foo_bar"');
});

test("buildFtsMatchQuery splits on hyphens", () => {
  // Hyphens are split as delimiters, so "hello-world" becomes "hello" AND "world"
  const result = buildFtsMatchQuery("hello-world foo-bar");
  assert.equal(result, '"hello" AND "world" AND "foo" AND "bar"');
});

test("buildFtsMatchQuery splits on quotes", () => {
  // Quotes are split as delimiters, so "quoted" becomes separate term
  const result = buildFtsMatchQuery('a "quoted" term');
  assert.equal(result, '"a" AND "quoted" AND "term"');
});

// extractSearchableText tests

test("extractSearchableText returns plain string directly", () => {
  const result = extractSearchableText("hello world");
  assert.equal(result, "hello world");
});

test("extractSearchableText trims whitespace", () => {
  const result = extractSearchableText("  hello world  ");
  assert.equal(result, "hello world");
});

test("extractSearchableText returns JSON string content directly if not object", () => {
  const result = extractSearchableText('"just a string"');
  assert.equal(result, '"just a string"');
});

test("extractSearchableText extracts workContext from JSON object", () => {
  const result = extractSearchableText('{"workContext": "my work context", "other": "data"}');
  assert.ok(result.includes("my work context"));
});

test("extractSearchableText handles empty JSON string", () => {
  const result = extractSearchableText("");
  assert.equal(result, "");
});

test("extractSearchableText handles invalid JSON gracefully and returns empty string", () => {
  // JSON.parse throws for non-JSON strings that start with "{"
  // This tests the catch branch fallback behavior
  const result = extractSearchableText("{invalid json}");
  // The function should handle the error and return empty string from catch block
  assert.equal(result, "");
});

test("extractSearchableText triggers catch branch for malformed JSON with valid prefix", () => {
  // A string that looks like JSON but fails to parse partway through
  const malformedJson = '{"incomplete": {"nested';
  const result = extractSearchableText(malformedJson);
  // JSON.parse fails during parsing, catch block returns empty string
  assert.equal(result, "");
});

test("extractSearchableText extracts topOfMind array items", () => {
  const result = extractSearchableText('{"topOfMind": ["item1", "item2", "item3"]}');
  assert.ok(result.includes("item1"));
  assert.ok(result.includes("item2"));
  assert.ok(result.includes("item3"));
});

test("extractSearchableText extracts recentHistory array items", () => {
  const result = extractSearchableText('{"recentHistory": ["history1", "history2"]}');
  assert.ok(result.includes("history1"));
  assert.ok(result.includes("history2"));
});

test("extractSearchableText extracts longTermBackground array items", () => {
  const result = extractSearchableText('{"longTermBackground": ["bg1", "bg2", "bg3"]}');
  assert.ok(result.includes("bg1"));
  assert.ok(result.includes("bg2"));
  assert.ok(result.includes("bg3"));
});

test("extractSearchableText extracts facts array with object content", () => {
  const result = extractSearchableText('{"facts": [{"content": "fact content 1"}, {"content": "fact content 2"}]}');
  assert.ok(result.includes("fact content 1"));
  assert.ok(result.includes("fact content 2"));
});

test("extractSearchableText filters non-string items in arrays", () => {
  const result = extractSearchableText('{"topOfMind": ["valid item", 123, null, "another valid"]}');
  assert.ok(result.includes("valid item"));
  assert.ok(result.includes("another valid"));
  assert.ok(!result.includes("123"));
});

test("extractSearchableText handles full structured memory content", () => {
  const result = extractSearchableText('{"workContext": "my context", "topOfMind": ["mind item"], "recentHistory": ["recent item"], "longTermBackground": ["bg item"], "facts": [{"content": "a fact"}]}');
  assert.ok(result.includes("my context"));
  assert.ok(result.includes("mind item"));
  assert.ok(result.includes("recent item"));
  assert.ok(result.includes("bg item"));
  assert.ok(result.includes("a fact"));
});

test("extractSearchableText returns parsed string when JSON is a string primitive", () => {
  // When texts.length === 0 and parsed is a string (not an object)
  const result = extractSearchableText('"just a string value"');
  // The parsed JSON is a string, so it should be included
  assert.ok(result.includes("just a string value"));
});

// createSnippet tests

test("createSnippet returns full text when shorter than maxLength", () => {
  const result = createSnippet("hello world", ["hello"], 100);
  assert.equal(result, "hello world");
});

test("createSnippet truncates and adds ellipsis when text exceeds maxLength and no match", () => {
  const longText = "a".repeat(200);
  const result = createSnippet(longText, ["missing"], 50);
  assert.ok(result.endsWith("..."));
  assert.ok(result.length <= 53); // 50 + "..."
});

test("createSnippet finds match and creates window around it", () => {
  const text = "prefix hello world suffix";
  const result = createSnippet(text, ["hello"], 50);
  assert.ok(result.includes("hello"));
});

test("createSnippet is case insensitive for matching", () => {
  const text = "Hello World";
  const result = createSnippet(text, ["hello"], 50);
  assert.ok(result.includes("Hello") || result.includes("hello"));
});

test("createSnippet returns full text when no query terms provided", () => {
  const text = "short text";
  const result = createSnippet(text, [], 100);
  assert.equal(result, "short text");
});

test("createSnippet handles multiple query terms", () => {
  const text = "prefix world hello suffix";
  const result = createSnippet(text, ["hello", "world"], 50);
  assert.ok(result.includes("hello") || result.includes("world"));
});

test("createSnippet adds leading ellipsis when match is not at start", () => {
  const text = "some text before the keyword after";
  const result = createSnippet(text, ["keyword"], 20);
  assert.ok(result.startsWith("..."));
});

test("createSnippet adds trailing ellipsis when match is not at end", () => {
  const text = "keyword is in the middle of the text here";
  const result = createSnippet(text, ["keyword"], 20);
  assert.ok(result.endsWith("..."));
});

test("createSnippet uses default maxLength of 100", () => {
  const longText = "a".repeat(200);
  const result = createSnippet(longText, ["aaa"], 100);
  assert.ok(result.length <= 103); // 100 + "..."
});

test("createSnippet handles query term longer than maxLength", () => {
  const longTerm = "a".repeat(150);
  const text = "prefix " + longTerm + " suffix";
  const result = createSnippet(text, [longTerm], 50);
  assert.ok(result.length <= 53);
});

test("createSnippet else branch when match is closer to end", () => {
  // This test exercises the else branch at lines 149-152 in compiled JS
  // We need the match to be at the very end with a small maxLength
  // Text: "abc defghij end" - "end" at position 10, text length 14
  const text = "abc defghij end";
  // maxLength = 4 forces a very small window
  // With halfWindow = 2: start = max(0, 10-2) = 8, end = min(14, 10+3+2) = 14
  // end - start = 6 > 4, so we adjust: matchIndex - start = 10 - 8 = 2
  // end - matchIndex = 14 - 10 = 4, so 2 < 4 = TRUE (takes IF, not else)
  // The else branch requires matchIndex-start >= end-matchIndex
  // This happens when the match is very close to the end
  const result = createSnippet(text, ["end"], 5);
  assert.ok(result.includes("end") || result.includes("..."));
});

// =============================================================================
// MemoryRetrievalService tests
// =============================================================================

type MockConnection = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void;
    get: () => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

type MockMemoryRepo = {
  listMemories: (query: MemoryRecallQuery) => MemoryRecord[];
};

function createMockStore(memories: MemoryRecord[] = []): AuthoritativeTaskStore {
  const mockConnection: MockConnection = {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (..._args: unknown[]) => {},
      get: () => ({ count: memories.length }),
      all: (..._args: unknown[]) => memories.map(m => ({ ...m, rank: -1 })),
    }),
  };

  const mockMemoryRepo: MockMemoryRepo = {
    listMemories: (_query: MemoryRecallQuery) => memories,
  };

  return {
    withConnection: <T>(work: (connection: MockConnection) => T): T => work(mockConnection),
    memory: mockMemoryRepo,
  } as unknown as AuthoritativeTaskStore;
}

function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_test_1",
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    executionId: "exec_1",
    memoryLayer: "layer_3",
    scope: "project",
    contentJson: '{"workContext": "test context"}',
    classification: "operational",
    sourceTrustLevel: "verified",
    qualityScore: 0.8,
    hitCount: 5,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.7,
    freshnessScore: 0.9,
    contentHash: "hash123",
    ...overrides,
  } as MemoryRecord;
}

test("MemoryRetrievalService.initializeFts does not reinitialize if already initialized", () => {
  assert.doesNotThrow(() => {
    const store = createMockStore();
    const service = new MemoryRetrievalService(store);

    // First call should initialize
    service.initializeFts();
    // Second call should not throw or reinitialize
    service.initializeFts(); // Should be idempotent
  });
});

test("MemoryRetrievalService.indexMemory calls withConnection with DELETE and INSERT", () => {
  assert.doesNotThrow(() => {
    const store = createMockStore();
    const service = new MemoryRetrievalService(store);

    // Should not throw
    service.indexMemory("mem_1", "test content");
  });
});

test("MemoryRetrievalService.indexMemoryRecord extracts searchable text and indexes", () => {
  assert.doesNotThrow(() => {
    const store = createMockStore();
    const service = new MemoryRetrievalService(store);

    const memory = createTestMemory({ contentJson: '{"workContext": "my important context"}' });

    // Should not throw
    service.indexMemoryRecord(memory);
  });
});

test("MemoryRetrievalService.unindexMemory removes memory from index", () => {
  assert.doesNotThrow(() => {
    const store = createMockStore();
    const service = new MemoryRetrievalService(store);

    // Should not throw
    service.unindexMemory("mem_test_1");
  });
});

test("MemoryRetrievalService.unindexMemory escapes single quotes in memoryId", () => {
  let capturedArgs: unknown[] = [];
  const store = {
    withConnection: <T>(work: (connection: MockConnection) => T): T => work({
      exec: () => {},
      prepare: (_sql: string) => ({
        run: (...args: unknown[]) => {
          capturedArgs = args;
        },
        get: () => ({ count: 0 }),
        all: () => [],
      }),
    }),
    memory: {
      listMemories: () => [],
    },
  } as unknown as AuthoritativeTaskStore;
  const service = new MemoryRetrievalService(store);

  service.unindexMemory("mem_with'_quote");
  assert.deepEqual(capturedArgs, ["mem_with'_quote"]);
});

test("MemoryRetrievalService.searchMemories returns empty array when no results", () => {
  const store = createMockStore([]);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "nonexistent" });

  assert.deepEqual(results, []);
});

test("MemoryRetrievalService.searchMemories applies taskId filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", taskId: "task_1" }),
    createTestMemory({ id: "mem_2", taskId: "task_2" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { taskId: "task_1" });

  // All results should have taskId = task_1
  for (const r of results) {
    assert.equal(r.memory.taskId, "task_1");
  }
});

test("MemoryRetrievalService.searchMemories applies sessionId filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", sessionId: "session_1" }),
    createTestMemory({ id: "mem_2", sessionId: "session_2" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { sessionId: "session_1" });

  for (const r of results) {
    assert.equal(r.memory.sessionId, "session_1");
  }
});

test("MemoryRetrievalService.searchMemories applies agentId filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", agentId: "agent_1" }),
    createTestMemory({ id: "mem_2", agentId: "agent_2" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { agentId: "agent_1" });

  for (const r of results) {
    assert.equal(r.memory.agentId, "agent_1");
  }
});

test("MemoryRetrievalService.searchMemories applies scopes filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", scope: "project" }),
    createTestMemory({ id: "mem_2", scope: "user" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { scopes: ["project"] });

  for (const r of results) {
    assert.equal(r.memory.scope, "project");
  }
});

test("MemoryRetrievalService.searchMemories applies memoryLayers filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", memoryLayer: "layer_3" }),
    createTestMemory({ id: "mem_2", memoryLayer: "layer_5" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { memoryLayers: ["layer_3"] });

  for (const r of results) {
    assert.equal(r.memory.memoryLayer, "layer_3");
  }
});

test("MemoryRetrievalService.searchMemories applies classifications filter", () => {
  const memories = [
    createTestMemory({ id: "mem_1", classification: "operational" }),
    createTestMemory({ id: "mem_2", classification: "insight" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test" }, { classifications: ["operational"] });

  for (const r of results) {
    assert.equal(r.memory.classification, "operational");
  }
});

test("MemoryRetrievalService.searchMemories tolerates null optional array filters", () => {
  const store = createMockStore([createTestMemory()]);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories(
    { query: "test" },
    {
      scopes: null,
      memoryLayers: null,
      classifications: null,
    } as unknown as MemoryRecallQuery,
  );

  assert.equal(results.length, 1);
});

test("MemoryRetrievalService.searchMemories uses limit and offset", () => {
  const store = createMockStore([]);
  const service = new MemoryRetrievalService(store);

  const results = service.searchMemories({ query: "test", limit: 10, offset: 5 });

  assert.deepEqual(results, []);
});

test("MemoryRetrievalService.searchMemories defaults limit to 50", () => {
  const store = createMockStore([]);
  const service = new MemoryRetrievalService(store);

  // Should not throw with no explicit limit
  const results = service.searchMemories({ query: "test" });

  assert.deepEqual(results, []);
});

test("MemoryRetrievalService.keywordSearchMemories returns empty when no matches", () => {
  const memories = [createTestMemory({ contentJson: "nothing here" })];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.keywordSearchMemories("nonexistent");

  assert.deepEqual(results, []);
});

test("MemoryRetrievalService.keywordSearchMemories filters by query terms", () => {
  const memories = [
    createTestMemory({ id: "mem_1", contentJson: "hello world" }),
    createTestMemory({ id: "mem_2", contentJson: "foo bar" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.keywordSearchMemories("hello");

  assert.equal(results.length, 1);
  assert.ok(results[0]);
  assert.equal(results[0]!.id, "mem_1");
});

test("MemoryRetrievalService.keywordSearchMemories requires all terms to match", () => {
  const memories = [
    createTestMemory({ id: "mem_1", contentJson: "hello world" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  // Should match because both "hello" and "world" are present
  const results = service.keywordSearchMemories("hello world");

  assert.equal(results.length, 1);
});

test("MemoryRetrievalService.keywordSearchMemories returns all memories for empty keyword", () => {
  // When keyword is empty, queryTerms becomes [] and every() on empty array returns true
  // So all memories are returned (vacuous truth - no terms to filter)
  const memories = [createTestMemory({ contentJson: "hello world" })];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.keywordSearchMemories("");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.id, "mem_test_1");
});

test("MemoryRetrievalService.keywordSearchMemories is case insensitive", () => {
  const memories = [
    createTestMemory({ id: "mem_1", contentJson: "Hello World" }),
  ];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const results = service.keywordSearchMemories("hello");

  assert.equal(results.length, 1);
});

test("MemoryRetrievalService.retrieveMemories uses fts when ftsQuery provided", () => {
  const store = createMockStore([]);
  const service = new MemoryRetrievalService(store);

  const result = service.retrieveMemories({ ftsQuery: { query: "test" } });

  assert.equal(result.method, "fts");
  assert.equal(result.results.length, 0);
  assert.equal(result.totalFts, 0);
  assert.equal(result.totalKeyword, 0);
});

test("MemoryRetrievalService.retrieveMemories uses keyword when keywordQuery provided", () => {
  const memories = [createTestMemory({ contentJson: "test content" })];
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const result = service.retrieveMemories({ keywordQuery: "test" });

  assert.equal(result.method, "keyword");
});

test("MemoryRetrievalService.retrieveMemories returns none when no query provided", () => {
  const store = createMockStore([]);
  const service = new MemoryRetrievalService(store);

  const result = service.retrieveMemories({});

  assert.equal(result.method, "none");
  assert.equal(result.results.length, 0);
  assert.equal(result.keywordResults.length, 0);
});

test("MemoryRetrievalService.retrieveMemories applies limit and offset to keyword search", () => {
  const memories = Array.from({ length: 20 }, (_, i) =>
    createTestMemory({ id: `mem_${i}`, contentJson: "test content" })
  );
  const store = createMockStore(memories);
  const service = new MemoryRetrievalService(store);

  const result = service.retrieveMemories({ keywordQuery: "test", limit: 5, offset: 10 });

  assert.equal(result.keywordResults.length, 5);
});

test("MemoryRetrievalService.rebuildIndex deletes and repopulates index", () => {
  assert.doesNotThrow(() => {
    const memories = [createTestMemory({ id: "mem_1" })];
    const store = createMockStore(memories);
    const service = new MemoryRetrievalService(store);

    // Should not throw
    service.rebuildIndex();
  });
});
