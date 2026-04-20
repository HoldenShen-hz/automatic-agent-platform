import assert from "node:assert/strict";
import test from "node:test";

import type {
  RegisterPerceptionSourceInput,
  IngestIntelCandidate,
  IngestIntelInput,
  IngestIntelResult,
  BuildIntelBriefInput,
  RecommendedPerceptionAction,
  BuildIntelBriefResult,
  ProposePerceptionActionsInput,
  ExportIntelBriefResult,
  PerceptionServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/perception-service.js";
import type {
  PerceptionSourceRecord,
  PerceptionSourceType,
  IntelBriefRecord,
} from "../../../../src/platform/contracts/types/domain.js";

test("RegisterPerceptionSourceInput structure is correct", () => {
  const input: RegisterPerceptionSourceInput = {
    sourceId: "src_123",
    tenantId: "tenant_abc",
    type: "api",
    name: "Security Feed",
    enabled: true,
    schedule: { frequency: "hourly" },
    filters: { minRelevance: 0.5 },
    priority: 10,
    accountId: "acc_456",
  };

  assert.equal(input.sourceId, "src_123");
  assert.equal(input.type, "api");
  assert.equal(input.name, "Security Feed");
  assert.equal(input.enabled, true);
  assert.deepEqual(input.schedule, { frequency: "hourly" });
  assert.deepEqual(input.filters, { minRelevance: 0.5 });
  assert.equal(input.priority, 10);
});

test("RegisterPerceptionSourceInput allows minimal definition", () => {
  const input: RegisterPerceptionSourceInput = {
    type: "github",
    name: "Minimal Source",
  };

  assert.equal(input.type, "github");
  assert.equal(input.name, "Minimal Source");
  assert.equal(input.enabled, undefined);
  assert.equal(input.schedule, undefined);
  assert.equal(input.filters, undefined);
  assert.equal(input.priority, undefined);
});

test("PerceptionSourceType accepts all valid values", () => {
  const types: PerceptionSourceType[] = ["rss", "web", "github", "api", "custom"];
  assert.equal(types.length, 5);
});

test("IngestIntelCandidate structure is correct", () => {
  const candidate: IngestIntelCandidate = {
    title: "Security Vulnerability Discovered",
    summary: "A critical vulnerability was found in the authentication system.",
    rawRef: "https://example.com/vuln-123",
    relevanceScore: 0.9,
    importance: 0.85,
    tags: ["security", "vulnerability", "urgent"],
    dedupeKey: "vuln-123",
    capturedAt: "2026-04-14T00:00:00.000Z",
    ttlHours: 72,
  };

  assert.equal(candidate.title, "Security Vulnerability Discovered");
  assert.equal(candidate.relevanceScore, 0.9);
  assert.equal(candidate.importance, 0.85);
  assert.deepEqual(candidate.tags, ["security", "vulnerability", "urgent"]);
  assert.equal(candidate.ttlHours, 72);
});

test("IngestIntelCandidate allows minimal definition", () => {
  const candidate: IngestIntelCandidate = {
    title: "Simple Intel",
    summary: "This is a simple intel item for testing purposes here.",
    rawRef: "https://example.com/intel-1",
    relevanceScore: 0.5,
    importance: 0.3,
  };

  assert.equal(candidate.tags, undefined);
  assert.equal(candidate.dedupeKey, undefined);
  assert.equal(candidate.capturedAt, undefined);
  assert.equal(candidate.ttlHours, undefined);
});

test("IngestIntelInput structure is correct", () => {
  const input: IngestIntelInput = {
    sourceId: "src_abc",
    tenantId: "tenant_123",
    items: [
      {
        title: "First Item",
        summary: "Summary of first item for testing purposes.",
        rawRef: "https://example.com/1",
        relevanceScore: 0.7,
        importance: 0.6,
      },
    ],
    accountId: "acc_xyz",
  };

  assert.equal(input.sourceId, "src_abc");
  assert.equal(input.items.length, 1);
  assert.equal(input.accountId, "acc_xyz");
});

test("IngestIntelResult structure is correct", () => {
  const result: IngestIntelResult = {
    source: {
      sourceId: "src_test",
      tenantId: "tenant_test",
      type: "api",
      name: "Test Source",
      enabled: 1,
      scheduleJson: null,
      filtersJson: null,
      priority: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    } as PerceptionSourceRecord,
    insertedItems: [],
    skippedDuplicateCount: 0,
  };

  assert.equal(result.source.sourceId, "src_test");
  assert.equal(result.skippedDuplicateCount, 0);
});

test("BuildIntelBriefInput structure is correct", () => {
  const input: BuildIntelBriefInput = {
    tenantId: "tenant_brief",
    sourceIds: ["src_1", "src_2"],
    since: "2026-04-01T00:00:00.000Z",
    until: "2026-04-14T23:59:59.999Z",
    generatedAt: "2026-04-14T12:00:00.000Z",
    limit: 50,
    accountId: "acc_brief",
  };

  assert.equal(input.tenantId, "tenant_brief");
  assert.equal(input.sourceIds?.length, 2);
  assert.equal(input.limit, 50);
});

test("BuildIntelBriefInput allows minimal definition", () => {
  const input: BuildIntelBriefInput = {};
  assert.equal(input.tenantId, undefined);
  assert.equal(input.sourceIds, undefined);
  assert.equal(input.limit, undefined);
});

test("RecommendedPerceptionAction structure is correct", () => {
  const action: RecommendedPerceptionAction = {
    title: "investigate:Critical Vulnerability",
    summary: "A critical vulnerability requires immediate investigation.",
    actionType: "investigate",
    intelId: "intel_123",
    reason: "importance=0.9; relevance=0.8; tags=security",
  };

  assert.equal(action.actionType, "investigate");
  assert.equal(action.intelId, "intel_123");
});

test("RecommendedPerceptionAction actionType accepts all valid values", () => {
  const actionTypes: RecommendedPerceptionAction["actionType"][] = [
    "monitor",
    "investigate",
    "notify",
  ];

  for (const actionType of actionTypes) {
    const action: RecommendedPerceptionAction = {
      title: `${actionType}:Test`,
      summary: "Test summary for validation.",
      actionType,
      intelId: "intel_test",
      reason: "test",
    };
    assert.ok(action.actionType === actionType);
  }
});

test("BuildIntelBriefResult structure is correct", () => {
  const result: BuildIntelBriefResult = {
    brief: {
      briefId: "brief_123",
      tenantId: "tenant_abc",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-14T23:59:59.999Z",
      sourceScopeJson: '["src_1"]',
      itemIdsJson: '["item_1","item_2"]',
      overallSummary: "Test brief summary",
      recommendedActionsJson: "[]",
      generatedAt: "2026-04-14T00:00:00.000Z",
    } as IntelBriefRecord,
    items: [],
    recommendedActions: [],
  };

  assert.equal(result.brief.briefId, "brief_123");
  assert.equal(result.items.length, 0);
  assert.equal(result.recommendedActions.length, 0);
});

test("ProposePerceptionActionsInput structure is correct", () => {
  const input: ProposePerceptionActionsInput = {
    briefId: "brief_xyz",
    tenantId: "tenant_propose",
    accountId: "acc_propose",
  };

  assert.equal(input.briefId, "brief_xyz");
  assert.equal(input.tenantId, "tenant_propose");
});

test("ExportIntelBriefResult structure is correct", () => {
  const result: ExportIntelBriefResult = {
    brief: {
      briefId: "brief_export",
      tenantId: "tenant_export",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-14T23:59:59.999Z",
      sourceScopeJson: "[]",
      itemIdsJson: "[]",
      overallSummary: "Export test",
      recommendedActionsJson: "[]",
      generatedAt: "2026-04-14T00:00:00.000Z",
    } as IntelBriefRecord,
    items: [],
    recommendedActions: [],
    proposals: [],
    jsonArtifact: {
      artifactId: "art_json",
      kind: "file",
      name: "brief.json",
      sizeBytes: 1024,
      uri: "file:///tmp/artifacts/brief.json",
      createdAt: "2026-04-14T00:00:00.000Z",
    } as import("../../../../src/platform/contracts/types/domain.js").ArtifactRef,
    markdownArtifact: {
      artifactId: "art_md",
      kind: "file",
      name: "brief.md",
      sizeBytes: 512,
      uri: "file:///tmp/artifacts/brief.md",
      createdAt: "2026-04-14T00:00:00.000Z",
    } as import("../../../../src/platform/contracts/types/domain.js").ArtifactRef,
  };

  assert.equal(result.brief.briefId, "brief_export");
  assert.equal(result.jsonArtifact.artifactId, "art_json");
  assert.equal(result.markdownArtifact.artifactId, "art_md");
});

test("PerceptionServiceOptions structure is correct", () => {
  const options: PerceptionServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/tmp/artifacts",
    },
  };

  assert.ok(options.artifactStoreOptions !== undefined);
  assert.equal(options.artifactStoreOptions?.rootDir, "/tmp/artifacts");
});

test("PerceptionServiceOptions allows empty options", () => {
  const options: PerceptionServiceOptions = {};
  assert.equal(options.artifactStoreOptions, undefined);
  assert.equal(options.billingService, undefined);
});
