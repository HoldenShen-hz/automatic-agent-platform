// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncReleaseRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/release-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type {
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
  DeploymentExecutionReportRecord,
  EnvironmentPromotionHistoryRecord,
  EnterpriseCapabilityReportRecord,
  IncidentHandoffRecord,
  EnterpriseGovernanceReportRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

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

function releaseBundleRecord(overrides: Partial<ReleaseBundleRecord> = {}): ReleaseBundleRecord {
  return {
    bundleId: "bundle-1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    imageTag: "v1.0.0",
    imageRef: "image:latest",
    rolloutStrategy: "canary",
    deploymentNamespace: "default",
    clusterName: "prod-cluster",
    configPath: "/config",
    configBundleRef: "cfg-bundle-1",
    registryCredentialRef: "reg-cred-1",
    deploymentCredentialRef: "deploy-cred-1",
    publishWorkflowPath: "/workflows/publish",
    deployWorkflowPath: "/workflows/deploy",
    requiredReadinessChecksJson: "[]",
    recommendedCommandsJson: "[]",
    taskId: "task-1",
    jsonArtifactUri: "file:///artifacts/bundle.json",
    markdownArtifactUri: "file:///artifacts/bundle.md",
    generatedAt: now,
    exportedAt: now,
    ...overrides,
  };
}

function releaseExecutionReportRecord(overrides: Partial<ReleaseExecutionReportRecord> = {}): ReleaseExecutionReportRecord {
  return {
    executionId: "exec-1",
    bundleId: "bundle-1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "canary",
    imageRef: "image:latest",
    imageRepository: "repo/image",
    registrySecretRef: "reg-secret",
    registrySecretProviderKind: "aws",
    registrySecretResolved: true,
    registrySecretAccessMode: "read-only",
    registryLeaseId: "lease-1",
    registryLeaseStatus: "active",
    registryLeaseExpiresAt: now,
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: "run-1",
    publishWorkflowRunUrl: "https://ci.example.com/run/1",
    buildCommand: "npm run build",
    publishCommand: "npm run publish",
    commandResultsJson: "{}",
    taskId: "task-1",
    jsonArtifactUri: "file:///artifacts/report.json",
    markdownArtifactUri: "file:///artifacts/report.md",
    generatedAt: now,
    exportedAt: now,
    ...overrides,
  };
}

function deploymentExecutionReportRecord(overrides: Partial<DeploymentExecutionReportRecord> = {}): DeploymentExecutionReportRecord {
  return {
    executionId: "exec-1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "canary",
    targetEligible: true,
    configBundleRef: "cfg-bundle-1",
    configVersionId: "cfg-ver-1",
    registrySecretRef: "reg-secret",
    registrySecretProviderKind: "aws",
    registrySecretResolved: true,
    deploymentSecretRef: "deploy-secret",
    deploymentSecretProviderKind: "aws",
    deploymentSecretResolved: true,
    publishWorkflowRunId: "run-1",
    publishWorkflowRunUrl: "https://ci.example.com/run/1",
    deployWorkflowRunId: "run-2",
    deployWorkflowRunUrl: "https://ci.example.com/run/2",
    executionMode: "automated",
    publishCommand: "npm run publish",
    deployCommand: "npm run deploy",
    commandResultsJson: "{}",
    releaseBundleId: "bundle-1",
    taskId: "task-1",
    jsonArtifactUri: "file:///artifacts/report.json",
    markdownArtifactUri: "file:///artifacts/report.md",
    generatedAt: now,
    exportedAt: now,
    ...overrides,
  };
}

function environmentPromotionHistoryRecord(overrides: Partial<EnvironmentPromotionHistoryRecord> = {}): EnvironmentPromotionHistoryRecord {
  return {
    promotionId: "promo-1",
    sourceEnvironment: "staging",
    targetEnvironment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "canary",
    decisionType: "automatic",
    decisionStatus: "approved",
    releaseBundleId: "bundle-1",
    deploymentExecutionId: "exec-1",
    reasonCode: "all_checks_passed",
    actor: "system",
    metadataJson: "{}",
    recordedAt: now,
    ...overrides,
  };
}

function enterpriseCapabilityReportRecord(overrides: Partial<EnterpriseCapabilityReportRecord> = {}): EnterpriseCapabilityReportRecord {
  return {
    reportId: "cap-report-1",
    accountId: "account-1",
    workspaceId: "ws-1",
    tenantId: "tenant-1",
    environment: "production",
    deploymentMode: "saas",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: now,
    ...overrides,
  };
}

function incidentHandoffRecord(overrides: Partial<IncidentHandoffRecord> = {}): IncidentHandoffRecord {
  return {
    handoffId: "handoff-1",
    incidentId: "incident-1",
    environment: "production",
    status: "pending",
    shiftOwner: "oncall-1",
    primaryOncall: "primary-1",
    secondaryOncall: "secondary-1",
    severity: "high",
    handoffJson: "{}",
    createdAt: now,
    ...overrides,
  };
}

