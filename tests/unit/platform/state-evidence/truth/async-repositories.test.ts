import assert from "node:assert/strict";
import test from "node:test";

import {
  AsyncCostManagementRepository,
  type BudgetAlertRecord,
  type CostReportRecord,
  type TokenUsageDailyRecord,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/cost-management-repository.js";
import {
  AsyncDelegationRepository,
  type DelegationEventRecord,
  type DelegationRecord,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/delegation-repository.js";
import { AsyncEvolutionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/evolution-repository.js";
import { AsyncIntelligenceRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/intelligence-repository.js";
import {
  AsyncMarketplaceListingRepository,
  type MarketplaceListingRecord,
  type PackDownloadRecord,
  type PackReviewRecord,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/marketplace-repository-ext.js";
import { AsyncOrganizationRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/organization-repository.js";
import { AsyncPromptRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/prompt-repository.js";
import {
  AsyncTenantRepository,
  type TenantBillingRecord,
  type TenantQuotaRecord,
  type TenantRecord,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/tenant-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

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

const now = "2026-04-16T10:00:00.000Z";

function costReportRecord(overrides: Partial<CostReportRecord> = {}): CostReportRecord {
  return {
    reportId: "report-1",
    tenantId: "tenant-a",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 42.5,
    currency: "USD",
    resourceCostsJson: '{"compute":30,"storage":12.5}',
    submittedBy: "system",
    submittedAt: now,
    createdAt: now,
    ...overrides,
  };
}

function budgetAlertRecord(overrides: Partial<BudgetAlertRecord> = {}): BudgetAlertRecord {
  return {
    alertId: "alert-1",
    tenantId: "tenant-a",
    budgetType: "monthly_spend",
    thresholdUsd: 1000,
    currentSpendUsd: 750,
    alertLevel: "warning",
    triggeredAt: null,
    acknowledgedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function tokenUsageDailyRecord(overrides: Partial<TokenUsageDailyRecord> = {}): TokenUsageDailyRecord {
  return {
    usageId: "usage-1",
    tenantId: "tenant-a",
    packId: "pack-1",
    date: "2026-04-15",
    modelId: "gpt-5.4-mini",
    inputTokens: 10000,
    outputTokens: 5000,
    requestCount: 100,
    costUsd: 1.25,
    stepId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function delegationRecord(overrides: Partial<DelegationRecord> = {}): DelegationRecord {
  return {
    delegationId: "delegation-1",
    parentAgentId: "agent-parent",
    childAgentId: "agent-child",
    delegationChainJson: '["agent-parent","agent-child"]',
    status: "active",
    depth: 2,
    expiresAt: "2026-04-16T12:00:00.000Z",
    resultRef: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function delegationEventRecord(overrides: Partial<DelegationEventRecord> = {}): DelegationEventRecord {
  return {
    eventId: "event-delegation-1",
    delegationId: "delegation-1",
    eventType: "delegation_created",
    payloadJson: '{"reason":"parallel_work"}',
    createdAt: now,
    ...overrides,
  };
}

test("AsyncCostManagementRepository writes and reads cost reports", async () => {
  const report = costReportRecord();
  const { connection, calls } = createConnection({
    queryRows: [[report]],
    queryOneRows: [report, undefined],
  });
  const repo = new AsyncCostManagementRepository(connection);

  await repo.insertCostReport(report);
  assert.equal(await repo.getCostReport("report-1"), report);
  assert.equal(await repo.getCostReport("missing-report"), null);

  assert.match(calls[0]!.sql, /INSERT INTO cost_reports/);
  assert.match(calls[1]!.sql, /FROM cost_reports WHERE report_id = \$1/);
});

test("AsyncCostManagementRepository lists cost reports by tenant with limit", async () => {
  const report = costReportRecord();
  const { connection, calls } = createConnection({
    queryRows: [[report], [report]],
  });
  const repo = new AsyncCostManagementRepository(connection);

  assert.deepEqual(await repo.listCostReportsByTenant("tenant-a", 10), [report]);
  assert.deepEqual(await repo.listCostReportsByTenant(null, 5), [report]);

  assert.deepEqual(calls[0]!.params, ["tenant-a", 10]);
  assert.deepEqual(calls[1]!.params, [5]);
});

test("AsyncCostManagementRepository writes and reads budget alerts", async () => {
  const alert = budgetAlertRecord();
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1, 2],
    queryRows: [[alert]],
    queryOneRows: [alert, undefined],
  });
  const repo = new AsyncCostManagementRepository(connection);

  await repo.insertBudgetAlert(alert);
  const updated = await repo.updateBudgetAlert({
    alertId: "alert-1",
    currentSpendUsd: 800,
    alertLevel: "critical",
    triggeredAt: now,
    updatedAt: now,
  });
  assert.equal(updated, 1);
  await repo.insertBudgetAlert({ ...alert, alertId: "alert-2" } as BudgetAlertRecord);
  assert.equal(await repo.getBudgetAlert("alert-1"), alert);
  assert.equal(await repo.getBudgetAlert("missing-alert"), null);

  assert.match(calls[0]!.sql, /INSERT INTO budget_alerts/);
  assert.match(calls[1]!.sql, /UPDATE budget_alerts SET/);
  assert.match(calls[1]!.sql, /current_spend_usd = \$2/);
  assert.match(calls[1]!.sql, /alert_level = \$3/);
});

test("AsyncCostManagementRepository lists budget alerts by tenant and active alerts", async () => {
  const alert = budgetAlertRecord({ alertId: "alert-1", triggeredAt: null, acknowledgedAt: null });
  const activeAlert = budgetAlertRecord({ alertId: "active-alert", triggeredAt: now, acknowledgedAt: null });
  const { connection, calls } = createConnection({
    queryRows: [[alert], [activeAlert], [activeAlert]],
  });
  const repo = new AsyncCostManagementRepository(connection);

  const resultTenant = await repo.listBudgetAlertsByTenant("tenant-a");
  assert.equal(resultTenant.length, 1);
  assert.equal(resultTenant[0]!.alertId, "alert-1");

  const resultNull = await repo.listBudgetAlertsByTenant(null);
  assert.equal(resultNull.length, 1);

  const activeResult = await repo.listActiveAlerts();
  assert.equal(activeResult.length, 1);
  assert.equal(activeResult[0]!.alertId, "active-alert");

  assert.deepEqual(calls[0]!.params, ["tenant-a"]);
});

test("AsyncCostManagementRepository upserts and queries token usage daily", async () => {
  const usage = tokenUsageDailyRecord();
  // queryOneRows: [usage, undefined] for getTokenUsageDaily calls
  // queryRows: [[usage], [usage]] for listTokenUsageByTenantAndDate calls
  // queryOneRows[2] for sumTokenCostsByTenant
  const { connection, calls } = createConnection({
    executeResults: [1],
    queryRows: [[usage], [usage]],
    queryOneRows: [usage, undefined, { total: 5.0 }],
  });
  const repo = new AsyncCostManagementRepository(connection);

  await repo.upsertTokenUsageDaily(usage);
  assert.equal(await repo.getTokenUsageDaily("usage-1"), usage);
  assert.equal(await repo.getTokenUsageDaily("missing-usage"), null);
  assert.deepEqual(await repo.listTokenUsageByTenantAndDate("tenant-a", "2026-04-01", "2026-04-30"), [usage]);
  assert.deepEqual(await repo.listTokenUsageByTenantAndDate(null, "2026-04-01", "2026-04-30"), [usage]);
  assert.equal(await repo.sumTokenCostsByTenant("tenant-a", "2026-04-01", "2026-04-30"), 5.0);

  assert.match(calls[0]!.sql, /INSERT INTO token_usage_daily/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(tenant_id, date, model_id, step_id\) DO UPDATE SET/);
  // calls[1] = getTokenUsageDaily("usage-1") - queryOne
  // calls[2] = getTokenUsageDaily("missing-usage") - queryOne
  // calls[3] = listTokenUsageByTenantAndDate("tenant-a") - query
  // calls[4] = listTokenUsageByTenantAndDate(null) - query
  // calls[5] = sumTokenCostsByTenant - queryOne
  assert.match(calls[3]!.sql, /WHERE tenant_id = \$1 AND date >= \$2 AND date <= \$3/);
  assert.match(calls[5]!.sql, /COALESCE\(SUM\(cost_usd\), 0\)/);
});

test("AsyncDelegationRepository writes and reads delegations", async () => {
  const delegation = delegationRecord();
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1],
    queryRows: [[delegation], [delegation]],
    queryOneRows: [delegation, undefined],
  });
  const repo = new AsyncDelegationRepository(connection);

  await repo.insertDelegation(delegation);
  const updated = await repo.updateDelegation({
    delegationId: "delegation-1",
    status: "completed",
    resultRef: "s3://results/delegation-1.json",
    updatedAt: now,
  });
  assert.equal(updated, 1);
  assert.equal(await repo.getDelegation("delegation-1"), delegation);
  assert.equal(await repo.getDelegation("missing-delegation"), null);

  assert.match(calls[0]!.sql, /INSERT INTO delegations/);
  assert.match(calls[1]!.sql, /UPDATE delegations SET/);
  assert.match(calls[1]!.sql, /status = \$2/);
  assert.match(calls[2]!.sql, /FROM delegations WHERE delegation_id = \$1/);
});

test("AsyncDelegationRepository lists delegations by parent and status", async () => {
  const delegation = delegationRecord();
  const { connection, calls } = createConnection({
    queryRows: [[delegation], [delegation], [delegation]],
  });
  const repo = new AsyncDelegationRepository(connection);

  assert.deepEqual(await repo.listDelegationsByParent("agent-parent"), [delegation]);
  assert.deepEqual(await repo.listDelegationsByStatus("active"), [delegation]);
  assert.deepEqual(await repo.listExpiredDelegations(), [delegation]);

  assert.deepEqual(calls[0]!.params, ["agent-parent"]);
  assert.deepEqual(calls[1]!.params, ["active"]);
});

test("AsyncDelegationRepository deletes delegation and manages events", async () => {
  const event = delegationEventRecord();
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[event]],
    queryOneRows: [{ count: 5 }],
  });
  const repo = new AsyncDelegationRepository(connection);

  await repo.insertDelegationEvent(event);
  assert.deepEqual(await repo.listDelegationEvents("delegation-1"), [event]);
  assert.equal(await repo.countDelegationEvents("delegation-1"), 5);
  assert.equal(await repo.deleteDelegation("delegation-1"), 1);

  assert.deepEqual(calls[1]!.params, ["delegation-1"]);
  assert.deepEqual(calls[3]!.params, ["delegation-1"]);
});

test("AsyncEvolutionRepository writes and reads evolution proposals", async () => {
  const proposal = {
    id: "proposal-1",
    taskId: "task-1",
    executionId: "execution-1",
    sourceAgentId: "agent-1",
    kind: "capability",
    scopeType: "task",
    scopeRef: "task-1",
    status: "pending",
    approvalId: null,
    summary: "Improve routing",
    proposalJson: '{"changes":[]}',
    evidenceJson: "[]",
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[proposal]],
    queryOneRows: [proposal, undefined],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.insertEvolutionProposal(proposal as any);
  const updated = await repo.updateEvolutionProposal({
    ...proposal,
    status: "approved",
    approvalId: "approval-1",
    updatedAt: now,
    approvedAt: now,
  } as any);
  assert.equal(updated, 1);
  assert.equal(await repo.getEvolutionProposal("proposal-1"), proposal);
  assert.equal(await repo.getEvolutionProposal("missing-proposal"), null);

  assert.match(calls[0]!.sql, /INSERT INTO evolution_proposals/);
});

test("AsyncEvolutionRepository lists evolution proposals by status", async () => {
  const proposal = {
    id: "proposal-1",
    taskId: "task-1",
    executionId: "execution-1",
    sourceAgentId: "agent-1",
    kind: "capability",
    scopeType: "task",
    scopeRef: "task-1",
    status: "approved",
    approvalId: "approval-1",
    summary: "Improve routing",
    proposalJson: '{"changes":[]}',
    evidenceJson: "[]",
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    appliedAt: null,
    rolledBackAt: null,
  } as const;
  const { connection, calls } = createConnection({
    queryRows: [[proposal], [proposal]],
  });
  const repo = new AsyncEvolutionRepository(connection);

  assert.deepEqual(await repo.listEvolutionProposals(), [proposal]);
  assert.deepEqual(await repo.listEvolutionProposals("approved" as any), [proposal]);

  assert.match(calls[0]!.sql, /FROM evolution_proposals[\s\S]*?ORDER BY created_at DESC/s);
  assert.match(calls[1]!.sql, /WHERE status = \$1[\s\S]*?ORDER BY created_at DESC/s);
});

test("AsyncEvolutionRepository writes and reads evolution policies and logs", async () => {
  const policy = {
    id: "policy-1",
    proposalId: "proposal-1",
    kind: "routing",
    scopeType: "task",
    scopeRef: "task-1",
    status: "active",
    valueJson: '{"priority":1}',
    createdAt: now,
    updatedAt: now,
    rolledBackAt: null,
  } as const;
  const log = {
    id: "log-1",
    proposalId: "proposal-1",
    taskId: "task-1",
    executionId: "execution-1",
    eventType: "proposal_created",
    reasonCode: "init",
    beforeStateJson: "{}",
    afterStateJson: '{"status":"pending"}',
    metadataJson: "{}",
    createdAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1],
    queryRows: [[policy], [log]],
    queryOneRows: [policy, undefined],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.insertEvolutionPolicy(policy as any);
  const updated = await repo.updateEvolutionPolicy({
    ...policy,
    status: "superseded",
    updatedAt: now,
    rolledBackAt: now,
  } as any);
  assert.equal(updated, 1);
  assert.equal(await repo.getEvolutionPolicyByProposal("proposal-1"), policy);
  assert.deepEqual(await repo.listEvolutionPolicies({ kind: "routing" as any }), [policy]);
  await repo.insertEvolutionLog(log as any);
  assert.deepEqual(await repo.listEvolutionLogsByProposal("proposal-1"), [log]);

  assert.match(calls[0]!.sql, /INSERT INTO evolution_policies/);
  assert.match(calls[4]!.sql, /INSERT INTO evolution_logs/);
});

test("AsyncEvolutionRepository writes and reads PMF validation reports", async () => {
  const report = {
    id: "pmf-1",
    profileName: "routing_v2",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-15T23:59:59.999Z",
    divisionId: "general_ops",
    verdict: "pass",
    summaryJson: '{"score":0.85}',
    reportJson: '{"details":[]}',
    generatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1],
    queryRows: [[report], [report]],
    queryOneRows: [report, undefined, report],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.insertPmfValidationReport(report as any);
  assert.deepEqual(await repo.listPmfValidationReports(5), [report]);
  assert.deepEqual(await repo.listPmfValidationReports(Number.NaN), [report]);
  assert.equal(await repo.getLatestPmfValidationReport("routing_v2"), report);
  assert.equal(await repo.getLatestPmfValidationReport("missing-profile"), null);
  assert.equal(await repo.getLatestPmfValidationReport(), report);

  assert.match(calls[0]!.sql, /INSERT INTO pmf_validation_reports/);
});

test("AsyncIntelligenceRepository upserts perception sources and inserts intel items", async () => {
  const source = {
    sourceId: "src-1",
    tenantId: "tenant-a",
    type: "feed",
    name: "News Feed",
    enabled: 1,
    scheduleJson: '{"interval":"1h"}',
    filtersJson: '{"topics":["tech"]}',
    priority: 10,
    createdAt: now,
    updatedAt: now,
  } as const;
  const item = {
    intelId: "intel-1",
    tenantId: "tenant-a",
    sourceId: "src-1",
    title: "AI Breakthrough",
    summary: "New model released",
    rawRef: "https://news.example/123",
    relevanceScore: 0.9,
    importance: 8,
    tagsJson: '["ai","research"]',
    dedupeKey: "article-123",
    capturedAt: now,
    expiresAt: null,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryOneRows: [source, source, undefined, undefined, item, item, undefined],
  });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.upsertPerceptionSource(source as any);
  assert.equal(await repo.getPerceptionSource("src-1"), source);
  assert.equal(await repo.getPerceptionSource("src-1", "tenant-a"), source);
  assert.equal(await repo.getPerceptionSource("missing-source"), null);
  assert.equal(await repo.getPerceptionSource("missing-source", "tenant-a"), null);

  await repo.insertIntelItem(item as any);
  assert.equal(await repo.getIntelItemBySourceAndDedupeKey("src-1", "article-123"), item);
  assert.equal(await repo.getIntelItemBySourceAndDedupeKey("src-1", "article-123", "tenant-a"), item);
  assert.equal(await repo.getIntelItemBySourceAndDedupeKey("src-1", "missing-key"), null);

  assert.match(calls[0]!.sql, /INSERT INTO perception_sources/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(source_id\) DO UPDATE SET/);
  assert.match(calls[5]!.sql, /INSERT INTO intel_items/);
});

test("AsyncIntelligenceRepository lists perception sources and intel items with filters", async () => {
  const source = {
    sourceId: "src-1",
    tenantId: "tenant-a",
    type: "feed",
    name: "News Feed",
    enabled: 1,
    scheduleJson: "{}",
    filtersJson: "{}",
    priority: 10,
    createdAt: now,
    updatedAt: now,
  } as const;
  const item = {
    intelId: "intel-1",
    tenantId: "tenant-a",
    sourceId: "src-1",
    title: "AI News",
    summary: "Summary",
    rawRef: "https://example.com/1",
    relevanceScore: 0.9,
    importance: 8,
    tagsJson: "[]",
    dedupeKey: "key-1",
    capturedAt: now,
    expiresAt: null,
  } as const;
  const { connection, calls } = createConnection({
    queryRows: [[source], [source], [source], [item], [item], [item], [item]],
  });
  const repo = new AsyncIntelligenceRepository(connection);

  assert.deepEqual(await repo.listPerceptionSources(false), [source]);
  assert.deepEqual(await repo.listPerceptionSources(true), [source]);
  assert.deepEqual(await repo.listPerceptionSources(true, "tenant-a"), [source]);
  assert.deepEqual(await repo.listIntelItems({ sourceIds: ["src-1"], limit: 10 }), [item]);
  assert.deepEqual(await repo.listIntelItems({ since: now, until: now, limit: 5 }), [item]);
  assert.deepEqual(await repo.listIntelItems({}), [item]);
  assert.deepEqual(await repo.listIntelItemsByIds(["intel-1", "intel-2"]), [item]);
  assert.deepEqual(await repo.listIntelItemsByIds([]), []);

  assert.match(calls[1]!.sql, /WHERE enabled = 1/);
  assert.match(calls[2]!.sql, /tenant_id = \$1/);
  assert.match(calls[3]!.sql, /source_id IN \(\$1\)/);
  assert.match(calls[4]!.sql, /captured_at >= \$1 AND captured_at <= \$2/);
  assert.match(calls[5]!.sql, /ORDER BY importance DESC, relevance_score DESC, captured_at DESC/);
  assert.match(calls[6]!.sql, /WHERE intel_id IN \(\$1, \$2\)/);
});

test("AsyncIntelligenceRepository writes intel briefs and action proposals", async () => {
  const brief = {
    briefId: "brief-1",
    tenantId: "tenant-a",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.999Z",
    sourceScopeJson: '{"sources":["src-1"]}',
    itemIdsJson: '["intel-1","intel-2"]',
    overallSummary: "AI developments trending",
    recommendedActionsJson: '["review_research"]',
    generatedAt: now,
  } as const;
  const proposal = {
    proposalId: "proposal-1",
    tenantId: "tenant-a",
    briefId: "brief-1",
    intelId: "intel-1",
    taskId: "task-1",
    title: "Review AI paper",
    summary: "Review new AI paper",
    actionType: "review",
    status: "pending",
    requiresApproval: 0,
    proposalJson: "{}",
    createdAt: now,
    decidedAt: null,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[brief], [brief], [brief], [proposal], [proposal]],
    queryOneRows: [brief, undefined, brief],
  });
  const repo = new AsyncIntelligenceRepository(connection);

  await repo.insertIntelBrief(brief as any);
  await repo.insertActionProposal(proposal as any);
  assert.equal(await repo.getIntelBrief("brief-1"), brief);
  assert.equal(await repo.getIntelBrief("missing-brief"), null);
  assert.equal(await repo.getIntelBrief("brief-1", "tenant-a"), brief);
  assert.deepEqual(await repo.listIntelBriefs(10), [brief]);
  assert.deepEqual(await repo.listIntelBriefs(Number.NaN), [brief]);
  assert.deepEqual(await repo.listIntelBriefs(5, "tenant-a"), [brief]);
  assert.deepEqual(await repo.listActionProposalsByBrief("brief-1"), [proposal]);
  assert.deepEqual(await repo.listActionProposalsByBrief("brief-1", "tenant-a"), [proposal]);

  assert.match(calls[0]!.sql, /INSERT INTO intel_briefs/);
  assert.match(calls[1]!.sql, /INSERT INTO action_proposals/);
  assert.match(calls[2]!.sql, /FROM intel_briefs[\s\S]*?WHERE brief_id = \$1/);
  assert.match(calls[7]!.sql, /WHERE tenant_id = \$1 ORDER BY generated_at DESC LIMIT \$2/);
  assert.match(calls[8]!.sql, /FROM action_proposals[\s\S]*?WHERE brief_id = \$1/);
  assert.match(calls[9]!.sql, /FROM action_proposals[\s\S]*?WHERE brief_id = \$1 AND tenant_id = \$2/);
});

test("AsyncMarketplaceListingRepository writes and reads marketplace listings", async () => {
  const listing: MarketplaceListingRecord = {
    listingId: "listing-1",
    packId: "pack-1",
    status: "published",
    title: "AI Tools Pack",
    description: "Useful AI tools",
    category: "productivity",
    version: "1.0.0",
    publishedAt: now,
    deprecatedAt: null,
    downloadCount: 100,
    ratingAvg: 4.5,
    ratingCount: 20,
    createdAt: now,
    updatedAt: now,
  };
  // Operations: insertListing(execute), updateListing(execute), getListing x2(queryOne), increment(execute), updateRating(execute)
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1, 1],
    queryRows: [[listing]],
    queryOneRows: [listing, undefined],
  });
  const repo = new AsyncMarketplaceListingRepository(connection);

  await repo.insertListing(listing);
  const updated = await repo.updateListing({ listingId: "listing-1", status: "deprecated", deprecatedAt: now, updatedAt: now });
  assert.equal(updated, 1);
  assert.equal(await repo.getListing("listing-1"), listing);
  assert.equal(await repo.getListing("missing-listing"), null);
  assert.equal(await repo.incrementDownloadCount("listing-1"), 1);
  assert.equal(await repo.updateRating("listing-1", 4.8, 25), 1);

  assert.match(calls[0]!.sql, /INSERT INTO marketplace_listings/);
  assert.match(calls[1]!.sql, /UPDATE marketplace_listings SET/);
  assert.match(calls[1]!.sql, /deprecated_at = \$3/);
  assert.match(calls[4]!.sql, /download_count = download_count \+ 1/);
  assert.match(calls[5]!.sql, /rating_avg = \$1, rating_count = \$2/);
});

