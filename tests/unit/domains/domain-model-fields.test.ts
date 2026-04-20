/**
 * Domain Model Fields Unit Tests
 *
 * Tests for §37 domain modeling field completeness:
 * - TenantRecord enhanced fields (quotas, billingPlan, slaLevel, allowedRegions)
 * - DomainRiskProfile enhanced fields (regulatoryClass, timeSensitivity, etc.)
 * - DomainKnowledgeSchema enhanced fields (knowledgeSources, retrievalStrategy, etc.)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainRiskProfileSchema,
  DomainRiskLevelSchema,
  RiskOverrideSchema,
  EscalationLevelSchema,
  ApprovalRuleSchema,
  computeDomainRiskLevel,
  type DomainRiskProfile,
} from "../../../src/domains/risk-profile/index.js";

import {
  DomainKnowledgeSchemaSchema,
  KnowledgeSourceSchema,
  RetrievalStrategySchema,
  FreshnessPolicySchema,
  resolveKnowledgeNamespaces,
  type DomainKnowledgeSchema,
} from "../../../src/domains/knowledge-schema/index.js";

import type { TenantRecord } from "../../../src/platform/contracts/types/domain/workspace-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// TenantRecord Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TenantRecord accepts minimal fields (backward compatible)", () => {
  const minimal: TenantRecord = {
    tenantId: "tenant-1",
    organizationId: "org-1",
    storageScope: "global",
    identityScope: "tenant",
    policyScope: "tenant",
    artifactScope: "tenant",
    isolationMode: "shared_logical",
    deploymentMode: "cloud_shared",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(minimal.tenantId, "tenant-1");
  assert.equal(minimal.isolationMode, "shared_logical");
});

test("TenantRecord accepts enhanced fields", () => {
  const enhanced: TenantRecord = {
    tenantId: "tenant-2",
    organizationId: "org-1",
    displayName: "Acme Corp",
    storageScope: "global",
    identityScope: "tenant",
    policyScope: "tenant",
    artifactScope: "tenant",
    isolationMode: "dedicated_runtime",
    deploymentMode: "private_cloud",
    quotas: {
      monthlyTokenLimit: 1000000,
      monthlyCostLimitUsd: 5000,
      maxConcurrentExecutions: 50,
      maxStorageBytes: 10 * 1024 * 1024 * 1024,
      rateLimitPerMinute: 1000,
    },
    billingPlan: "enterprise",
    slaLevel: "professional",
    allowedRegions: ["us-east-1", "eu-west-1"],
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(enhanced.displayName, "Acme Corp");
  assert.equal(enhanced.billingPlan, "enterprise");
  assert.equal(enhanced.slaLevel, "professional");
  assert.equal(enhanced.allowedRegions?.length, 2);
  assert.equal(enhanced.quotas?.monthlyTokenLimit, 1000000);
});

test("TenantRecord quotas fields are optional", () => {
  const partial: TenantRecord = {
    tenantId: "tenant-3",
    organizationId: "org-1",
    storageScope: "global",
    identityScope: "tenant",
    policyScope: "tenant",
    artifactScope: "tenant",
    isolationMode: "shared_logical",
    deploymentMode: "cloud_shared",
    quotas: {
      monthlyTokenLimit: null,
      maxConcurrentExecutions: 10,
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.equal(partial.quotas?.monthlyTokenLimit, null);
  assert.equal(partial.quotas?.monthlyCostLimitUsd, undefined);
  assert.equal(partial.quotas?.maxConcurrentExecutions, 10);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainRiskProfile Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainRiskProfileSchema accepts minimal profile", () => {
  const profile = DomainRiskProfileSchema.parse({
    profileId: "profile-1",
    domainId: "finance",
    defaultRiskLevel: "medium",
  });

  assert.equal(profile.profileId, "profile-1");
  assert.equal(profile.defaultRiskLevel, "medium");
  assert.equal(profile.dimensions.length, 0);
});

test("DomainRiskProfileSchema accepts enhanced profile", () => {
  const profile = DomainRiskProfileSchema.parse({
    profileId: "profile-2",
    domainId: "healthcare",
    defaultRiskLevel: "high",
    regulatoryClass: "heavily_regulated",
    timeSensitivity: "realtime",
    reversibility: "irreversible",
    blastRadius: "department",
    riskOverrides: [
      {
        actionPattern: "patient.data.delete",
        baseRisk: 50,
        domainRisk: 90,
        reason: "HIPAA requirement",
        requiresJustification: true,
      },
    ],
    escalationChain: [
      {
        level: 1,
        trigger: "risk_score > 70",
        target: "domain_owner",
        responseSla: "1h",
      },
      {
        level: 2,
        trigger: "risk_score > 90",
        target: "security_team",
        responseSla: "15m",
      },
    ],
    mandatoryApprovals: [
      {
        ruleId: "rule-1",
        actionPattern: "*.write",
        requiredApprovals: 2,
        approverRole: "compliance_officer",
      },
    ],
  });

  assert.equal(profile.regulatoryClass, "heavily_regulated");
  assert.equal(profile.timeSensitivity, "realtime");
  assert.equal(profile.blastRadius, "department");
  assert.equal(profile.riskOverrides?.length, 1);
  assert.equal(profile.escalationChain?.length, 2);
  assert.equal(profile.mandatoryApprovals?.length, 1);
});

test("DomainRiskLevelSchema validates correctly", () => {
  assert.equal(DomainRiskLevelSchema.parse("low"), "low");
  assert.equal(DomainRiskLevelSchema.parse("critical"), "critical");

  assert.throws(() => DomainRiskLevelSchema.parse("invalid"));
});

test("computeDomainRiskLevel returns correct level", () => {
  const profile: DomainRiskProfile = {
    profileId: "p1",
    domainId: "d1",
    defaultRiskLevel: "low",
    dimensions: [],
  };

  assert.equal(computeDomainRiskLevel(profile, 90), "critical");
  assert.equal(computeDomainRiskLevel(profile, 70), "high");
  assert.equal(computeDomainRiskLevel(profile, 40), "medium");
  assert.equal(computeDomainRiskLevel(profile, 10), "low");
});

test("computeDomainRiskLevel handles critical default", () => {
  const profile: DomainRiskProfile = {
    profileId: "p1",
    domainId: "d1",
    defaultRiskLevel: "critical",
    dimensions: [],
  };

  assert.equal(computeDomainRiskLevel(profile, 10), "medium");
});

test("RiskOverrideSchema validates correctly", () => {
  const valid = RiskOverrideSchema.parse({
    actionPattern: "finance.payment.*",
    baseRisk: 60,
    domainRisk: 85,
    reason: "High value transaction",
    requiresJustification: true,
  });

  assert.equal(valid.actionPattern, "finance.payment.*");
  assert.equal(valid.domainRisk, 85);
});

test("EscalationLevelSchema validates correctly", () => {
  const valid = EscalationLevelSchema.parse({
    level: 1,
    trigger: "risk_score > 80",
    target: "platform_sre",
    responseSla: "30m",
  });

  assert.equal(valid.level, 1);
  assert.equal(valid.target, "platform_sre");
});

test("ApprovalRuleSchema validates correctly", () => {
  const valid = ApprovalRuleSchema.parse({
    ruleId: "rule-1",
    actionPattern: "*.delete",
    requiredApprovals: 3,
    approverRole: "admin",
  });

  assert.equal(valid.requiredApprovals, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainKnowledgeSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainKnowledgeSchemaSchema accepts minimal schema", () => {
  const schema = DomainKnowledgeSchemaSchema.parse({
    schemaId: "schema-1",
    domainId: "content",
  });

  assert.equal(schema.schemaId, "schema-1");
  assert.equal(schema.namespaceIds.length, 0);
  assert.equal(schema.conflictResolution, "trust_priority");
});

test("DomainKnowledgeSchemaSchema accepts enhanced schema", () => {
  const schema = DomainKnowledgeSchemaSchema.parse({
    schemaId: "schema-2",
    domainId: "analytics",
    namespaceIds: ["ns-1", "ns-2"],
    freshnessWindowHours: 48,
    conflictResolution: "latest_wins",
    retentionDays: 90,
    knowledgeSources: [
      {
        sourceId: "src-1",
        type: "document_store",
        priority: 80,
        refreshInterval: "1h",
        authScope: "internal",
      },
      {
        sourceId: "src-2",
        type: "embedding_index",
        priority: 60,
        refreshInterval: "daily",
        authScope: "public",
        endpoint: "https://api.example.com/search",
      },
    ],
    retrievalStrategy: {
      strategy: "hybrid",
      maxResults: 20,
      minRelevanceScore: 0.8,
      rerankEnabled: true,
    },
    freshnessPolicy: {
      maxStalenessHours: 12,
      refreshTrigger: "event_driven",
      backgroundRefreshEnabled: true,
    },
  });

  assert.equal(schema.namespaceIds.length, 2);
  assert.equal(schema.knowledgeSources?.length, 2);
  assert.equal(schema.retrievalStrategy?.strategy, "hybrid");
  assert.equal(schema.freshnessPolicy?.refreshTrigger, "event_driven");
});

test("KnowledgeSourceSchema validates correctly", () => {
  const valid = KnowledgeSourceSchema.parse({
    sourceId: "src-1",
    type: "database",
    priority: 75,
    refreshInterval: "30m",
    authScope: "admin",
  });

  assert.equal(valid.type, "database");
  assert.equal(valid.priority, 75);
});

test("RetrievalStrategySchema validates correctly", () => {
  const valid = RetrievalStrategySchema.parse({
    strategy: "semantic",
    maxResults: 15,
    minRelevanceScore: 0.6,
    rerankEnabled: false,
  });

  assert.equal(valid.strategy, "semantic");
  assert.equal(valid.maxResults, 15);
});

test("FreshnessPolicySchema validates correctly", () => {
  const valid = FreshnessPolicySchema.parse({
    maxStalenessHours: 6,
    refreshTrigger: "scheduled",
    backgroundRefreshEnabled: true,
  });

  assert.equal(valid.maxStalenessHours, 6);
  assert.equal(valid.refreshTrigger, "scheduled");
});

test("resolveKnowledgeNamespaces merges namespaces", () => {
  const schema = DomainKnowledgeSchemaSchema.parse({
    schemaId: "s1",
    domainId: "d1",
    namespaceIds: ["ns-a", "ns-b"],
  });

  const result = resolveKnowledgeNamespaces(schema, ["ns-b", "ns-c"]);
  assert.ok(result.includes("ns-a"));
  assert.ok(result.includes("ns-b"));
  assert.ok(result.includes("ns-c"));
  assert.equal(result.length, 3);
});

test("resolveKnowledgeNamespaces handles empty additional", () => {
  const schema = DomainKnowledgeSchemaSchema.parse({
    schemaId: "s1",
    domainId: "d1",
    namespaceIds: ["ns-x"],
  });

  const result = resolveKnowledgeNamespaces(schema);
  assert.equal(result.length, 1);
  assert.equal(result[0], "ns-x");
});

test("resolveKnowledgeNamespaces handles minimal schema", () => {
  const schema = DomainKnowledgeSchemaSchema.parse({
    schemaId: "s1",
    domainId: "d1",
  });

  const result = resolveKnowledgeNamespaces(schema, ["ns-y"]);
  assert.equal(result.length, 1);
  assert.equal(result[0], "ns-y");
});
