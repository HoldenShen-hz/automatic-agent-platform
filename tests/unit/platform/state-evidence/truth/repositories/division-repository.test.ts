import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DivisionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/division-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { DataMovementJobRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function setupParentRecords(db: SqliteDatabase, now: string): void {
  // Create organizations first (no dependencies)
  db.connection.exec(`
    INSERT INTO organizations (organization_id, display_name, created_at, updated_at)
    VALUES ('org-1', 'Org 1', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO organizations (organization_id, display_name, created_at, updated_at)
    VALUES ('org-2', 'Org 2', '${now}', '${now}')
  `);

  // Create tenants (depends on organizations)
  db.connection.exec(`
    INSERT INTO tenants (tenant_id, organization_id, storage_scope, identity_scope, policy_scope, artifact_scope, isolation_mode, deployment_mode, created_at, updated_at)
    VALUES ('tenant-1', 'org-1', 'standard', 'standard', 'standard', 'standard', 'shared', 'standard', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO tenants (tenant_id, organization_id, storage_scope, identity_scope, policy_scope, artifact_scope, isolation_mode, deployment_mode, created_at, updated_at)
    VALUES ('tenant-2', 'org-2', 'standard', 'standard', 'standard', 'standard', 'shared', 'standard', '${now}', '${now}')
  `);

  // Create workspaces (depends on organizations)
  db.connection.exec(`
    INSERT INTO workspaces (workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at)
    VALUES ('ws-1', 'owner-1', 'Workspace 1', 'plan-1', '{}', 'org-1', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO workspaces (workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at)
    VALUES ('ws-2', 'owner-2', 'Workspace 2', 'plan-1', '{}', 'org-2', '${now}', '${now}')
  `);

  // Create data namespaces (depends on tenants, organizations, workspaces)
  db.connection.exec(`
    INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
    VALUES ('ns-source-1', 'aws', 'tenant-1', 'org-1', 'ws-1', 'standard', 'standard', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
    VALUES ('ns-target-1', 'gcp', 'tenant-1', 'org-1', 'ws-1', 'standard', 'standard', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
    VALUES ('ns-source-2', 'aws', 'tenant-2', 'org-2', 'ws-2', 'standard', 'standard', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
    VALUES ('ns-target-2', 'azure', 'tenant-2', 'org-2', 'ws-2', 'standard', 'standard', '${now}', '${now}')
  `);
}

test("DivisionRepository listDataMovementJobRecords returns all jobs without filter", () => {
  const workspace = createTempWorkspace("aa-division-repo-");
  const dbPath = join(workspace, "division-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DivisionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    setupParentRecords(db, now);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-1', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'analytics_etl', '[]', 'completed', '${now}', '${now}', '{}')
    `);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-2', 'tenant-2', 'org-2', 'ws-2', 'ns-source-2', 'ns-target-2', 'aws', 'azure', 'archive_compaction', '[]', 'running', '${now}', NULL, NULL)
    `);

    const results = repo.listDataMovementJobRecords();
    assert.equal(results.length, 2, "should return 2 jobs");
  } finally {
    cleanupPath(workspace);
  }
});

test("DivisionRepository listDataMovementJobRecords with status filter works", () => {
  const workspace = createTempWorkspace("aa-division-repo-");
  const dbPath = join(workspace, "division-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DivisionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    setupParentRecords(db, now);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-status-1', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'analytics_etl', '[]', 'completed', '${now}', '${now}', '{}')
    `);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-status-2', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'analytics_etl', '[]', 'running', '${now}', NULL, NULL)
    `);

    const completedResults = repo.listDataMovementJobRecords({ status: "completed" });
    assert.equal(completedResults.length, 1, "should return 1 completed job");
    assert.equal(completedResults[0]?.jobId, "job-status-1");

    const runningResults = repo.listDataMovementJobRecords({ status: "running" });
    assert.equal(runningResults.length, 1, "should return 1 running job");
    assert.equal(runningResults[0]?.jobId, "job-status-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("DivisionRepository listDataMovementJobRecords with movementType filter works", () => {
  const workspace = createTempWorkspace("aa-division-repo-");
  const dbPath = join(workspace, "division-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DivisionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    setupParentRecords(db, now);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-type-1', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'analytics_etl', '[]', 'completed', '${now}', '${now}', '{}')
    `);

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-type-2', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'archive_compaction', '[]', 'completed', '${now}', '${now}', '{}')
    `);

    const etlResults = repo.listDataMovementJobRecords({ movementType: "analytics_etl" });
    assert.equal(etlResults.length, 1, "should return 1 analytics_etl job");
    assert.equal(etlResults[0]?.jobId, "job-type-1");

    const archiveResults = repo.listDataMovementJobRecords({ movementType: "archive_compaction" });
    assert.equal(archiveResults.length, 1, "should return 1 archive_compaction job");
    assert.equal(archiveResults[0]?.jobId, "job-type-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("DivisionRepository listDataMovementJobRecords with limit works", () => {
  const workspace = createTempWorkspace("aa-division-repo-");
  const dbPath = join(workspace, "division-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DivisionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    setupParentRecords(db, now);

    for (let i = 1; i <= 5; i++) {
      db.connection.exec(`
        INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
        VALUES ('job-limit-${i}', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'aws', 'gcp', 'analytics_etl', '[]', 'completed', '${now}', '${now}', '{}')
      `);
    }

    const results = repo.listDataMovementJobRecords({ limit: 3 });
    assert.equal(results.length, 3, "should return only 3 jobs");
  } finally {
    cleanupPath(workspace);
  }
});

test("DivisionRepository column mapping snake_case to camelCase is correct", () => {
  const workspace = createTempWorkspace("aa-division-repo-");
  const dbPath = join(workspace, "division-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DivisionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    setupParentRecords(db, now);

    const finishedAt = "2026-04-14T12:00:00.000Z";

    db.connection.exec(`
      INSERT INTO data_movement_jobs (job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id, source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json)
      VALUES ('job-cols', 'tenant-1', 'org-1', 'ws-1', 'ns-source-1', 'ns-target-1', 'azure', 'aws', 'replay_dataset_build', '["ref1","ref2"]', 'failed', '${now}', '${finishedAt}', '{"error":"timeout"}')
    `);

    const results = repo.listDataMovementJobRecords();
    assert.equal(results.length, 1);
    const job = results[0]!;
    assert.equal(job.jobId, "job-cols");
    assert.equal(job.tenantId, "tenant-1");
    assert.equal(job.organizationId, "org-1");
    assert.equal(job.workspaceId, "ws-1");
    assert.equal(job.sourceNamespaceId, "ns-source-1");
    assert.equal(job.targetNamespaceId, "ns-target-1");
    assert.equal(job.sourcePlane, "azure");
    assert.equal(job.targetPlane, "aws");
    assert.equal(job.movementType, "replay_dataset_build");
    assert.equal(job.inputRefsJson, '["ref1","ref2"]');
    assert.equal(job.status, "failed");
    assert.equal(job.finishedAt, finishedAt);
    assert.equal(job.reportJson, '{"error":"timeout"}');
  } finally {
    cleanupPath(workspace);
  }
});
