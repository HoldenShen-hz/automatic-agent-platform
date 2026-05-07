import assert from "node:assert/strict";
import test from "node:test";

import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { AsyncReleaseRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/release-repository.js";

function createConnectionRecorder(): {
  readonly statements: Array<{ sql: string; params: unknown[] }>;
  readonly conn: AsyncSqlConnection;
} {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  return {
    statements,
    conn: {
      async query<T>(_sql: string, ..._params: unknown[]): Promise<AsyncQueryResult<T>> {
        return { rows: [], rowCount: 0 };
      },
      async queryOne<T>(_sql: string, ..._params: unknown[]): Promise<T | undefined> {
        return undefined;
      },
      async execute(sql: string, ...params: unknown[]): Promise<number> {
        statements.push({ sql, params });
        return 1;
      },
    },
  };
}

test("AsyncReleaseRepository.insertReleaseBundleRecord uses one placeholder per column", async () => {
  const { statements, conn } = createConnectionRecorder();
  const repository = new AsyncReleaseRepository(conn);

  await repository.insertReleaseBundleRecord({
    bundleId: "bundle_1",
    environment: "prod",
    version: "1.0.0",
    commitSha: "abc123",
    imageTag: "image:1.0.0",
    imageRef: "registry.example.com/image:1.0.0",
    rolloutStrategy: "blue_green",
    deploymentNamespace: "prod",
    clusterName: "cluster-a",
    configPath: "/configs/prod",
    configBundleRef: "config_bundle_1",
    registryCredentialRef: "registry_cred_1",
    deploymentCredentialRef: "deployment_cred_1",
    publishWorkflowPath: "/publish.yml",
    deployWorkflowPath: "/deploy.yml",
    requiredReadinessChecksJson: "[]",
    recommendedCommandsJson: "[]",
    taskId: "task_1",
    jsonArtifactUri: "artifact://json",
    markdownArtifactUri: "artifact://md",
    generatedAt: "2026-05-07T00:00:00.000Z",
    exportedAt: "2026-05-07T00:00:01.000Z",
  });

  assert.equal(statements.length, 1);
  assert.match(statements[0]!.sql, /\$22\)/);
  assert.doesNotMatch(statements[0]!.sql, /\$23\b/);
  assert.equal(statements[0]!.params.length, 22);
});

test("AsyncReleaseRepository.insertReleaseExecutionReportRecord includes the exported_at placeholder", async () => {
  const { statements, conn } = createConnectionRecorder();
  const repository = new AsyncReleaseRepository(conn);

  await repository.insertReleaseExecutionReportRecord({
    executionId: "exec_1",
    bundleId: "bundle_1",
    environment: "prod",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "blue_green",
    imageRef: "registry.example.com/image:1.0.0",
    imageRepository: "registry.example.com/image",
    registrySecretRef: "registry_secret_1",
    registrySecretProviderKind: "vault",
    registrySecretResolved: true,
    registrySecretAccessMode: "leased",
    registryLeaseId: "lease_1",
    registryLeaseStatus: "active",
    registryLeaseExpiresAt: null,
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: "run_1",
    publishWorkflowRunUrl: "https://ci.example.test/run/1",
    buildCommand: "npm run build",
    publishCommand: "npm run publish",
    commandResultsJson: "[]",
    taskId: "task_1",
    jsonArtifactUri: "artifact://json",
    markdownArtifactUri: "artifact://md",
    generatedAt: "2026-05-07T00:00:00.000Z",
    exportedAt: "2026-05-07T00:00:01.000Z",
  });

  assert.equal(statements.length, 1);
  assert.match(statements[0]!.sql, /\$26\)/);
  assert.equal(statements[0]!.params.length, 26);
});