test("AsyncMarketplaceListingRepository lists listings by status and category", async () => {
  const listing: MarketplaceListingRecord = {
    listingId: "listing-1",
    packId: "pack-1",
    status: "published",
    title: "AI Tools Pack",
    description: null,
    category: "productivity",
    version: "1.0.0",
    publishedAt: now,
    deprecatedAt: null,
    downloadCount: 50,
    ratingAvg: 4.0,
    ratingCount: 10,
    createdAt: now,
    updatedAt: now,
  };
  const { connection, calls } = createConnection({
    queryRows: [[listing], [listing]],
  });
  const repo = new AsyncMarketplaceListingRepository(connection);

  assert.deepEqual(await repo.listListingsByStatus("published"), [listing]);
  assert.deepEqual(await repo.listListingsByCategory("productivity"), [listing]);

  assert.match(calls[0]!.sql, /WHERE status = \$1[\s\S]*?ORDER BY download_count DESC/s);
  assert.match(calls[1]!.sql, /WHERE category = \$1[\s\S]*?ORDER BY rating_avg DESC/s);
});

test("AsyncMarketplaceListingRepository writes and reads pack reviews", async () => {
  const review: PackReviewRecord = {
    reviewId: "review-1",
    listingId: "listing-1",
    userId: "user-1",
    rating: 5,
    title: "Great pack!",
    body: "Very useful",
    helpfulCount: 10,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  // insertReview(execute), updateReview(execute), getReview x2(queryOne), listReviews(query), countReviews(queryOne)
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[review]],
    queryOneRows: [review, undefined, { count: 1 }],
  });
  const repo = new AsyncMarketplaceListingRepository(connection);

  await repo.insertReview(review);
  const updated = await repo.updateReview({ reviewId: "review-1", rating: 4, helpfulCount: 11, updatedAt: now });
  assert.equal(updated, 1);
  assert.equal(await repo.getReview("review-1"), review);
  assert.equal(await repo.getReview("missing-review"), null);
  assert.deepEqual(await repo.listReviewsByListing("listing-1"), [review]);
  assert.equal(await repo.countReviewsByListing("listing-1"), 1);

  assert.match(calls[0]!.sql, /INSERT INTO pack_reviews/);
  assert.match(calls[1]!.sql, /UPDATE pack_reviews SET/);
  assert.match(calls[1]!.sql, /rating = \$2/);
  assert.match(calls[4]!.sql, /WHERE listing_id = \$1 AND status = 'active'/);
  assert.match(calls[5]!.sql, /COUNT\(\*\) AS count FROM pack_reviews/);
});

