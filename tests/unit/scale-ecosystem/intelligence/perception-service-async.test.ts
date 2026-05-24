import assert from "node:assert/strict";
import test from "node:test";

import type {
  ActionProposalRecord,
  IntelBriefRecord,
  IntelItemRecord,
  PerceptionSourceRecord,
} from "../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { PerceptionServiceAsync } from "../../../../src/scale-ecosystem/intelligence/perception-service-async.js";

type ListIntelInput = {
  tenantId: string | null;
  since: string | null;
  until: string | null;
  limit: number;
  sourceIds?: readonly string[];
};

function createHarness(): {
  db: AuthoritativeSqlDatabase;
  store: AuthoritativeTaskStore;
  service: PerceptionServiceAsync;
} {
  const sources = new Map<string, PerceptionSourceRecord>();
  const intelItems = new Map<string, IntelItemRecord>();
  const briefs = new Map<string, IntelBriefRecord>();
  const proposals: ActionProposalRecord[] = [];

  const store = {
    intelligence: {
      upsertPerceptionSource(source: PerceptionSourceRecord): void {
        sources.set(source.sourceId, source);
      },
      getPerceptionSource(sourceId: string, tenantId?: string | null): PerceptionSourceRecord | null {
        const source = sources.get(sourceId) ?? null;
        if (source == null) {
          return null;
        }
        if (tenantId !== undefined && source.tenantId !== tenantId) {
          return null;
        }
        return source;
      },
      insertIntelItem(item: IntelItemRecord): void {
        intelItems.set(item.intelId, item);
      },
      getIntelItemBySourceAndDedupeKey(
        sourceId: string,
        dedupeKey: string,
        tenantId?: string | null,
      ): IntelItemRecord | null {
        for (const item of intelItems.values()) {
          if (item.sourceId !== sourceId || item.dedupeKey !== dedupeKey) {
            continue;
          }
          if (tenantId !== undefined && item.tenantId !== tenantId) {
            continue;
          }
          return item;
        }
        return null;
      },
      listIntelItems({ tenantId, since, until, limit, sourceIds }: ListIntelInput): IntelItemRecord[] {
        let items = [...intelItems.values()];
        if (tenantId !== null) {
          items = items.filter((item) => item.tenantId === tenantId);
        }
        if (since !== null) {
          items = items.filter((item) => item.capturedAt >= since);
        }
        if (until !== null) {
          items = items.filter((item) => item.capturedAt <= until);
        }
        if (sourceIds != null && sourceIds.length > 0) {
          items = items.filter((item) => sourceIds.includes(item.sourceId));
        }
        return items.slice(0, limit);
      },
      listIntelItemsByIds(ids: readonly string[]): IntelItemRecord[] {
        return ids
          .map((id) => intelItems.get(id))
          .filter((item): item is IntelItemRecord => item != null);
      },
      insertIntelBrief(brief: IntelBriefRecord): void {
        briefs.set(brief.briefId, brief);
      },
      getIntelBrief(briefId: string, tenantId?: string | null): IntelBriefRecord | null {
        const brief = briefs.get(briefId) ?? null;
        if (brief == null) {
          return null;
        }
        if (tenantId !== undefined && brief.tenantId !== tenantId) {
          return null;
        }
        return brief;
      },
      listPerceptionSources(enabledOnly: boolean, tenantId?: string | null): PerceptionSourceRecord[] {
        let result = [...sources.values()];
        if (tenantId !== undefined) {
          result = result.filter((source) => source.tenantId === tenantId);
        }
        if (enabledOnly) {
          result = result.filter((source) => source.enabled === 1);
        }
        return result;
      },
      listActionProposalsByBrief(briefId: string, tenantId?: string | null): ActionProposalRecord[] {
        return proposals.filter(
          (proposal) => proposal.briefId === briefId && (tenantId === undefined || proposal.tenantId === tenantId),
        );
      },
      insertActionProposal(proposal: ActionProposalRecord): void {
        proposals.push(proposal);
      },
    },
    task: {
      getTask(_taskId: string): null {
        return null;
      },
      insertTask(_task: unknown): void {},
    },
    artifact: {
      insertArtifact(_artifact: unknown): void {},
    },
    listIntelItemsByIds(ids: readonly string[]): IntelItemRecord[] {
      return ids
        .map((id) => intelItems.get(id))
        .filter((item): item is IntelItemRecord => item != null);
    },
  } as unknown as AuthoritativeTaskStore;

  const db = {
    filePath: "/tmp/perception-service-async.test.db",
    transaction<T>(fn: () => T): T {
      return fn();
    },
  } as unknown as AuthoritativeSqlDatabase;

  return {
    db,
    store,
    service: new PerceptionServiceAsync(db, store),
  };
}

