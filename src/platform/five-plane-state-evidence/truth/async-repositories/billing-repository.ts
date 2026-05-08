/**
 * AsyncBillingRepository - Async data access for billing, payments, quotas, and usage.
 *
 * This is the async PostgreSQL-compatible version of BillingRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  CostEventRecord,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncBillingRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async insertCostEvent(costEvent: CostEventRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO cost_events (
        id, task_id, session_id, execution_id, agent_id, provider, model,
        input_tokens, output_tokens, cost_usd, budget_scope,
        provider_request_id, pricing_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      costEvent.id,
      costEvent.taskId,
      costEvent.sessionId,
      costEvent.executionId,
      costEvent.agentId,
      costEvent.provider,
      costEvent.model,
      costEvent.inputTokens,
      costEvent.outputTokens,
      costEvent.costUsd,
      costEvent.budgetScope,
      costEvent.providerRequestId,
      costEvent.pricingVersion,
      costEvent.createdAt,
    );
  }

  public async listCostEventsByTask(taskId: string, tenantId?: string | null): Promise<CostEventRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<CostEventRecord>(
        this.conn,
        `SELECT
          c.id,
          c.task_id AS "taskId",
          c.session_id AS "sessionId",
          c.execution_id AS "executionId",
          c.agent_id AS "agentId",
          c.provider,
          c.model,
          c.input_tokens AS "inputTokens",
          c.output_tokens AS "outputTokens",
          c.cost_usd AS "costUsd",
          c.budget_scope AS "budgetScope",
          c.provider_request_id AS "providerRequestId",
          c.pricing_version AS "pricingVersion",
          c.created_at AS "createdAt"
         FROM cost_events c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE c.task_id = $1
           AND t.tenant_id = $2
         ORDER BY c.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<CostEventRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        session_id AS "sessionId",
        execution_id AS "executionId",
        agent_id AS "agentId",
        provider,
        model,
        input_tokens AS "inputTokens",
        output_tokens AS "outputTokens",
        cost_usd AS "costUsd",
        budget_scope AS "budgetScope",
        provider_request_id AS "providerRequestId",
        pricing_version AS "pricingVersion",
        created_at AS "createdAt"
       FROM cost_events
       WHERE task_id = $1
       ORDER BY created_at ASC`,
      taskId,
    );
  }

  public async sumCostByTask(taskId: string, tenantId?: string | null): Promise<number> {
    const scopedTenantId = resolveTenantScope(tenantId);
    let result;
    if (scopedTenantId !== undefined) {
      result = await asyncQueryOne<{ total: number }>(
        this.conn,
        `SELECT COALESCE(SUM(c.cost_usd), 0) AS total
         FROM cost_events c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE c.task_id = $1
           AND t.tenant_id = $2`,
        taskId,
        scopedTenantId,
      );
    } else {
      result = await asyncQueryOne<{ total: number }>(
        this.conn,
        `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_events WHERE task_id = $1`,
        taskId,
      );
    }
    return result?.total ?? 0;
  }

  public async upsertBillingAccount(account: BillingAccountRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO billing_accounts (
        account_id, owner_id, workspace_id, plan_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(account_id) DO UPDATE SET
        owner_id = excluded.owner_id,
        workspace_id = excluded.workspace_id,
        plan_id = excluded.plan_id,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      account.accountId,
      account.ownerId,
      account.workspaceId,
      account.planId,
      account.status,
      account.createdAt,
      account.updatedAt,
    );
  }

  public async insertBillingInvoice(invoice: BillingInvoiceRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO billing_invoices (
        invoice_id, account_id, workspace_id, tenant_id, period_id, currency,
        subtotal_usd, tax_usd, total_usd, status, summary_json, external_invoice_ref,
        due_at, created_at, updated_at, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      invoice.invoiceId,
      invoice.accountId,
      invoice.workspaceId,
      invoice.tenantId,
      invoice.periodId,
      invoice.currency,
      invoice.subtotalUsd,
      invoice.taxUsd,
      invoice.totalUsd,
      invoice.status,
      invoice.summaryJson,
      invoice.externalInvoiceRef,
      invoice.dueAt,
      invoice.createdAt,
      invoice.updatedAt,
      invoice.paidAt,
    );
  }

  public async updateBillingInvoiceStatus(input: {
    invoiceId: string;
    status: BillingInvoiceRecord["status"];
    updatedAt: string;
    paidAt?: string | null;
    externalInvoiceRef?: string | null;
  }): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE billing_invoices
       SET status = $1,
           updated_at = $2,
           paid_at = $3,
           external_invoice_ref = COALESCE($4, external_invoice_ref)
       WHERE invoice_id = $5`,
      input.status,
      input.updatedAt,
      input.paidAt ?? null,
      input.externalInvoiceRef ?? null,
      input.invoiceId,
    );
  }

  public async insertBillingPaymentSession(session: BillingPaymentSessionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO billing_payment_sessions (
        session_id, invoice_id, account_id, gateway_kind, gateway_session_ref, checkout_url,
        status, amount_usd, currency, expires_at, created_at, updated_at, settled_at, failure_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      session.sessionId,
      session.invoiceId,
      session.accountId,
      session.gatewayKind,
      session.gatewaySessionRef,
      session.checkoutUrl,
      session.status,
      session.amountUsd,
      session.currency,
      session.expiresAt,
      session.createdAt,
      session.updatedAt,
      session.settledAt,
      session.failureCode,
    );
  }

  public async updateBillingPaymentSessionStatus(input: {
    sessionId: string;
    status: BillingPaymentSessionRecord["status"];
    updatedAt: string;
    settledAt?: string | null;
    failureCode?: string | null;
  }): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE billing_payment_sessions
       SET status = $1,
           updated_at = $2,
           settled_at = $3,
           failure_code = $4
       WHERE session_id = $5`,
      input.status,
      input.updatedAt,
      input.settledAt ?? null,
      input.failureCode ?? null,
      input.sessionId,
    );
  }

  public async insertUsageEvent(event: UsageEventRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO usage_events (
        usage_id, account_id, subject_id, workspace_id, tenant_id, task_id, execution_id,
        metric_type, quantity, source, unit_price_usd, captured_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      event.usageId,
      event.accountId,
      event.subjectId,
      event.workspaceId,
      event.tenantId,
      event.taskId,
      event.executionId,
      event.metricType,
      event.quantity,
      event.source,
      event.unitPriceUsd,
      event.capturedAt,
    );
  }

  public async upsertQuotaCounter(counter: QuotaCounterRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO quota_counters (
        counter_id, account_id, metric_type, window_start, window_end, used_quantity,
        limit_quantity, limit_type, reset_policy, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(account_id, metric_type, window_start, window_end) DO UPDATE SET
        used_quantity = excluded.used_quantity,
        limit_quantity = excluded.limit_quantity,
        limit_type = excluded.limit_type,
        reset_policy = excluded.reset_policy,
        updated_at = excluded.updated_at`,
      counter.counterId,
      counter.accountId,
      counter.metricType,
      counter.windowStart,
      counter.windowEnd,
      counter.usedQuantity,
      counter.limitQuantity,
      counter.limitType,
      counter.resetPolicy,
      counter.updatedAt,
    );
  }

  public async insertLedgerEntry(entry: LedgerEntryRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO ledger_entries (
        entry_id, account_id, usage_id, period_id, entry_type, amount_usd, currency, source_ref, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      entry.entryId,
      entry.accountId,
      entry.usageId,
      entry.periodId,
      entry.entryType,
      entry.amountUsd,
      entry.currency,
      entry.sourceRef,
      entry.recordedAt,
    );
  }

  public async insertEntitlementDecision(decision: EntitlementDecisionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO entitlement_decisions (
        decision_id, account_id, feature_key, metric_type, requested_quantity,
        allowed, decision_type, reason_code, policy_version, evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      decision.decisionId,
      decision.accountId,
      decision.featureKey,
      decision.metricType,
      decision.requestedQuantity,
      decision.allowed,
      decision.decisionType,
      decision.reasonCode,
      decision.policyVersion,
      decision.evaluatedAt,
    );
  }

  public async getBillingAccount(accountId: string): Promise<BillingAccountRecord | null> {
    const result = await asyncQueryOne<BillingAccountRecord>(
      this.conn,
      `SELECT
        account_id AS "accountId",
        owner_id AS "ownerId",
        workspace_id AS "workspaceId",
        plan_id AS "planId",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM billing_accounts
       WHERE account_id = $1`,
      accountId,
    );
    return result ?? null;
  }

  public async countActiveExecutionsByTenant(tenantId: string): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM executions e
       INNER JOIN tasks t ON e.task_id = t.id
       WHERE t.tenant_id = $1 AND e.status IN ('pending', 'in_progress')`,
      tenantId,
    );
    return result?.count ?? 0;
  }

  public async countQueuedTasksByTenant(tenantId: string): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM tasks WHERE tenant_id = $1 AND status = 'queued'`,
      tenantId,
    );
    return result?.count ?? 0;
  }
}
