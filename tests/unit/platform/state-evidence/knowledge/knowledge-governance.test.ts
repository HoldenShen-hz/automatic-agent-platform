import test from "node:test";
import assert from "node:assert/strict";

import {
  CitationBuilder,
  FreshnessTracker,
  KnowledgeAccessControl,
  SourceTrustPolicyRegistry,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/index.js";

test("knowledge governance services enforce trust, citation, freshness, and access rules", () => {
  const trustPolicies = new SourceTrustPolicyRegistry();
  const citations = new CitationBuilder();
  const freshness = new FreshnessTracker();
  const access = new KnowledgeAccessControl();

  assert.equal(trustPolicies.get("verified").allowedInFinalResponse, true);
  assert.equal(citations.build({
    chunkId: "chunk_1",
    documentId: "doc_1",
    score: 1,
    matchType: "keyword",
    snippet: "Rollback immediately",
    namespace: "ops/incident",
    knowledgeRef: "knowledge:chunk_1",
  }), "knowledge:chunk_1");
  assert.equal(access.canRead({
    namespaceId: "ns_1",
    path: "ops/incident",
    description: "Ops",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 1,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, "ops"), true);
  assert.equal(freshness.assess({
    sourceId: "source_1",
    type: "text",
    uri: "memory://ops",
    contentHash: "hash",
    metadata: {},
    ingestedAt: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString(),
    namespace: "ops/incident",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString(),
    checksum: "hash",
  }, {
    namespaceId: "ns_1",
    path: "ops/incident",
    description: "Ops",
    ownerDomainId: "ops",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 1,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }).stale, true);
});

test("SourceTrustPolicyRegistry denies unverified sources in final response", () => {
  const trustPolicies = new SourceTrustPolicyRegistry();
  const policy = trustPolicies.get("unverified");
  assert.equal(policy.allowedInFinalResponse, false);
});

test("CitationBuilder builds citation with semantic match type", () => {
  const citations = new CitationBuilder();
  const citation = citations.build({
    chunkId: "chunk_2",
    documentId: "doc_2",
    score: 0.95,
    matchType: "semantic",
    snippet: "configuration guide",
    namespace: "ops/config",
    knowledgeRef: "knowledge:chunk_2",
  });
  assert.equal(citation, "knowledge:chunk_2");
});

test("KnowledgeAccessControl denies read for domain_only policy from wrong domain", () => {
  const access = new KnowledgeAccessControl();
  const canRead = access.canRead({
    namespaceId: "ns_2",
    path: "ops/security",
    description: "Security",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, "billing"); // wrong domain
  assert.equal(canRead, false);
});

test("KnowledgeAccessControl allows explicit cross-domain namespace grants", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_4",
    path: "ops/security",
    description: "Security",
    ownerDomainId: "ops",
    accessPolicy: "restricted",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "read",
    principal: {
      principalId: "auditor_1",
      domainId: "security",
      roles: ["cross_domain_reader"],
      permittedNamespaces: ["ops/security"],
    },
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.crossDomain, true);
  assert.equal(decision.reasonCode, "knowledge.access.explicit_override");
});

test("FreshnessTracker returns fresh for recent content", () => {
  const freshness = new FreshnessTracker();
  const result = freshness.assess({
    sourceId: "source_2",
    type: "text",
    uri: "memory://ops",
    contentHash: "hash2",
    metadata: {},
    ingestedAt: new Date().toISOString(),
    namespace: "ops/recent",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: new Date().toISOString(),
    checksum: "hash2",
  }, {
    namespaceId: "ns_3",
    path: "ops/recent",
    description: "Recent",
    ownerDomainId: "ops",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  });
  assert.equal(result.stale, false);
});

test("KnowledgeAccessControl allows same-domain write with writer role", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_write",
    path: "ops/config",
    description: "Config",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "write",
    principal: {
      principalId: "writer_1",
      domainId: "ops",
      roles: ["writer"],
    },
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.domain_write");
});

test("KnowledgeAccessControl allows cross-domain read with cross_domain_reader role", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_cross",
    path: "ops/security",
    description: "Security",
    ownerDomainId: "ops",
    accessPolicy: "restricted",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "read",
    principal: {
      principalId: "reader_1",
      domainId: "billing",
      roles: ["cross_domain_reader"],
    },
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.crossDomain, true);
  assert.equal(decision.reasonCode, "knowledge.access.cross_domain_reader");
});

