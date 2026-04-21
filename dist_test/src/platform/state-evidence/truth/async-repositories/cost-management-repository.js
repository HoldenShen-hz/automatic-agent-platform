/**
 * AsyncCostManagementRepository - Async data access for cost management tables.
 *
 * Implements §26 storage layer - missing tables: cost_reports, budget_alerts, token_usage_daily
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
export class AsyncCostManagementRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    // ================================
    // COST REPORTS
    // ================================
    async insertCostReport(report) {
        await this.conn.execute(`INSERT INTO cost_reports (
        report_id, tenant_id, period_start, period_end, total_cost_usd,
        currency, resource_costs_json, submitted_by, submitted_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, report.reportId, report.tenantId, report.periodStart, report.periodEnd, report.totalCostUsd, report.currency, report.resourceCostsJson, report.submittedBy, report.submittedAt, report.createdAt);
    }
    async getCostReport(reportId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        report_id AS "reportId",
        tenant_id AS "tenantId",
        period_start AS "periodStart",
        period_end AS "periodEnd",
        total_cost_usd AS "totalCostUsd",
        currency,
        resource_costs_json AS "resourceCostsJson",
        submitted_by AS "submittedBy",
        submitted_at AS "submittedAt",
        created_at AS "createdAt"
       FROM cost_reports WHERE report_id = $1`, reportId);
        return result ?? null;
    }
    async listCostReportsByTenant(tenantId, limit = 10) {
        if (tenantId) {
            return asyncQueryAll(this.conn, `SELECT
          report_id AS "reportId",
          tenant_id AS "tenantId",
          period_start AS "periodStart",
          period_end AS "periodEnd",
          total_cost_usd AS "totalCostUsd",
          currency,
          resource_costs_json AS "resourceCostsJson",
          submitted_by AS "submittedBy",
          submitted_at AS "submittedAt",
          created_at AS "createdAt"
         FROM cost_reports
         WHERE tenant_id = $1
         ORDER BY period_start DESC
         LIMIT $2`, tenantId, limit);
        }
        return asyncQueryAll(this.conn, `SELECT
        report_id AS "reportId",
        tenant_id AS "tenantId",
        period_start AS "periodStart",
        period_end AS "periodEnd",
        total_cost_usd AS "totalCostUsd",
        currency,
        resource_costs_json AS "resourceCostsJson",
        submitted_by AS "submittedBy",
        submitted_at AS "submittedAt",
        created_at AS "createdAt"
       FROM cost_reports
       ORDER BY period_start DESC
       LIMIT $1`, limit);
    }
    // ================================
    // BUDGET ALERTS
    // ================================
    async insertBudgetAlert(alert) {
        await this.conn.execute(`INSERT INTO budget_alerts (
        alert_id, tenant_id, budget_type, threshold_usd, current_spend_usd,
        alert_level, triggered_at, acknowledged_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, alert.alertId, alert.tenantId, alert.budgetType, alert.thresholdUsd, alert.currentSpendUsd, alert.alertLevel, alert.triggeredAt, alert.acknowledgedAt, alert.createdAt, alert.updatedAt);
    }
    async updateBudgetAlert(input) {
        const sets = ["updated_at = $1"];
        const values = [input.updatedAt];
        let idx = 2;
        if (input.currentSpendUsd !== undefined) {
            sets.push(`current_spend_usd = $${idx++}`);
            values.push(input.currentSpendUsd);
        }
        if (input.alertLevel !== undefined) {
            sets.push(`alert_level = $${idx++}`);
            values.push(input.alertLevel);
        }
        if (input.triggeredAt !== undefined) {
            sets.push(`triggered_at = $${idx++}`);
            values.push(input.triggeredAt);
        }
        if (input.acknowledgedAt !== undefined) {
            sets.push(`acknowledged_at = $${idx++}`);
            values.push(input.acknowledgedAt);
        }
        values.push(input.alertId);
        return asyncExecute(this.conn, `UPDATE budget_alerts SET ${sets.join(", ")} WHERE alert_id = $${idx}`, ...values);
    }
    async getBudgetAlert(alertId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        alert_id AS "alertId",
        tenant_id AS "tenantId",
        budget_type AS "budgetType",
        threshold_usd AS "thresholdUsd",
        current_spend_usd AS "currentSpendUsd",
        alert_level AS "alertLevel",
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM budget_alerts WHERE alert_id = $1`, alertId);
        return result ?? null;
    }
    async listBudgetAlertsByTenant(tenantId) {
        if (tenantId) {
            return asyncQueryAll(this.conn, `SELECT
          alert_id AS "alertId",
          tenant_id AS "tenantId",
          budget_type AS "budgetType",
          threshold_usd AS "thresholdUsd",
          current_spend_usd AS "currentSpendUsd",
          alert_level AS "alertLevel",
          triggered_at AS "triggeredAt",
          acknowledged_at AS "acknowledgedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
         FROM budget_alerts WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId);
        }
        return asyncQueryAll(this.conn, `SELECT
        alert_id AS "alertId",
        tenant_id AS "tenantId",
        budget_type AS "budgetType",
        threshold_usd AS "thresholdUsd",
        current_spend_usd AS "currentSpendUsd",
        alert_level AS "alertLevel",
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM budget_alerts ORDER BY created_at DESC`);
    }
    async listActiveAlerts() {
        return asyncQueryAll(this.conn, `SELECT
        alert_id AS "alertId",
        tenant_id AS "tenantId",
        budget_type AS "budgetType",
        threshold_usd AS "thresholdUsd",
        current_spend_usd AS "currentSpendUsd",
        alert_level AS "alertLevel",
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM budget_alerts
       WHERE triggered_at IS NOT NULL AND acknowledged_at IS NULL
       ORDER BY triggered_at DESC`);
    }
    // ================================
    // TOKEN USAGE DAILY
    // ================================
    async upsertTokenUsageDaily(usage) {
        await this.conn.execute(`INSERT INTO token_usage_daily (
        usage_id, tenant_id, pack_id, date, model_id, input_tokens,
        output_tokens, request_count, cost_usd, step_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(tenant_id, date, model_id, step_id) DO UPDATE SET
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        request_count = excluded.request_count,
        cost_usd = excluded.cost_usd,
        updated_at = excluded.updated_at`, usage.usageId, usage.tenantId, usage.packId, usage.date, usage.modelId, usage.inputTokens, usage.outputTokens, usage.requestCount, usage.costUsd, usage.stepId, usage.createdAt, usage.updatedAt);
    }
    async getTokenUsageDaily(usageId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        usage_id AS "usageId",
        tenant_id AS "tenantId",
        pack_id AS "packId",
        date,
        model_id AS "modelId",
        input_tokens AS "inputTokens",
        output_tokens AS "outputTokens",
        request_count AS "requestCount",
        cost_usd AS "costUsd",
        step_id AS "stepId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM token_usage_daily WHERE usage_id = $1`, usageId);
        return result ?? null;
    }
    async listTokenUsageByTenantAndDate(tenantId, startDate, endDate) {
        if (tenantId) {
            return asyncQueryAll(this.conn, `SELECT
          usage_id AS "usageId",
          tenant_id AS "tenantId",
          pack_id AS "packId",
          date,
          model_id AS "modelId",
          input_tokens AS "inputTokens",
          output_tokens AS "outputTokens",
          request_count AS "requestCount",
          cost_usd AS "costUsd",
          step_id AS "stepId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
         FROM token_usage_daily
         WHERE tenant_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, model_id`, tenantId, startDate, endDate);
        }
        return asyncQueryAll(this.conn, `SELECT
        usage_id AS "usageId",
        tenant_id AS "tenantId",
        pack_id AS "packId",
        date,
        model_id AS "modelId",
        input_tokens AS "inputTokens",
        output_tokens AS "outputTokens",
        request_count AS "requestCount",
        cost_usd AS "costUsd",
        step_id AS "stepId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM token_usage_daily
       WHERE date >= $1 AND date <= $2
       ORDER BY date DESC, model_id`, startDate, endDate);
    }
    async sumTokenCostsByTenant(tenantId, startDate, endDate) {
        const result = await asyncQueryOne(this.conn, `SELECT COALESCE(SUM(cost_usd), 0) AS total
       FROM token_usage_daily
       WHERE tenant_id = $1 AND date >= $2 AND date <= $3`, tenantId, startDate, endDate);
        return result?.total ?? 0;
    }
}
//# sourceMappingURL=cost-management-repository.js.map