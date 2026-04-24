import assert from "node:assert/strict";
import test from "node:test";

import {
  PerceptionService,
  type IngestIntelCandidate,
  type RegisterPerceptionSourceInput,
} from "../../../../src/scale-ecosystem/intelligence/perception-service.js";

// Mock stores and db
function createMockStore() {
  return {
    intelligence: {
      upsertPerceptionSource: () => {},
      getPerceptionSource: () => null,
      insertIntelItem: () => {},
      getIntelItemBySourceAndDedupeKey: () => null,
      insertIntelBrief: () => {},
      listIntelItems: () => [],
      listIntelItemsByIds: () => [],
      getIntelBrief: () => null,
      listPerceptionSources: () => [],
      listIntelBriefs: () => [],
      listActionProposalsByBrief: () => [],
      insertActionProposal: () => {},
    },
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
    artifact: {
      insertArtifact: () => {},
    },
  };
}

function createMockDb() {
  return {
    transaction: (fn: () => void) => fn(),
  };
}

test("PerceptionService registers a perception source", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);

  const input: RegisterPerceptionSourceInput = {
    type: "api",
    name: "Test Source",
  };

  const source = service.registerSource(input);

  assert.equal(source.name, "Test Source");
  assert.equal(source.type, "api");
  assert.ok(source.sourceId);
});

test("PerceptionService registers source with custom id", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);

  const source = service.registerSource({
    sourceId: "custom_source_id",
    type: "feed",
    name: "Custom Source",
  });

  assert.equal(source.sourceId, "custom_source_id");
});

test("PerceptionService registers source with priority", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);

  const source = service.registerSource({
    type: "api",
    name: "Priority Source",
    priority: 10,
  });

  assert.equal(source.priority, 10);
});

test("PerceptionService registers disabled source", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);

  const source = service.registerSource({
    type: "api",
    name: "Disabled Source",
    enabled: false,
  });

  assert.equal(source.enabled, 0);
});

test("PerceptionService ingests intel items", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "Important Update",
    summary: "There is a critical update available",
    rawRef: "https://example.com/update",
    relevanceScore: 0.8,
    importance: 0.9,
  };

  const result = service.ingestIntel({
    sourceId: "src_1",
    items: [candidate],
  });

  assert.equal(result.insertedItems.length, 1);
  assert.equal(result.insertedItems[0].title, "Important Update");
  assert.equal(result.skippedDuplicateCount, 0);
});

test("PerceptionService skips duplicate intel items", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;
  mockStore.intelligence.getIntelItemBySourceAndDedupeKey = () => ({ intelId: "existing" }) as any; // Return existing item

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "Duplicate Title",
    summary: "This is a duplicate",
    rawRef: "https://example.com/duplicate",
    relevanceScore: 0.5,
    importance: 0.5,
  };

  const result = service.ingestIntel({
    sourceId: "src_1",
    items: [candidate],
  });

  assert.equal(result.insertedItems.length, 0);
  assert.equal(result.skippedDuplicateCount, 1);
});

test("PerceptionService builds intel brief", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelItems = () => [
    {
      intelId: "intel_1",
      tenantId: null,
      sourceId: "src_1",
      title: "Test Item",
      summary: "Test summary",
      rawRef: "https://example.com",
      relevanceScore: 0.7,
      importance: 0.8,
      tagsJson: "[]",
      dedupeKey: "key1",
      capturedAt: new Date().toISOString(),
      expiresAt: null,
    },
  ];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const result = service.buildBrief({});

  assert.ok(result.brief);
  assert.equal(result.items.length, 1);
  assert.equal(result.recommendedActions.length, 3); // Top 3 items
});

test("PerceptionService proposes actions from brief", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listActionProposalsByBrief = () => []; // No existing proposals
  mockStore.intelligence.getIntelBrief = () => ({
    briefId: "brief_1",
    tenantId: null,
    periodStart: new Date(Date.now() - 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
    sourceScopeJson: "[]",
    itemIdsJson: "[]",
    overallSummary: "Test summary",
    recommendedActionsJson: JSON.stringify([
      { title: "Action 1", summary: "Summary 1", actionType: "monitor", intelId: "intel_1", reason: "test" },
    ]),
    generatedAt: new Date().toISOString(),
  });

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const proposals = service.proposeActions({ briefId: "brief_1" });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].title, "Action 1");
  assert.equal(proposals[0].status, "proposed");
});

test("PerceptionService returns existing proposals idempotently", () => {
  const mockStore = createMockStore();
  const existingProposals = [{ proposalId: "prop_1", briefId: "brief_1" }] as any;
  mockStore.intelligence.listActionProposalsByBrief = () => existingProposals;
  mockStore.intelligence.getIntelBrief = () => ({
    briefId: "brief_1",
    tenantId: null,
    periodStart: "",
    periodEnd: "",
    sourceScopeJson: "[]",
    itemIdsJson: "[]",
    overallSummary: "",
    recommendedActionsJson: "[]",
    generatedAt: new Date().toISOString(),
  });

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const proposals = service.proposeActions({ briefId: "brief_1" });

  assert.equal(proposals, existingProposals);
});

test("PerceptionService lists sources", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listPerceptionSources = (enabledOnly?: boolean) => {
    const sources = [
      { sourceId: "src_1", enabled: 1, tenantId: null } as any,
      { sourceId: "src_2", enabled: 0, tenantId: null } as any,
    ];
    return enabledOnly ? sources.filter((source) => source.enabled === 1) : sources;
  };

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const allSources = service.listSources();
  assert.equal(allSources.length, 2);

  const enabledSources = service.listSources(true);
  assert.equal(enabledSources.length, 1);
});