test("AsyncMarketplaceListingRepository writes and reads pack downloads", async () => {
  const download: PackDownloadRecord = {
    downloadId: "dl-1",
    listingId: "listing-1",
    tenantId: "tenant-a",
    userId: "user-1",
    packVersion: "1.0.0",
    downloadedAt: now,
    source: "marketplace",
  };
  const { connection, calls } = createConnection({
    executeResults: [1],
    queryRows: [[download], [download], [download]],
    queryOneRows: [{ count: 5 }],
  });
  const repo = new AsyncMarketplaceListingRepository(connection);

  await repo.insertDownload(download);
  assert.deepEqual(await repo.listDownloadsByTenant("tenant-a"), [download]);
  assert.deepEqual(await repo.listDownloadsByListing("listing-1", 50), [download]);
  assert.deepEqual(await repo.listDownloadsByListing("listing-1"), [download]);
  assert.equal(await repo.countDownloadsByListing("listing-1"), 5);

  assert.deepEqual(calls[1]!.params, ["tenant-a"]);
  assert.deepEqual(calls[2]!.params, ["listing-1", 50]);
});

test("AsyncOrganizationRepository upserts workspace and membership records", async () => {
  const workspace = {
    workspaceId: "ws-1",
    ownerId: "user-1",
    displayName: "My Workspace",
    planId: "pro",
    defaultPolicySet: "default",
    organizationId: "org-1",
    createdAt: now,
    updatedAt: now,
  } as const;
  const membership = {
    workspaceId: "ws-1",
    userId: "user-2",
    role: "editor",
    joinedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[membership]],
    queryOneRows: [workspace, undefined],
  });
  const repo = new AsyncOrganizationRepository(connection);

  await repo.upsertWorkspaceRecord(workspace as any);
  await repo.upsertWorkspaceMembershipRecord(membership as any);
  assert.equal(await repo.getWorkspaceRecord("ws-1"), workspace);
  assert.equal(await repo.getWorkspaceRecord("missing-ws"), null);
  assert.deepEqual(await repo.listWorkspaceMemberships("ws-1"), [membership]);

  assert.match(calls[0]!.sql, /INSERT INTO workspaces/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(workspace_id\) DO UPDATE SET/);
  assert.match(calls[1]!.sql, /INSERT INTO workspace_memberships/);
  assert.match(calls[2]!.sql, /FROM workspaces[\s\S]*?WHERE workspace_id = \$1/);
});

