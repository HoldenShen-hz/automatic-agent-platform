import assert from "node:assert/strict";
import test from "node:test";

import {
  CitationBuilder,
  FreshnessTracker,
  KnowledgeAccessControl,
  SourceTrustPolicyRegistry,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/index.js";

const namespace = {
  namespaceId: "ns_1",
  path: "ops/incident",
  description: "Ops",
  ownerDomainId: "ops",
  accessPolicy: "domain_only" as const,
  freshnessPolicy: {
    maxAgeDays: 1,
    staleAction: "warn" as const,
    refreshStrategy: "manual" as const,
    refreshIntervalHours: null,
  },
  trustLevel: "authoritative" as const,
  maxDocuments: 10,
  maxTotalSizeBytes: 10_000,
};

test("knowledge governance services enforce canonical trust, citation, freshness, and access rules", () => {
  const trustPolicies = new SourceTrustPolicyRegistry();
  const citations = new CitationBuilder();
  const freshness = new FreshnessTracker();
  const access = new KnowledgeAccessControl();

  assert.equal(trustPolicies.get("authoritative").allowedInFinalResponse, true);
  assert.equal(
    citations.build({
      chunkId: "chunk_1",
      documentId: "doc_1",
      score: 1,
      matchType: "keyword",
      snippet: "Rollback immediately",
      namespace: "ops/incident",
      knowledgeRef: "knowledge:chunk_1",
    }),
    "knowledge:chunk_1",
  );
  assert.equal(access.canRead(namespace, "ops"), true);
  assert.equal(
    freshness.assess(
      {
        sourceId: "source_1",
        type: "text",
        uri: "memory://ops",
        contentHash: "hash",
        metadata: {},
        ingestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        namespace: "ops/incident",
        language: null,
        tags: [],
        trustLevel: "authoritative",
        freshnessTimestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        checksum: "hash",
      },
      { ...namespace, accessPolicy: "public" },
    ).stale,
    true,
  );
});

test("SourceTrustPolicyRegistry denies private_unverified sources in final responses", () => {
  assert.equal(new SourceTrustPolicyRegistry().get("private_unverified").allowedInFinalResponse, false);
});

test("KnowledgeAccessControl applies explicit grants and cross-domain reader roles", () => {
  const access = new KnowledgeAccessControl();

  const explicitGrant = access.checkAccess(
    { ...namespace, accessPolicy: "restricted" },
    {
      action: "read",
      principal: {
        principalId: "auditor_1",
        domainId: "security",
        roles: ["cross_domain_reader"],
        permittedNamespaces: ["ops/incident"],
      },
    },
  );
  const crossDomainReader = access.checkAccess(
    { ...namespace, accessPolicy: "restricted" },
    {
      action: "read",
      principal: {
        principalId: "reader_1",
        domainId: "billing",
        roles: ["cross_domain_reader"],
      },
    },
  );

  assert.equal(explicitGrant.allowed, true);
  assert.equal(explicitGrant.reasonCode, "knowledge.access.explicit_override");
  assert.equal(crossDomainReader.allowed, true);
  assert.equal(crossDomainReader.reasonCode, "knowledge.access.cross_domain_reader");
});

test("FreshnessTracker keeps recent authoritative content fresh", () => {
  const freshness = new FreshnessTracker();
  const result = freshness.assess(
    {
      sourceId: "source_2",
      type: "text",
      uri: "memory://ops",
      contentHash: "hash2",
      metadata: {},
      ingestedAt: new Date().toISOString(),
      namespace: "ops/recent",
      language: null,
      tags: [],
      trustLevel: "authoritative",
      freshnessTimestamp: new Date().toISOString(),
      checksum: "hash2",
    },
    { ...namespace, path: "ops/recent", accessPolicy: "public" },
  );

  assert.equal(result.stale, false);
  assert.equal(result.effectiveTrustLevel, "authoritative");
});
