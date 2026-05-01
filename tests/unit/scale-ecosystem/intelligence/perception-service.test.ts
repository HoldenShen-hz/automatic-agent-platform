import assert from "node:assert/strict";
import test from "node:test";

import {
  PerceptionService,
  type IngestIntelCandidate,
  type RegisterPerceptionSourceInput,
  type BuildIntelBriefInput,
  type IngestIntelInput,
  type ProposePerceptionActionsInput,
} from "../../../../src/scale-ecosystem/intelligence/perception-service.js";
import { ValidationError, StorageError, PolicyDeniedError, MonetizationError } from "../../../../src/platform/contracts/errors.js";
import type { IntelItemRecord, IntelBriefRecord, ActionProposalRecord, PerceptionSourceRecord } from "../../../../src/platform/contracts/types/domain.js";

function createMockStore() {
  const sources = new Map<string, PerceptionSourceRecord>();
  const briefs = new Map<string, IntelBriefRecord>();
  const items: IntelItemRecord[] = [];
  const proposals: ActionProposalRecord[] = [];
  const tasks = new Map<string, Record<string, unknown>>();
  const artifacts: Record<string, unknown>[] = [];

  return {
    intelligence: {
      upsertPerceptionSource: ((source: PerceptionSourceRecord) => {
        sources.set(source.sourceId, source);
      }) as any,
      getPerceptionSource: ((sourceId: string) => sources.get(sourceId) ?? null) as any,
      insertIntelItem: ((item: IntelItemRecord) => { items.push(item); }) as any,
      getIntelItemBySourceAndDedupeKey: (() => null) as any,
      insertIntelBrief: ((brief: IntelBriefRecord) => { briefs.set(brief.briefId, brief); }) as any,
      listIntelItems: (({ since, until, limit }: { since?: string | null; until?: string | null; limit?: number }) => {
        let result = items;
        if (since) result = result.filter(i => i.capturedAt >= since);
        if (until) result = result.filter(i => i.capturedAt <= until);
        return limit ? result.slice(0, limit) : result;
      }) as any,
      listIntelItemsByIds: ((ids: string[]) => ids.map(id => items.find(i => i.intelId === id)).filter(Boolean)) as any,
      getIntelBrief: ((briefId: string) => briefs.get(briefId) ?? null) as any,
      listPerceptionSources: ((enabledOnly?: boolean, tenantId?: string | null) => {
        const all = Array.from(sources.values());
        return enabledOnly ? all.filter(s => s.enabled === 1) : all;
      }) as any,
      listIntelBriefs: ((limit?: number, tenantId?: string | null) => {
        const all = Array.from(briefs.values());
        return limit ? all.slice(0, limit) : all;
      }) as any,
      listActionProposalsByBrief: ((briefId: string) =>
        proposals.filter(p => p.briefId === briefId)) as any,
      insertActionProposal: ((proposal: ActionProposalRecord) => { proposals.push(proposal); }) as any,
    },
    task: {
      getTask: ((taskId: string) => tasks.get(taskId) ?? null) as any,
      insertTask: ((task: Record<string, unknown>) => { tasks.set(task.id as string, task); }) as any,
    },
    artifact: {
      insertArtifact: ((artifact: Record<string, unknown>) => { artifacts.push(artifact); }) as any,
    },
  };
}

function createMockDb() {
  return {
    transaction: (fn: () => void) => fn(),
  };
}

function createMockBillingService() {
  return {
    evaluateEntitlement: ({ accountId, featureKey }: { accountId: string; featureKey: string; evaluatedAt: string }) => ({
      decision: { allowed: 1, reasonCode: "ok", featureKey },
      account: { accountId, name: "Test Account" },
    }),
  };
}

// ============================================================================
// PerceptionService: registerSource
// ============================================================================

test("PerceptionService.registerSource happy path", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const input: RegisterPerceptionSourceInput = { type: "api", name: "Test Source" };
  const source = service.registerSource(input);
  assert.equal(source.name, "Test Source");
  assert.equal(source.type, "api");
  assert.ok(source.sourceId);
  assert.equal(source.enabled, 1);
});

test("PerceptionService.registerSource with custom id", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const source = service.registerSource({ sourceId: "custom_source_123", type: "rss", name: "Custom Source" });
  assert.equal(source.sourceId, "custom_source_123");
});

test("PerceptionService.registerSource with priority", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const source = service.registerSource({ type: "api", name: "Priority Source", priority: 10 });
  assert.equal(source.priority, 10);
});

test("PerceptionService.registerSource disabled", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const source = service.registerSource({ type: "api", name: "Disabled Source", enabled: false });
  assert.equal(source.enabled, 0);
});