test("AsyncOrganizationRepository lists workspaces by organization", async () => {
  const workspace = {
    workspaceId: "ws-1",
    ownerId: "user-1",
    displayName: "My Workspace",
    planId: "pro",
    defaultPolicySet: "default",
    organizationId: "org-1",
    createdAt: now,
    updatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    queryRows: [[workspace], [workspace], [workspace], [workspace]],
  });
  const repo = new AsyncOrganizationRepository(connection);

  assert.deepEqual(await repo.listWorkspaceRecords({ organizationId: "org-1" }), [workspace]);
  assert.deepEqual(await repo.listWorkspaceRecords({ organizationId: null }), [workspace]);
  assert.deepEqual(await repo.listWorkspaceRecords({ limit: 5 }), [workspace]);
  assert.deepEqual(await repo.listWorkspaceRecords({}), [workspace]);

  assert.deepEqual(calls[0]!.params, ["org-1", 50]);
});

test("AsyncOrganizationRepository upserts and reads organizations", async () => {
  const org = {
    organizationId: "org-1",
    displayName: "Acme Corp",
    billingAccountId: "acct-1",
    defaultTenantId: "tenant-a",
    createdAt: now,
    updatedAt: now,
  } as const;
  const membership = {
    organizationId: "org-1",
    userId: "user-1",
    role: "admin",
    joinedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[org], [membership]],
    queryOneRows: [org, undefined],
  });
  const repo = new AsyncOrganizationRepository(connection);

  await repo.upsertOrganizationRecord(org as any);
  await repo.upsertOrganizationMembershipRecord(membership as any);
  assert.equal(await repo.getOrganizationRecord("org-1"), org);
  assert.equal(await repo.getOrganizationRecord("missing-org"), null);
  assert.deepEqual(await repo.listOrganizationRecords(10), [org]);
  assert.deepEqual(await repo.listOrganizationMemberships("org-1"), [membership]);

  assert.match(calls[0]!.sql, /INSERT INTO organizations/);
  assert.match(calls[1]!.sql, /INSERT INTO organization_memberships/);
});