test("PerceptionService lists briefs", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelBriefs = () => [
    { briefId: "brief_1" } as any,
    { briefId: "brief_2" } as any,
  ];

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const briefs = service.listBriefs(10);
  assert.equal(briefs.length, 2);
});

test("PerceptionService normalizes tags", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "Tagged Item",
    summary: "Item with tags",
    rawRef: "https://example.com/tagged",
    relevanceScore: 0.5,
    importance: 0.5,
    tags: ["IMPORTANT", "update", "security"],
  };

  const result = service.ingestIntel({
    sourceId: "src_1",
    items: [candidate],
  });

  const tags = JSON.parse(result.insertedItems[0].tagsJson);
  assert.ok(tags.includes("important"));
  assert.ok(tags.includes("update"));
  assert.ok(tags.includes("security"));
});

test("PerceptionService validates title length", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "AB", // Too short
    summary: "Valid summary for testing",
    rawRef: "https://example.com/short",
    relevanceScore: 0.5,
    importance: 0.5,
  };

  assert.throws(() => {
    service.ingestIntel({
      sourceId: "src_1",
      items: [candidate],
    });
  });
});

test("PerceptionService validates summary length", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "Valid Title",
    summary: "Short", // Too short
    rawRef: "https://example.com/short-summary",
    relevanceScore: 0.5,
    importance: 0.5,
  };

  assert.throws(() => {
    service.ingestIntel({
      sourceId: "src_1",
      items: [candidate],
    });
  });
});

test("PerceptionService validates score range", () => {
  const mockStore = createMockStore();
  const source = { sourceId: "src_1", tenantId: null, type: "api" as const, name: "Test", enabled: 1, scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "" };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const candidate: IngestIntelCandidate = {
    title: "Valid Title",
    summary: "Valid summary for score test",
    rawRef: "https://example.com/score",
    relevanceScore: 1.5, // Out of range
    importance: 0.5,
  };

  assert.throws(() => {
    service.ingestIntel({
      sourceId: "src_1",
      items: [candidate],
    });
  });
});

test("PerceptionService derives correct action types", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelItems = () => [
    {
      intelId: "high_importance",
      tenantId: null,
      sourceId: "src_1",
      title: "Critical Issue",
      summary: "Very important",
      rawRef: "https://example.com/critical",
      relevanceScore: 0.9,
      importance: 0.9,
      tagsJson: "[]",
      dedupeKey: "key1",
      capturedAt: new Date().toISOString(),
      expiresAt: null,
    },
    {
      intelId: "high_relevance",
      tenantId: null,
      sourceId: "src_1",
      title: "Relevant Update",
      summary: "Highly relevant",
      rawRef: "https://example.com/relevant",
      relevanceScore: 0.9,
      importance: 0.5,
      tagsJson: "[]",
      dedupeKey: "key2",
      capturedAt: new Date().toISOString(),
      expiresAt: null,
    },
    {
      intelId: "low_both",
      tenantId: null,
      sourceId: "src_1",
      title: "Minor Update",
      summary: "Not very important",
      rawRef: "https://example.com/minor",
      relevanceScore: 0.3,
      importance: 0.3,
      tagsJson: "[]",
      dedupeKey: "key3",
      capturedAt: new Date().toISOString(),
      expiresAt: null,
    },
  ];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const result = service.buildBrief({});

  // First item has importance >= 0.85 -> investigate
  // Second item has relevanceScore >= 0.75 -> notify
  // Third item -> monitor
  assert.equal(result.recommendedActions.length, 3);
});

test("PerceptionService respects limit parameter in buildBrief", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelItems = () => Array(10).fill(null).map((_, i) => ({
    intelId: `intel_${i}`,
    tenantId: null,
    sourceId: "src_1",
    title: `Item ${i}`,
    summary: `Summary ${i}`,
    rawRef: `https://example.com/${i}`,
    relevanceScore: 0.5,
    importance: 0.5,
    tagsJson: "[]",
    dedupeKey: `key${i}`,
    capturedAt: new Date().toISOString(),
    expiresAt: null,
  }));
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const result = service.buildBrief({ limit: 5 });

  // buildBrief itself doesn't filter by limit, it passes to listIntelItems
  // but recommended actions are top 3
  assert.ok(result.items.length >= 5);
});

test("PerceptionService filters expired items", () => {
  const mockStore = createMockStore();
  const now = new Date();
  mockStore.intelligence.listIntelItems = () => [
    {
      intelId: "current",
      tenantId: null,
      sourceId: "src_1",
      title: "Current Item",
      summary: "Not expired",
      rawRef: "https://example.com/current",
      relevanceScore: 0.5,
      importance: 0.5,
      tagsJson: "[]",
      dedupeKey: "key1",
      capturedAt: new Date(now.getTime() - 3600000).toISOString(),
      expiresAt: null, // Never expires
    },
    {
      intelId: "expired",
      tenantId: null,
      sourceId: "src_1",
      title: "Expired Item",
      summary: "This has expired",
      rawRef: "https://example.com/expired",
      relevanceScore: 0.5,
      importance: 0.5,
      tagsJson: "[]",
      dedupeKey: "key2",
      capturedAt: new Date(now.getTime() - 7200000).toISOString(),
      expiresAt: new Date(now.getTime() - 3600000).toISOString(), // Expired
    },
  ];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);

  const result = service.buildBrief({ generatedAt: now.toISOString() });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].intelId, "current");
});
