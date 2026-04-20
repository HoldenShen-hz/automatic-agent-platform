import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(
    process.execPath,
    [join(process.cwd(), "dist", "src", "cli", "enterprise-capability.js")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
    },
  );
  return JSON.parse(stdout) as T;
}

test("enterprise capability CLI can register readiness, build a summary, and export artifacts", () => {
  const workspace = createTempWorkspace("aa-enterprise-cli-");
  const dbPath = join(workspace, "enterprise-cli.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    store.upsertBillingAccount({
      accountId: "acct-enterprise-cli",
      ownerId: "owner-enterprise-cli",
      workspaceId: "workspace-enterprise-cli",
      planId: "enterprise",
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    db.close();

    const readinessSpecs = [
      ["gateway", "ops_gateway", {}],
      ["artifact_store", "audit_export_store", {}],
      ["external_service", "audit_export_pipeline", { export_ready: true }],
      ["gateway", "identity_gateway", { sso_ready: true }],
      ["worker_fleet", "tenant_scoped_workers", {}],
      ["artifact_store", "tenant_scoped_artifacts", { namespace_ready: true }],
      ["provider", "private_model_provider", {}],
      ["sandbox", "private_network_boundary", { network_ready: true }],
      ["worker_fleet", "enterprise_worker_fleet", {}],
      ["artifact_store", "release_artifacts", { artifact_namespace_ready: true }],
      ["gateway", "incident_console_gateway", {}],
      ["notification_channel", "oncall_notifications", { webhook_ready: true }],
      ["artifact_store", "residency_store", { artifact_namespace_ready: true }],
      ["external_service", "residency_controls", { attestation_ready: true }],
      ["external_service", "scim_bridge", { scim_ready: true }],
    ] as const;

    for (const [componentType, componentId, secondaryGates] of readinessSpecs) {
      const record = runCli<{ readinessId: string }>({
        AA_DB_PATH: dbPath,
        AA_ENTERPRISE_ACTION: "register_readiness",
        AA_ENVIRONMENT: "prod",
        AA_COMPONENT_TYPE: componentType,
        AA_COMPONENT_ID: componentId,
        AA_CREDENTIAL_READY: "true",
        AA_SECONDARY_GATES_JSON: JSON.stringify(secondaryGates),
        AA_OWNER: "ops.team",
      });
      assert.ok(record.readinessId.length > 0);
    }

    const summary = runCli<{ report: { summary: { overallVerdict: string } } }>({
      AA_DB_PATH: dbPath,
      AA_ENTERPRISE_ACTION: "summary",
      AA_ACCOUNT_ID: "acct-enterprise-cli",
      AA_ENVIRONMENT: "prod",
      AA_DEPLOYMENT_MODE: "private_cloud",
    });
    assert.equal(summary.report.summary.overallVerdict, "ready");

    const exported = runCli<{ jsonArtifact: { uri: string }; markdownArtifact: { uri: string } }>({
      AA_DB_PATH: dbPath,
      AA_ENTERPRISE_ACTION: "export",
      AA_ACCOUNT_ID: "acct-enterprise-cli",
      AA_ENVIRONMENT: "prod",
      AA_DEPLOYMENT_MODE: "private_cloud",
      AA_ARTIFACT_ROOT: artifactRoot,
    });
    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));

    const db2 = new SqliteDatabase(dbPath);
    db2.migrate();
    const store2 = new AuthoritativeTaskStore(db2);
    assert.equal(store2.listEnvironmentReadinessRecords("prod").length >= 10, true);
    assert.equal(store2.listEnterpriseCapabilityReports(10).length >= 1, true);
    db2.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("enterprise capability CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("enterprise-capability.js", {
    AA_DB_PATH: "/tmp/enterprise-postgres.db",
    AA_ENTERPRISE_ACTION: "list_reports",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
