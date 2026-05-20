/**
 * BillingRepository - Data access for billing, payments, quotas, and usage.
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
} from "../sqlite-repository-contracts.js";
import type { SqliteConnection } from "../query-helper.js";
import { execute, queryAll, queryOne } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

const BILLING_ACCOUNT_COLS = `account_id AS accountId,
        owner_id AS ownerId,
        workspace_id AS workspaceId,
        plan_id AS planId,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt`;

const BILLING_INVOICE_COLS = `invoice_id AS invoiceId,
        account_id AS accountId,
        workspace_id AS workspaceId,
        tenant_id AS tenantId,
        period_id AS periodId,
        currency,
        subtotal_usd AS subtotalUsd,
        tax_usd AS taxUsd,
        total_usd AS totalUsd,
        status,
        summary_json AS summaryJson,
        external_invoice_ref AS externalInvoiceRef,
        due_at AS dueAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        paid_at AS paidAt`;

const BILLING_PAYMENT_SESSION_COLS = `session_id AS sessionId,
        invoice_id AS invoiceId,
        account_id AS accountId,
        gateway_kind AS gatewayKind,
        gateway_session_ref AS gatewaySessionRef,
        checkout_url AS checkoutUrl,
        status,
        amount_usd AS amountUsd,
        currency,
        expires_at AS expiresAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        settled_at AS settledAt,
        failure_code AS failureCode`;

const BILLING_PAYMENT_SESSION_COLS_PREFIXED = `s.session_id AS sessionId,
        s.invoice_id AS invoiceId,
        s.account_id AS accountId,
        s.gateway_kind AS gatewayKind,
        s.gateway_session_ref AS gatewaySessionRef,
        s.checkout_url AS checkoutUrl,
        s.status,
        s.amount_usd AS amountUsd,
        s.currency,
        s.expires_at AS expiresAt,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt,
        s.settled_at AS settledAt,
        s.failure_code AS failureCode`;

export class BillingRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertCostEvent(costEvent: CostEventRecord): void {
    this.conn
      .prepare(
        `INSERT INTO cost_events (
          id, task_id, session_id, execution_id, agent_id, provider, model,
          input_tokens, output_tokens, cost_usd, budget_scope,
          provider_request_id, pricing_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  /**
   * R4-28 (INV-COST-001): Write-ahead log for cost events to prevent loss on crash.
   *
   * Inserts a cost event into the WAL table before execution with "pending" status.
   * On success, the event is committed via commitCostEventWAL(). On crash recovery,
   * pending WAL entries can be detected and cleaned up.
   */
  public insertCostEventWAL(costEvent: CostEventRecord, status: "pending" | "committed"): void {
    this.conn
      .prepare(
        `INSERT INTO cost_event_wal (
          id, task_id, session_id, execution_id, agent_id, provider, model,
          input_tokens, output_tokens, cost_usd, budget_scope,
          provider_request_id, pricing_version, created_at, wal_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
        status,
      );
  }

  /**
   * R4-28: Mark a WAL cost event as committed after successful execution.
   */
  public commitCostEventWAL(costEventId: string): void {
    this.conn
      .prepare(`UPDATE cost_event_wal SET wal_status = 'committed' WHERE id = ?`)
      .run(costEventId);
    // Also insert into the main cost_events table for query compatibility
    this.conn
      .prepare(
        `INSERT INTO cost_events (id, task_id, session_id, execution_id, agent_id, provider, model,
          input_tokens, output_tokens, cost_usd, budget_scope,
          provider_request_id, pricing_version, created_at)
         SELECT id, task_id, session_id, execution_id, agent_id, provider, model,
                input_tokens, output_tokens, cost_usd, budget_scope,
                provider_request_id, pricing_version, created_at
         FROM cost_event_wal WHERE id = ?`,
      )
      .run(costEventId);
  }

  /**
   * R4-28: Cleanup orphaned pending WAL entries on startup/recovery.
   * Returns the count of cleaned up entries.
   */
  public cleanupPendingCostEventWAL(): number {
    const result = this.conn
      .prepare(`DELETE FROM cost_event_wal WHERE wal_status = 'pending'`)
      .run();
    return typeof result.changes === 'bigint' ? Number(result.changes) : result.changes;
  }

  public listCostEventsByTask(taskId: string, tenantId?: string | null): CostEventRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<CostEventRecord>(
        this.conn,
        `SELECT
          c.id,
          c.task_id AS taskId,
          c.session_id AS sessionId,
          c.execution_id AS executionId,
          c.agent_id AS agentId,
          c.provider,
          c.model,
          c.input_tokens AS inputTokens,
          c.output_tokens AS outputTokens,
          c.cost_usd AS costUsd,
          c.budget_scope AS budgetScope,
          c.provider_request_id AS providerRequestId,
          c.pricing_version AS pricingVersion,
          c.created_at AS createdAt
         FROM cost_events c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE c.task_id = ?
           AND t.tenant_id = ?
         ORDER BY c.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<CostEventRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS taskId,
        session_id AS sessionId,
        execution_id AS executionId,
        agent_id AS agentId,
        provider,
        model,
        input_tokens AS inputTokens,
        output_tokens AS outputTokens,
        cost_usd AS costUsd,
        budget_scope AS budgetScope,
        provider_request_id AS providerRequestId,
        pricing_version AS pricingVersion,
        created_at AS createdAt
       FROM cost_events
       WHERE task_id = ?
       ORDER BY created_at ASC`,
      taskId,
    );
  }

  public sumCostByTask(taskId: string, tenantId?: string | null): number {
    const scopedTenantId = resolveTenantScope(tenantId);
    const result = scopedTenantId !== undefined
      ? queryOne<{ total: number }>(
          this.conn,
          `SELECT COALESCE(SUM(c.cost_usd), 0) AS total
           FROM cost_events c
           INNER JOIN tasks t ON t.id = c.task_id
           WHERE c.task_id = ?
             AND t.tenant_id = ?`,
          taskId,
          scopedTenantId,
        )
      : queryOne<{ total: number }>(
          this.conn,
          `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_events WHERE task_id = ?`,
          taskId,
        );
    return result?.total ?? 0;
  }

  public upsertBillingAccount(account: BillingAccountRecord): void {
    this.conn
      .prepare(
        `INSERT INTO billing_accounts (
          account_id, owner_id, workspace_id, plan_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          owner_id = excluded.owner_id,
          workspace_id = excluded.workspace_id,
          plan_id = excluded.plan_id,
          status = excluded.status,
          updated_at = excluded.updated_at`,
      )
      .run(
        account.accountId,
        account.ownerId,
        account.workspaceId,
        account.planId,
        account.status,
        account.createdAt,
        account.updatedAt,
      );
  }

  public insertBillingInvoice(invoice: BillingInvoiceRecord): void {
    this.conn
      .prepare(
        `INSERT INTO billing_invoices (
          invoice_id, account_id, workspace_id, tenant_id, period_id, currency,
          subtotal_usd, tax_usd, total_usd, status, summary_json, external_invoice_ref,
          due_at, created_at, updated_at, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  public updateBillingInvoiceStatus(input: {
    invoiceId: string;
    status: BillingInvoiceRecord["status"];
    updatedAt: string;
    paidAt?: string | null;
    externalInvoiceRef?: string | null;
  }): void {
    execute(
      this.conn,
      `UPDATE billing_invoices
       SET status = ?,
           updated_at = ?,
           paid_at = ?,
           external_invoice_ref = COALESCE(?, external_invoice_ref)
       WHERE invoice_id = ?`,
      input.status,
      input.updatedAt,
      input.paidAt ?? null,
      input.externalInvoiceRef ?? null,
      input.invoiceId,
    );
  }

  public insertBillingPaymentSession(session: BillingPaymentSessionRecord): void {
    this.conn
      .prepare(
        `INSERT INTO billing_payment_sessions (
          session_id, invoice_id, account_id, gateway_kind, gateway_session_ref, checkout_url,
          status, amount_usd, currency, expires_at, created_at, updated_at, settled_at, failure_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  public updateBillingPaymentSessionStatus(input: {
    sessionId: string;
    status: BillingPaymentSessionRecord["status"];
    updatedAt: string;
    settledAt?: string | null;
    failureCode?: string | null;
  }): void {
    execute(
      this.conn,
      `UPDATE billing_payment_sessions
       SET status = ?,
           updated_at = ?,
           settled_at = ?,
           failure_code = ?
       WHERE session_id = ?`,
      input.status,
      input.updatedAt,
      input.settledAt ?? null,
      input.failureCode ?? null,
      input.sessionId,
    );
  }

  public insertUsageEvent(event: UsageEventRecord): void {
    this.conn
      .prepare(
        `INSERT INTO usage_events (
          usage_id, account_id, subject_id, workspace_id, tenant_id, task_id, execution_id,
          metric_type, quantity, source, unit_price_usd, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  public upsertQuotaCounter(counter: QuotaCounterRecord): void {
    this.conn
      .prepare(
        `INSERT INTO quota_counters (
          counter_id, account_id, metric_type, window_start, window_end, used_quantity,
          limit_quantity, limit_type, reset_policy, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, metric_type, window_start, window_end) DO UPDATE SET
          used_quantity = excluded.used_quantity,
          limit_quantity = excluded.limit_quantity,
          limit_type = excluded.limit_type,
          reset_policy = excluded.reset_policy,
          updated_at = excluded.updated_at`,
      )
      .run(
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

  public incrementQuotaCounter(counter: QuotaCounterRecord, deltaQuantity: number): QuotaCounterRecord {
    this.conn
      .prepare(
        `INSERT INTO quota_counters (
          counter_id, account_id, metric_type, window_start, window_end, used_quantity,
          limit_quantity, limit_type, reset_policy, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, metric_type, window_start, window_end) DO UPDATE SET
          used_quantity = ROUND(quota_counters.used_quantity + excluded.used_quantity, 2),
          limit_quantity = excluded.limit_quantity,
          limit_type = excluded.limit_type,
          reset_policy = excluded.reset_policy,
          updated_at = excluded.updated_at`,
      )
      .run(
        counter.counterId,
        counter.accountId,
        counter.metricType,
        counter.windowStart,
        counter.windowEnd,
        deltaQuantity,
        counter.limitQuantity,
        counter.limitType,
        counter.resetPolicy,
        counter.updatedAt,
      );

    const persisted = this.getQuotaCounter(
      counter.accountId,
      counter.metricType,
      counter.windowStart,
      counter.windowEnd,
    );
    if (persisted == null) {
      throw new Error("billing_repository.increment_quota_counter_missing_after_upsert");
    }
    return persisted;
  }

  public insertLedgerEntry(entry: LedgerEntryRecord): void {
    this.conn
      .prepare(
        `INSERT INTO ledger_entries (
          entry_id, account_id, usage_id, period_id, entry_type, amount_usd, currency, source_ref, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  public insertEntitlementDecision(decision: EntitlementDecisionRecord): void {
    this.conn
      .prepare(
        `INSERT INTO entitlement_decisions (
          decision_id, account_id, feature_key, metric_type, requested_quantity,
          allowed, decision_type, reason_code, policy_version, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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

  public getBillingAccount(accountId: string): BillingAccountRecord | null {
    return queryOne<BillingAccountRecord>(
      this.conn,
      `SELECT ${BILLING_ACCOUNT_COLS}
       FROM billing_accounts
       WHERE account_id = ?`,
      accountId,
    ) ?? null;
  }

  public listBillingAccounts(limit = 50): BillingAccountRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    return queryAll<BillingAccountRecord>(
      this.conn,
      `SELECT ${BILLING_ACCOUNT_COLS}
       FROM billing_accounts
       ORDER BY updated_at DESC
       LIMIT ?`,
      safeLimit,
    );
  }

  public getBillingInvoice(invoiceId: string, tenantId?: string | null): BillingInvoiceRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    return (scopedTenantId !== undefined
      ? queryOne<BillingInvoiceRecord>(
          this.conn,
          `SELECT ${BILLING_INVOICE_COLS}
           FROM billing_invoices
           WHERE invoice_id = ?
             AND tenant_id = ?`,
          invoiceId,
          scopedTenantId,
        )
      : queryOne<BillingInvoiceRecord>(
          this.conn,
          `SELECT ${BILLING_INVOICE_COLS}
           FROM billing_invoices
           WHERE invoice_id = ?`,
          invoiceId,
        )) ?? null;
  }

  public listBillingInvoicesForAccount(
    accountId: string,
    limit = 50,
    tenantId?: string | null,
  ): BillingInvoiceRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    const scopedTenantId = resolveTenantScope(tenantId);
    return scopedTenantId !== undefined
      ? queryAll<BillingInvoiceRecord>(
          this.conn,
          `SELECT ${BILLING_INVOICE_COLS}
           FROM billing_invoices
           WHERE account_id = ?
             AND tenant_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          accountId,
          scopedTenantId,
          safeLimit,
        )
      : queryAll<BillingInvoiceRecord>(
          this.conn,
          `SELECT ${BILLING_INVOICE_COLS}
           FROM billing_invoices
           WHERE account_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          accountId,
          safeLimit,
        );
  }

  public getBillingPaymentSession(sessionId: string, tenantId?: string | null): BillingPaymentSessionRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    return (scopedTenantId !== undefined
      ? queryOne<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS_PREFIXED}
           FROM billing_payment_sessions s
           INNER JOIN billing_invoices i ON i.invoice_id = s.invoice_id
           WHERE s.session_id = ?
             AND i.tenant_id = ?`,
          sessionId,
          scopedTenantId,
        )
      : queryOne<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS}
           FROM billing_payment_sessions
           WHERE session_id = ?`,
          sessionId,
        )) ?? null;
  }

  public getBillingPaymentSessionByGatewayRef(
    gatewayKind: BillingPaymentSessionRecord["gatewayKind"],
    gatewaySessionRef: string,
    tenantId?: string | null,
  ): BillingPaymentSessionRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    return (scopedTenantId !== undefined
      ? queryOne<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS_PREFIXED}
           FROM billing_payment_sessions s
           INNER JOIN billing_invoices i ON i.invoice_id = s.invoice_id
           WHERE s.gateway_kind = ?
             AND s.gateway_session_ref = ?
             AND i.tenant_id = ?
           ORDER BY s.created_at DESC
           LIMIT 1`,
          gatewayKind,
          gatewaySessionRef,
          scopedTenantId,
        )
      : queryOne<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS}
           FROM billing_payment_sessions
           WHERE gateway_kind = ?
             AND gateway_session_ref = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          gatewayKind,
          gatewaySessionRef,
        )) ?? null;
  }

  public listBillingPaymentSessionsForInvoice(
    invoiceId: string,
    limit = 50,
    tenantId?: string | null,
  ): BillingPaymentSessionRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    const scopedTenantId = resolveTenantScope(tenantId);
    return scopedTenantId !== undefined
      ? queryAll<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS_PREFIXED}
           FROM billing_payment_sessions s
           INNER JOIN billing_invoices i ON i.invoice_id = s.invoice_id
           WHERE s.invoice_id = ?
             AND i.tenant_id = ?
           ORDER BY s.created_at DESC
           LIMIT ?`,
          invoiceId,
          scopedTenantId,
          safeLimit,
        )
      : queryAll<BillingPaymentSessionRecord>(
          this.conn,
          `SELECT ${BILLING_PAYMENT_SESSION_COLS}
           FROM billing_payment_sessions
           WHERE invoice_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          invoiceId,
          safeLimit,
        );
  }

  public listBillingPaymentSessions(options: {
    status?: BillingPaymentSessionRecord["status"] | null;
    gatewayKind?: BillingPaymentSessionRecord["gatewayKind"] | null;
    tenantId?: string | null;
    limit?: number;
  } = {}): BillingPaymentSessionRecord[] {
    const scopedTenantId = resolveTenantScope(options.tenantId);
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];

    if (options.status != null) {
      conditions.push("s.status = ?");
      parameters.push(options.status);
    }
    if (options.gatewayKind != null) {
      conditions.push("s.gateway_kind = ?");
      parameters.push(options.gatewayKind);
    }
    if (scopedTenantId !== undefined) {
      conditions.push("i.tenant_id = ?");
      parameters.push(scopedTenantId);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return queryAll<BillingPaymentSessionRecord>(
      this.conn,
      `SELECT ${BILLING_PAYMENT_SESSION_COLS_PREFIXED}
       FROM billing_payment_sessions s
       INNER JOIN billing_invoices i ON i.invoice_id = s.invoice_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ?`,
      ...parameters,
    );
  }

  public getQuotaCounter(
    accountId: string,
    metricType: string,
    windowStart: string,
    windowEnd: string,
  ): QuotaCounterRecord | null {
    return queryOne<QuotaCounterRecord>(
      this.conn,
      `SELECT
         counter_id AS counterId,
         account_id AS accountId,
         metric_type AS metricType,
         window_start AS windowStart,
         window_end AS windowEnd,
         used_quantity AS usedQuantity,
         limit_quantity AS limitQuantity,
         limit_type AS limitType,
         reset_policy AS resetPolicy,
         updated_at AS updatedAt
       FROM quota_counters
       WHERE account_id = ? AND metric_type = ? AND window_start = ? AND window_end = ?
       LIMIT 1`,
      accountId,
      metricType,
      windowStart,
      windowEnd,
    ) ?? null;
  }

  public listQuotaCounters(accountId: string): QuotaCounterRecord[] {
    return queryAll<QuotaCounterRecord>(
      this.conn,
      `SELECT
         counter_id AS counterId,
         account_id AS accountId,
         metric_type AS metricType,
         window_start AS windowStart,
         window_end AS windowEnd,
         used_quantity AS usedQuantity,
         limit_quantity AS limitQuantity,
         limit_type AS limitType,
         reset_policy AS resetPolicy,
         updated_at AS updatedAt
       FROM quota_counters
       WHERE account_id = ?
       ORDER BY window_end DESC, metric_type ASC`,
      accountId,
    );
  }

  public listUsageEventsForAccount(accountId: string, limit = 50): UsageEventRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    return queryAll<UsageEventRecord>(
      this.conn,
      `SELECT
         usage_id AS usageId,
         account_id AS accountId,
         subject_id AS subjectId,
         workspace_id AS workspaceId,
         tenant_id AS tenantId,
         task_id AS taskId,
         execution_id AS executionId,
         metric_type AS metricType,
         quantity,
         source,
         unit_price_usd AS unitPriceUsd,
         captured_at AS capturedAt
       FROM usage_events
       WHERE account_id = ?
       ORDER BY captured_at DESC
       LIMIT ?`,
      accountId,
      safeLimit,
    );
  }

  public listLedgerEntriesForAccount(accountId: string, limit = 50): LedgerEntryRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    return queryAll<LedgerEntryRecord>(
      this.conn,
      `SELECT
         entry_id AS entryId,
         account_id AS accountId,
         usage_id AS usageId,
         period_id AS periodId,
         entry_type AS entryType,
         amount_usd AS amountUsd,
         currency,
         source_ref AS sourceRef,
         recorded_at AS recordedAt
       FROM ledger_entries
       WHERE account_id = ?
       ORDER BY recorded_at DESC
       LIMIT ?`,
      accountId,
      safeLimit,
    );
  }

  public listEntitlementDecisionsForAccount(accountId: string, limit = 50): EntitlementDecisionRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    return queryAll<EntitlementDecisionRecord>(
      this.conn,
      `SELECT
         decision_id AS decisionId,
         account_id AS accountId,
         feature_key AS featureKey,
         metric_type AS metricType,
         requested_quantity AS requestedQuantity,
         allowed,
         decision_type AS decisionType,
         reason_code AS reasonCode,
         policy_version AS policyVersion,
         evaluated_at AS evaluatedAt
       FROM entitlement_decisions
       WHERE account_id = ?
       ORDER BY evaluated_at DESC
       LIMIT ?`,
      accountId,
      safeLimit,
    );
  }

  /**
   * Count active executions for a tenant (used for quota tracking).
   */
  public countActiveExecutionsByTenant(tenantId: string): number {
    const result = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM executions e
       INNER JOIN tasks t ON e.task_id = t.id
       WHERE t.tenant_id = ? AND e.status IN ('pending', 'in_progress')`,
      tenantId,
    );
    return result?.count ?? 0;
  }

  /**
   * List recent executions for a tenant.
   */
  public listRecentExecutionsByTenant(tenantId: string, limit?: number): unknown[] {
    const params: Array<string | number> = [tenantId];
    const limitClause = Number.isFinite(limit) ? " LIMIT ?" : "";
    if (limitClause.length > 0) {
      params.push(Math.max(1, Math.trunc(limit!)));
    }
    const sql = `SELECT e.* FROM executions e
       INNER JOIN tasks t ON e.task_id = t.id
       WHERE t.tenant_id = ?
       ORDER BY e.created_at DESC${limitClause}`;
    return queryAll(this.conn, sql, ...params);
  }

  /**
   * Update task status (helper for billing-related operations).
   */
  public updateTaskStatus(taskId: string, status: string, updatedAt: string): void {
    execute(
      this.conn,
      `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`,
      status,
      updatedAt,
      taskId,
    );
  }

  /**
   * Get task by ID.
   */
  public getTask(taskId: string): unknown | undefined {
    return queryOne(
      this.conn,
      `SELECT * FROM tasks WHERE id = ?`,
      taskId,
    );
  }

  /**
   * Count queued tasks for a tenant.
   */
  public countQueuedTasksByTenant(tenantId: string): number {
    const result = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM tasks WHERE tenant_id = ? AND status = 'queued'`,
      tenantId,
    );
    return result?.count ?? 0;
  }

  /**
   * List queued tasks for a tenant.
   */
  public listQueuedTasksByTenant(tenantId: string, limit?: number): unknown[] {
    const sql = `SELECT * FROM tasks
       WHERE tenant_id = ? AND status = 'queued'
       ORDER BY created_at ASC${limit ? ` LIMIT ${limit}` : ""}`;
    return queryAll(this.conn, sql, tenantId);
  }

  /**
   * R11-13 FIX: Insert a budget settlement record for durable crash-safe cost tracking.
   *
   * Budget settlements must be persisted atomically with ledger updates to ensure
   * cost records are not lost if a crash occurs mid-execution.
   *
   * @param settlement - The budget settlement record to persist
   */
  public insertBudgetSettlement(settlement: {
    budgetSettlementId: string;
    budgetReservationId: string;
    actualAmount: number;
    settlementKind: string;
    createdAt: string;
  }): void {
    this.conn
      .prepare(
        `INSERT INTO budget_settlements (
          budget_settlement_id, budget_reservation_id, actual_amount, settlement_kind, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        settlement.budgetSettlementId,
        settlement.budgetReservationId,
        settlement.actualAmount,
        settlement.settlementKind,
        settlement.createdAt,
      );
  }
}
