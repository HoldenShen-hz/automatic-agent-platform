import assert from "node:assert/strict";
import test from "node:test";
import { IntelligenceRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/intelligence-repository.js";

function createMockDb() {
  const runCalls: unknown[][] = [];
  return {
    db: {
      connection: {
        prepare: () => ({
          run: (...args: unknown[]) => {
            runCalls.push(args);
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        }),
      },
    },
    runCalls,
  };
}

test("IntelligenceRepository has all required methods", () => {
  const { db } = createMockDb();
  const repo = new IntelligenceRepository(db);

  assert.equal(typeof repo.upsertPerceptionSource, "function");
  assert.equal(typeof repo.insertIntelItem, "function");
  assert.equal(typeof repo.insertIntelBrief, "function");
  assert.equal(typeof repo.insertActionProposal, "function");
  assert.equal(typeof repo.getPerceptionSource, "function");
  assert.equal(typeof repo.listPerceptionSources, "function");
  assert.equal(typeof repo.getIntelItemBySourceAndDedupeKey, "function");
  assert.equal(typeof repo.listIntelItems, "function");
  assert.equal(typeof repo.listIntelItemsByIds, "function");
  assert.equal(typeof repo.getIntelBrief, "function");
  assert.equal(typeof repo.listIntelBriefs, "function");
  assert.equal(typeof repo.listActionProposalsByBrief, "function");
});

test("IntelligenceRepository upserts perception source", () => {
  const { db, runCalls } = createMockDb();
  const repo = new IntelligenceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const source = {
    sourceId: "source_1",
    tenantId: "tenant_1",
    type: "rss",
    name: "Tech News",
    enabled: true,
    scheduleJson: "{}",
    filtersJson: "[]",
    priority: 100,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertPerceptionSource(source), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(source.sourceId));
  assert.ok(runCalls[0]?.includes(source.name));
});

test("IntelligenceRepository gets perception source", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.getPerceptionSource("nonexistent");
  assert.equal(result, null);
});

test("IntelligenceRepository gets perception source with tenant scope", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.getPerceptionSource("source_1", "tenant_1");
  assert.equal(result, null);
});

test("IntelligenceRepository lists perception sources", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listPerceptionSources();
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository lists enabled perception sources", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listPerceptionSources(true);
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository inserts intel item", () => {
  const { db, runCalls } = createMockDb();
  const repo = new IntelligenceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const item = {
    intelId: "intel_1",
    tenantId: "tenant_1",
    sourceId: "source_1",
    title: "Important Update",
    summary: "There is a new update available",
    rawRef: "https://example.com/update",
    relevanceScore: 0.9,
    importance: 8,
    tagsJson: "[\"security\",\"update\"]",
    dedupeKey: "update_123",
    capturedAt: now,
    expiresAt: null,
  };

  assert.equal(repo.insertIntelItem(item), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(item.intelId));
  assert.ok(runCalls[0]?.includes(item.title));
});

test("IntelligenceRepository gets intel item by source and dedupe key", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.getIntelItemBySourceAndDedupeKey("source_1", "nonexistent");
  assert.equal(result, null);
});

test("IntelligenceRepository lists intel items", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listIntelItems({});
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository lists intel items with source filter", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listIntelItems({ sourceIds: ["source_1", "source_2"] });
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository lists intel items by ids", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listIntelItemsByIds(["intel_1", "intel_2"]);
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository lists intel items by ids with empty array", () => {
  const { db } = createMockDb();
  const repo = new IntelligenceRepository(db);

  const result = repo.listIntelItemsByIds([]);
  assert.deepEqual(result, []);
});

test("IntelligenceRepository inserts intel brief", () => {
  const { db, runCalls } = createMockDb();
  const repo = new IntelligenceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const brief = {
    briefId: "brief_1",
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.000Z",
    sourceScopeJson: "{\"sources\":[\"source_1\"]}",
    itemIdsJson: "[\"intel_1\",\"intel_2\"]",
    overallSummary: "2 important items found",
    recommendedActionsJson: "[]",
    generatedAt: now,
  };

  assert.equal(repo.insertIntelBrief(brief), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(brief.briefId));
  assert.ok(runCalls[0]?.includes(brief.overallSummary));
});

test("IntelligenceRepository gets intel brief", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.getIntelBrief("nonexistent");
  assert.equal(result, null);
});

test("IntelligenceRepository lists intel briefs", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listIntelBriefs();
  assert.ok(Array.isArray(result));
});

test("IntelligenceRepository inserts action proposal", () => {
  const { db, runCalls } = createMockDb();
  const repo = new IntelligenceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const proposal = {
    proposalId: "proposal_1",
    tenantId: "tenant_1",
    briefId: "brief_1",
    intelId: "intel_1",
    taskId: "task_1",
    title: "Apply Security Update",
    summary: "Security update available",
    actionType: "apply_update",
    status: "pending",
    requiresApproval: true,
    proposalJson: "{}",
    createdAt: now,
    decidedAt: null,
  };

  assert.equal(repo.insertActionProposal(proposal), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(proposal.proposalId));
  assert.ok(runCalls[0]?.includes(proposal.title));
});

test("IntelligenceRepository lists action proposals by brief", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new IntelligenceRepository(db);

  const result = repo.listActionProposalsByBrief("brief_1");
  assert.ok(Array.isArray(result));
});