test("AsyncOrganizationRepository upserts and reads tenant records", async () => {
  const tenant: TenantRecord = {
    tenantId: "tenant-a",
    displayName: "Tenant A",
    status: "active",
    billingPlan: "pro",
    slaLevel: "standard",
    allowedRegionsJson: '["us-east-1"]',
    quotasJson: '{"tasks":1000}',
    metadataJson: "{}",
    createdAt: now,
    updatedAt: now,
  };
  const { connection, calls } = createConnection({
    executeResults: [1],
    queryRows: [[tenant], [tenant]],
    queryOneRows: [tenant, undefined],
  });
  const repo = new AsyncOrganizationRepository(connection);

  await repo.upsertTenantRecord(tenant as any);
  assert.deepEqual(await repo.getTenantRecord("tenant-a"), { ...tenant, quotas: {} });
  assert.equal(await repo.getTenantRecord("missing-tenant"), null);
  assert.deepEqual(await repo.listTenantRecords({ organizationId: "org-1" }), [{ ...tenant, quotas: {} }]);
  assert.deepEqual(await repo.listTenantRecords({}), [{ ...tenant, quotas: {} }]);

  assert.match(calls[0]!.sql, /INSERT INTO tenants/);
});

test("AsyncOrganizationRepository upserts deployment bindings and data namespaces", async () => {
  const binding = {
    bindingId: "binding-1",
    tenantId: "tenant-a",
    environmentId: "env-1",
    deploymentMode: "cloud",
    region: "us-east-1",
    networkBoundary: "public",
    createdAt: now,
    updatedAt: now,
  } as const;
  const ns = {
    namespaceId: "ns-1",
    plane: "artifact",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    retentionPolicy: "standard",
    encryptionPolicy: "aes256",
    residencyPolicy: "us",
    createdAt: now,
    updatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[binding], [binding], [ns]],
    queryOneRows: [binding, undefined, ns, undefined],
  });
  const repo = new AsyncOrganizationRepository(connection);

  await repo.upsertDeploymentBindingRecord(binding as any);
  await repo.upsertDataNamespaceRecord(ns as any);
  assert.equal(await repo.getDeploymentBindingRecord("binding-1"), binding);
  assert.equal(await repo.getDeploymentBindingRecord("missing-binding"), null);
  assert.deepEqual(await repo.listDeploymentBindings({ tenantId: "tenant-a" }), [binding]);
  assert.deepEqual(await repo.listDeploymentBindings({}), [binding]);
  assert.equal(await repo.getDataNamespaceRecord("ns-1"), ns);
  assert.equal(await repo.getDataNamespaceRecord("missing-ns"), null);
  assert.deepEqual(await repo.listDataNamespaces({ plane: "artifact" }), [ns]);

  assert.match(calls[0]!.sql, /INSERT INTO deployment_bindings/);
  assert.match(calls[1]!.sql, /INSERT INTO data_namespaces/);
});