test("KnowledgeAccessControl denies cross-domain read without cross_domain_reader role", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_cross_deny",
    path: "ops/security",
    description: "Security",
    ownerDomainId: "ops",
    accessPolicy: "restricted",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "read",
    principal: {
      principalId: "reader_2",
      domainId: "billing",
      roles: ["reader"], // wrong role for cross-domain
    },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.crossDomain, true);
  assert.equal(decision.reasonCode, "knowledge.access.cross_domain_denied");
});

test("KnowledgeAccessControl allows public namespace read without reader role", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_public",
    path: "docs/public",
    description: "Public docs",
    ownerDomainId: "docs",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "read",
    principal: {
      principalId: "anonymous_user",
      domainId: null,
      roles: [],
    },
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.public");
});

test("KnowledgeAccessControl allows write on public namespace from same domain with writer role", () => {
  const access = new KnowledgeAccessControl();
  const decision = access.checkAccess({
    namespaceId: "ns_public_write",
    path: "docs/public",
    description: "Public docs",
    ownerDomainId: "docs",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  }, {
    action: "write",
    principal: {
      principalId: "writer_2",
      domainId: "docs",
      roles: ["writer"],
    },
  });
  // Same domain with writer role allows write even on public namespace
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.domain_write");
});

test("FreshnessTracker downgrades verified trust to reviewed when stale", () => {
  const freshness = new FreshnessTracker();
  const result = freshness.assess({
    sourceId: "source_stale",
    type: "text",
    uri: "memory://ops",
    contentHash: "hash",
    metadata: {},
    ingestedAt: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString(),
    namespace: "ops/incident",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString(),
    checksum: "hash",
  }, {
    namespaceId: "ns_stale",
    path: "ops/incident",
    description: "Stale incident",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 1,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  });
  assert.equal(result.stale, true);
  assert.equal(result.effectiveTrustLevel, "reviewed"); // verified downgraded to reviewed
  assert.equal(result.action, "warn");
});

test("FreshnessTracker preserves non-verified trust level when stale", () => {
  const freshness = new FreshnessTracker();
  const result = freshness.assess({
    sourceId: "source_stale_unverified",
    type: "text",
    uri: "memory://ops",
    contentHash: "hash",
    metadata: {},
    ingestedAt: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString(),
    namespace: "ops/incident",
    language: null,
    tags: [],
    trustLevel: "unverified", // not verified, should not be downgraded
    freshnessTimestamp: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString(),
    checksum: "hash",
  }, {
    namespaceId: "ns_stale2",
    path: "ops/incident",
    description: "Stale incident 2",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 1,
      staleAction: "demote",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  });
  assert.equal(result.stale, true);
  assert.equal(result.effectiveTrustLevel, "unverified"); // preserved, not downgraded
  assert.equal(result.action, "demote");
});

test("FreshnessTracker returns null action when content is fresh", () => {
  const freshness = new FreshnessTracker();
  const result = freshness.assess({
    sourceId: "source_fresh",
    type: "text",
    uri: "memory://ops",
    contentHash: "hash",
    metadata: {},
    ingestedAt: new Date().toISOString(),
    namespace: "ops/recent",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: new Date().toISOString(),
    checksum: "hash",
  }, {
    namespaceId: "ns_fresh",
    path: "ops/recent",
    description: "Fresh content",
    ownerDomainId: "ops",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "demote",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 10,
    maxTotalSizeBytes: 10_000,
  });
  assert.equal(result.stale, false);
  assert.equal(result.action, null); // null when not stale
  assert.equal(result.daysOld, 0);
});

test("CitationBuilder.buildMany deduplicates citations", () => {
  const citations = new CitationBuilder();
  const hits = [
    { chunkId: "chunk_1", documentId: "doc_1", score: 1, matchType: "keyword" as const, snippet: "test", namespace: "ns", knowledgeRef: "knowledge:chunk_1" },
    { chunkId: "chunk_1", documentId: "doc_1", score: 1, matchType: "semantic" as const, snippet: "test", namespace: "ns", knowledgeRef: "knowledge:chunk_1" },
    { chunkId: "chunk_2", documentId: "doc_1", score: 0.9, matchType: "keyword" as const, snippet: "test2", namespace: "ns", knowledgeRef: "knowledge:chunk_2" },
  ];
  const result = citations.buildMany(hits);
  assert.equal(result.length, 2); // chunk_1 should be deduplicated
  assert.ok(result.includes("knowledge:chunk_1"));
  assert.ok(result.includes("knowledge:chunk_2"));
});