test("PerceptionServiceAsync registerSource returns a promise and normalizes persisted source fields", async () => {
  const { service } = createHarness();

  const pending = service.registerSource({
    sourceId: "source.async.api",
    type: "api",
    name: "  Example Source  ",
    enabled: false,
    priority: 7.8,
  });

  assert.ok(pending instanceof Promise);

  const source = await pending;
  assert.equal(source.sourceId, "source.async.api");
  assert.equal(source.name, "Example Source");
  assert.equal(source.enabled, 0);
  assert.equal(source.priority, 7);
});

test("PerceptionServiceAsync ingestIntel deduplicates items and normalizes metadata", async () => {
  const { service } = createHarness();
  const source = await service.registerSource({
    sourceId: "source.async.ingest",
    type: "api",
    name: "Async Ingest",
  });

  const first = await service.ingestIntel({
    sourceId: source.sourceId,
    items: [{
      title: "Critical Security Update",
      summary: "A significant update is available for the platform.",
      rawRef: " https://example.com/update ",
      relevanceScore: 0.81234,
      importance: 0.94567,
      dedupeKey: "same-update",
      tags: ["IMPORTANT", "security", "security", "release"],
      ttlHours: 4.7,
    }],
  });

  const second = await service.ingestIntelAsync({
    sourceId: source.sourceId,
    items: [{
      title: "Critical Security Update",
      summary: "A significant update is available for the platform.",
      rawRef: "https://example.com/update",
      relevanceScore: 0.8,
      importance: 0.9,
      dedupeKey: "same-update",
    }],
  });

  assert.equal(first.insertedItems.length, 1);
  assert.equal(first.insertedItems[0]?.rawRef, "https://example.com/update");
  assert.equal(first.insertedItems[0]?.relevanceScore, 0.812);
  assert.equal(first.insertedItems[0]?.importance, 0.946);
  assert.deepEqual(JSON.parse(first.insertedItems[0]?.tagsJson ?? "[]"), ["important", "security", "release"]);
  assert.notEqual(first.insertedItems[0]?.expiresAt, null);
  assert.equal(second.insertedItems.length, 0);
  assert.equal(second.skippedDuplicateCount, 1);
});

test("PerceptionServiceAsync buildBrief returns current items and derived recommended actions", async () => {
  const { service } = createHarness();
  const source = await service.registerSource({
    sourceId: "source.async.brief",
    type: "api",
    name: "Async Brief",
  });

  await service.ingestIntel({
    sourceId: source.sourceId,
    items: [
      {
        title: "Major launch signal",
        summary: "A high-importance launch should drive investigation.",
        rawRef: "https://example.com/launch",
        relevanceScore: 0.7,
        importance: 0.9,
      },
      {
        title: "Broad adoption signal",
        summary: "A highly relevant signal should notify stakeholders.",
        rawRef: "https://example.com/adoption",
        relevanceScore: 0.8,
        importance: 0.5,
      },
    ],
  });

  const pending = service.buildBrief({});
  assert.ok(pending instanceof Promise);

  const result = await pending;
  assert.equal(result.items.length, 2);
  assert.equal(result.recommendedActions.length, 2);
  assert.equal(result.recommendedActions[0]?.actionType, "investigate");
  assert.equal(result.recommendedActions[1]?.actionType, "notify");
  assert.equal(result.brief.overallSummary.includes("2 intel items"), true);
});

test("PerceptionServiceAsync proposeActions is async and idempotent for the same brief", async () => {
  const { service } = createHarness();
  const source = await service.registerSource({
    sourceId: "source.async.actions",
    type: "api",
    name: "Async Actions",
  });

  await service.ingestIntel({
    sourceId: source.sourceId,
    items: [{
      title: "Notify signal",
      summary: "This signal should create an approval-gated proposal.",
      rawRef: "https://example.com/notify",
      relevanceScore: 0.95,
      importance: 0.6,
    }],
  });

  const brief = await service.buildBrief({});
  const pending = service.proposeActions({ briefId: brief.brief.briefId });
  assert.ok(pending instanceof Promise);

  const first = await pending;
  const second = await service.proposeActionsAsync({ briefId: brief.brief.briefId });

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0], second[0]);
  assert.equal(first[0]?.actionType, "notify");
  assert.equal(first[0]?.requiresApproval, 1);
  assert.equal(first[0]?.status, "proposed");
});