test("AsyncPromptRepository writes and reads prompt bundles", async () => {
  const bundle = {
    bundleId: "bundle-1",
    name: "routing_prompt",
    version: "1.0.0",
    domain: "routing",
    taskType: "task_run",
    packId: null,
    systemPromptContent: "You are a router",
    userPromptContent: "Route this task",
    fewShotExamplesJson: null,
    constraintsJson: "{}",
    metadataJson: "{}",
    deprecated: 0,
    createdAt: now,
    updatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryOneRows: [bundle, undefined, bundle, undefined],
  });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptBundle(bundle as any);
  const updated = await repo.updatePromptBundle({ bundleId: "bundle-1", version: "1.1.0", updatedAt: now } as any);
  assert.equal(updated, 1);
  assert.equal(await repo.getPromptBundle("bundle-1"), bundle);
  assert.equal(await repo.getPromptBundle("missing-bundle"), null);
  assert.equal(await repo.getPromptBundleByNameVersion("routing_prompt", "1.0.0"), bundle);
  assert.equal(await repo.getPromptBundleByNameVersion("missing", "1.0.0"), null);

  assert.match(calls[0]!.sql, /INSERT INTO prompt_bundles/);
  assert.match(calls[1]!.sql, /UPDATE prompt_bundles SET/);
  assert.match(calls[1]!.sql, /version = \$2/);
  assert.match(calls[2]!.sql, /FROM prompt_bundles WHERE bundle_id = \$1/);
});