function enterpriseGovernanceReportRecord(overrides: Partial<EnterpriseGovernanceReportRecord> = {}): EnterpriseGovernanceReportRecord {
  return {
    reportId: "gov-report-1",
    taskId: "task-1",
    environment: "production",
    status: "pending",
    shiftOwner: "oncall-1",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: now,
    handoffId: null,
    ...overrides,
  };
}

// === Release Bundle Tests ===

test("AsyncReleaseRepository insertReleaseBundleRecord inserts record", async () => {
  const record = releaseBundleRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertReleaseBundleRecord(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO release_bundles/);
});

test("AsyncReleaseRepository getReleaseBundleRecord returns record when found", async () => {
  const record = releaseBundleRecord();
  const { connection, calls } = createConnection({ queryOneRows: [record] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.getReleaseBundleRecord("bundle-1");

  assert.deepEqual(result, record);
  assert.match(calls[0]!.sql, /FROM release_bundles/);
  assert.match(calls[0]!.sql, /WHERE bundle_id = \$1/);
});

test("AsyncReleaseRepository getReleaseBundleRecord returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.getReleaseBundleRecord("bundle-missing");

  assert.equal(result, null);
});

test("AsyncReleaseRepository listReleaseBundleRecords returns all bundles", async () => {
  const record = releaseBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[record]] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.listReleaseBundleRecords();

  assert.deepEqual(result, [record]);
  assert.match(calls[0]!.sql, /FROM release_bundles/);
});

test("AsyncReleaseRepository listReleaseBundleRecords filters by environment", async () => {
  const record = releaseBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[record]] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.listReleaseBundleRecords({ environment: "production" });

  assert.deepEqual(result, [record]);
  assert.match(calls[0]!.sql, /WHERE environment IS \$1/);
});

// === Release Execution Report Tests ===

test("AsyncReleaseRepository insertReleaseExecutionReportRecord inserts record", async () => {
  const record = releaseExecutionReportRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertReleaseExecutionReportRecord(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO release_execution_reports/);
});

// === Deployment Execution Report Tests ===

test("AsyncReleaseRepository insertDeploymentExecutionReportRecord inserts record", async () => {
  const record = deploymentExecutionReportRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertDeploymentExecutionReportRecord(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO deployment_execution_reports/);
});

// === Environment Promotion History Tests ===

test("AsyncReleaseRepository insertEnvironmentPromotionHistoryRecord inserts record", async () => {
  const record = environmentPromotionHistoryRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertEnvironmentPromotionHistoryRecord(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO environment_promotion_history/);
});

// === Enterprise Capability Report Tests ===

test("AsyncReleaseRepository insertEnterpriseCapabilityReport inserts record", async () => {
  const record = enterpriseCapabilityReportRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertEnterpriseCapabilityReport(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO enterprise_capability_reports/);
});

test("AsyncReleaseRepository listEnterpriseCapabilityReports returns reports", async () => {
  const record = enterpriseCapabilityReportRecord();
  const { connection, calls } = createConnection({ queryRows: [[record]] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.listEnterpriseCapabilityReports();

  assert.deepEqual(result, [record]);
  assert.match(calls[0]!.sql, /FROM enterprise_capability_reports/);
  assert.match(calls[0]!.sql, /ORDER BY generated_at DESC/);
});

// === Incident Handoff Record Tests ===

test("AsyncReleaseRepository insertIncidentHandoffRecord inserts record", async () => {
  const record = incidentHandoffRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertIncidentHandoffRecord(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO incident_handoff_records/);
});

test("AsyncReleaseRepository listIncidentHandoffRecords returns records", async () => {
  const record = incidentHandoffRecord();
  const { connection, calls } = createConnection({ queryRows: [[record]] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.listIncidentHandoffRecords();

  assert.deepEqual(result, [record]);
  assert.match(calls[0]!.sql, /FROM incident_handoff_records/);
});

// === Enterprise Governance Report Tests ===

test("AsyncReleaseRepository insertEnterpriseGovernanceReport inserts record", async () => {
  const record = enterpriseGovernanceReportRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncReleaseRepository(connection);

  await repo.insertEnterpriseGovernanceReport(record);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO enterprise_governance_reports/);
});

test("AsyncReleaseRepository listEnterpriseGovernanceReports returns reports", async () => {
  const record = enterpriseGovernanceReportRecord();
  const { connection, calls } = createConnection({ queryRows: [[record]] });
  const repo = new AsyncReleaseRepository(connection);

  const result = await repo.listEnterpriseGovernanceReports();

  assert.deepEqual(result, [record]);
  assert.match(calls[0]!.sql, /FROM enterprise_governance_reports/);
});