test("PerceptionService.registerSource with tenantId", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const source = service.registerSource({ type: "api", name: "Tenant Source", tenantId: "tenant_1" });
  assert.equal(source.tenantId, "tenant_1");
});

test("PerceptionService.registerSource with schedule and filters", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  const source = service.registerSource({
    type: "api", name: "Configured Source",
    schedule: { interval: "1h" },
    filters: { tag: "important" },
  });
  assert.ok(source.scheduleJson);
  assert.ok(source.filtersJson);
});

test("PerceptionService.registerSource throws on invalid source id format", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  assert.throws(() => service.registerSource({ sourceId: "invalid id!", type: "api", name: "Test" }), ValidationError);
});

test("PerceptionService.registerSource throws on invalid name (too short)", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  assert.throws(() => service.registerSource({ type: "api", name: "AB" }), ValidationError);
});

test("PerceptionService.registerSource throws on invalid name (too long)", () => {
  const service = new PerceptionService(createMockDb() as any, createMockStore() as any);
  assert.throws(() => service.registerSource({ type: "api", name: "A".repeat(201) }), ValidationError);
});

// ============================================================================
// PerceptionService: ingestIntel
// ============================================================================

test("PerceptionService.ingestIntel happy path", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Important Update", summary: "There is a critical update available",
    rawRef: "https://example.com/update", relevanceScore: 0.8, importance: 0.9,
  };
  const result = service.ingestIntel({ sourceId: "src_1", items: [candidate] });

  assert.equal(result.insertedItems.length, 1);
  assert.equal(result.insertedItems[0]!.title, "Important Update");
  assert.equal(result.skippedDuplicateCount, 0);
});

test("PerceptionService.ingestIntel skips duplicates", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;
  mockStore.intelligence.getIntelItemBySourceAndDedupeKey = () => ({ intelId: "existing" }) as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Duplicate", summary: "This is a duplicate",
    rawRef: "https://example.com/duplicate", relevanceScore: 0.5, importance: 0.5,
  };
  const result = service.ingestIntel({ sourceId: "src_1", items: [candidate] });

  assert.equal(result.insertedItems.length, 0);
  assert.equal(result.skippedDuplicateCount, 1);
});

test("PerceptionService.ingestIntel with custom dedupeKey", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Item With Custom Key", summary: "This item has a custom dedupe key for testing",
    rawRef: "https://example.com/item",
    relevanceScore: 0.5, importance: 0.5, dedupeKey: "my-custom-key",
  };
  const result = service.ingestIntel({ sourceId: "src_1", items: [candidate] });

  assert.equal(result.insertedItems.length, 1);
  assert.ok(result.insertedItems[0]!.dedupeKey.includes("my-custom-key"));
});

test("PerceptionService.ingestIntel with ttlHours", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Timed Item", summary: "Item with expiration", rawRef: "https://example.com/timed",
    relevanceScore: 0.5, importance: 0.5, ttlHours: 24,
  };
  const result = service.ingestIntel({ sourceId: "src_1", items: [candidate] });

  assert.ok(result.insertedItems[0]!.expiresAt);
});

test("PerceptionService.ingestIntel throws on non-existent source", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.getPerceptionSource = () => null;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Item", summary: "Summary", rawRef: "https://example.com/item",
    relevanceScore: 0.5, importance: 0.5,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "nonexistent", items: [candidate] }), StorageError);
});

test("PerceptionService.ingestIntel throws on disabled source", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_disabled", tenantId: null, type: "api", name: "Test", enabled: 0,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Item", summary: "Summary", rawRef: "https://example.com/item",
    relevanceScore: 0.5, importance: 0.5,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "src_disabled", items: [candidate] }), PolicyDeniedError);
});

test("PerceptionService.ingestIntel throws on invalid title (too short)", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "AB", summary: "Valid summary for testing",
    rawRef: "https://example.com/short", relevanceScore: 0.5, importance: 0.5,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "src_1", items: [candidate] }), ValidationError);
});

test("PerceptionService.ingestIntel throws on invalid summary (too short)", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Valid Title", summary: "Short",
    rawRef: "https://example.com/short-summary", relevanceScore: 0.5, importance: 0.5,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "src_1", items: [candidate] }), ValidationError);
});

test("PerceptionService.ingestIntel throws on invalid relevanceScore (> 1)", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Valid Title", summary: "Valid summary for score test",
    rawRef: "https://example.com/score", relevanceScore: 1.5, importance: 0.5,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "src_1", items: [candidate] }), ValidationError);
});

