import assert from "node:assert/strict";
import test from "node:test";

import {
  AsyncTenantRepository,
  type TenantBillingRecord,
  type TenantQuotaRecord,
  type TenantRecord,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/tenant-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-23T10:00:00.000Z";

function tenantRecord(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    tenantId: "tenant-1",
    displayName: "Test Tenant",
    status: "active",
    billingPlan: "pro",
    slaLevel: "standard",
    allowedRegionsJson: null,
    quotasJson: null,
    metadataJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function tenantQuotaRecord(overrides: Partial<TenantQuotaRecord> = {}): TenantQuotaRecord {
  return {
    quotaId: "quota-1",
    tenantId: "tenant-1",
    resourceType: "compute",
    monthlyLimit: 1000,
    currentUsage: 250,
    alertThreshold: 0.8,
    resetAt: "2026-05-01T00:00:00.000Z",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function tenantBillingRecord(overrides: Partial<TenantBillingRecord> = {}): TenantBillingRecord {
  return {
    billingId: "billing-1",
    tenantId: "tenant-1",
    billingPlan: "pro",
    billingPeriodStart: "2026-04-01T00:00:00.000Z",
    billingPeriodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 150.0,
    currency: "USD",
    status: "pending",
    invoiceUrl: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === Tenant Tests ===

test("AsyncTenantRepository insertTenant inserts tenant record", async () => {
  const tenant = tenantRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  await repo.insertTenant(tenant);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO tenants/);
  assert.match(calls[0]!.sql, /tenant_id, display_name/);
});

test("AsyncTenantRepository getTenant returns tenant when found", async () => {
  const tenant = tenantRecord();
  const { connection, calls } = createConnection({ queryOneRows: [tenant] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenant("tenant-1");

  assert.deepEqual(result, tenant);
  assert.match(calls[0]!.sql, /FROM tenants WHERE tenant_id = \$1/);
});

test("AsyncTenantRepository getTenant returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenant("tenant-missing");

  assert.equal(result, null);
});

test("AsyncTenantRepository updateTenant updates tenant fields", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.updateTenant({
    tenantId: "tenant-1",
    displayName: "Updated Tenant",
    status: "suspended",
    updatedAt: now,
  });

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE tenants SET/);
  assert.match(calls[0]!.sql, /display_name = \$2/);
  assert.match(calls[0]!.sql, /status = \$3/);
});

test("AsyncTenantRepository listTenantsByStatus returns tenants with status", async () => {
  const tenant = tenantRecord();
  const { connection, calls } = createConnection({ queryRows: [[tenant]] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.listTenantsByStatus("active");

  assert.deepEqual(result, [tenant]);
  assert.match(calls[0]!.sql, /FROM tenants WHERE status = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
});

test("AsyncTenantRepository deleteTenant deletes tenant", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.deleteTenant("tenant-1");

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /DELETE FROM tenants WHERE tenant_id = \$1/);
});

// === Tenant Quota Tests ===

test("AsyncTenantRepository upsertTenantQuota inserts quota", async () => {
  const quota = tenantQuotaRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  await repo.upsertTenantQuota(quota);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO tenant_quotas/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(quota_id\) DO UPDATE SET/);
});

test("AsyncTenantRepository getTenantQuota returns quota when found", async () => {
  const quota = tenantQuotaRecord();
  const { connection, calls } = createConnection({ queryOneRows: [quota] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenantQuota("quota-1");

  assert.deepEqual(result, quota);
  assert.match(calls[0]!.sql, /FROM tenant_quotas WHERE quota_id = \$1/);
});

test("AsyncTenantRepository getTenantQuota returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenantQuota("quota-missing");

  assert.equal(result, null);
});

test("AsyncTenantRepository listTenantQuotas returns quotas for tenant", async () => {
  const quota = tenantQuotaRecord();
  const { connection, calls } = createConnection({ queryRows: [[quota]] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.listTenantQuotas("tenant-1");

  assert.deepEqual(result, [quota]);
  assert.match(calls[0]!.sql, /FROM tenant_quotas WHERE tenant_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY resource_type/);
});

test("AsyncTenantRepository updateQuotaUsage updates usage", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.updateQuotaUsage("quota-1", 500, now);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE tenant_quotas SET current_usage = \$1/);
  assert.deepEqual(calls[0]!.params, [500, now, "quota-1"]);
});

// === Tenant Billing Tests ===

test("AsyncTenantRepository insertTenantBilling inserts billing record", async () => {
  const billing = tenantBillingRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  await repo.insertTenantBilling(billing);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO tenant_billing/);
});

test("AsyncTenantRepository updateTenantBillingStatus updates status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.updateTenantBillingStatus({
    billingId: "billing-1",
    status: "paid",
    totalCostUsd: 200.0,
    updatedAt: now,
  });

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE tenant_billing SET/);
  assert.match(calls[0]!.sql, /status = \$1/);
  assert.match(calls[0]!.sql, /total_cost_usd = \$3/);
});

test("AsyncTenantRepository getTenantBilling returns billing when found", async () => {
  const billing = tenantBillingRecord();
  const { connection, calls } = createConnection({ queryOneRows: [billing] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenantBilling("billing-1");

  assert.deepEqual(result, billing);
  assert.match(calls[0]!.sql, /FROM tenant_billing WHERE billing_id = \$1/);
});

test("AsyncTenantRepository getTenantBilling returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.getTenantBilling("billing-missing");

  assert.equal(result, null);
});

test("AsyncTenantRepository listTenantBillingHistory returns billing history", async () => {
  const billing = tenantBillingRecord();
  const { connection, calls } = createConnection({ queryRows: [[billing]] });
  const repo = new AsyncTenantRepository(connection);

  const result = await repo.listTenantBillingHistory("tenant-1", 10);

  assert.deepEqual(result, [billing]);
  assert.match(calls[0]!.sql, /FROM tenant_billing/);
  assert.match(calls[0]!.sql, /WHERE tenant_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY billing_period_start DESC/);
  assert.match(calls[0]!.sql, /LIMIT \$2/);
});