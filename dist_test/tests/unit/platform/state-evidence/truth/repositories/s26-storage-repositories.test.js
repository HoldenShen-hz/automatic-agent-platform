/**
 * Unit tests for §26 Storage Layer - Tenant, Delegation, and Prompt Bundle Repositories
 *
 * @see docs_zh/architecture/00-platform-architecture.md §26
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §26
 */
import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTenantRepository, InMemoryQuotaRepository, InMemoryBillingRepository, } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/tenant-repository.js";
import { InMemoryDelegationRepository, InMemoryDelegationEventRepository, } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/delegation-repository.js";
import { InMemoryPromptBundleRepository, InMemoryPromptVersionRepository, InMemoryPromptAbTestRepository, } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/prompt-bundle-repository.js";
// ─────────────────────────────────────────────────────────────────────────────
// Tenant Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryTenantRepository.create creates a new tenant", async () => {
    const repo = new InMemoryTenantRepository();
    const input = {
        displayName: "Test Tenant",
        storageScope: "test-storage",
        identityScope: "test-identity",
        policyScope: "test-policy",
        artifactScope: "test-artifact",
    };
    const tenant = await repo.create(input);
    assert.ok(tenant.tenantId);
    assert.equal(tenant.displayName, "Test Tenant");
    assert.ok(tenant.organizationId);
    assert.equal(tenant.storageScope, "test-storage");
    assert.equal(tenant.status, "active");
});
test("InMemoryTenantRepository.findById returns tenant by ID", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Find Test" });
    const found = await repo.findById(created.tenantId);
    assert.ok(found);
    assert.equal(found?.tenantId, created.tenantId);
    assert.equal(found?.displayName, "Find Test");
});
test("InMemoryTenantRepository.findById returns null for unknown ID", async () => {
    const repo = new InMemoryTenantRepository();
    const found = await repo.findById("unknown-id");
    assert.equal(found, null);
});
test("InMemoryTenantRepository.findByStatus filters by status", async () => {
    const repo = new InMemoryTenantRepository();
    await repo.create({ displayName: "Active 1", status: "active" });
    await repo.create({ displayName: "Active 2", status: "active" });
    await repo.create({ displayName: "Suspended 1", status: "suspended" });
    const active = await repo.findByStatus("active");
    assert.equal(active.length, 2);
    assert.ok(active.every((t) => t.status === "active"));
});
test("InMemoryTenantRepository.update modifies tenant fields", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "Original Name" });
    const updated = await repo.update(created.tenantId, {
        displayName: "Updated Name",
        billingPlan: "enterprise",
    });
    assert.equal(updated.displayName, "Updated Name");
    assert.equal(updated.billingPlan, "enterprise");
    assert.ok(updated.updatedAt);
});
test("InMemoryTenantRepository.delete removes tenant", async () => {
    const repo = new InMemoryTenantRepository();
    const created = await repo.create({ displayName: "To Delete" });
    await repo.delete(created.tenantId);
    const found = await repo.findById(created.tenantId);
    assert.equal(found, null);
});
test("InMemoryTenantRepository.listAll returns paginated results", async () => {
    const repo = new InMemoryTenantRepository();
    for (let i = 0; i < 5; i++) {
        await repo.create({ displayName: `Tenant ${i}` });
    }
    const page1 = await repo.listAll(2, 0);
    const page2 = await repo.listAll(2, 2);
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
});
// ─────────────────────────────────────────────────────────────────────────────
// Quota Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryQuotaRepository.create creates quota with defaults", async () => {
    const repo = new InMemoryQuotaRepository();
    const input = {
        tenantId: "tenant-1",
        resourceType: "tokens",
        monthlyLimit: 1000000,
        resetAt: "2024-02-01T00:00:00Z",
    };
    const quota = await repo.create(input);
    assert.ok(quota.quotaId);
    assert.equal(quota.tenantId, "tenant-1");
    assert.equal(quota.resourceType, "tokens");
    assert.equal(quota.monthlyLimit, 1000000);
    assert.equal(quota.currentUsage, 0);
    assert.equal(quota.alertThreshold, 0.8);
});
test("InMemoryQuotaRepository.findByTenantId returns all quotas for tenant", async () => {
    const repo = new InMemoryQuotaRepository();
    await repo.create({
        tenantId: "tenant-1",
        resourceType: "tokens",
        monthlyLimit: 1000000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    await repo.create({
        tenantId: "tenant-1",
        resourceType: "storage_bytes",
        monthlyLimit: 50000000000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    await repo.create({
        tenantId: "tenant-2",
        resourceType: "tokens",
        monthlyLimit: 500000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    const quotas = await repo.findByTenantId("tenant-1");
    assert.equal(quotas.length, 2);
    assert.ok(quotas.every((q) => q.tenantId === "tenant-1"));
});
test("InMemoryQuotaRepository.updateUsage modifies current usage", async () => {
    const repo = new InMemoryQuotaRepository();
    const created = await repo.create({
        tenantId: "tenant-1",
        resourceType: "tokens",
        monthlyLimit: 1000000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    await repo.updateUsage("tenant-1", "tokens", 500000);
    const quotas = await repo.findByTenantId("tenant-1");
    const tokenQuota = quotas.find((q) => q.resourceType === "tokens");
    assert.equal(tokenQuota?.currentUsage, 500000);
});
test("InMemoryQuotaRepository.deleteByTenantId removes all tenant quotas", async () => {
    const repo = new InMemoryQuotaRepository();
    await repo.create({
        tenantId: "tenant-1",
        resourceType: "tokens",
        monthlyLimit: 1000000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    await repo.create({
        tenantId: "tenant-1",
        resourceType: "storage",
        monthlyLimit: 50000000000,
        resetAt: "2024-02-01T00:00:00Z",
    });
    await repo.deleteByTenantId("tenant-1");
    const quotas = await repo.findByTenantId("tenant-1");
    assert.equal(quotas.length, 0);
});
// ─────────────────────────────────────────────────────────────────────────────
// Billing Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryBillingRepository.create creates billing record", async () => {
    const repo = new InMemoryBillingRepository();
    const input = {
        tenantId: "tenant-1",
        billingPlan: "enterprise",
        billingPeriodStart: "2024-01-01T00:00:00Z",
        billingPeriodEnd: "2024-01-31T23:59:59Z",
        totalCostUsd: 1500.00,
    };
    const billing = await repo.create(input);
    assert.ok(billing.billingId);
    assert.equal(billing.tenantId, "tenant-1");
    assert.equal(billing.billingPlan, "enterprise");
    assert.equal(billing.totalCostUsd, 1500.00);
    assert.equal(billing.currency, "USD");
    assert.equal(billing.status, "pending");
    assert.equal(billing.invoiceUrl, null);
});
test("InMemoryBillingRepository.findByTenantId returns billing history", async () => {
    const repo = new InMemoryBillingRepository();
    await repo.create({
        tenantId: "tenant-1",
        billingPlan: "basic",
        billingPeriodStart: "2024-01-01T00:00:00Z",
        billingPeriodEnd: "2024-01-31T23:59:59Z",
        totalCostUsd: 100.00,
    });
    await repo.create({
        tenantId: "tenant-1",
        billingPlan: "basic",
        billingPeriodStart: "2024-02-01T00:00:00Z",
        billingPeriodEnd: "2024-02-29T23:59:59Z",
        totalCostUsd: 120.00,
    });
    const history = await repo.findByTenantId("tenant-1");
    assert.equal(history.length, 2);
});
test("InMemoryBillingRepository.findById returns specific billing", async () => {
    const repo = new InMemoryBillingRepository();
    const created = await repo.create({
        tenantId: "tenant-1",
        billingPlan: "pro",
        billingPeriodStart: "2024-01-01T00:00:00Z",
        billingPeriodEnd: "2024-01-31T23:59:59Z",
        totalCostUsd: 500.00,
    });
    const found = await repo.findById(created.billingId);
    assert.ok(found);
    assert.equal(found?.billingId, created.billingId);
});
test("InMemoryBillingRepository.updateStatus changes status", async () => {
    const repo = new InMemoryBillingRepository();
    const created = await repo.create({
        tenantId: "tenant-1",
        billingPlan: "pro",
        billingPeriodStart: "2024-01-01T00:00:00Z",
        billingPeriodEnd: "2024-01-31T23:59:59Z",
        totalCostUsd: 500.00,
    });
    await repo.updateStatus(created.billingId, "paid");
    const found = await repo.findById(created.billingId);
    assert.equal(found?.status, "paid");
    assert.ok(found?.paidAt);
});
// ─────────────────────────────────────────────────────────────────────────────
// Delegation Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryDelegationRepository.create creates delegation record", async () => {
    const repo = new InMemoryDelegationRepository();
    const input = {
        parentAgentId: "agent-parent",
        childAgentId: "agent-child",
        delegationChain: ["agent-1", "agent-2", "agent-3"],
        depth: 2,
        expiresAt: "2024-12-31T23:59:59Z",
    };
    const delegation = await repo.create(input);
    assert.ok(delegation.delegationId);
    assert.equal(delegation.parentAgentId, "agent-parent");
    assert.equal(delegation.childAgentId, "agent-child");
    assert.equal(delegation.depth, 2);
    assert.equal(delegation.status, "pending");
    assert.equal(delegation.expiresAt, "2024-12-31T23:59:59Z");
});
test("InMemoryDelegationRepository.findById returns delegation", async () => {
    const repo = new InMemoryDelegationRepository();
    const created = await repo.create({
        parentAgentId: "parent",
        childAgentId: "child",
        delegationChain: ["parent"],
        depth: 1,
    });
    const found = await repo.findById(created.delegationId);
    assert.ok(found);
    assert.equal(found?.delegationId, created.delegationId);
});
test("InMemoryDelegationRepository.findByParentAgentId filters correctly", async () => {
    const repo = new InMemoryDelegationRepository();
    await repo.create({ parentAgentId: "agent-a", childAgentId: "child-1", delegationChain: [], depth: 1 });
    await repo.create({ parentAgentId: "agent-a", childAgentId: "child-2", delegationChain: [], depth: 1 });
    await repo.create({ parentAgentId: "agent-b", childAgentId: "child-3", delegationChain: [], depth: 1 });
    const found = await repo.findByParentAgentId("agent-a");
    assert.equal(found.length, 2);
    assert.ok(found.every((d) => d.parentAgentId === "agent-a"));
});
test("InMemoryDelegationRepository.findByStatus filters by status", async () => {
    const repo = new InMemoryDelegationRepository();
    const d1 = await repo.create({ parentAgentId: "p", childAgentId: "c1", delegationChain: [], depth: 1 });
    const d2 = await repo.create({ parentAgentId: "p", childAgentId: "c2", delegationChain: [], depth: 1 });
    await repo.updateStatus(d1.delegationId, "active");
    await repo.updateStatus(d2.delegationId, "completed");
    const active = await repo.findByStatus("active");
    assert.equal(active.length, 1);
});
test("InMemoryDelegationRepository.findExpired returns expired delegations", async () => {
    const repo = new InMemoryDelegationRepository();
    const past = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const future = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    await repo.create({ parentAgentId: "p", childAgentId: "c1", delegationChain: [], depth: 1, expiresAt: past });
    await repo.create({ parentAgentId: "p", childAgentId: "c2", delegationChain: [], depth: 1, expiresAt: future });
    const expired = await repo.findExpired(new Date().toISOString());
    assert.equal(expired.length, 1);
});
test("InMemoryDelegationRepository.complete marks delegation completed", async () => {
    const repo = new InMemoryDelegationRepository();
    const created = await repo.create({ parentAgentId: "p", childAgentId: "c", delegationChain: [], depth: 1 });
    await repo.complete(created.delegationId, "result-ref-123");
    const found = await repo.findById(created.delegationId);
    assert.equal(found?.status, "completed");
    assert.equal(found?.resultRef, "result-ref-123");
});
test("InMemoryDelegationRepository.fail marks delegation failed", async () => {
    const repo = new InMemoryDelegationRepository();
    const created = await repo.create({ parentAgentId: "p", childAgentId: "c", delegationChain: [], depth: 1 });
    await repo.fail(created.delegationId, "error message");
    const found = await repo.findById(created.delegationId);
    assert.equal(found?.status, "failed");
});
// ─────────────────────────────────────────────────────────────────────────────
// Delegation Event Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryDelegationEventRepository.create adds event", async () => {
    const delegationRepo = new InMemoryDelegationRepository();
    const eventRepo = new InMemoryDelegationEventRepository();
    const delegation = await delegationRepo.create({ parentAgentId: "p", childAgentId: "c", delegationChain: [], depth: 1 });
    const input = {
        delegationId: delegation.delegationId,
        eventType: "delegation.started",
        payload: { timestamp: Date.now() },
    };
    const event = await eventRepo.create(input);
    assert.ok(event.eventId);
    assert.equal(event.eventType, "delegation.started");
});
test("InMemoryDelegationEventRepository.findByDelegationId returns events", async () => {
    const delegationRepo = new InMemoryDelegationRepository();
    const eventRepo = new InMemoryDelegationEventRepository();
    const delegation = await delegationRepo.create({ parentAgentId: "p", childAgentId: "c", delegationChain: [], depth: 1 });
    await eventRepo.create({
        delegationId: delegation.delegationId,
        eventType: "event-1",
        payload: {},
    });
    await eventRepo.create({
        delegationId: delegation.delegationId,
        eventType: "event-2",
        payload: {},
    });
    const events = await eventRepo.findByDelegationId(delegation.delegationId);
    assert.equal(events.length, 2);
});
test("InMemoryDelegationEventRepository.deleteByDelegationId removes all events", async () => {
    const delegationRepo = new InMemoryDelegationRepository();
    const eventRepo = new InMemoryDelegationEventRepository();
    const delegation = await delegationRepo.create({ parentAgentId: "p", childAgentId: "c", delegationChain: [], depth: 1 });
    await eventRepo.create({ delegationId: delegation.delegationId, eventType: "e", payload: {} });
    await eventRepo.create({ delegationId: delegation.delegationId, eventType: "e", payload: {} });
    await eventRepo.deleteByDelegationId(delegation.delegationId);
    const events = await eventRepo.findByDelegationId(delegation.delegationId);
    assert.equal(events.length, 0);
});
// ─────────────────────────────────────────────────────────────────────────────
// Prompt Bundle Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryPromptBundleRepository.create creates bundle", async () => {
    const repo = new InMemoryPromptBundleRepository();
    const input = {
        name: "Customer Support Prompt",
        version: "1.0.0",
        domain: "support",
        taskType: "chat",
        systemPromptContent: "You are a helpful assistant.",
        constraints: { maxTokens: 1000 },
    };
    const bundle = await repo.create(input);
    assert.ok(bundle.bundleId);
    assert.equal(bundle.name, "Customer Support Prompt");
    assert.equal(bundle.version, "1.0.0");
    assert.equal(bundle.domain, "support");
    assert.equal(bundle.deprecated, false);
});
test("InMemoryPromptBundleRepository.findById returns bundle", async () => {
    const repo = new InMemoryPromptBundleRepository();
    const created = await repo.create({
        name: "Test Bundle",
        version: "1.0.0",
        domain: "test",
        taskType: "analysis",
        systemPromptContent: "Test content",
        constraints: {},
    });
    const found = await repo.findById(created.bundleId);
    assert.ok(found);
    assert.equal(found?.bundleId, created.bundleId);
});
test("InMemoryPromptBundleRepository.findByNameVersion searches correctly", async () => {
    const repo = new InMemoryPromptBundleRepository();
    await repo.create({
        name: "Bundle A",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content A",
        constraints: {},
    });
    await repo.create({
        name: "Bundle A",
        version: "2.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content A v2",
        constraints: {},
    });
    const found = await repo.findByNameVersion("Bundle A", "1.0.0");
    assert.ok(found);
    assert.equal(found?.version, "1.0.0");
});
test("InMemoryPromptBundleRepository.findByDomainTask filters correctly", async () => {
    const repo = new InMemoryPromptBundleRepository();
    await repo.create({
        name: "Support v1",
        version: "1.0.0",
        domain: "support",
        taskType: "chat",
        systemPromptContent: "Support chat",
        constraints: {},
    });
    await repo.create({
        name: "Sales v1",
        version: "1.0.0",
        domain: "sales",
        taskType: "chat",
        systemPromptContent: "Sales chat",
        constraints: {},
    });
    const found = await repo.findByDomainTask("support", "chat");
    assert.equal(found.length, 1);
    assert.equal(found[0]?.name, "Support v1");
});
test("InMemoryPromptBundleRepository.update modifies bundle", async () => {
    const repo = new InMemoryPromptBundleRepository();
    const created = await repo.create({
        name: "Original",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Original content",
        constraints: {},
    });
    const updated = await repo.update(created.bundleId, {
        systemPromptContent: "Updated content",
        constraints: { maxTokens: 2000 },
    });
    assert.equal(updated.systemPromptContent, "Updated content");
});
test("InMemoryPromptBundleRepository.deprecate marks as deprecated", async () => {
    const repo = new InMemoryPromptBundleRepository();
    const created = await repo.create({
        name: "To Deprecate",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    await repo.deprecate(created.bundleId);
    const found = await repo.findById(created.bundleId);
    assert.equal(found?.deprecated, true);
});
// ─────────────────────────────────────────────────────────────────────────────
// Prompt Version Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryPromptVersionRepository.create creates version", async () => {
    const repo = new InMemoryPromptVersionRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const input = {
        bundleId: bundle.bundleId,
        version: "1.0.0",
        isCurrent: true,
        trafficWeight: 100,
    };
    const version = await repo.create(input);
    assert.ok(version.versionId);
    assert.equal(version.bundleId, bundle.bundleId);
    assert.equal(version.version, "1.0.0");
    assert.equal(version.isCurrent, true);
});
test("InMemoryPromptVersionRepository.findByBundleId returns all versions", async () => {
    const repo = new InMemoryPromptVersionRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    await repo.create({ bundleId: bundle.bundleId, version: "1.0.0" });
    await repo.create({ bundleId: bundle.bundleId, version: "2.0.0" });
    const versions = await repo.findByBundleId(bundle.bundleId);
    assert.equal(versions.length, 2);
});
test("InMemoryPromptVersionRepository.setCurrent marks version as current", async () => {
    const repo = new InMemoryPromptVersionRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    await repo.create({ bundleId: bundle.bundleId, version: "1.0.0", isCurrent: true });
    await repo.create({ bundleId: bundle.bundleId, version: "2.0.0", isCurrent: false });
    await repo.setCurrent(bundle.bundleId, "2.0.0");
    const versions = await repo.findByBundleId(bundle.bundleId);
    const v1 = versions.find((v) => v.version === "1.0.0");
    const v2 = versions.find((v) => v.version === "2.0.0");
    assert.equal(v1?.isCurrent, false);
    assert.equal(v2?.isCurrent, true);
});
test("InMemoryPromptVersionRepository.deprecate marks version deprecated", async () => {
    const repo = new InMemoryPromptVersionRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const version = await repo.create({ bundleId: bundle.bundleId, version: "1.0.0" });
    await repo.deprecate(bundle.bundleId, "1.0.0");
    const found = await repo.findByBundleId(bundle.bundleId);
    assert.ok(found[0]?.deprecatedAt);
});
// ─────────────────────────────────────────────────────────────────────────────
// Prompt A/B Test Repository Tests
// ─────────────────────────────────────────────────────────────────────────────
test("InMemoryPromptAbTestRepository.create creates test", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const input = {
        bundleId: bundle.bundleId,
        testName: "Control vs Treatment",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        trafficSplitPercent: 50,
        metrics: { conversionRate: 0.05 },
    };
    const test = await repo.create(input);
    assert.ok(test.testId);
    assert.equal(test.testName, "Control vs Treatment");
    assert.equal(test.status, "draft");
    assert.equal(test.trafficSplitPercent, 50);
});
test("InMemoryPromptAbTestRepository.findById returns test", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const created = await repo.create({
        bundleId: bundle.bundleId,
        testName: "Test",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    const found = await repo.findById(created.testId);
    assert.ok(found);
    assert.equal(found?.testId, created.testId);
});
test("InMemoryPromptAbTestRepository.findByBundleId returns tests for bundle", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    await repo.create({
        bundleId: bundle.bundleId,
        testName: "Test 1",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    await repo.create({
        bundleId: bundle.bundleId,
        testName: "Test 2",
        controlVersion: "1.0.0",
        treatmentVersion: "3.0.0",
        metrics: {},
    });
    const tests = await repo.findByBundleId(bundle.bundleId);
    assert.equal(tests.length, 2);
});
test("InMemoryPromptAbTestRepository.findByStatus filters correctly", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const t1 = await repo.create({
        bundleId: bundle.bundleId,
        testName: "Draft Test",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    await repo.create({
        bundleId: bundle.bundleId,
        testName: "Running Test",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    await repo.updateStatus(t1.testId, "running");
    const drafts = await repo.findByStatus("draft");
    const running = await repo.findByStatus("running");
    assert.equal(drafts.length, 1);
    assert.equal(running.length, 1);
});
test("InMemoryPromptAbTestRepository.updateResults stores results", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const created = await repo.create({
        bundleId: bundle.bundleId,
        testName: "Test",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    const results = { conversionRate: 0.08, pValue: 0.02 };
    await repo.updateResults(created.testId, results);
    const found = await repo.findById(created.testId);
    assert.ok(found?.resultsJson);
});
test("InMemoryPromptAbTestRepository.updateStatus changes status", async () => {
    const repo = new InMemoryPromptAbTestRepository();
    const bundleRepo = new InMemoryPromptBundleRepository();
    const bundle = await bundleRepo.create({
        name: "Test",
        version: "1.0.0",
        domain: "d",
        taskType: "t",
        systemPromptContent: "Content",
        constraints: {},
    });
    const created = await repo.create({
        bundleId: bundle.bundleId,
        testName: "Test",
        controlVersion: "1.0.0",
        treatmentVersion: "2.0.0",
        metrics: {},
    });
    await repo.updateStatus(created.testId, "completed");
    const found = await repo.findById(created.testId);
    assert.equal(found?.status, "completed");
});
//# sourceMappingURL=s26-storage-repositories.test.js.map