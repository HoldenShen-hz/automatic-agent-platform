/**
 * Unit tests for tenant repository
 *
 * Part of §26 storage layer implementation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTenantRepository, InMemoryQuotaRepository, InMemoryBillingRepository, } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/tenant-repository.js";
test("InMemoryTenantRepository creates tenant", async () => {
    const repo = new InMemoryTenantRepository();
    const input = {
        organizationId: "org-enterprise",
        displayName: "Test Tenant",
        isolationMode: "shared_hard_scoped",
        deploymentMode: "private_cloud",
        billingPlan: "pro",
        slaLevel: "silver",
        allowedRegions: ["cn-shanghai", "us-west-1"],
        quotas: [
            { resourceType: "tokens", monthlyLimit: 1000000 },
            { resourceType: "monthly_cost_usd", monthlyLimit: 2000 },
        ],
    };
    const tenant = await repo.create(input);
    assert.ok(tenant.tenantId);
    assert.match(tenant.tenantId, /^tenant_/);
    assert.equal(tenant.organizationId, "org-enterprise");
    assert.equal(tenant.displayName, "Test Tenant");
    assert.equal(tenant.storageScope, `${tenant.tenantId}:storage`);
    assert.equal(tenant.identityScope, `${tenant.tenantId}:identity`);
    assert.equal(tenant.policyScope, `${tenant.tenantId}:policy`);
    assert.equal(tenant.artifactScope, `${tenant.tenantId}:artifact`);
    assert.equal(tenant.isolationMode, "shared_hard_scoped");
    assert.equal(tenant.deploymentMode, "private_cloud");
    assert.equal(tenant.billingPlan, "pro");
    assert.equal(tenant.slaLevel, "silver");
    assert.equal(tenant.status, "active");
    assert.deepEqual(tenant.allowedRegions, ["cn-shanghai", "us-west-1"]);
    assert.equal(tenant.quotas?.monthlyTokenLimit, 1000000);
    assert.equal(tenant.quotas?.monthlyCostLimitUsd, 2000);
});
test("InMemoryTenantRepository finds by id", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Find Test" });
    const found = await repo.findById(created.tenantId);
    assert.ok(found);
    assert.equal(found?.displayName, "Find Test");
});
test("InMemoryTenantRepository returns null for missing id", async () => {
    const repo = new InMemoryTenantRepository();
    const found = await repo.findById("nonexistent");
    assert.equal(found, null);
});
test("InMemoryTenantRepository updates tenant", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Original" });
    const updated = await repo.update(created.tenantId, {
        displayName: "Updated",
        deploymentMode: "on_prem",
        quotas: [{ resourceType: "concurrent_executions", monthlyLimit: 12 }],
    });
    assert.equal(updated.displayName, "Updated");
    assert.equal(updated.status, "active");
    assert.equal(updated.deploymentMode, "on_prem");
    assert.equal(updated.quotas?.maxConcurrentExecutions, 12);
});
test("InMemoryTenantRepository updates status", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Status Test" });
    const updated = await repo.update(created.tenantId, { status: "suspended" });
    assert.equal(updated.status, "suspended");
});
test("InMemoryTenantRepository deletes tenant", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Delete Test" });
    await repo.delete(created.tenantId);
    const found = await repo.findById(created.tenantId);
    assert.equal(found, null);
});
test("InMemoryTenantRepository lists all with pagination", async () => {
    const repo = new InMemoryTenantRepository();
    for (let i = 0; i < 5; i++) {
        await repo.create({ displayName: `Tenant ${i}` });
    }
    const page1 = await repo.listAll(2, 0);
    const page2 = await repo.listAll(2, 2);
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
});
test("InMemoryTenantRepository finds by status", async () => {
    const repo = new InMemoryTenantRepository();
    await repo.create({ displayName: "Active 1", status: "active" });
    await repo.create({ displayName: "Active 2", status: "active" });
    await repo.create({ displayName: "Suspended", status: "suspended" });
    const active = await repo.findByStatus("active");
    assert.equal(active.length, 2);
});
test("InMemoryQuotaRepository creates and finds quotas", async () => {
    const repo = new InMemoryQuotaRepository();
    const tenantId = "tenant-1";
    const quota = await repo.create({
        tenantId,
        resourceType: "tokens",
        monthlyLimit: 1000000,
        alertThreshold: 0.8,
        resetAt: "2026-05-01T00:00:00Z",
    });
    assert.match(quota.quotaId, /^tenant_quota_/);
    const quotas = await repo.findByTenantId(tenantId);
    assert.equal(quotas.length, 1);
    assert.equal(quotas[0].resourceType, "tokens");
    assert.equal(quotas[0].monthlyLimit, 1000000);
});
test("InMemoryQuotaRepository updates usage", async () => {
    const repo = new InMemoryQuotaRepository();
    const tenantId = "tenant-2";
    await repo.create({
        tenantId,
        resourceType: "compute",
        monthlyLimit: 500,
        resetAt: "2026-05-01T00:00:00Z",
    });
    await repo.updateUsage(tenantId, "compute", 250);
    const quotas = await repo.findByTenantId(tenantId);
    assert.equal(quotas[0].currentUsage, 250);
});
test("InMemoryQuotaRepository deletes by tenant id", async () => {
    const repo = new InMemoryQuotaRepository();
    const tenantId = "tenant-3";
    await repo.create({
        tenantId,
        resourceType: "storage",
        monthlyLimit: 100,
        resetAt: "2026-05-01T00:00:00Z",
    });
    await repo.deleteByTenantId(tenantId);
    const quotas = await repo.findByTenantId(tenantId);
    assert.equal(quotas.length, 0);
});
test("InMemoryBillingRepository creates billing record", async () => {
    const repo = new InMemoryBillingRepository();
    const billing = await repo.create({
        tenantId: "tenant-1",
        billingPlan: "pro",
        billingPeriodStart: "2026-04-01T00:00:00Z",
        billingPeriodEnd: "2026-04-30T23:59:59Z",
        totalCostUsd: 999.99,
    });
    assert.ok(billing.billingId);
    assert.match(billing.billingId, /^tenant_billing_/);
    assert.equal(billing.tenantId, "tenant-1");
    assert.equal(billing.totalCostUsd, 999.99);
    assert.equal(billing.status, "pending");
});
test("InMemoryBillingRepository finds by tenant id", async () => {
    const repo = new InMemoryBillingRepository();
    await repo.create({
        tenantId: "tenant-x",
        billingPlan: "pro",
        billingPeriodStart: "2026-04-01T00:00:00Z",
        billingPeriodEnd: "2026-04-30T23:59:59Z",
        totalCostUsd: 100,
    });
    const billings = await repo.findByTenantId("tenant-x");
    assert.equal(billings.length, 1);
});
test("InMemoryBillingRepository updates status to paid", async () => {
    const repo = new InMemoryBillingRepository();
    const billing = await repo.create({
        tenantId: "tenant-y",
        billingPlan: "pro",
        billingPeriodStart: "2026-04-01T00:00:00Z",
        billingPeriodEnd: "2026-04-30T23:59:59Z",
        totalCostUsd: 200,
    });
    await repo.updateStatus(billing.billingId, "paid");
    const updated = await repo.findById(billing.billingId);
    assert.equal(updated?.status, "paid");
    assert.ok(updated?.paidAt);
});
//# sourceMappingURL=tenant-repository.test.js.map