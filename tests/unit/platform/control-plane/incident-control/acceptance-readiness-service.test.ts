import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { AcceptanceReadinessService } from "../../../../../src/platform/five-plane-control-plane/incident-control/acceptance-readiness-service.js";
import { SecretManagementService } from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const REPO_ROOT = process.cwd();

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "acceptance-readiness.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

function seedReadyEnvironment(store: AuthoritativeTaskStore, environment: "test" | "staging" | "pre-prod" | "prod", verifiedAt: string): void {
  const componentTypes = environment === "test"
    ? (["provider", "sandbox"] as const)
    : (["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"] as const);
  for (const componentType of componentTypes) {
    store.upsertEnvironmentReadinessRecord({
      readinessId: `${environment}-${componentType}`,
      environment,
      componentType,
      componentId: `${environment}-${componentType}`,
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: verifiedAt,
      isActive: 1,
      notes: null,
    });
  }
}

function upsertTenantForEnvironment(store: AuthoritativeTaskStore, environmentId: string): void {
  const timestamp = nowIso();
  store.upsertOrganizationRecord({
    organizationId: `org-${environmentId}`,
    displayName: `Organization ${environmentId}`,
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  store.upsertTenantRecord({
    tenantId: `tenant-${environmentId}`,
    organizationId: `org-${environmentId}`,
    storageScope: `tenant.${environmentId}.storage`,
    identityScope: `tenant.${environmentId}.identity`,
    policyScope: `tenant.${environmentId}.policy`,
    artifactScope: `tenant.${environmentId}.artifact`,
    isolationMode: "shared_hard_scoped",
    deploymentMode: "private_cloud",
    quotas: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function seedManagedEnvironmentSecrets(
  store: AuthoritativeTaskStore,
  environment: "dev" | "test" | "staging" | "pre-prod" | "prod",
): void {
  const createdAt = nowIso();
  store.upsertSecretRegistryRecord({
    secretRef: `secret://system/registry/ghcr/${environment}`,
    displayName: `Registry ${environment}`,
    category: "tenant_credential",
    providerKind: "environment",
    scopeType: "system",
    scopeRef: `registry.ghcr.${environment}`,
    status: "active",
    rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false }),
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: createdAt,
    nextRotationDueAt: null,
    createdAt,
    updatedAt: createdAt,
  });
  store.upsertSecretRegistryRecord({
    secretRef: `secret://system/deploy/kubeconfig/${environment}`,
    displayName: `Deploy ${environment}`,
    category: "db_connection_secret",
    providerKind: "environment",
    scopeType: "system",
    scopeRef: `deploy.kubeconfig.${environment}`,
    status: "active",
    rotationPolicyJson: JSON.stringify({ cadenceDays: 14, ttlMinutes: 30, breakGlass: true }),
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: createdAt,
    nextRotationDueAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function seedDeploymentBindings(store: AuthoritativeTaskStore): void {
  for (const environmentId of ["staging", "pre-prod", "prod"] as const) {
    upsertTenantForEnvironment(store, environmentId);
    store.upsertDeploymentBindingRecord({
      bindingId: `binding-${environmentId}`,
      tenantId: `tenant-${environmentId}`,
      environmentId,
      deploymentMode: "private_cloud",
      region: "cn-shanghai-1",
      networkBoundary: `vpc-${environmentId}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

function writeEvidenceState(
  evidenceRoot: string,
  options: {
    sequenceCompleted: boolean;
    activeProfileName: "24h" | "72h" | null;
    profiles: Array<{
      profileName: "24h" | "72h";
      completed: boolean;
      passed: boolean | null;
      updatedAt: string | null;
    }>;
  },
): void {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(
    join(evidenceRoot, "stable-evidence-sequence-state.json"),
    JSON.stringify({
      sequenceId: "stable_evidence_sequence_test",
      evidenceRootDir: evidenceRoot,
      profileNames: ["24h", "72h"],
      activeProfileName: options.activeProfileName,
      completed: options.sequenceCompleted,
      blocked: false,
      blockReason: null,
      startedAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
      profiles: options.profiles.map((profile) => ({
        profileName: profile.profileName,
        outputDir: join(evidenceRoot, profile.profileName),
        campaignStatePath: join(evidenceRoot, profile.profileName, "stable-evidence-campaign-state.json"),
        finalEvidenceReportPath: join(evidenceRoot, profile.profileName, "stable-evidence-report.json"),
        startedAt: "2026-04-14T00:00:00.000Z",
        updatedAt: profile.updatedAt,
        completed: profile.completed,
        passed: profile.passed,
        accumulatedDurationMs: profile.completed ? 1000 : 500,
        remainingDurationMs: profile.completed ? 0 : 500,
        accumulatedWallClockDurationMs: profile.completed ? 1000 : 500,
        remainingWallClockDurationMs: profile.completed ? 0 : 500,
        segmentCount: profile.completed ? 2 : 1,
      })),
    }, null, 2),
  );
}

function seedReleaseExecution(store: AuthoritativeTaskStore, environment: "dev" | "test" | "staging" | "pre-prod" | "prod"): void {
  const timestamp = nowIso();
  store.insertReleaseExecutionReportRecord({
    executionId: "release-execution-1",
    bundleId: "release-bundle-1",
    environment,
    version: "1.2.3",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    rolloutStrategy: "rolling",
    imageRef: "ghcr.io/example/automatic-agent:1.2.3",
    imageRepository: "automatic-agent",
    registrySecretRef: `secret://system/registry/ghcr/${environment}`,
    registrySecretProviderKind: "environment",
    registrySecretResolved: 1,
    registrySecretAccessMode: "lease",
    registryLeaseId: "lease-1",
    registryLeaseStatus: "active",
    registryLeaseExpiresAt: timestamp,
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: "700000001",
    publishWorkflowRunUrl: "https://github.com/example/actions/runs/700000001",
    buildCommand: "docker build -t example .",
    publishCommand: "gh workflow run publish-image.yml",
    commandResultsJson: JSON.stringify([{ step: "publish_workflow", exitCode: 0 }]),
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: timestamp,
    exportedAt: timestamp,
  });
}

function seedDeploymentExecution(store: AuthoritativeTaskStore, environment: "dev" | "test" | "staging" | "pre-prod" | "prod"): void {
  const timestamp = nowIso();
  store.insertDeploymentExecutionReportRecord({
    executionId: "deployment-execution-1",
    environment,
    version: "1.2.3",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    rolloutStrategy: "rolling",
    targetEligible: 1,
    configBundleRef: "config-bundle://runtime/prod",
    configVersionId: "config-v1",
    registrySecretRef: `secret://system/registry/ghcr/${environment}`,
    registrySecretProviderKind: "environment",
    registrySecretResolved: 1,
    deploymentSecretRef: `secret://system/deploy/kubeconfig/${environment}`,
    deploymentSecretProviderKind: "environment",
    deploymentSecretResolved: 1,
    publishWorkflowRunId: "700000002",
    publishWorkflowRunUrl: "https://github.com/example/actions/runs/700000002",
    deployWorkflowRunId: "700000003",
    deployWorkflowRunUrl: "https://github.com/example/actions/runs/700000003",
    executionMode: "execute",
    publishCommand: "gh workflow run publish-image.yml",
    deployCommand: "gh workflow run deploy-environment.yml",
    commandResultsJson: JSON.stringify([{ step: "deploy", exitCode: 0 }]),
    releaseBundleId: "release-bundle-1",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: timestamp,
    exportedAt: timestamp,
  });
}

test("acceptance readiness service reflects the current todo conclusion with 72h evidence still running while external blockers keep readiness blocked", async () => {
  const harness = createHarness("aa-acceptance-readiness-in-progress-");
  try {
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: false,
      activeProfileName: "72h",
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: false, passed: null, updatedAt: "2026-04-15T08:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T08:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_BUILD_COMMIT: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: join(REPO_ROOT, "data", "sqlite", "acceptance-readiness-shadow.db"),
      },
      observedStorageDriver: "sqlite",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    assert.equal(report.overallStatus, "blocked");
    assert.equal(report.currentFocusItemId, "P1A-EVID-72");
    assert.equal(report.stableEvidence.status, "in_progress");
    assert.equal(report.registryPublish.status, "blocked_on_external_infra");
    assert.equal(report.multiEnvironmentDeployment.status, "blocked");
    assert.equal(report.postgresAuthoritativeStore.status, "blocked_on_external_infra");
    assert.ok(report.recommendedNextActions.some((item) => item.includes("P1A-EVID-72")));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service reflects blocked stable evidence when 24h profile fails", async () => {
  const harness = createHarness("aa-acceptance-readiness-blocked-24h-");
  try {
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: false,
      activeProfileName: "24h",
      profiles: [
        { profileName: "24h", completed: true, passed: false, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: false, passed: null, updatedAt: null },
      ],
    });

    const verifiedAt = "2026-04-14T12:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_BUILD_COMMIT: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        AA_STORAGE_DRIVER: "sqlite",
      },
      observedStorageDriver: "sqlite",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    assert.equal(report.overallStatus, "blocked");
    assert.equal(report.currentFocusItemId, "P1A-EVID-72");
    // When 24h fails but 72h hasn't run yet, status is in_progress (not blocked)
    // because sequenceBlocked only becomes true when ALL completed profiles have passed=false
    // Since 72h is still pending (completed=false), sequenceBlocked = false
    assert.equal(report.stableEvidence.status, "in_progress");
    assert.equal(report.stableEvidence.sequenceBlocked, false);
    assert.ok(report.stableEvidence.blockers.includes("stable_24h_evidence_missing_or_unpassed"));
    // sequence_blocked is NOT present because 72h profile hasn't completed yet
    assert.ok(!report.stableEvidence.blockers.includes("stable_evidence_sequence_blocked"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service reflects in_progress when evidence collection is active but incomplete", async () => {
  const harness = createHarness("aa-acceptance-readiness-in-progress-");
  try {
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: false,
      activeProfileName: "72h",
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: false, passed: null, updatedAt: "2026-04-15T08:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T08:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_STORAGE_DRIVER: "sqlite",
      },
      observedStorageDriver: "sqlite",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    assert.equal(report.stableEvidence.status, "in_progress");
    assert.equal(report.stableEvidence.activeProfileName, "72h");
    assert.equal(report.stableEvidence.profiles[0]?.profileName, "24h");
    assert.equal(report.stableEvidence.profiles[1]?.profileName, "72h");
    // overallStatus should be blocked because other items (postgres, registry, deployment) are blocked
    assert.equal(report.overallStatus, "blocked");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service reflects blocked registry publish when release execution evidence is missing", async () => {
  const harness = createHarness("aa-acceptance-readiness-registry-blocked-");
  try {
    // Write evidence state with completed 24h/72h to isolate registryPublish blocking
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: true,
      activeProfileName: null,
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: true, passed: true, updatedAt: "2026-04-15T12:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T12:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);
    seedDeploymentExecution(harness.store, "prod");
    // NOTE: NOT seeding releaseExecution - this should cause registryPublish to be blocked_on_external_infra

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_BUILD_COMMIT: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: join(REPO_ROOT, "data", "sqlite", "acceptance-readiness-shadow.db"),
      },
      observedStorageDriver: "postgres",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    // stableEvidence should be ready (both profiles passed)
    assert.equal(report.stableEvidence.status, "ready");
    // postgres should be ready
    assert.equal(report.postgresAuthoritativeStore.status, "ready");
    // registryPublish should be blocked_on_external_infra because bundle builds but no release execution evidence
    assert.equal(report.registryPublish.status, "blocked_on_external_infra");
    assert.ok(report.registryPublish.blockers.includes("live_registry_publish_evidence_missing"));
    // deployment should be ready since we seeded deployment execution
    assert.equal(report.multiEnvironmentDeployment.status, "ready");
    // overallStatus is in_progress because no lineItem has status === "blocked"
    // (registryPublish is "blocked_on_external_infra", not "blocked")
    assert.equal(report.overallStatus, "in_progress");
    assert.equal(report.currentFocusItemId, "IND-P0-09");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service reflects blocked deployment when deployment execution evidence is missing", async () => {
  const harness = createHarness("aa-acceptance-readiness-deployment-blocked-");
  try {
    // Write evidence state with completed 24h/72h to isolate deployment blocking
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: true,
      activeProfileName: null,
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: true, passed: true, updatedAt: "2026-04-15T12:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T12:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);
    seedReleaseExecution(harness.store, "prod");
    // NOTE: NOT seeding deploymentExecution - this should cause multiEnvironmentDeployment to be blocked

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: join(REPO_ROOT, "data", "sqlite", "acceptance-readiness-shadow.db"),
      },
      observedStorageDriver: "postgres",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    // stableEvidence should be ready
    assert.equal(report.stableEvidence.status, "ready");
    // postgres should be ready
    assert.equal(report.postgresAuthoritativeStore.status, "ready");
    // registryPublish should be ready since we seeded release execution
    assert.equal(report.registryPublish.status, "ready");
    // deployment status is "blocked" when buildReport fails and systemPrepared is false
    // (buildDeploymentReport throws when deployment execution evidence is missing in its internal checks)
    assert.equal(report.multiEnvironmentDeployment.status, "blocked");
    assert.ok(report.overallStatus, "blocked");
    assert.equal(report.currentFocusItemId, "IND-P0-10");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service targets staging environment correctly", async () => {
  const harness = createHarness("aa-acceptance-readiness-staging-");
  try {
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: true,
      activeProfileName: null,
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: true, passed: true, updatedAt: "2026-04-15T12:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T12:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);
    seedReleaseExecution(harness.store, "staging");
    seedDeploymentExecution(harness.store, "staging");

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: join(REPO_ROOT, "data", "sqlite", "acceptance-readiness-shadow.db"),
      },
      observedStorageDriver: "postgres",
    });

    const report = await service.buildReport({
      targetEnvironment: "staging",
    });

    assert.equal(report.overallStatus, "ready");
    assert.equal(report.currentFocusItemId, null);
    assert.equal(report.registryPublish.targetEnvironment, "staging");
    assert.equal(report.multiEnvironmentDeployment.targetEnvironment, "staging");
    assert.equal(report.postgresAuthoritativeStore.targetEnvironment, "staging");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("acceptance readiness service reaches ready when evidence and live execution traces are present", async () => {
  const harness = createHarness("aa-acceptance-readiness-ready-");
  try {
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    writeEvidenceState(evidenceRoot, {
      sequenceCompleted: true,
      activeProfileName: null,
      profiles: [
        { profileName: "24h", completed: true, passed: true, updatedAt: "2026-04-14T12:00:00.000Z" },
        { profileName: "72h", completed: true, passed: true, updatedAt: "2026-04-15T12:00:00.000Z" },
      ],
    });

    const verifiedAt = "2026-04-15T12:00:00.000Z";
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
    seedDeploymentBindings(harness.store);
    seedReleaseExecution(harness.store, "prod");
    seedDeploymentExecution(harness.store, "prod");

    const service = new AcceptanceReadinessService(harness.store, {
      repoRootDir: REPO_ROOT,
      evidenceRootDir: evidenceRoot,
      secretManagementService: new SecretManagementService(harness.db, harness.store),
      runtimeEnv: {
        ...process.env,
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: join(REPO_ROOT, "data", "sqlite", "acceptance-readiness-shadow.db"),
      },
      observedStorageDriver: "postgres",
    });

    const report = await service.buildReport({
      targetEnvironment: "prod",
    });

    assert.equal(report.overallStatus, "ready");
    assert.equal(report.currentFocusItemId, null);
    assert.equal(report.stableEvidence.status, "ready");
    assert.equal(report.registryPublish.status, "ready");
    assert.equal(report.multiEnvironmentDeployment.status, "ready");
    assert.equal(report.postgresAuthoritativeStore.status, "ready");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
