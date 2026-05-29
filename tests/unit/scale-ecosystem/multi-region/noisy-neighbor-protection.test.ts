/**
 * Tests for NoisyNeighborProtectionService
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  NoisyNeighborProtectionService,
  type TenantQuota,
  type ResourceType,
  getNoisyNeighborProtectionService,
  resetNoisyNeighborProtectionService,
} from "../../../../src/scale-ecosystem/multi-region/noisy-neighbor-protection.js";

test("NoisyNeighborProtectionService: registers a quota for a tenant [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: 100,
    priority: 1,
  };

  service.registerQuota(quota);

  const quotas = service.getTenantQuotas("tenant-1");
  assert.equal(quotas.length, 1);
  assert.equal(quotas[0]!.resourceType, "api_requests");
});

test("NoisyNeighborProtectionService: registers multiple quotas for a tenant [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quotas: readonly Omit<TenantQuota, "quotaId" | "tenantId">[] = [
    { resourceType: "cpu", limit: 100, windowSeconds: 60, burstLimit: 10, priority: 1 },
    { resourceType: "memory", limit: 200, windowSeconds: 60, burstLimit: 20, priority: 1 },
  ];

  service.registerQuotas("tenant-1", quotas);

  const tenantQuotas = service.getTenantQuotas("tenant-1");
  assert.equal(tenantQuotas.length, 2);
});

test("NoisyNeighborProtectionService: assigns new quota IDs [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quotas: readonly Omit<TenantQuota, "quotaId" | "tenantId">[] = [
    { resourceType: "cpu", limit: 100, windowSeconds: 60, burstLimit: 10, priority: 1 },
  ];

  service.registerQuotas("tenant-1", quotas);

  const tenantQuotas = service.getTenantQuotas("tenant-1");
  assert.ok(tenantQuotas[0]!.quotaId.startsWith("quota_"));
});

test("NoisyNeighborProtectionService: allows request when no quota is set [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const decision = service.checkRateLimit("tenant-1", "api_requests");

  assert.equal(decision.allowed, true);
  assert.equal(decision.limit, Infinity);
  assert.equal(decision.remaining, Infinity);
});

test("NoisyNeighborProtectionService: allows request within quota limits [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  const decision = service.checkRateLimit("tenant-1", "api_requests");

  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 999);
});

test("NoisyNeighborProtectionService: allows request within window limit [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  // Record some usage
  service.recordUsage("tenant-1", "api_requests", 50);

  const decision = service.checkRateLimit("tenant-1", "api_requests");

  assert.equal(decision.allowed, true);
  assert.equal(decision.remaining, 49);
});

test("NoisyNeighborProtectionService: blocks request when window limit exceeded [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  // Exceed the limit
  service.recordUsage("tenant-1", "api_requests", 100);

  const decision = service.checkRateLimit("tenant-1", "api_requests");

  assert.equal(decision.allowed, false);
  assert.ok(decision.retryAfterMs !== null);
});

test("NoisyNeighborProtectionService: checks token bucket for burst handling [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: 50,
    priority: 1,
  };
  service.registerQuota(quota);

  // Consume all burst tokens
  for (let i = 0; i < 50; i++) {
    service.checkRateLimit("tenant-1", "api_requests");
  }

  const decision = service.checkRateLimit("tenant-1", "api_requests");

  assert.equal(decision.allowed, false);
});

test("NoisyNeighborProtectionService: returns correct tenant and resource type in decision [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "cpu",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  const decision = service.checkRateLimit("tenant-1", "cpu");

  assert.equal(decision.tenantId, "tenant-1");
  assert.equal(decision.resourceType, "cpu");
});

test("NoisyNeighborProtectionService: records usage and returns ResourceUsage [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  const usage = service.recordUsage("tenant-1", "api_requests", 10);

  assert.equal(usage.tenantId, "tenant-1");
  assert.equal(usage.resourceType, "api_requests");
  assert.equal(usage.used, 10);
  assert.equal(usage.limit, 1000);
  assert.ok(usage.percentUsed > 0);
});

test("NoisyNeighborProtectionService: accumulates usage within same window [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 10);
  service.recordUsage("tenant-1", "api_requests", 20);

  const usage = service.getCurrentUsage("tenant-1", "api_requests");
  assert.ok(usage);
  assert.equal(usage!.used, 30);
});

test("NoisyNeighborProtectionService: tracks all resource types [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const resources: ResourceType[] = [
    "cpu",
    "memory",
    "storage",
    "network_bandwidth",
    "api_requests",
    "task_executions",
    "concurrent_connections",
  ];

  for (const resource of resources) {
    service.recordUsage("tenant-1", resource, 5);
  }

  const usages = service.getTenantUsage("tenant-1");
  assert.equal(usages.length, resources.length);
});

test("NoisyNeighborProtectionService: returns null when no usage recorded [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const usage = service.getCurrentUsage("tenant-1", "api_requests");
  assert.equal(usage, null);
});

test("NoisyNeighborProtectionService: returns current usage for tenant and resource type [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 50);

  const usage = service.getCurrentUsage("tenant-1", "api_requests");
  assert.ok(usage);
  assert.equal(usage!.used, 50);
});

test("NoisyNeighborProtectionService: preserves recorded usage shape even if quota changes later [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  service.registerQuota({
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  });

  const recorded = service.recordUsage("tenant-1", "api_requests", 50);
  service.registerQuota({
    quotaId: "quota-2",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 200,
    windowSeconds: 120,
    burstLimit: null,
    priority: 2,
  });

  const current = service.getCurrentUsage("tenant-1", "api_requests");
  assert.ok(current);
  assert.equal(current!.usageId, recorded.usageId);
  assert.equal(current!.limit, 100);
  assert.equal(current!.windowSeconds, 60);
  assert.equal(current!.percentUsed, 50);
});

test("NoisyNeighborProtectionService: returns percent used [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 50);

  const usage = service.getCurrentUsage("tenant-1", "api_requests");
  assert.ok(usage);
  assert.equal(usage!.percentUsed, 50);
});

test("NoisyNeighborProtectionService: returns empty array when no quotas registered [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quotas = service.getTenantQuotas("tenant-1");
  assert.equal(quotas.length, 0);
});

test("NoisyNeighborProtectionService: returns all quotas for a tenant [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quotas: TenantQuota[] = [
    {
      quotaId: "quota-1",
      tenantId: "tenant-1",
      resourceType: "cpu",
      limit: 100,
      windowSeconds: 60,
      burstLimit: null,
      priority: 1,
    },
    {
      quotaId: "quota-2",
      tenantId: "tenant-1",
      resourceType: "memory",
      limit: 200,
      windowSeconds: 60,
      burstLimit: null,
      priority: 1,
    },
  ];

  for (const q of quotas) {
    service.registerQuota(q);
  }

  const tenantQuotas = service.getTenantQuotas("tenant-1");
  assert.equal(tenantQuotas.length, 2);
});

test("NoisyNeighborProtectionService: does not return quotas for other tenants [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "cpu",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  const otherQuotas = service.getTenantQuotas("tenant-2");
  assert.equal(otherQuotas.length, 0);
});

test("NoisyNeighborProtectionService: returns false when no quotas exceeded [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 500);

  const exceeding = service.isExceedingQuotas("tenant-1");
  assert.equal(exceeding, false);
});

test("NoisyNeighborProtectionService: returns true when any quota exceeded [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 150);

  const exceeding = service.isExceedingQuotas("tenant-1");
  assert.equal(exceeding, true);
});

test("NoisyNeighborProtectionService: returns false when tenant has no quotas [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const exceeding = service.isExceedingQuotas("tenant-with-no-quotas");
  assert.equal(exceeding, false);
});

test("NoisyNeighborProtectionService: returns empty array when no quotas for utilization [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const utilization = service.getQuotaUtilization("tenant-1");
  assert.equal(utilization.length, 0);
});

test("NoisyNeighborProtectionService: returns utilization for each quota [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "cpu",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "cpu", 80);

  const utilization = service.getQuotaUtilization("tenant-1");
  assert.equal(utilization.length, 1);
  assert.equal(utilization[0]!.percentUsed, 80);
  assert.equal(utilization[0]!.isNearLimit, true);
});

test("NoisyNeighborProtectionService: marks isNearLimit false when below 80% [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "cpu",
    limit: 100,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "cpu", 50);

  const utilization = service.getQuotaUtilization("tenant-1");
  assert.equal(utilization[0]!.isNearLimit, false);
});

test("NoisyNeighborProtectionService: resets usage for specific resource type [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 100);
  service.recordUsage("tenant-1", "cpu", 50);

  service.resetUsage("tenant-1", "api_requests");

  const apiUsage = service.getCurrentUsage("tenant-1", "api_requests");
  const cpuUsage = service.getCurrentUsage("tenant-1", "cpu");

  assert.equal(apiUsage, null);
  assert.ok(cpuUsage !== null);
});

test("NoisyNeighborProtectionService: resets all resources when no resource type specified [noisy-neighbor-protection]", () => {
  const service = new NoisyNeighborProtectionService();
  const quota: TenantQuota = {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "api_requests",
    limit: 1000,
    windowSeconds: 60,
    burstLimit: null,
    priority: 1,
  };
  service.registerQuota(quota);

  service.recordUsage("tenant-1", "api_requests", 100);
  service.recordUsage("tenant-1", "cpu", 50);

  service.resetUsage("tenant-1");

  const apiUsage = service.getCurrentUsage("tenant-1", "api_requests");
  const cpuUsage = service.getCurrentUsage("tenant-1", "cpu");

  assert.equal(apiUsage, null);
  assert.equal(cpuUsage, null);
});

test("getNoisyNeighborProtectionService returns singleton instance [noisy-neighbor-protection]", () => {
  resetNoisyNeighborProtectionService();
  const instance1 = getNoisyNeighborProtectionService();
  const instance2 = getNoisyNeighborProtectionService();
  assert.ok(instance1 === instance2);
});

test("resetNoisyNeighborProtectionService clears singleton [noisy-neighbor-protection]", () => {
  const instance1 = getNoisyNeighborProtectionService();
  resetNoisyNeighborProtectionService();
  const instance2 = getNoisyNeighborProtectionService();
  assert.ok(instance1 !== instance2);
});
