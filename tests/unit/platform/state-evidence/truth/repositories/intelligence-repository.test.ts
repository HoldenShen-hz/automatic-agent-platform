import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { IntelligenceRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/intelligence-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

test("IntelligenceRepository upsertPerceptionSource and getPerceptionSource", () => {
  const workspace = createTempWorkspace("aa-intelligence-perception-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{\"cron\":\"0 * * * *\"}",
      filtersJson: "{\"regions\":[\"us\"]}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });

    const result = repo.getPerceptionSource("source-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.sourceId, "source-1");
    assert.equal(result.name, "Market Feed");
    assert.equal(result.type, "api");
    assert.equal(result.enabled, 1);
    assert.equal(result.priority, 5);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository upsertPerceptionSource updates existing record", () => {
  const workspace = createTempWorkspace("aa-intelligence-perception-upd-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Original Name",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "rss",
      name: "Updated Name",
      enabled: 0,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 10,
      createdAt: now,
      updatedAt: "2026-04-15T11:00:00.000Z",
    });

    const result = repo.getPerceptionSource("source-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.name, "Updated Name");
    assert.equal(result.type, "rss");
    assert.equal(result.enabled, 0);
    assert.equal(result.priority, 10);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listPerceptionSources returns all sources", () => {
  const workspace = createTempWorkspace("aa-intelligence-perception-list-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertPerceptionSource({
      sourceId: "source-2",
      tenantId: "tenant-alpha",
      type: "rss",
      name: "News Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 3,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listPerceptionSources(false, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listPerceptionSources filters by enabled status", () => {
  const workspace = createTempWorkspace("aa-intelligence-perception-enabled-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Enabled Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertPerceptionSource({
      sourceId: "source-2",
      tenantId: "tenant-alpha",
      type: "rss",
      name: "Disabled Feed",
      enabled: 0,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 3,
      createdAt: now,
      updatedAt: now,
    });

    const allSources = repo.listPerceptionSources(false, "tenant-alpha");
    assert.equal(allSources.length, 2);

    const enabledSources = repo.listPerceptionSources(true, "tenant-alpha");
    assert.equal(enabledSources.length, 1);
    assert.equal(enabledSources[0]?.sourceId, "source-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository insertIntelItem and getIntelItemBySourceAndDedupeKey", () => {
  const workspace = createTempWorkspace("aa-intelligence-intel-item-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    // Insert parent perception source first
    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertIntelItem({
      intelId: "intel-1",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Demand spike",
      summary: "Traffic increased",
      rawRef: "s3://intel/raw/1.json",
      relevanceScore: 0.91,
      importance: 10,
      tagsJson: "[\"demand\"]",
      dedupeKey: "dedupe-1",
      capturedAt: now,
      expiresAt: null,
    });

    const result = repo.getIntelItemBySourceAndDedupeKey("source-1", "dedupe-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.intelId, "intel-1");
    assert.equal(result.title, "Demand spike");
    assert.equal(result.relevanceScore, 0.91);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listIntelItems returns items for source", () => {
  const workspace = createTempWorkspace("aa-intelligence-intel-list-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    // Insert parent perception source first
    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertIntelItem({
      intelId: "intel-1",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Item One",
      summary: "Summary one",
      rawRef: "s3://intel/1.json",
      relevanceScore: 0.9,
      importance: 8,
      tagsJson: "[]",
      dedupeKey: "dedupe-1",
      capturedAt: now,
      expiresAt: null,
    });
    repo.insertIntelItem({
      intelId: "intel-2",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Item Two",
      summary: "Summary two",
      rawRef: "s3://intel/2.json",
      relevanceScore: 0.8,
      importance: 5,
      tagsJson: "[]",
      dedupeKey: "dedupe-2",
      capturedAt: now,
      expiresAt: null,
    });

    const results = repo.listIntelItems({ tenantId: "tenant-alpha", sourceIds: ["source-1"] });
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listIntelItemsByIds returns items by id list", () => {
  const workspace = createTempWorkspace("aa-intelligence-intel-byids-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    // Insert parent perception source first
    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertIntelItem({
      intelId: "intel-1",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Item One",
      summary: "Summary one",
      rawRef: "s3://intel/1.json",
      relevanceScore: 0.9,
      importance: 8,
      tagsJson: "[]",
      dedupeKey: "dedupe-1",
      capturedAt: now,
      expiresAt: null,
    });
    repo.insertIntelItem({
      intelId: "intel-2",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Item Two",
      summary: "Summary two",
      rawRef: "s3://intel/2.json",
      relevanceScore: 0.8,
      importance: 5,
      tagsJson: "[]",
      dedupeKey: "dedupe-2",
      capturedAt: now,
      expiresAt: null,
    });

    const results = repo.listIntelItemsByIds(["intel-1", "intel-2"], "tenant-alpha");
    assert.equal(results.length, 2);
    assert.equal(results[0]?.title, "Item One");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listIntelItemsByIds returns empty for empty ids", () => {
  const workspace = createTempWorkspace("aa-intelligence-intel-empty-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    const results = repo.listIntelItemsByIds([], "tenant-alpha");
    assert.equal(results.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository insertIntelBrief and getIntelBrief", () => {
  const workspace = createTempWorkspace("aa-intelligence-brief-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.insertIntelBrief({
      briefId: "brief-1",
      tenantId: "tenant-alpha",
      periodStart: "2026-04-15T09:00:00.000Z",
      periodEnd: now,
      sourceScopeJson: "[\"source-1\"]",
      itemIdsJson: "[\"intel-1\"]",
      overallSummary: "Market demand is rising",
      recommendedActionsJson: "[\"scale\"]",
      generatedAt: now,
    });

    const result = repo.getIntelBrief("brief-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.briefId, "brief-1");
    assert.equal(result.overallSummary, "Market demand is rising");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository listIntelBriefs returns all briefs", () => {
  const workspace = createTempWorkspace("aa-intelligence-brief-list-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    repo.insertIntelBrief({
      briefId: "brief-1",
      tenantId: "tenant-alpha",
      periodStart: "2026-04-15T09:00:00.000Z",
      periodEnd: now,
      sourceScopeJson: "[]",
      itemIdsJson: "[]",
      overallSummary: "Summary One",
      recommendedActionsJson: "[]",
      generatedAt: now,
    });
    repo.insertIntelBrief({
      briefId: "brief-2",
      tenantId: "tenant-alpha",
      periodStart: "2026-04-15T09:00:00.000Z",
      periodEnd: now,
      sourceScopeJson: "[]",
      itemIdsJson: "[]",
      overallSummary: "Summary Two",
      recommendedActionsJson: "[]",
      generatedAt: now,
    });

    const results = repo.listIntelBriefs(10, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntelligenceRepository insertActionProposal and listActionProposalsByBrief", () => {
  const workspace = createTempWorkspace("aa-intelligence-proposal-");
  const dbPath = join(workspace, "intelligence-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new IntelligenceRepository(db);

    // Insert parent source and intel item first
    repo.upsertPerceptionSource({
      sourceId: "source-1",
      tenantId: "tenant-alpha",
      type: "api",
      name: "Market Feed",
      enabled: 1,
      scheduleJson: "{}",
      filtersJson: "{}",
      priority: 5,
      createdAt: now,
      updatedAt: now,
    });
    repo.insertIntelItem({
      intelId: "intel-1",
      tenantId: "tenant-alpha",
      sourceId: "source-1",
      title: "Demand spike",
      summary: "Traffic increased",
      rawRef: "s3://intel/raw/1.json",
      relevanceScore: 0.91,
      importance: 10,
      tagsJson: "[\"demand\"]",
      dedupeKey: "dedupe-1",
      capturedAt: now,
      expiresAt: null,
    });
    repo.insertIntelBrief({
      briefId: "brief-1",
      tenantId: "tenant-alpha",
      periodStart: "2026-04-15T09:00:00.000Z",
      periodEnd: now,
      sourceScopeJson: "[\"source-1\"]",
      itemIdsJson: "[\"intel-1\"]",
      overallSummary: "Market demand is rising",
      recommendedActionsJson: "[\"scale\"]",
      generatedAt: now,
    });

    repo.insertActionProposal({
      proposalId: "proposal-1",
      tenantId: "tenant-alpha",
      briefId: "brief-1",
      intelId: "intel-1",
      taskId: null,
      title: "Scale budget",
      summary: "Increase spend",
      actionType: "budget_adjustment",
      status: "proposed",
      requiresApproval: 1,
      proposalJson: "{\"delta\":0.2}",
      createdAt: now,
      decidedAt: null,
    });

    const results = repo.listActionProposalsByBrief("brief-1", "tenant-alpha");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.proposalId, "proposal-1");
    assert.equal(results[0]?.title, "Scale budget");
    assert.equal(results[0]?.status, "proposed");
  } finally {
    cleanupPath(workspace);
  }
});