test("AsyncPromptRepository lists prompt bundles by domain and active bundles", async () => {
  const bundle = {
    bundleId: "bundle-1",
    name: "routing_prompt",
    version: "1.0.0",
    domain: "routing",
    taskType: "task_run",
    packId: null,
    systemPromptContent: "You are a router",
    userPromptContent: null,
    fewShotExamplesJson: null,
    constraintsJson: "{}",
    metadataJson: "{}",
    deprecated: 0,
    createdAt: now,
    updatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    queryRows: [[bundle], [bundle], [bundle]],
  });
  const repo = new AsyncPromptRepository(connection);

  assert.deepEqual(await repo.listPromptBundlesByDomain("routing"), [bundle]);
  assert.deepEqual(await repo.listPromptBundlesByDomain("routing", "task_run"), [bundle]);
  assert.deepEqual(await repo.listActivePromptBundles(), [bundle]);

  assert.match(calls[0]!.sql, /WHERE domain = \$1 AND deprecated = false/);
  assert.match(calls[1]!.sql, /WHERE domain = \$1 AND task_type = \$2 AND deprecated = false/);
});

test("AsyncPromptRepository writes and reads prompt versions", async () => {
  const version = {
    versionId: "ver-1",
    bundleId: "bundle-1",
    version: "1.0.0",
    isCurrent: 1,
    trafficWeight: 100,
    trafficAllocationJson: null,
    createdAt: now,
    deprecatedAt: null,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1],
    queryRows: [[version]],
    queryOneRows: [version, undefined, version, undefined],
  });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptVersion(version as any);
  await repo.setCurrentVersion("bundle-1", "ver-1");
  assert.equal(await repo.getPromptVersion("ver-1"), version);
  assert.equal(await repo.getPromptVersion("missing-ver"), null);
  assert.deepEqual(await repo.listPromptVersions("bundle-1"), [version]);
  assert.equal(await repo.getCurrentVersion("bundle-1"), version);
  assert.equal(await repo.getCurrentVersion("missing-bundle"), null);

  assert.match(calls[0]!.sql, /INSERT INTO prompt_versions/);
  assert.match(calls[1]!.sql, /BEGIN/);
  assert.match(calls[2]!.sql, /UPDATE prompt_versions SET is_current = false WHERE bundle_id = \$1/);
  assert.match(calls[3]!.sql, /UPDATE prompt_versions SET is_current = true WHERE version_id = \$1/);
});

