/**
 * AsyncTenantRepository - Async data access for multi-tenancy tables.
 *
 * Implements §26 storage layer - missing tables: tenants, tenant_quotas, tenant_billing
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
export class AsyncTenantRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    // ================================
    // TENANTS
    // ================================
    async insertTenant(tenant) {
        await this.conn.execute(`INSERT INTO tenants (
        tenant_id, display_name, status, billing_plan, sla_level,
        allowed_regions_json, quotas_json, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, tenant.tenantId, tenant.displayName, tenant.status, tenant.billingPlan, tenant.slaLevel, tenant.allowedRegionsJson, tenant.quotasJson, tenant.metadataJson, tenant.createdAt, tenant.updatedAt);
    }
    async updateTenant(input) {
        const sets = ["updated_at = $1"];
        const values = [input.updatedAt];
        let idx = 2;
        if (input.displayName !== undefined) {
            sets.push(`display_name = $${idx++}`);
            values.push(input.displayName);
        }
        if (input.status !== undefined) {
            sets.push(`status = $${idx++}`);
            values.push(input.status);
        }
        if (input.billingPlan !== undefined) {
            sets.push(`billing_plan = $${idx++}`);
            values.push(input.billingPlan);
        }
        if (input.slaLevel !== undefined) {
            sets.push(`sla_level = $${idx++}`);
            values.push(input.slaLevel);
        }
        if (input.allowedRegionsJson !== undefined) {
            sets.push(`allowed_regions_json = $${idx++}`);
            values.push(input.allowedRegionsJson);
        }
        if (input.quotasJson !== undefined) {
            sets.push(`quotas_json = $${idx++}`);
            values.push(input.quotasJson);
        }
        if (input.metadataJson !== undefined) {
            sets.push(`metadata_json = $${idx++}`);
            values.push(input.metadataJson);
        }
        values.push(input.tenantId);
        return asyncExecute(this.conn, `UPDATE tenants SET ${sets.join(", ")} WHERE tenant_id = $${idx}`, ...values);
    }
    async getTenant(tenantId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        tenant_id AS "tenantId",
        display_name AS "displayName",
        status,
        billing_plan AS "billingPlan",
        sla_level AS "slaLevel",
        allowed_regions_json AS "allowedRegionsJson",
        quotas_json AS "quotasJson",
        metadata_json AS "metadataJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenants WHERE tenant_id = $1`, tenantId);
        return result ?? null;
    }
    async listTenantsByStatus(status) {
        return asyncQueryAll(this.conn, `SELECT
        tenant_id AS "tenantId",
        display_name AS "displayName",
        status,
        billing_plan AS "billingPlan",
        sla_level AS "slaLevel",
        allowed_regions_json AS "allowedRegionsJson",
        quotas_json AS "quotasJson",
        metadata_json AS "metadataJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenants WHERE status = $1 ORDER BY created_at DESC`, status);
    }
    async deleteTenant(tenantId) {
        return asyncExecute(this.conn, `DELETE FROM tenants WHERE tenant_id = $1`, tenantId);
    }
    // ================================
    // TENANT QUOTAS
    // ================================
    async upsertTenantQuota(quota) {
        await this.conn.execute(`INSERT INTO tenant_quotas (
        quota_id, tenant_id, resource_type, monthly_limit, current_usage,
        alert_threshold, reset_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(quota_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        resource_type = excluded.resource_type,
        monthly_limit = excluded.monthly_limit,
        current_usage = excluded.current_usage,
        alert_threshold = excluded.alert_threshold,
        reset_at = excluded.reset_at,
        updated_at = excluded.updated_at`, quota.quotaId, quota.tenantId, quota.resourceType, quota.monthlyLimit, quota.currentUsage, quota.alertThreshold, quota.resetAt, quota.createdAt, quota.updatedAt);
    }
    async getTenantQuota(quotaId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        quota_id AS "quotaId",
        tenant_id AS "tenantId",
        resource_type AS "resourceType",
        monthly_limit AS "monthlyLimit",
        current_usage AS "currentUsage",
        alert_threshold AS "alertThreshold",
        reset_at AS "resetAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenant_quotas WHERE quota_id = $1`, quotaId);
        return result ?? null;
    }
    async listTenantQuotas(tenantId) {
        return asyncQueryAll(this.conn, `SELECT
        quota_id AS "quotaId",
        tenant_id AS "tenantId",
        resource_type AS "resourceType",
        monthly_limit AS "monthlyLimit",
        current_usage AS "currentUsage",
        alert_threshold AS "alertThreshold",
        reset_at AS "resetAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenant_quotas WHERE tenant_id = $1 ORDER BY resource_type`, tenantId);
    }
    async updateQuotaUsage(quotaId, currentUsage, updatedAt) {
        return asyncExecute(this.conn, `UPDATE tenant_quotas SET current_usage = $1, updated_at = $2 WHERE quota_id = $3`, currentUsage, updatedAt, quotaId);
    }
    // ================================
    // TENANT BILLING
    // ================================
    async insertTenantBilling(billing) {
        await this.conn.execute(`INSERT INTO tenant_billing (
        billing_id, tenant_id, billing_plan, billing_period_start, billing_period_end,
        total_cost_usd, currency, status, invoice_url, paid_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, billing.billingId, billing.tenantId, billing.billingPlan, billing.billingPeriodStart, billing.billingPeriodEnd, billing.totalCostUsd, billing.currency, billing.status, billing.invoiceUrl, billing.paidAt, billing.createdAt, billing.updatedAt);
    }
    async updateTenantBillingStatus(input) {
        const sets = ["status = $1", "updated_at = $2"];
        const values = [input.status, input.updatedAt];
        let idx = 3;
        if (input.totalCostUsd !== undefined) {
            sets.push(`total_cost_usd = $${idx++}`);
            values.push(input.totalCostUsd);
        }
        if (input.invoiceUrl !== undefined) {
            sets.push(`invoice_url = $${idx++}`);
            values.push(input.invoiceUrl);
        }
        if (input.paidAt !== undefined) {
            sets.push(`paid_at = $${idx++}`);
            values.push(input.paidAt);
        }
        values.push(input.billingId);
        return asyncExecute(this.conn, `UPDATE tenant_billing SET ${sets.join(", ")} WHERE billing_id = $${idx}`, ...values);
    }
    async getTenantBilling(billingId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        billing_id AS "billingId",
        tenant_id AS "tenantId",
        billing_plan AS "billingPlan",
        billing_period_start AS "billingPeriodStart",
        billing_period_end AS "billingPeriodEnd",
        total_cost_usd AS "totalCostUsd",
        currency,
        status,
        invoice_url AS "invoiceUrl",
        paid_at AS "paidAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenant_billing WHERE billing_id = $1`, billingId);
        return result ?? null;
    }
    async listTenantBillingHistory(tenantId, limit = 10) {
        return asyncQueryAll(this.conn, `SELECT
        billing_id AS "billingId",
        tenant_id AS "tenantId",
        billing_plan AS "billingPlan",
        billing_period_start AS "billingPeriodStart",
        billing_period_end AS "billingPeriodEnd",
        total_cost_usd AS "totalCostUsd",
        currency,
        status,
        invoice_url AS "invoiceUrl",
        paid_at AS "paidAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM tenant_billing
       WHERE tenant_id = $1
       ORDER BY billing_period_start DESC
       LIMIT $2`, tenantId, limit);
    }
}
//# sourceMappingURL=tenant-repository.js.map