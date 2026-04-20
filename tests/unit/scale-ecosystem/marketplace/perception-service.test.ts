import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { BillingService, type PlanCatalogEntry } from "../../../../src/scale-ecosystem/marketplace/billing-service.js";
import { PerceptionService } from "../../../../src/scale-ecosystem/marketplace/perception-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("perception service deduplicates intel items and excludes expired items from briefs", () => {
  const workspace = createTempWorkspace("aa-perception-unit-");
  const dbPath = join(workspace, "perception.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new PerceptionService(db, store);

    const source = service.registerSource({
      sourceId: "source-unit-1",
      type: "rss",
      name: "Unit Signals",
      priority: 5,
    });

    const first = service.ingestIntel({
      sourceId: source.sourceId,
      items: [
        {
          title: "Pricing discussion spikes",
          summary: "Users discussed pricing changes across multiple channels.",
          rawRef: "https://example.test/pricing",
          relevanceScore: 0.88,
          importance: 0.86,
          tags: ["pricing", "support"],
          capturedAt: "2026-04-08T10:00:00.000Z",
          ttlHours: 24,
        },
        {
          title: "Old stale mention",
          summary: "A stale low-priority item that should expire before brief generation.",
          rawRef: "https://example.test/stale",
          relevanceScore: 0.2,
          importance: 0.1,
          tags: ["noise"],
          capturedAt: "2026-04-07T00:00:00.000Z",
          ttlHours: 1,
        },
      ],
    });
    assert.equal(first.insertedItems.length, 2);

    const second = service.ingestIntel({
      sourceId: source.sourceId,
      items: [
        {
          title: "Pricing discussion spikes",
          summary: "Duplicate record should be skipped by dedupe key.",
          rawRef: "https://example.test/pricing",
          relevanceScore: 0.88,
          importance: 0.86,
          tags: ["pricing", "support"],
          capturedAt: "2026-04-08T10:05:00.000Z",
          ttlHours: 24,
        },
      ],
    });
    assert.equal(second.insertedItems.length, 0);
    assert.equal(second.skippedDuplicateCount, 1);

    const brief = service.buildBrief({
      sourceIds: [source.sourceId],
      generatedAt: "2026-04-08T12:00:00.000Z",
    });
    assert.equal(brief.items.length, 1);
    assert.match(brief.brief.overallSummary, /Pricing discussion spikes/);
    assert.equal(brief.recommendedActions.length, 1);

    const proposals = service.proposeActions({ briefId: brief.brief.briefId });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.requiresApproval, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("perception service respects billing feature entitlements when a billing account is provided", () => {
  const workspace = createTempWorkspace("aa-perception-billing-");
  const dbPath = join(workspace, "perception-billing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const tinyPlan: PlanCatalogEntry = {
      planId: "tiny",
      displayName: "Tiny",
      features: ["phase3.billing_export"],
      quotas: {},
    };
    const billing = new BillingService(db, store, {
      planCatalog: { tiny: tinyPlan },
    });
    billing.createAccount({
      accountId: "acct-no-perception",
      ownerId: "owner-1",
      planId: "tiny",
      createdAt: "2026-04-08T10:00:00.000Z",
    });
    const service = new PerceptionService(db, store, {
      billingService: billing,
    });

    assert.throws(
      () =>
        service.registerSource({
          sourceId: "source-denied-1",
          type: "rss",
          name: "Denied Source",
          accountId: "acct-no-perception",
        }),
      /perception\.feature_denied:billing\.feature_not_in_plan/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("perception service scopes sources, briefs, and proposals by tenant", () => {
  const workspace = createTempWorkspace("aa-perception-tenant-");
  const dbPath = join(workspace, "perception-tenant.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new PerceptionService(db, store);

    const tenantASource = service.registerSource({
      sourceId: "source-tenant-a",
      tenantId: "tenant-a",
      type: "rss",
      name: "Tenant A Signals",
      priority: 8,
    });
    const tenantBSource = service.registerSource({
      sourceId: "source-tenant-b",
      tenantId: "tenant-b",
      type: "rss",
      name: "Tenant B Signals",
      priority: 4,
    });

    service.ingestIntel({
      sourceId: tenantASource.sourceId,
      tenantId: "tenant-a",
      items: [
        {
          title: "Tenant A launch signal",
          summary: "Tenant A-specific signal",
          rawRef: "https://example.test/tenant-a",
          relevanceScore: 0.9,
          importance: 0.9,
          tags: ["launch"],
          capturedAt: "2026-04-08T10:00:00.000Z",
          ttlHours: 24,
        },
      ],
    });
    service.ingestIntel({
      sourceId: tenantBSource.sourceId,
      tenantId: "tenant-b",
      items: [
        {
          title: "Tenant B launch signal",
          summary: "Tenant B-specific signal",
          rawRef: "https://example.test/tenant-b",
          relevanceScore: 0.85,
          importance: 0.82,
          tags: ["launch"],
          capturedAt: "2026-04-08T10:05:00.000Z",
          ttlHours: 24,
        },
      ],
    });

    const tenantABrief = service.buildBrief({
      tenantId: "tenant-a",
      generatedAt: "2026-04-08T12:00:00.000Z",
    });
    const tenantBBrief = service.buildBrief({
      tenantId: "tenant-b",
      generatedAt: "2026-04-08T12:00:00.000Z",
    });

    assert.deepEqual(service.listSources(false, "tenant-a").map((source) => source.sourceId), [tenantASource.sourceId]);
    assert.deepEqual(service.listSources(false, "tenant-b").map((source) => source.sourceId), [tenantBSource.sourceId]);
    assert.deepEqual(service.listBriefs(10, "tenant-a").map((brief) => brief.briefId), [tenantABrief.brief.briefId]);
    assert.deepEqual(service.listBriefs(10, "tenant-b").map((brief) => brief.briefId), [tenantBBrief.brief.briefId]);
    assert.equal(tenantABrief.items.length, 1);
    assert.equal(tenantABrief.items[0]?.sourceId, tenantASource.sourceId);
    assert.equal(tenantBBrief.items[0]?.sourceId, tenantBSource.sourceId);

    assert.throws(
      () => service.proposeActions({ briefId: tenantABrief.brief.briefId, tenantId: "tenant-b" }),
      /perception\.brief_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
