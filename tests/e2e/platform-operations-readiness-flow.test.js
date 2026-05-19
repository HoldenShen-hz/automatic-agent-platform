import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { WorkerRegistryService } from "../../src/platform/execution/worker-pool/worker-registry-service.js";
import { PlatformOperatorService } from "../../src/scale-ecosystem/operations/platform-operator-service.js";
import { ComplianceProgramService } from "../../src/scale-ecosystem/tenant-platform/compliance-program-service.js";
import { HaProgramService } from "../../src/scale-ecosystem/tenant-platform/ha-program-service.js";
import { TenantPlatformService } from "../../src/scale-ecosystem/tenant-platform/tenant-platform-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
function writeSmokeEvidence(root) {
    const dir = join(root, "smoke");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "stable-evidence-report.json"), JSON.stringify({
        profile: { name: "smoke" },
        artifacts: {
            chaosReportPath: join(dir, "chaos-report.json"),
            leaseReportPath: join(dir, "lease-report.json"),
            doctorReportPath: join(dir, "doctor-report.json"),
            acceptanceReportPath: join(dir, "stable-acceptance-line-report.json"),
            backupRestoreReportPath: join(dir, "backup-restore-report.json"),
            backupRestorePlaybookPath: join(dir, "stable-disaster-recovery-playbook.json"),
            rollingUpgradeReportPath: join(dir, "rolling-upgrade-report.json"),
            rollingUpgradePlaybookPath: join(dir, "stable-rolling-upgrade-playbook.json"),
            maintenanceReportPath: join(dir, "maintenance-report.json"),
            maintenancePlaybookPath: join(dir, "stable-maintenance-playbook.json"),
            grayReleaseReportPath: join(dir, "gray-release-report.json"),
            grayReleasePlaybookPath: join(dir, "stable-gray-release-playbook.json"),
            eventReplayReportPath: join(dir, "event-replay-report.json"),
            dbQueueDisconnectReportPath: join(dir, "db-queue-disconnect-report.json"),
            dbWritabilityReportPath: join(dir, "db-writability-report.json"),
            queueDeliveryReportPath: join(dir, "queue-delivery-report.json"),
            migrationCompatibilityReportPath: join(dir, "migration-compatibility-report.json"),
            repairReportPath: join(dir, "repair-report.json"),
            rollbackReportPath: join(dir, "rollback-report.json"),
            takeoverSamplePath: join(dir, "takeover-sample.json"),
        },
        acceptanceLine: {
            evaluatedAt: "2026-04-24T00:00:00.000Z",
            status: "pass",
            profileName: "smoke",
            truthNotes: [],
            criteria: [],
            observed: {
                soakDurationMs: 5_000,
                requiredDurationMs: 5_000,
                longRunCoveragePct: 100,
                manualDbRepairSignalCount: 0,
                orphanQueueClaimCount: 0,
                zombieLockCount: 0,
                recoveryAttemptCount: 1,
                recoverySucceededCount: 1,
                recoverySuccessRatePct: 100,
            },
            latencyBudget: [],
        },
        summary: {
            passed: true,
            chaosPassed: true,
            leasePassed: true,
            concurrencyPassed: true,
            rollbackPassed: true,
            backupRestorePassed: true,
            rollingUpgradePassed: true,
            maintenancePassed: true,
            grayReleasePassed: true,
            eventReplayPassed: true,
            dbQueueDisconnectPassed: true,
            dbWritabilityPassed: true,
            queueDeliveryPassed: true,
            migrationCompatibilityPassed: true,
            doctorStatus: "ok",
            repairAfterStatus: "pass",
            takeoverSampleClosedLoop: true,
        },
    }, null, 2));
}
test("E2E: platform operator exports execution-plane readiness with topology and promotion risks", () => {
    const harness = createE2EHarness("aa-e2e-platform-operator-");
    const evidenceRoot = join(harness.workspace, "stable-evidence");
    const packageOutput = join(harness.workspace, "platform-package");
    const artifactRoot = join(harness.workspace, "operator-artifacts");
    const generatedAt = "2026-04-24T16:00:00.000Z";
    try {
        writeSmokeEvidence(evidenceRoot);
        const tenantPlatform = new TenantPlatformService(harness.db, harness.store);
        const workers = new WorkerRegistryService(harness.store);
        const organization = tenantPlatform.createOrganization({
            organizationId: "org-operator-e2e",
            displayName: "Operator Org",
        });
        const workspace = tenantPlatform.createWorkspace({
            workspaceId: "ws-operator-e2e",
            displayName: "Operator Workspace",
            ownerId: "owner-operator-e2e",
            planId: "enterprise",
            organizationId: organization.organizationId,
        });
        const tenant = tenantPlatform.createTenant({
            tenantId: "tenant-operator-e2e",
            organizationId: organization.organizationId,
            storageScope: "tenant-operator-e2e",
            identityScope: "tenant-operator-e2e",
            policyScope: "tenant-operator-e2e",
            artifactScope: "tenant-operator-e2e",
            setAsOrganizationDefault: true,
        });
        tenantPlatform.createDeploymentBinding({
            bindingId: "binding-operator-e2e",
            tenantId: tenant.tenantId,
            environmentId: "prod",
            region: "cn-mainland",
            networkBoundary: "private",
            deploymentMode: "private_cloud",
        });
        tenantPlatform.createDataNamespace({
            namespaceId: "ns-operator-e2e",
            plane: "transactional",
            tenantId: tenant.tenantId,
            organizationId: organization.organizationId,
            workspaceId: workspace.workspaceId,
            retentionPolicy: "retain_30d",
            encryptionPolicy: "enc_strict",
            residencyPolicy: "cn-mainland",
        });
        harness.store.upsertEnvironmentReadinessRecord({
            readinessId: "provider-ready",
            environment: "prod",
            componentType: "provider",
            componentId: "default_provider",
            credentialReady: 1,
            secondaryGatesJson: JSON.stringify({}),
            owner: "ops.team",
            lastVerifiedAt: generatedAt,
            isActive: 1,
            notes: null,
        });
        harness.store.upsertEnvironmentReadinessRecord({
            readinessId: "gateway-ready",
            environment: "prod",
            componentType: "gateway",
            componentId: "ops_gateway",
            credentialReady: 1,
            secondaryGatesJson: JSON.stringify({}),
            owner: "ops.team",
            lastVerifiedAt: generatedAt,
            isActive: 1,
            notes: null,
        });
        harness.store.upsertEnvironmentReadinessRecord({
            readinessId: "sandbox-ready",
            environment: "prod",
            componentType: "sandbox",
            componentId: "strict_sandbox",
            credentialReady: 1,
            secondaryGatesJson: JSON.stringify({}),
            owner: "ops.team",
            lastVerifiedAt: generatedAt,
            isActive: 1,
            notes: null,
        });
        harness.store.upsertEnvironmentReadinessRecord({
            readinessId: "worker-ready",
            environment: "prod",
            componentType: "worker_fleet",
            componentId: "default_worker_fleet",
            credentialReady: 1,
            secondaryGatesJson: JSON.stringify({}),
            owner: "ops.team",
            lastVerifiedAt: generatedAt,
            isActive: 1,
            notes: null,
        });
        harness.store.upsertEnvironmentReadinessRecord({
            readinessId: "artifact-ready",
            environment: "prod",
            componentType: "artifact_store",
            componentId: "release_artifacts",
            credentialReady: 1,
            secondaryGatesJson: JSON.stringify({ artifact_namespace_ready: true }),
            owner: "ops.team",
            lastVerifiedAt: generatedAt,
            isActive: 1,
            notes: null,
        });
        workers.recordHeartbeat({
            workerId: "worker-operator-healthy",
            status: "idle",
            placement: "local",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 4,
            queueAffinity: "default",
            occurredAt: generatedAt,
        });
        workers.recordHeartbeat({
            workerId: "worker-operator-remote",
            status: "idle",
            placement: "remote",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 2,
            queueAffinity: "default",
            occurredAt: generatedAt,
        });
        const staleHeartbeat = new Date(Date.parse(generatedAt) - 20 * 60 * 1000).toISOString();
        workers.recordHeartbeat({
            workerId: "worker-operator-stale",
            status: "idle",
            placement: "local",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: staleHeartbeat,
        });
        const service = new PlatformOperatorService(harness.db, harness.store, {
            artifactStoreOptions: { rootDir: artifactRoot },
            staleWorkerThresholdMs: 10 * 60 * 1000,
        });
        const exported = service.exportReport({
            environment: "prod",
            evidenceRootDir: evidenceRoot,
            packageOutputDir: packageOutput,
            targetStatus: "production_ready",
            generatedAt,
        });
        const markdown = readFileSync(exported.markdownArtifact.uri, "utf8");
        assert.equal(exported.report.environment, "prod");
        assert.equal(exported.report.targetStatus, "production_ready");
        assert.equal(exported.report.executionPlane.topology.organizations, 1);
        assert.equal(exported.report.executionPlane.topology.workspaces, 1);
        assert.equal(exported.report.executionPlane.topology.tenants, 1);
        assert.equal(exported.report.executionPlane.topology.deploymentBindings, 1);
        assert.equal(exported.report.executionPlane.topology.dataNamespaces, 1);
        assert.equal(exported.report.executionPlane.workerCounts.total, 3);
        assert.equal(exported.report.executionPlane.workerCounts.stale, 1);
        assert.ok(exported.report.executionPlane.staleWorkerIds.includes("worker-operator-stale"));
        assert.ok(exported.report.executionPlane.untrustedWorkerIds.includes("worker-operator-remote"));
        assert.equal(exported.report.promoteEligible, false);
        assert.ok(exported.report.executionPlane.promotionRisks.length > 0);
        assert.ok(existsSync(exported.jsonArtifact.uri));
        assert.ok(existsSync(exported.markdownArtifact.uri));
        assert.ok(markdown.includes("Platform Operator Report"));
        assert.ok(markdown.includes("Promote Eligible: `false`"));
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: compliance and HA program exports summarize tenant residency and HA readiness", () => {
    const harness = createE2EHarness("aa-e2e-compliance-ha-");
    const complianceArtifactRoot = join(harness.workspace, "compliance-artifacts");
    const haArtifactRoot = join(harness.workspace, "ha-artifacts");
    const generatedAt = "2026-04-24T16:10:00.000Z";
    try {
        const tenantPlatform = new TenantPlatformService(harness.db, harness.store);
        const workers = new WorkerRegistryService(harness.store);
        const organization = tenantPlatform.createOrganization({
            organizationId: "org-compliance-ha-e2e",
            displayName: "Compliance HA Org",
        });
        const workspace = tenantPlatform.createWorkspace({
            workspaceId: "ws-compliance-ha-e2e",
            displayName: "Compliance HA Workspace",
            ownerId: "owner-compliance-ha-e2e",
            planId: "enterprise",
            organizationId: organization.organizationId,
        });
        const tenant = tenantPlatform.createTenant({
            tenantId: "tenant-compliance-ha-e2e",
            organizationId: organization.organizationId,
            storageScope: "tenant-compliance-ha-e2e",
            identityScope: "tenant-compliance-ha-e2e",
            policyScope: "tenant-compliance-ha-e2e",
            artifactScope: "tenant-compliance-ha-e2e",
            setAsOrganizationDefault: true,
        });
        tenantPlatform.createDataNamespace({
            namespaceId: "ns-compliance-ha-e2e-1",
            plane: "transactional",
            tenantId: tenant.tenantId,
            organizationId: organization.organizationId,
            workspaceId: workspace.workspaceId,
            retentionPolicy: "retain_30d",
            encryptionPolicy: "enc_standard",
            residencyPolicy: "cn-mainland",
        });
        tenantPlatform.createDataNamespace({
            namespaceId: "ns-compliance-ha-e2e-2",
            plane: "analytics",
            tenantId: tenant.tenantId,
            organizationId: organization.organizationId,
            workspaceId: workspace.workspaceId,
            retentionPolicy: "retain_90d",
            encryptionPolicy: "enc_standard",
            residencyPolicy: "us-east",
        });
        harness.store.insertEnterpriseCapabilityReport({
            reportId: "enterprise-cap-report-e2e",
            accountId: null,
            workspaceId: workspace.workspaceId,
            tenantId: tenant.tenantId,
            environment: "prod",
            deploymentMode: "private_cloud",
            summaryJson: JSON.stringify({ ready: true }),
            reportJson: JSON.stringify({ capability: "enterprise_ready" }),
            generatedAt,
        });
        for (const [readinessId, componentType, componentId] of [
            ["ha-coordinator-ready", "external_service", "ha_coordinator"],
            ["postgres-ready", "external_service", "postgres_primary"],
            ["redis-ready", "external_service", "redis_queue"],
            ["lock-ready", "external_service", "distributed_lock"],
        ]) {
            harness.store.upsertEnvironmentReadinessRecord({
                readinessId,
                environment: "prod",
                componentType,
                componentId,
                credentialReady: 1,
                secondaryGatesJson: JSON.stringify({}),
                owner: "ops.team",
                lastVerifiedAt: generatedAt,
                isActive: 1,
                notes: null,
            });
        }
        workers.recordHeartbeat({
            workerId: "worker-ha-e2e",
            status: "idle",
            placement: "local",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 2,
            queueAffinity: "default",
            occurredAt: generatedAt,
        });
        harness.store.insertTask({
            id: "task-ha-e2e",
            parentId: null,
            rootId: "task-ha-e2e",
            divisionId: "general_ops",
            tenantId: tenant.tenantId,
            title: "HA readiness validation",
            status: "in_progress",
            source: "system",
            priority: "normal",
            inputJson: JSON.stringify({ environment: "prod" }),
            normalizedInputJson: JSON.stringify({ environment: "prod" }),
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: generatedAt,
            updatedAt: generatedAt,
            completedAt: null,
        });
        harness.store.insertExecution({
            id: "exec-ha-e2e",
            taskId: "task-ha-e2e",
            workflowId: "single_agent_minimal",
            parentExecutionId: null,
            agentId: "agent-ha-e2e",
            roleId: "general_executor",
            runKind: "task_run",
            status: "executing",
            inputRef: null,
            traceId: "trace-ha-e2e",
            attempt: 1,
            timeoutMs: 60_000,
            budgetUsdLimit: 1,
            requiresApproval: 0,
            sandboxMode: "workspace_write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 0,
            retryBackoff: "none",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: generatedAt,
            finishedAt: null,
            createdAt: generatedAt,
            updatedAt: generatedAt,
        });
        harness.store.worker.insertExecutionLease({
            id: "lease-ha-e2e",
            executionId: "exec-ha-e2e",
            workerId: "worker-ha-e2e",
            attempt: 1,
            status: "active",
            fencingToken: 1,
            queueName: "default",
            leasedAt: generatedAt,
            expiresAt: new Date(Date.parse(generatedAt) + 30_000).toISOString(),
            releasedAt: null,
            lastHeartbeatAt: generatedAt,
            reasonCode: "ha_validation",
        });
        const compliance = new ComplianceProgramService(harness.store, {
            artifactStoreOptions: { rootDir: complianceArtifactRoot },
        });
        const ha = new HaProgramService(harness.store, {
            artifactStoreOptions: { rootDir: haArtifactRoot },
        });
        const complianceExport = compliance.exportReport({ generatedAt });
        const haExport = ha.exportReport({ environment: "prod", generatedAt });
        const complianceMarkdown = readFileSync(complianceExport.markdownArtifact.uri, "utf8");
        const haMarkdown = readFileSync(haExport.markdownArtifact.uri, "utf8");
        assert.equal(complianceExport.report.tenantCount, 1);
        assert.equal(complianceExport.report.workspaceCount, 1);
        assert.equal(complianceExport.report.organizationCount, 1);
        assert.equal(complianceExport.report.namespaceCount, 2);
        assert.equal(complianceExport.report.auditExportReady, true);
        assert.deepEqual(complianceExport.report.residencySummary.map((entry) => entry.residencyPolicy).sort(), ["cn-mainland", "us-east"]);
        assert.equal(haExport.report.overallStatus, "pass");
        assert.equal(haExport.report.activeWorkerCount, 1);
        assert.equal(haExport.report.activeLeaseCount, 1);
        assert.equal(haExport.report.components.every((component) => component.ready), true);
        assert.ok(existsSync(complianceExport.jsonArtifact.uri));
        assert.ok(existsSync(complianceExport.markdownArtifact.uri));
        assert.ok(existsSync(haExport.jsonArtifact.uri));
        assert.ok(existsSync(haExport.markdownArtifact.uri));
        assert.ok(complianceMarkdown.includes("Compliance Program"));
        assert.ok(haMarkdown.includes("HA Transition Program"));
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=platform-operations-readiness-flow.test.js.map