test("AsyncPromptRepository writes and reads prompt AB tests", async () => {
  const test = {
    testId: "test-1",
    bundleId: "bundle-1",
    testName: "Routing v1 vs v2",
    controlVersion: "1.0.0",
    treatmentVersion: "1.1.0",
    trafficSplitPercent: 50,
    status: "running",
    startTime: now,
    endTime: null,
    metricsJson: '{"accuracy":0.95}',
    resultsJson: null,
    createdAt: now,
    updatedAt: now,
  } as const;
  const { connection, calls } = createConnection({
    executeResults: [1, 1],
    queryRows: [[test], [test]],
    queryOneRows: [test, undefined],
  });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptAbTest(test as any);
  const updated = await repo.updatePromptAbTest({
    testId: "test-1",
    status: "completed",
    resultsJson: '{"winner":"treatment"}',
    updatedAt: now,
  } as any);
  assert.equal(updated, 1);
  assert.equal(await repo.getPromptAbTest("test-1"), test);
  assert.equal(await repo.getPromptAbTest("missing-test"), null);
  assert.deepEqual(await repo.listPromptAbTestsByBundle("bundle-1"), [test]);
  assert.deepEqual(await repo.listActiveAbTests(), [test]);

  assert.match(calls[0]!.sql, /INSERT INTO prompt_ab_tests/);
  assert.match(calls[1]!.sql, /UPDATE prompt_ab_tests SET/);
  assert.match(calls[1]!.sql, /status = \$2/);
  assert.match(calls[2]!.sql, /FROM prompt_ab_tests WHERE test_id = \$1/);
});

test("AsyncTenantRepository writes and reads tenants with quotas and billing", async () => {
  const tenant: TenantRecord = {
    tenantId: "tenant-a",
    displayName: "Tenant A",
    status: "active",
    billingPlan: "pro",
    slaLevel: "standard",
    allowedRegionsJson: '["us-east-1"]',
    quotasJson: '{"tasks":1000}',
    metadataJson: "{}",
    createdAt: now,
    updatedAt: now,
  };
  const quota: TenantQuotaRecord = {
    quotaId: "quota-1",
    tenantId: "tenant-a",
    resourceType: "tasks",
    monthlyLimit: 1000,
    currentUsage: 500,
    alertThreshold: 0.8,
    resetAt: "2026-05-01T00:00:00.000Z",
    createdAt: now,
    updatedAt: now,
  };
  const billing: TenantBillingRecord = {
    billingId: "billing-1",
    tenantId: "tenant-a",
    billingPlan: "pro",
    billingPeriodStart: "2026-04-01T00:00:00.000Z",
    billingPeriodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 99.99,
    currency: "USD",
    status: "pending",
    invoiceUrl: "https://billing.example/invoice-1",
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const { connection, calls } = createConnection({
    executeResults: [1, 1, 1, 1],
    queryRows: [[tenant], [quota], [billing]],
    queryOneRows: [tenant, undefined, quota, undefined, billing],
  });
  const repo = new AsyncTenantRepository(connection);

  await repo.insertTenant(tenant);
  const updatedTenant = await repo.updateTenant({ tenantId: "tenant-a", displayName: "Updated Tenant", status: "suspended", updatedAt: now });
  assert.equal(updatedTenant, 1);
  assert.equal(await repo.getTenant("tenant-a"), tenant);
  assert.equal(await repo.getTenant("missing-tenant"), null);
  assert.deepEqual(await repo.listTenantsByStatus("active"), [tenant]);
  assert.equal(await repo.deleteTenant("tenant-a"), 1);

  await repo.upsertTenantQuota(quota);
  assert.equal(await repo.getTenantQuota("quota-1"), quota);
  assert.equal(await repo.getTenantQuota("missing-quota"), null);
  assert.deepEqual(await repo.listTenantQuotas("tenant-a"), [quota]);
  assert.equal(await repo.updateQuotaUsage("quota-1", 600, now), 1);

  await repo.insertTenantBilling(billing);
  const updatedBilling = await repo.updateTenantBillingStatus({ billingId: "billing-1", status: "paid", paidAt: now, totalCostUsd: 99.99, updatedAt: now });
  assert.equal(updatedBilling, 1);
  assert.equal(await repo.getTenantBilling("billing-1"), billing);
  assert.deepEqual(await repo.listTenantBillingHistory("tenant-a", 5), [billing]);

  assert.match(calls[0]!.sql, /INSERT INTO tenants/);
  assert.match(calls[1]!.sql, /UPDATE tenants SET/);
  assert.match(calls[2]!.sql, /FROM tenants WHERE tenant_id = \$1/);
  assert.match(calls[5]!.sql, /DELETE FROM tenants WHERE tenant_id = \$1/);
  assert.match(calls[6]!.sql, /INSERT INTO tenant_quotas/);
  assert.match(calls[10]!.sql, /UPDATE tenant_quotas SET current_usage = \$1/);
  assert.match(calls[11]!.sql, /INSERT INTO tenant_billing/);
  assert.match(calls[12]!.sql, /UPDATE tenant_billing SET status = \$1/);
});