test("PerceptionService.ingestIntel throws on negative importance", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const candidate: IngestIntelCandidate = {
    title: "Valid Title", summary: "Valid summary",
    rawRef: "https://example.com/negative", relevanceScore: 0.5, importance: -0.1,
  };
  assert.throws(() => service.ingestIntel({ sourceId: "src_1", items: [candidate] }), ValidationError);
});

test("PerceptionService.ingestIntel normalizes tags", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const result = service.ingestIntel({
    sourceId: "src_1",
    items: [{
      title: "Tagged Item", summary: "Item with tags",
      rawRef: "https://example.com/tagged",
      relevanceScore: 0.5, importance: 0.5,
      tags: ["IMPORTANT", "update", "security"],
    }],
  });

  const tags = JSON.parse(result.insertedItems[0]!.tagsJson);
  assert.ok(tags.includes("important"));
  assert.ok(tags.includes("update"));
  assert.ok(tags.includes("security"));
});

test("PerceptionService.ingestIntel with billing service entitlement denied", () => {
  const mockStore = createMockStore();
  const source: PerceptionSourceRecord = {
    sourceId: "src_1", tenantId: null, type: "api", name: "Test", enabled: 1,
    scheduleJson: null, filtersJson: null, priority: 0, createdAt: "", updatedAt: "",
  };
  mockStore.intelligence.getPerceptionSource = () => source;

  const mockBilling = {
    evaluateEntitlement: () => ({
      decision: { allowed: 0, reasonCode: "feature_disabled", featureKey: "phase3.perception_mvp" },
      account: null,
    }),
  };

  const service = new PerceptionService(createMockDb() as any, mockStore as any, { billingService: mockBilling as any });

  assert.throws(() => service.ingestIntel({ sourceId: "src_1", accountId: "acc_1", items: [{ title: "Item", summary: "Summary", rawRef: "ref", relevanceScore: 0.5, importance: 0.5 }] }), MonetizationError);
});

// ============================================================================
// PerceptionService: buildBrief
// ============================================================================

test("PerceptionService.buildBrief happy path", () => {
  const mockStore = createMockStore();
  const now = new Date().toISOString();
  mockStore.intelligence.listIntelItems = () => [{
    intelId: "intel_1", tenantId: null, sourceId: "src_1", title: "Test Item",
    summary: "Test summary", rawRef: "https://example.com", relevanceScore: 0.7,
    importance: 0.8, tagsJson: "[]", dedupeKey: "key1", capturedAt: now, expiresAt: null,
  }];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const result = service.buildBrief({});

  assert.ok(result.brief);
  assert.equal(result.items.length, 1);
  assert.equal(result.recommendedActions.length, 1);
});

test("PerceptionService.buildBrief with custom generatedAt", () => {
  const mockStore = createMockStore();
  const customTime = "2026-04-01T12:00:00.000Z";
  mockStore.intelligence.listIntelItems = () => [];
  mockStore.intelligence.listPerceptionSources = () => [];

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const result = service.buildBrief({ generatedAt: customTime });

  assert.equal(result.brief.generatedAt, customTime);
});

test("PerceptionService.buildBrief with since/until filters", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelItems = ({ since, until }: { since?: string | null; until?: string | null }) => {
    assert.ok(since);
    assert.ok(until);
    return [];
  };
  mockStore.intelligence.listPerceptionSources = () => [];

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  service.buildBrief({ since: "2026-04-01T00:00:00.000Z", until: "2026-04-30T00:00:00.000Z" });
});

test("PerceptionService.buildBrief filters expired items", () => {
  const mockStore = createMockStore();
  const now = new Date();
  mockStore.intelligence.listIntelItems = () => [
    { intelId: "current", tenantId: null, sourceId: "src_1", title: "Current", summary: "Not expired", rawRef: "https://example.com/current", relevanceScore: 0.5, importance: 0.5, tagsJson: "[]", dedupeKey: "k1", capturedAt: new Date(now.getTime() - 3600000).toISOString(), expiresAt: null },
    { intelId: "expired", tenantId: null, sourceId: "src_1", title: "Expired", summary: "Expired", rawRef: "https://example.com/expired", relevanceScore: 0.5, importance: 0.5, tagsJson: "[]", dedupeKey: "k2", capturedAt: new Date(now.getTime() - 7200000).toISOString(), expiresAt: new Date(now.getTime() - 3600000).toISOString() },
  ];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const result = service.buildBrief({ generatedAt: now.toISOString() });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.intelId, "current");
});

