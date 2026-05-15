/**
 * Unit tests for Artifact and Knowledge Plane facade types
 * Tests src/platform/five-plane-interface/api/facade-interfaces.ts - Artifact and Knowledge types
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  ArtifactLink,
  ArtifactRecord,
  ArtifactBundleType,
  ArtifactBundleExtended,
  ArtifactGovernanceDecision,
  ArtifactPlaneBundleResult,
  ArtifactPublishLedgerEntry,
  ArtifactFacadeService,
  RetrievalHit,
  KnowledgeQueryOptions,
  KnowledgeFacadeService,
} from "../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

test("ArtifactLink structure is correct", () => {
  const link: ArtifactLink = {
    ref: "s3://bucket/artifact.zip",
    type: "application/zip",
  };
  assert.equal(link.ref, "s3://bucket/artifact.zip");
  assert.equal(link.type, "application/zip");
});

test("ArtifactRecord structure is correct", () => {
  const record: ArtifactRecord = {
    artifactId: "art-123",
    name: "release-v1.0.0.zip",
    mimeType: "application/zip",
    sizeBytes: 1048576,
    checksum: "sha256:abc123",
    storageRef: "s3://bucket/releases/v1.0.0.zip",
    createdAt: "2026-04-01T10:00:00.000Z",
  };
  assert.equal(record.artifactId, "art-123");
  assert.equal(record.name, "release-v1.0.0.zip");
  assert.equal(record.sizeBytes, 1048576);
});

test("ArtifactBundleType accepts all valid variants", () => {
  const types: ArtifactBundleType[] = [
    "release_bundle",
    "asset_bundle",
    "campaign_bundle",
    "incident_bundle",
  ];
  assert.equal(types.length, 4);
});

test("ArtifactBundleExtended structure is correct", () => {
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle-456",
    bundleType: "release_bundle",
    taskId: "task-789",
    domainId: "domain-abc",
    artifacts: [],
    links: [],
    finalDeliverables: ["output.json"],
    createdAt: "2026-04-01T10:00:00.000Z",
  };
  assert.equal(bundle.bundleId, "bundle-456");
  assert.equal(bundle.bundleType, "release_bundle");
  assert.equal(bundle.taskId, "task-789");
  assert.equal(bundle.domainId, "domain-abc");
});

test("ArtifactBundleExtended with full artifacts and links", () => {
  const bundle: ArtifactBundleExtended = {
    bundleId: "bundle-full",
    bundleType: "campaign_bundle",
    taskId: "task-full",
    domainId: "domain-full",
    artifacts: [
      {
        artifactId: "art-1",
        name: "image.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        checksum: "sha256:img123",
        storageRef: "s3://bucket/img.png",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ],
    links: [
      { ref: "https://docs.example.com", type: "text/html" },
    ],
    finalDeliverables: ["report.pdf", "data.json"],
    createdAt: "2026-04-01T12:00:00.000Z",
  };
  assert.equal(bundle.artifacts.length, 1);
  assert.equal(bundle.links.length, 1);
  assert.equal(bundle.finalDeliverables.length, 2);
});

test("ArtifactGovernanceDecision structure for allowed bundle", () => {
  const decision: ArtifactGovernanceDecision = {
    allowed: true,
    issues: [],
  };
  assert.equal(decision.allowed, true);
  assert.equal(decision.issues.length, 0);
});

test("ArtifactGovernanceDecision structure for rejected bundle", () => {
  const decision: ArtifactGovernanceDecision = {
    allowed: false,
    issues: ["missing_checksum", "invalid_mime_type"],
  };
  assert.equal(decision.allowed, false);
  assert.equal(decision.issues.length, 2);
});

test("ArtifactPlaneBundleResult structure is correct", () => {
  const result: ArtifactPlaneBundleResult = {
    bundle: {
      bundleId: "bundle-result",
      bundleType: "release_bundle",
      taskId: "task-result",
      domainId: "domain-result",
      artifacts: [],
      links: [],
      finalDeliverables: [],
      createdAt: "2026-04-01T10:00:00.000Z",
    },
    governance: { allowed: true, issues: [] },
    preview: '{"status":"ready"}',
  };
  assert.equal(result.bundle.bundleId, "bundle-result");
  assert.equal(result.governance.allowed, true);
});

test("ArtifactPublishLedgerEntry structure is correct", () => {
  const entry: ArtifactPublishLedgerEntry = {
    publishedAt: "2026-04-01T14:00:00.000Z",
    bundleId: "bundle-ledger",
    bundleType: "incident_bundle",
    domainId: "domain-incident",
    artifactCount: 5,
  };
  assert.equal(entry.bundleId, "bundle-ledger");
  assert.equal(entry.bundleType, "incident_bundle");
  assert.equal(entry.artifactCount, 5);
});

test("ArtifactFacadeService interface defines required methods", () => {
  const service: ArtifactFacadeService = {
    prepareBundle: () => ({
      bundle: {
        bundleId: "bundle-1",
        bundleType: "asset_bundle",
        taskId: "task-1",
        domainId: "domain-1",
        artifacts: [],
        links: [],
        finalDeliverables: [],
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      governance: { allowed: true, issues: [] },
      preview: "preview",
    }),
    publishBundle: (bundle) => ({
      bundle,
      governance: { allowed: true, issues: [] },
      preview: "preview",
    }),
    listPublishHistory: () => [],
  };
  assert.equal(typeof service.prepareBundle, "function");
  assert.equal(typeof service.publishBundle, "function");
  assert.equal(typeof service.listPublishHistory, "function");
});

test("RetrievalHit structure is correct", () => {
  const hit: RetrievalHit = {
    chunkId: "chunk-1",
    documentId: "doc-1",
    score: 0.95,
    matchType: "semantic",
    snippet: "This is a relevant snippet...",
    namespace: "default",
    knowledgeRef: "kb://documents/tech/spec",
  };
  assert.equal(hit.chunkId, "chunk-1");
  assert.equal(hit.score, 0.95);
  assert.equal(hit.matchType, "semantic");
});

test("RetrievalHit matchType accepts all valid variants", () => {
  const semanticHit: RetrievalHit = {
    chunkId: "c1",
    documentId: "d1",
    score: 0.9,
    matchType: "semantic",
    snippet: "semantic match",
    namespace: "ns1",
    knowledgeRef: "kb://ref1",
  };
  const keywordHit: RetrievalHit = { ...semanticHit, matchType: "keyword" };
  const structuralHit: RetrievalHit = { ...semanticHit, matchType: "structural" };
  assert.equal(semanticHit.matchType, "semantic");
  assert.equal(keywordHit.matchType, "keyword");
  assert.equal(structuralHit.matchType, "structural");
});

test("KnowledgeQueryOptions allows all optional fields", () => {
  const options: KnowledgeQueryOptions = {
    namespace: "custom-namespace",
    limit: 50,
    domainId: "domain-123",
    includePluginRetrieval: true,
  };
  assert.equal(options.namespace, "custom-namespace");
  assert.equal(options.limit, 50);
  assert.equal(options.domainId, "domain-123");
  assert.equal(options.includePluginRetrieval, true);
});

test("KnowledgeQueryOptions allows empty object", () => {
  const options: KnowledgeQueryOptions = {};
  assert.equal(options.namespace, undefined);
  assert.equal(options.limit, undefined);
});

test("KnowledgeFacadeService interface defines required methods", () => {
  const service: KnowledgeFacadeService = {
    listNamespaces: () => [],
    queryForDomain: async () => [],
    queryAsync: async () => [],
    inspectGraph: () => null,
    inspectSemanticInfrastructure: () => null,
    inspectNamespace: () => null,
  };
  assert.equal(typeof service.listNamespaces, "function");
  assert.equal(typeof service.queryForDomain, "function");
  assert.equal(typeof service.queryAsync, "function");
  assert.equal(typeof service.inspectGraph, "function");
  assert.equal(typeof service.inspectSemanticInfrastructure, "function");
  assert.equal(typeof service.inspectNamespace, "function");
});