test("PerceptionService.buildBrief derives correct action types", () => {
  const mockStore = createMockStore();
  const now = new Date().toISOString();
  mockStore.intelligence.listIntelItems = () => [
    { intelId: "high_imp", tenantId: null, sourceId: "src_1", title: "Critical", summary: "Important", rawRef: "https://example.com/1", relevanceScore: 0.5, importance: 0.9, tagsJson: "[]", dedupeKey: "k1", capturedAt: now, expiresAt: null },
    { intelId: "high_rel", tenantId: null, sourceId: "src_1", title: "Relevant", summary: "Relevant", rawRef: "https://example.com/2", relevanceScore: 0.9, importance: 0.5, tagsJson: "[]", dedupeKey: "k2", capturedAt: now, expiresAt: null },
    { intelId: "monitor", tenantId: null, sourceId: "src_1", title: "Minor", summary: "Minor", rawRef: "https://example.com/3", relevanceScore: 0.3, importance: 0.3, tagsJson: "[]", dedupeKey: "k3", capturedAt: now, expiresAt: null },
  ];
  mockStore.intelligence.listPerceptionSources = () => [{ sourceId: "src_1", enabled: 1, tenantId: null }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const result = service.buildBrief({});

  // importance >= 0.85 -> investigate, relevance >= 0.75 -> notify, else -> monitor
  assert.equal(result.recommendedActions.length, 3);
  const investigate = result.recommendedActions.find(a => a.actionType === "investigate");
  const notify = result.recommendedActions.find(a => a.actionType === "notify");
  const monitor = result.recommendedActions.find(a => a.actionType === "monitor");
  assert.ok(investigate);
  assert.ok(notify);
  assert.ok(monitor);
});

test("PerceptionService.buildBrief throws on invalid generatedAt", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listPerceptionSources = () => [];

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  assert.throws(() => service.buildBrief({ generatedAt: "not-a-valid-date" }), ValidationError);
});

// ============================================================================
// PerceptionService: proposeActions
// ============================================================================

test("PerceptionService.proposeActions happy path", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listActionProposalsByBrief = () => [];
  mockStore.intelligence.getIntelBrief = () => ({
    briefId: "brief_1", tenantId: null, periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(), sourceScopeJson: "[]", itemIdsJson: "[]",
    overallSummary: "Test", recommendedActionsJson: JSON.stringify([
      { title: "Action 1", summary: "Summary 1", actionType: "monitor", intelId: "intel_1", reason: "test" },
    ]), generatedAt: new Date().toISOString(),
  });

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const proposals = service.proposeActions({ briefId: "brief_1" });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]!.title, "Action 1");
  assert.equal(proposals[0]!.status, "proposed");
});

test("PerceptionService.proposeActions idempotent - returns existing", () => {
  const mockStore = createMockStore();
  const existing = [{ proposalId: "prop_1", briefId: "brief_1" }] as any;
  mockStore.intelligence.listActionProposalsByBrief = () => existing;
  mockStore.intelligence.getIntelBrief = () => ({
    briefId: "brief_1", tenantId: null, periodStart: "", periodEnd: "",
    sourceScopeJson: "[]", itemIdsJson: "[]", overallSummary: "", recommendedActionsJson: "[]",
    generatedAt: new Date().toISOString(),
  });

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const proposals = service.proposeActions({ briefId: "brief_1" });

  assert.equal(proposals, existing);
});

test("PerceptionService.proposeActions throws on non-existent brief", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.getIntelBrief = () => null;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  assert.throws(() => service.proposeActions({ briefId: "nonexistent" }), StorageError);
});

// ============================================================================
// PerceptionService: listSources and listBriefs
// ============================================================================

test("PerceptionService.listSources returns all sources", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listPerceptionSources = () => [
    { sourceId: "src_1", enabled: 1, tenantId: null } as any,
    { sourceId: "src_2", enabled: 0, tenantId: null } as any,
  ];

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const sources = service.listSources();

  assert.equal(sources.length, 2);
});

test("PerceptionService.listSources with enabledOnly filter", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listPerceptionSources = (enabledOnly?: boolean) => {
    const sources = [{ sourceId: "src_1", enabled: 1 }, { sourceId: "src_2", enabled: 0 }] as any;
    return enabledOnly ? sources.filter((s: any) => s.enabled === 1) : sources;
  };

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const enabled = service.listSources(true);

  assert.equal(enabled.length, 1);
});

test("PerceptionService.listBriefs returns all briefs", () => {
  const mockStore = createMockStore();
  mockStore.intelligence.listIntelBriefs = () => [{ briefId: "brief_1" }, { briefId: "brief_2" }] as any;

  const service = new PerceptionService(createMockDb() as any, mockStore as any);
  const briefs = service.listBriefs(10);

  assert.equal(briefs.length, 2);
});