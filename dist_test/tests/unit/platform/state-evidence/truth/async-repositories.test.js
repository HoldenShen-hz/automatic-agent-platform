import assert from "node:assert/strict";
import test from "node:test";
import { AsyncApprovalRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/approval-repository.js";
import { AsyncArtifactRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/artifact-repository.js";
import { AsyncBillingRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/billing-repository.js";
import { AsyncDispatchRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/dispatch-repository.js";
import { AsyncDivisionRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/division-repository.js";
import { AsyncExecutionRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import { AsyncEventRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/event-repository.js";
import { AsyncLeaseRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/lease-repository.js";
import { AsyncLockRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/lock-repository.js";
import { AsyncMemoryRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/memory-repository.js";
import { AsyncOperationsRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/operations-repository.js";
import { AsyncReleaseRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/release-repository.js";
import { AsyncSecretRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/secret-repository.js";
import { AsyncSessionRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/session-repository.js";
import { AsyncTaskRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { AsyncWorkflowRepository } from "../../../../../src/platform/state-evidence/truth/async-repositories/workflow-repository.js";
function createConnection(options = {}) {
    const calls = [];
    let queryIndex = 0;
    let queryOneIndex = 0;
    let executeIndex = 0;
    const connection = {
        async query(sql, ...params) {
            calls.push({ method: "query", sql, params });
            const rows = (options.queryRows?.[queryIndex++] ?? []);
            return { rows, rowCount: rows.length, changes: rows.length };
        },
        async queryOne(sql, ...params) {
            calls.push({ method: "queryOne", sql, params });
            return options.queryOneRows?.[queryOneIndex++];
        },
        async execute(sql, ...params) {
            calls.push({ method: "execute", sql, params });
            return options.executeResults?.[executeIndex++] ?? 1;
        },
    };
    return { connection, calls };
}
const now = "2026-04-16T10:00:00.000Z";
function taskRecord(overrides = {}) {
    return {
        id: "task-1",
        parentId: null,
        rootId: "task-1",
        divisionId: "general_ops",
        tenantId: "tenant-a",
        title: "Async task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        ...overrides,
    };
}
function sessionRecord(overrides = {}) {
    return {
        id: "session-1",
        taskId: "task-1",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function messageRecord(overrides = {}) {
    return {
        id: "message-1",
        sessionId: "session-1",
        direction: "inbound",
        messageType: "text",
        content: "hello",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
        ...overrides,
    };
}
function executionRecord(overrides = {}) {
    return {
        id: "execution-1",
        taskId: "task-1",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function approvalRecord(overrides = {}) {
    return {
        id: "approval-1",
        taskId: "task-1",
        executionId: "execution-1",
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "5m",
        createdAt: now,
        respondedAt: null,
        ...overrides,
    };
}
function artifactRecord(overrides = {}) {
    return {
        artifactId: "artifact-1",
        taskId: "task-1",
        executionId: "execution-1",
        stepId: "step-1",
        kind: "output",
        storagePath: "/tmp/output.json",
        fileName: "output.json",
        mimeType: "application/json",
        sizeBytes: 128,
        checksum: "abc123",
        lineageJson: "[]",
        createdAt: now,
        ...overrides,
    };
}
function dataMovementJobRecord(overrides = {}) {
    return {
        jobId: "job-1",
        tenantId: "tenant-a",
        organizationId: "org-1",
        workspaceId: "ws-1",
        sourceNamespaceId: "ns-source",
        targetNamespaceId: "ns-target",
        sourcePlane: "analytics",
        targetPlane: "artifact",
        movementType: "analytics_etl",
        inputRefsJson: "[]",
        status: "completed",
        startedAt: now,
        finishedAt: now,
        reportJson: "{}",
        ...overrides,
    };
}
function eventRecord(overrides = {}) {
    return {
        id: "event-1",
        taskId: "task-1",
        sessionId: null,
        executionId: "execution-1",
        eventType: "task:created",
        eventTier: "tier_1",
        payloadJson: "{}",
        traceId: "trace-1",
        createdAt: now,
        ...overrides,
    };
}
function eventAckRecord(overrides = {}) {
    return {
        id: "ack-1",
        eventId: "event-1",
        consumerId: "consumer-1",
        status: "pending",
        lastAttemptAt: now,
        ackedAt: null,
        errorCode: null,
        attemptCount: 0,
        ...overrides,
    };
}
function eventDeadLetterRecord(overrides = {}) {
    return {
        id: "dead-letter-1",
        originalEventId: "event-1",
        eventType: "task:created",
        payloadJson: "{}",
        consumerId: "consumer-1",
        failureCount: 2,
        lastError: "boom",
        deadLetteredAt: now,
        reprocessedAt: null,
        reprocessResult: null,
        ...overrides,
    };
}
function leaseAuditRecord(overrides = {}) {
    return {
        id: "lease-audit-1",
        executionId: "execution-1",
        leaseId: "lease-1",
        workerId: "worker-1",
        fencingToken: 1,
        eventType: "lease_granted",
        reasonCode: "initial",
        recordedAt: now,
        ...overrides,
    };
}
function fileLockRecord(overrides = {}) {
    return {
        id: "lock-1",
        taskId: "task-1",
        executionId: "execution-1",
        lockScope: "task",
        resourcePath: "/tmp/file.txt",
        lockMode: "exclusive",
        ownerId: "worker-1",
        expiresAt: "2026-04-16T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function workflowStateRecord(overrides = {}) {
    return {
        taskId: "task-1",
        divisionId: "general_ops",
        workflowId: "wf-1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function stepOutputRecord(overrides = {}) {
    return {
        id: "step-output-1",
        taskId: "task-1",
        stepId: "step-1",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: '{"ok":true}',
        summary: "done",
        artifactsJson: null,
        tokenCost: 42,
        durationMs: 1200,
        validationJson: null,
        producedAt: now,
        ...overrides,
    };
}
function analyticsFactRecord(overrides = {}) {
    return {
        factId: "fact-1",
        namespaceId: "ns-1",
        tenantId: "tenant-a",
        organizationId: "org-1",
        workspaceId: "ws-1",
        metricName: "runtime.cost",
        dimensionJson: "{}",
        value: 12.5,
        windowStart: now,
        windowEnd: "2026-04-16T11:00:00.000Z",
        sourceRef: "task-1",
        capturedAt: now,
        ...overrides,
    };
}
function archiveBundleRecord(overrides = {}) {
    return {
        bundleId: "bundle-1",
        namespaceId: "ns-1",
        tenantId: "tenant-a",
        organizationId: "org-1",
        workspaceId: "ws-1",
        bundleType: "session_archive",
        sourceRefsJson: "[]",
        summaryRef: "summary-1",
        createdAt: now,
        ...overrides,
    };
}
function replayDatasetRecord(overrides = {}) {
    return {
        datasetId: "dataset-1",
        namespaceId: "ns-1",
        tenantId: "tenant-a",
        organizationId: "org-1",
        workspaceId: "ws-1",
        datasetType: "golden_replay",
        sampleRefsJson: "[]",
        truthRefsJson: "[]",
        version: "v1",
        createdAt: now,
        ...overrides,
    };
}
function costEventRecord(overrides = {}) {
    return {
        id: "cost-1",
        taskId: "task-1",
        sessionId: "session-1",
        executionId: "execution-1",
        agentId: "agent-1",
        provider: "openai",
        model: "gpt-5.4-mini",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.12,
        budgetScope: "task_execution",
        providerRequestId: "req-1",
        pricingVersion: "2026-04",
        createdAt: now,
        ...overrides,
    };
}
function billingAccountRecord(overrides = {}) {
    return {
        accountId: "acct-1",
        ownerId: "owner-1",
        workspaceId: "ws-1",
        planId: "plan-pro",
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function billingInvoiceRecord(overrides = {}) {
    return {
        invoiceId: "inv-1",
        accountId: "acct-1",
        workspaceId: "ws-1",
        tenantId: "tenant-a",
        periodId: "2026-04",
        currency: "USD",
        subtotalUsd: 10,
        taxUsd: 1,
        totalUsd: 11,
        status: "open",
        summaryJson: '{"lines":1}',
        externalInvoiceRef: null,
        dueAt: "2026-04-30T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        paidAt: null,
        ...overrides,
    };
}
function billingPaymentSessionRecord(overrides = {}) {
    return {
        sessionId: "pay-1",
        invoiceId: "inv-1",
        accountId: "acct-1",
        gatewayKind: "stripe",
        gatewaySessionRef: "stripe-ref-1",
        checkoutUrl: "https://payments.example/pay-1",
        status: "pending",
        amountUsd: 11,
        currency: "USD",
        expiresAt: "2026-04-16T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        settledAt: null,
        failureCode: null,
        ...overrides,
    };
}
function usageEventRecord(overrides = {}) {
    return {
        usageId: "usage-1",
        accountId: "acct-1",
        subjectId: "subject-1",
        workspaceId: "ws-1",
        tenantId: "tenant-a",
        taskId: "task-1",
        executionId: "execution-1",
        stepId: null,
        metricType: "tokens",
        quantity: 150,
        source: "runtime",
        unitPriceUsd: 0.001,
        capturedAt: now,
        ...overrides,
    };
}
function quotaCounterRecord(overrides = {}) {
    return {
        counterId: "quota-1",
        accountId: "acct-1",
        metricType: "tokens",
        windowStart: now,
        windowEnd: "2026-04-30T00:00:00.000Z",
        usedQuantity: 150,
        limitQuantity: 1000,
        limitType: "hard",
        resetPolicy: "calendar_month",
        updatedAt: now,
        ...overrides,
    };
}
function ledgerEntryRecord(overrides = {}) {
    return {
        entryId: "ledger-1",
        accountId: "acct-1",
        usageId: "usage-1",
        periodId: "2026-04",
        entryType: "usage_charge",
        amountUsd: 11,
        currency: "USD",
        sourceRef: "invoice:inv-1",
        recordedAt: now,
        ...overrides,
    };
}
function entitlementDecisionRecord(overrides = {}) {
    return {
        decisionId: "decision-1",
        accountId: "acct-1",
        featureKey: "priority-routing",
        metricType: "tokens",
        requestedQuantity: 10,
        allowed: 1,
        decisionType: "allow",
        reasonCode: "within_limit",
        policyVersion: "v1",
        evaluatedAt: now,
        ...overrides,
    };
}
function workerSnapshotRecord(overrides = {}) {
    return {
        workerId: "worker-1",
        status: "idle",
        placement: "local",
        isolationLevel: "standard",
        repoVersion: "v1.0.0",
        remoteSessionStatus: "connected",
        lastAcknowledgedStreamOffset: "100",
        streamResumeSuccessRate: 0.95,
        credentialRefreshSuccessRate: 1,
        sessionConsistencyCheckStatus: "passed",
        sessionConsistencyCheckedAt: now,
        workspaceSyncStatus: "aligned",
        workspaceSyncCheckedAt: now,
        saturation: 0.5,
        activeLeaseCount: 1,
        meanStartupLatencyMs: 150,
        sandboxSuccessRate: 0.99,
        repoCacheHitRate: 0.85,
        registrationVerifiedAt: now,
        registrationChallengeId: "challenge-1",
        capabilitiesJson: '["code_edit"]',
        runningExecutionsJson: '["execution-1"]',
        maxConcurrency: 10,
        queueAffinity: null,
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: 10.5,
        memoryMb: 256,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: now,
        lastHeartbeatAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function memoryRecord(overrides = {}) {
    return {
        id: "memory-1",
        taskId: "task-1",
        sessionId: "session-1",
        agentId: "agent-1",
        executionId: "execution-1",
        memoryLayer: "layer_3",
        scope: "task",
        contentJson: '{"note":"remember"}',
        classification: "fact",
        sourceTrustLevel: "trusted",
        qualityScore: 0.9,
        hitCount: 1,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: null,
        revokedAt: null,
        revocationReason: null,
        kind: "fact",
        status: "active",
        importanceScore: 0.8,
        freshnessScore: 0.9,
        contentHash: "hash-1",
        ...overrides,
    };
}
function secretRegistryRecord(overrides = {}) {
    return {
        secretRef: "secret://provider/openai",
        displayName: "OpenAI key",
        category: "provider_api_key",
        providerKind: "vault",
        scopeType: "tenant",
        scopeRef: "tenant-a",
        status: "active",
        rotationPolicyJson: '{"days":30}',
        metadataJson: '{"owner":"ops"}',
        currentVersion: "v2",
        lastRotatedAt: now,
        nextRotationDueAt: "2026-05-16T10:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
function secretUsageAuditRecord(overrides = {}) {
    return {
        auditId: "audit-1",
        secretRef: "secret://provider/openai",
        providerKind: "vault",
        taskId: "task-1",
        executionId: "execution-1",
        requestedBy: "planner",
        grantedTo: "worker-1",
        usagePurpose: "publish_release",
        resolvedAt: now,
        expiresAt: "2026-04-16T12:00:00.000Z",
        maskedValue: "sk-***",
        metadataJson: '{"request":"release"}',
        ...overrides,
    };
}
function secretRotationEventRecord(overrides = {}) {
    return {
        eventId: "rotation-1",
        secretRef: "secret://provider/openai",
        providerKind: "vault",
        rotationMode: "scheduled",
        status: "completed",
        reasonCode: "policy_due",
        requestedBy: "scheduler",
        previousVersion: "v1",
        nextVersion: "v2",
        occurredAt: now,
        metadataJson: '{"window":"nightly"}',
        ...overrides,
    };
}
function secretLeaseRecord(overrides = {}) {
    return {
        leaseId: "lease-secret-1",
        secretRef: "secret://provider/openai",
        providerKind: "vault",
        taskId: "task-1",
        executionId: "execution-1",
        requestedBy: "planner",
        grantedTo: "worker-1",
        usagePurpose: "deploy_prod",
        issuedAt: now,
        expiresAt: "2026-04-16T12:00:00.000Z",
        status: "active",
        revokedAt: null,
        revokedBy: null,
        revocationReasonCode: null,
        sourceVersion: "v2",
        maskedValue: "sk-***",
        metadataJson: '{"scope":"release"}',
        ...overrides,
    };
}
function releaseBundleRecord(overrides = {}) {
    return {
        bundleId: "bundle-release-1",
        environment: "staging",
        version: "1.2.3",
        commitSha: "abc1234",
        imageTag: "app:1.2.3",
        imageRef: "registry.example/app:1.2.3",
        rolloutStrategy: "canary",
        deploymentNamespace: "app-staging",
        clusterName: "cluster-staging",
        configPath: "deploy/staging.yaml",
        configBundleRef: "config-bundle-1",
        registryCredentialRef: "secret://registry",
        deploymentCredentialRef: "secret://deploy",
        publishWorkflowPath: ".github/workflows/publish.yml",
        deployWorkflowPath: ".github/workflows/deploy.yml",
        requiredReadinessChecksJson: '["db","gateway"]',
        recommendedCommandsJson: '["npm test"]',
        taskId: "task-1",
        jsonArtifactUri: "s3://bundle.json",
        markdownArtifactUri: "s3://bundle.md",
        generatedAt: now,
        exportedAt: now,
        ...overrides,
    };
}
function releaseExecutionReportRecord(overrides = {}) {
    return {
        executionId: "release-exec-1",
        bundleId: "bundle-release-1",
        environment: "staging",
        version: "1.2.3",
        commitSha: "abc1234",
        rolloutStrategy: "rolling",
        imageRef: "registry.example/app:1.2.3",
        imageRepository: "registry.example/app",
        registrySecretRef: "secret://registry",
        registrySecretProviderKind: "vault",
        registrySecretResolved: 1,
        registrySecretAccessMode: "lease",
        registryLeaseId: "lease-secret-1",
        registryLeaseStatus: "active",
        registryLeaseExpiresAt: "2026-04-16T12:00:00.000Z",
        registryLeaseRevokedAt: null,
        publishWorkflowRunId: "1001",
        publishWorkflowRunUrl: "https://ci.example/run/1001",
        buildCommand: "npm run build",
        publishCommand: "npm run publish",
        commandResultsJson: '{"publish":"ok"}',
        taskId: "task-1",
        jsonArtifactUri: "s3://publish.json",
        markdownArtifactUri: "s3://publish.md",
        generatedAt: now,
        exportedAt: now,
        ...overrides,
    };
}
function deploymentExecutionReportRecord(overrides = {}) {
    return {
        executionId: "deploy-exec-1",
        environment: "staging",
        version: "1.2.3",
        commitSha: "abc1234",
        rolloutStrategy: "blue_green",
        targetEligible: 1,
        configBundleRef: "config-bundle-1",
        configVersionId: "cfg-v1",
        registrySecretRef: "secret://registry",
        registrySecretProviderKind: "vault",
        registrySecretResolved: 1,
        deploymentSecretRef: "secret://deploy",
        deploymentSecretProviderKind: "vault",
        deploymentSecretResolved: 1,
        publishWorkflowRunId: "1001",
        publishWorkflowRunUrl: "https://ci.example/run/1001",
        deployWorkflowRunId: "1002",
        deployWorkflowRunUrl: "https://ci.example/run/1002",
        executionMode: "execute",
        publishCommand: "npm run publish",
        deployCommand: "npm run deploy",
        commandResultsJson: '{"deploy":"ok"}',
        releaseBundleId: "bundle-release-1",
        taskId: "task-1",
        jsonArtifactUri: "s3://deploy.json",
        markdownArtifactUri: "s3://deploy.md",
        generatedAt: now,
        exportedAt: now,
        ...overrides,
    };
}
function environmentPromotionHistoryRecord(overrides = {}) {
    return {
        promotionId: "promotion-1",
        sourceEnvironment: "dev",
        targetEnvironment: "staging",
        version: "1.2.3",
        commitSha: "abc1234",
        rolloutStrategy: "canary",
        decisionType: "execute",
        decisionStatus: "executed",
        releaseBundleId: "bundle-release-1",
        deploymentExecutionId: "deploy-exec-1",
        reasonCode: "passed_checks",
        actor: "release-bot",
        metadataJson: '{"ticket":"change-1"}',
        recordedAt: now,
        ...overrides,
    };
}
function enterpriseCapabilityReportRecord(overrides = {}) {
    return {
        reportId: "capability-1",
        accountId: "acct-1",
        workspaceId: "ws-1",
        tenantId: "tenant-a",
        environment: "staging",
        deploymentMode: "private_cloud",
        summaryJson: '{"status":"ok"}',
        reportJson: '{"details":[]}',
        generatedAt: now,
        ...overrides,
    };
}
function incidentHandoffRecord(overrides = {}) {
    return {
        handoffId: "handoff-1",
        incidentId: "incident-1",
        environment: "staging",
        status: "ready",
        shiftOwner: "ops-a",
        primaryOncall: "alice",
        secondaryOncall: "bob",
        severity: "sev2",
        handoffJson: '{"runbook":"rb-1"}',
        createdAt: now,
        ...overrides,
    };
}
function enterpriseGovernanceReportRecord(overrides = {}) {
    return {
        reportId: "governance-1",
        taskId: "task-1",
        environment: "staging",
        status: "pass",
        shiftOwner: "ops-a",
        summaryJson: '{"ready":true}',
        reportJson: '{"checks":[]}',
        generatedAt: now,
        handoffId: "handoff-1",
        ...overrides,
    };
}
test("AsyncTaskRepository writes task mutations through async execute", async () => {
    const { connection, calls } = createConnection({ executeResults: [1, 2, 3, 4, 5, 6] });
    const repo = new AsyncTaskRepository(connection);
    const task = taskRecord();
    await repo.insertTask(task);
    await repo.updateTaskStatus("task-1", "failed", now, "boom", now);
    const casChanges = await repo.updateTaskStatusCas("task-1", "queued", "in_progress", now, null, null);
    await repo.setTaskState({ taskId: "task-1", status: "done", updatedAt: now, errorCode: null, completedAt: now });
    await repo.updateTaskOutput("task-1", '{"ok":true}', now);
    await repo.updateTaskInput("task-1", '{"raw":true}', '{"raw":true}', now);
    assert.equal(casChanges, 3);
    assert.equal(calls.length, 6);
    assert.match(calls[0].sql, /INSERT INTO tasks/);
    assert.deepEqual(calls[0].params.slice(0, 5), ["task-1", null, "task-1", "general_ops", "tenant-a"]);
    assert.match(calls[2].sql, /WHERE id = \$5 AND status = \$6/);
    assert.deepEqual(calls[2].params, ["in_progress", now, null, null, "task-1", "queued"]);
    assert.match(calls[4].sql, /UPDATE tasks SET output_json = \$1/);
    assert.deepEqual(calls[5].params, ['{"raw":true}', '{"raw":true}', now, "task-1"]);
});
test("AsyncTaskRepository builds scoped and unscoped read queries", async () => {
    const task = taskRecord();
    const { connection, calls } = createConnection({
        queryRows: [[task], [task]],
        queryOneRows: [task, undefined, { count: 3 }, undefined],
    });
    const repo = new AsyncTaskRepository(connection);
    assert.equal(await repo.getTask("task-1", "tenant-a"), task);
    assert.equal(await repo.getTask("missing-task"), null);
    assert.deepEqual(await repo.listTasks(5, "tenant-a"), [task]);
    assert.deepEqual(await repo.listTasks(), [task]);
    assert.equal(await repo.countQueuedTasks("tenant-a"), 3);
    assert.equal(await repo.countQueuedTasks(), 0);
    assert.match(calls[0].sql, /FROM tasks t WHERE t\.id = \$1 AND t\.tenant_id = \$2/);
    assert.deepEqual(calls[0].params, ["task-1", "tenant-a"]);
    assert.match(calls[2].sql, /WHERE tenant_id = \$1\s+ORDER BY updated_at DESC\s+LIMIT \$2/);
    assert.deepEqual(calls[2].params, ["tenant-a", 5]);
    assert.doesNotMatch(calls[3].sql, /WHERE tenant_id/);
    assert.match(calls[4].sql, /status IN \('queued', 'pending'\) AND tenant_id = \$1/);
});
test("AsyncSessionRepository delegates writes and point lookups", async () => {
    const summary = {
        id: "summary-1",
        sessionId: "session-1",
        taskId: "task-1",
        agentId: "agent-1",
        summaryText: "summary",
        keyDecisions: null,
        keyOutcomes: null,
        memoryIdsReferenced: null,
        tokenCount: 12,
        createdAt: now,
    };
    const target = {
        targetId: "target-1",
        channel: "slack",
        targetKind: "user",
        externalTargetId: "U1",
        displayName: "Operator",
        aliasesJson: "[]",
        metadataJson: "{}",
        source: "session_history",
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
    };
    const { connection, calls } = createConnection({ queryOneRows: [sessionRecord(), summary, target] });
    const repo = new AsyncSessionRepository(connection);
    await repo.insertSession(sessionRecord());
    assert.deepEqual(await repo.getSession("session-1"), sessionRecord());
    await repo.insertMessage(messageRecord());
    await repo.insertSessionSummary(summary);
    assert.equal(await repo.getLatestSessionSummary("session-1"), summary);
    await repo.insertSessionEvent({
        id: "event-1",
        sessionId: "session-1",
        eventType: "session.created",
        payloadJson: "{}",
        createdAt: now,
    });
    await repo.upsertGatewayTarget(target);
    assert.equal(await repo.getGatewayTarget("target-1"), target);
    assert.match(calls[0].sql, /INSERT INTO sessions/);
    assert.deepEqual(calls[0].params, ["session-1", "task-1", "cli", "open", null, now, now]);
    assert.match(calls[5].sql, /INSERT INTO session_events/);
    assert.match(calls[6].sql, /ON CONFLICT\(target_id\) DO UPDATE/);
    assert.match(calls[7].sql, /FROM gateway_targets WHERE target_id = \$1/);
});
test("AsyncSessionRepository builds list queries with limits and tenant joins", async () => {
    const compaction = {
        id: "compaction-1",
        sessionId: "session-1",
        taskId: "task-1",
        stage: "summarize",
        sourceMessageIdsJson: "[]",
        summaryText: "compact",
        summaryRef: null,
        compactionReason: "token_limit",
        overflowTriggered: 1,
        autoTriggered: 1,
        tokenReductionEstimate: 100,
        createdAt: now,
    };
    const { connection, calls } = createConnection({
        queryRows: [
            [sessionRecord()],
            [messageRecord()],
            [messageRecord()],
            [{ id: "event-1", sessionId: "session-1", eventType: "created", payloadJson: "{}", createdAt: now }],
            [{ targetId: "target-1", channel: "slack" }],
            [compaction],
            [compaction],
        ],
    });
    const repo = new AsyncSessionRepository(connection);
    assert.equal((await repo.listSessionsByTask("task-1")).length, 1);
    assert.equal((await repo.listMessagesBySession("session-1", 3)).length, 1);
    assert.equal((await repo.listMessagesBySession("session-1")).length, 1);
    assert.equal((await repo.listSessionEvents("session-1")).length, 1);
    assert.equal((await repo.listGatewayTargetsByChannel("slack")).length, 1);
    assert.equal((await repo.listCompactionRecordsBySession("session-1", "tenant-a")).length, 1);
    assert.equal((await repo.listCompactionRecordsBySession("session-1")).length, 1);
    assert.match(calls[1].sql, /ORDER BY created_at ASC LIMIT 3/);
    assert.doesNotMatch(calls[2].sql, /LIMIT/);
    assert.deepEqual(calls[3].params, ["session-1", 100]);
    assert.match(calls[5].sql, /INNER JOIN tasks t ON t\.id = c\.task_id/);
    assert.deepEqual(calls[5].params, ["session-1", "tenant-a"]);
    assert.doesNotMatch(calls[6].sql, /INNER JOIN tasks/);
});
test("AsyncExecutionRepository writes execution lifecycle records", async () => {
    const { connection, calls } = createConnection({ executeResults: [1, 2, 3, 4, 5, 6] });
    const repo = new AsyncExecutionRepository(connection);
    const execution = executionRecord();
    const precheck = {
        id: "precheck-1",
        executionId: "execution-1",
        allowed: 1,
        reasonCode: "ok",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 60000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
    };
    const deadLetter = {
        id: "dead-1",
        taskId: "task-1",
        executionId: "execution-1",
        finalReasonCode: "agent_failed",
        retryCount: 2,
        lastErrorMessage: "boom",
        movedAt: now,
    };
    await repo.insertExecution(execution);
    await repo.updateExecutionStatus("execution-1", "failed", now, now, now, "agent.crash");
    await repo.updateExecutionFailure({
        executionId: "execution-1",
        status: "failed",
        updatedAt: now,
        finishedAt: now,
        lastErrorCode: "agent.crash",
        lastErrorMessage: "boom",
    });
    await repo.updateExecutionAgent("execution-1", "agent-2", now);
    await repo.insertExecutionPrecheck(precheck);
    await repo.insertDeadLetter(deadLetter);
    assert.equal(calls.length, 6);
    assert.match(calls[0].sql, /INSERT INTO executions/);
    assert.match(calls[1].sql, /started_at = COALESCE\(\$3, started_at\)/);
    assert.deepEqual(calls[3].params, ["agent-2", now, "execution-1"]);
    assert.match(calls[4].sql, /INSERT INTO execution_prechecks/);
    assert.match(calls[5].sql, /INSERT INTO dead_letters/);
});
test("AsyncArtifactRepository writes and scopes artifact queries", async () => {
    const artifact = artifactRecord();
    const { connection, calls } = createConnection({
        queryRows: [[artifact], [artifact]],
        queryOneRows: [artifact, undefined],
    });
    const repo = new AsyncArtifactRepository(connection);
    await repo.insertArtifact(artifact);
    assert.equal(await repo.getArtifact("artifact-1"), artifact);
    assert.equal(await repo.getArtifact("missing-artifact"), null);
    assert.deepEqual(await repo.listArtifactsByTask("task-1", "tenant-a"), [artifact]);
    assert.deepEqual(await repo.listArtifactsByTask("task-1"), [artifact]);
    assert.match(calls[0].sql, /INSERT INTO artifacts/);
    assert.deepEqual(calls[0].params.slice(0, 4), ["artifact-1", "task-1", "execution-1", "step-1"]);
    assert.match(calls[1].sql, /WHERE artifact_id = \$1/);
    assert.match(calls[3].sql, /INNER JOIN tasks t ON t\.id = a\.task_id/);
    assert.deepEqual(calls[3].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[4].sql, /INNER JOIN tasks/);
});
test("AsyncDivisionRepository builds filtered movement job queries and sanitizes limits", async () => {
    const job = dataMovementJobRecord();
    const { connection, calls } = createConnection({
        queryRows: [[job], [job], [job], [job], [job]],
    });
    const repo = new AsyncDivisionRepository(connection);
    assert.deepEqual(await repo.listDataMovementJobRecords(), [job]);
    assert.deepEqual(await repo.listDataMovementJobRecords({ tenantId: "tenant-a" }), [job]);
    assert.deepEqual(await repo.listDataMovementJobRecords({ status: "running", movementType: "archive_compaction", limit: 5.8 }), [job]);
    assert.deepEqual(await repo.listDataMovementJobRecords({ tenantId: null, limit: 0 }), [job]);
    assert.deepEqual(await repo.listDataMovementJobRecords({ limit: Number.NaN }), [job]);
    assert.match(calls[0].sql, /FROM data_movement_jobs\s+ORDER BY started_at DESC, job_id ASC\s+LIMIT \$1/);
    assert.deepEqual(calls[0].params, [100]);
    assert.match(calls[1].sql, /WHERE tenant_id = \$1/);
    assert.deepEqual(calls[1].params, ["tenant-a", 100]);
    assert.match(calls[2].sql, /WHERE status = \$1 AND movement_type = \$2/);
    assert.deepEqual(calls[2].params, ["running", "archive_compaction", 5]);
    assert.deepEqual(calls[3].params, [1]);
    assert.deepEqual(calls[4].params, [100]);
});
test("AsyncEventRepository writes event and ack mutations", async () => {
    const { connection, calls } = createConnection({ executeResults: [1, 2, 3, 4, 5] });
    const repo = new AsyncEventRepository(connection);
    const deadLetter = eventDeadLetterRecord();
    const ack = eventAckRecord();
    await repo.insertEventDeadLetter(deadLetter);
    await repo.insertEventConsumerAck(ack);
    await repo.markEventAck("event-1", "consumer-1", "acked", now);
    await repo.markEventDeadLettered({
        eventId: "event-1",
        consumerId: "consumer-1",
        occurredAt: now,
        errorCode: "timeout",
    });
    await repo.ackAllConsumersForEvent("event-1", now);
    assert.match(calls[0].sql, /INSERT INTO event_dead_letters/);
    assert.match(calls[1].sql, /INSERT INTO event_consumer_acks/);
    assert.match(calls[2].sql, /acked_at = CASE WHEN \$1 = 'acked' THEN \$2 ELSE acked_at END/);
    assert.deepEqual(calls[2].params, ["acked", now, null, "event-1", "consumer-1"]);
    assert.match(calls[3].sql, /status = 'dead_lettered'/);
    assert.match(calls[4].sql, /status IN \('pending', 'failed'\)/);
});
test("AsyncEventRepository handles list, tenant, and count queries", async () => {
    const event = eventRecord();
    const ack = eventAckRecord();
    const deadLetter = eventDeadLetterRecord();
    const { connection, calls } = createConnection({
        queryRows: [
            [deadLetter],
            [event],
            [event],
            [{ consumerId: "consumer-1" }, { consumerId: "consumer-2" }],
            [event],
            [event],
            [event],
        ],
        queryOneRows: [ack, event, { count: 2 }, undefined],
    });
    const repo = new AsyncEventRepository(connection);
    assert.deepEqual(await repo.listEventDeadLetters(25), [deadLetter]);
    assert.deepEqual(await repo.listEventsByType("task:created", 5), [event]);
    assert.deepEqual(await repo.listEventsByType("task:created"), [event]);
    assert.equal(await repo.getEventConsumerAck("event-1", "consumer-1"), ack);
    assert.deepEqual(await repo.getRequiredConsumerIds("event-1"), ["consumer-1", "consumer-2"]);
    assert.deepEqual(await repo.listEventsForTask("task-1", 3), [event]);
    assert.deepEqual(await repo.listEventsForTask("task-1", "tenant-a"), [event]);
    assert.deepEqual(await repo.listEventsForTask("task-1"), [event]);
    assert.equal(await repo.getEvent("event-1"), event);
    assert.equal(await repo.countPendingTier1Acks(), 2);
    assert.equal(await repo.countFailedTier1Acks(), 0);
    assert.deepEqual(calls[0].params, [25]);
    assert.match(calls[1].sql, /ORDER BY created_at DESC LIMIT \$2/);
    assert.deepEqual(calls[1].params, ["task:created", 5]);
    assert.doesNotMatch(calls[2].sql, /LIMIT/);
    assert.match(calls[5].sql, /WHERE task_id = \$1 ORDER BY created_at DESC LIMIT \$2/);
    assert.deepEqual(calls[5].params, ["task-1", 3]);
    assert.match(calls[6].sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
    assert.deepEqual(calls[6].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[7].sql, /INNER JOIN tasks/);
});
test("AsyncLeaseRepository lists lease audits for an execution", async () => {
    const audit = leaseAuditRecord();
    const { connection, calls } = createConnection({ queryRows: [[audit], []] });
    const repo = new AsyncLeaseRepository(connection);
    assert.deepEqual(await repo.listLeaseAudits("execution-1"), [audit]);
    assert.deepEqual(await repo.listLeaseAudits("missing-execution"), []);
    assert.match(calls[0].sql, /FROM lease_audits/);
    assert.match(calls[0].sql, /ORDER BY recorded_at ASC/);
    assert.deepEqual(calls[0].params, ["execution-1"]);
    assert.deepEqual(calls[1].params, ["missing-execution"]);
});
test("AsyncLockRepository writes file locks and builds scoped lock queries", async () => {
    const lock = fileLockRecord();
    const { connection, calls } = createConnection({
        executeResults: [1, 2],
        queryRows: [[lock], [lock], [lock], [lock], [lock]],
    });
    const repo = new AsyncLockRepository(connection);
    await repo.insertFileLock(lock);
    assert.deepEqual(await repo.listActiveFileLocksForResource("/tmp/file.txt", now), [lock]);
    assert.deepEqual(await repo.listExpiredFileLocks(now), [lock]);
    assert.deepEqual(await repo.listFileLocks(), [lock]);
    assert.deepEqual(await repo.listFileLocksByTask("task-1", "tenant-a"), [lock]);
    assert.deepEqual(await repo.listFileLocksByTask("task-1"), [lock]);
    assert.equal(await repo.deleteFileLock("lock-1"), 2);
    assert.match(calls[0].sql, /INSERT INTO file_locks/);
    assert.match(calls[1].sql, /WHERE resource_path = \$1\s+AND expires_at >= \$2/);
    assert.deepEqual(calls[1].params, ["/tmp/file.txt", now]);
    assert.match(calls[4].sql, /INNER JOIN tasks t ON t\.id = f\.task_id/);
    assert.deepEqual(calls[4].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[5].sql, /INNER JOIN tasks/);
    assert.deepEqual(calls[6].params, ["lock-1"]);
});
test("AsyncWorkflowRepository writes workflow states and tenant-scoped reads", async () => {
    const workflow = workflowStateRecord();
    const stepOutput = stepOutputRecord();
    const { connection, calls } = createConnection({
        executeResults: [1, 2, 3, 4],
        queryRows: [[workflow], [workflow]],
        queryOneRows: [workflow, undefined],
    });
    const repo = new AsyncWorkflowRepository(connection);
    await repo.insertWorkflowState(workflow);
    await repo.insertStepOutput(stepOutput);
    assert.equal(await repo.getWorkflowState("task-1", "tenant-a"), workflow);
    assert.equal(await repo.getWorkflowState("missing-workflow"), null);
    assert.deepEqual(await repo.listWorkflowStates("tenant-a"), [workflow]);
    assert.deepEqual(await repo.listWorkflowStates(), [workflow]);
    await repo.updateWorkflowState("task-1", "failed", 2, '{"step":2}', now, "step-2");
    await repo.updateWorkflowRecoveryState({
        taskId: "task-1",
        status: "failed",
        currentStepIndex: 3,
        outputsJson: '{"step":3}',
        updatedAt: now,
        resumableFromStep: "step-3",
        retryCount: 2,
        lastErrorCode: "ERR_WORKFLOW",
    });
    assert.match(calls[0].sql, /INSERT INTO workflow_state/);
    assert.match(calls[1].sql, /INSERT INTO workflow_step_outputs/);
    assert.match(calls[2].sql, /FROM workflow_state w INNER JOIN tasks t ON t\.id = w\.task_id/);
    assert.deepEqual(calls[2].params, ["task-1", "tenant-a"]);
    assert.match(calls[4].sql, /WHERE w\.task_id IN \(SELECT id FROM tasks WHERE tenant_id = \$1\)/);
    assert.deepEqual(calls[4].params, ["tenant-a"]);
    assert.doesNotMatch(calls[5].sql, /tenant_id/);
    assert.match(calls[6].sql, /UPDATE workflow_state SET status = \$1, current_step_index = \$2/);
    assert.match(calls[7].sql, /retry_count = \$6, last_error_code = \$7 WHERE task_id = \$8/);
});
test("AsyncDispatchRepository handles execution, session, gateway, message, and worker lookups", async () => {
    const execution = executionRecord();
    const precheck = {
        id: "precheck-1",
        executionId: "execution-1",
        allowed: 1,
        reasonCode: "ok",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 60000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
    };
    const deadLetter = {
        id: "dead-1",
        taskId: "task-1",
        executionId: "execution-1",
        finalReasonCode: "timeout",
        retryCount: 2,
        lastErrorMessage: "boom",
        movedAt: now,
    };
    const target = {
        targetId: "target-1",
        channel: "slack",
        targetKind: "user",
        externalTargetId: "U1",
        displayName: "Operator",
        aliasesJson: "[]",
        metadataJson: "{}",
        source: "directory",
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
    };
    const worker = workerSnapshotRecord();
    const { connection, calls } = createConnection({
        queryRows: [
            [execution],
            [deadLetter],
            [target],
            [target],
            [messageRecord()],
        ],
        queryOneRows: [
            execution,
            undefined,
            precheck,
            deadLetter,
            sessionRecord(),
            sessionRecord({ id: "session-latest" }),
            target,
            worker,
        ],
    });
    const repo = new AsyncDispatchRepository(connection);
    assert.deepEqual(await repo.listExecutionsByStatuses(["executing", "blocked"]), [execution]);
    assert.deepEqual(await repo.listExecutionsByStatuses([]), []);
    assert.equal(await repo.getExecution("execution-1", "tenant-a"), execution);
    assert.equal(await repo.getExecution("missing-exec"), null);
    assert.equal(await repo.getExecutionPrecheck("execution-1", "tenant-a"), precheck);
    assert.equal(await repo.getDeadLetterByExecutionId("execution-1"), deadLetter);
    assert.deepEqual(await repo.listDeadLettersByTask("task-1", "tenant-a"), [deadLetter]);
    assert.deepEqual(await repo.getSession("session-1", "tenant-a"), sessionRecord());
    assert.deepEqual(await repo.selectLatestSessionByTask("task-1"), sessionRecord({ id: "session-latest" }));
    assert.equal(await repo.getGatewayTarget("target-1"), target);
    assert.deepEqual(await repo.listGatewayTargets(20, "slack"), [target]);
    assert.deepEqual(await repo.listGatewayTargets(Number.NaN), [target]);
    assert.deepEqual(await repo.listMessagesBySession("session-1", "tenant-a"), [messageRecord()]);
    assert.equal(await repo.getWorkerSnapshot("worker-1"), worker);
    assert.match(calls[0].sql, /WHERE status IN \(\$1, \$2\)/);
    assert.match(calls[1].sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
    assert.deepEqual(calls[1].params, ["execution-1", "tenant-a"]);
    assert.match(calls[3].sql, /INNER JOIN executions e ON e\.id = ep\.execution_id/);
    assert.deepEqual(calls[5].params, ["task-1", "tenant-a"]);
    assert.match(calls[6].sql, /INNER JOIN tasks t ON t\.id = s\.task_id/);
    assert.match(calls[9].sql, /WHERE channel = \$1 .* LIMIT \$2/);
    assert.deepEqual(calls[10].params, [100]);
    assert.match(calls[11].sql, /INNER JOIN sessions s ON s\.id = m\.session_id/);
    assert.match(calls[12].sql, /FROM worker_snapshots WHERE worker_id = \$1/);
});
test("AsyncOperationsRepository writes analytics, archive, replay, and movement records", async () => {
    const analytics = analyticsFactRecord();
    const archive = archiveBundleRecord();
    const replay = replayDatasetRecord();
    const movement = dataMovementJobRecord();
    const { connection, calls } = createConnection({
        queryRows: [[analytics], [archive], [replay], [movement], [movement]],
        queryOneRows: [movement, undefined],
    });
    const repo = new AsyncOperationsRepository(connection);
    await repo.insertAnalyticsFactRecord(analytics);
    assert.deepEqual(await repo.listAnalyticsFactRecords({ namespaceId: "ns-1", tenantId: "tenant-a", metricName: "runtime.cost", limit: 9.9 }), [analytics]);
    await repo.insertArchiveBundleRecord(archive);
    assert.deepEqual(await repo.listArchiveBundleRecords({ namespaceId: "ns-1", tenantId: null, bundleType: "session_archive", limit: 0 }), [archive]);
    await repo.insertReplayDatasetRecord(replay);
    assert.deepEqual(await repo.listReplayDatasetRecords({ namespaceId: "ns-1", datasetType: "golden_replay" }), [replay]);
    await repo.upsertDataMovementJobRecord(movement);
    assert.equal(await repo.getDataMovementJobRecord("job-1"), movement);
    assert.equal(await repo.getDataMovementJobRecord("missing-job"), null);
    assert.deepEqual(await repo.listDataMovementJobRecords({ tenantId: "tenant-a", status: "completed", movementType: "analytics_etl", limit: 5 }), [movement]);
    assert.deepEqual(await repo.listDataMovementJobRecords(), [movement]);
    assert.match(calls[0].sql, /INSERT INTO analytics_facts/);
    assert.match(calls[1].sql, /WHERE namespace_id = \$1 AND tenant_id IS \$2 AND metric_name = \$3/);
    assert.deepEqual(calls[1].params, ["ns-1", "tenant-a", "runtime.cost", 9]);
    assert.match(calls[2].sql, /INSERT INTO archive_bundles/);
    assert.deepEqual(calls[3].params, ["ns-1", null, "session_archive", 1]);
    assert.match(calls[4].sql, /INSERT INTO replay_datasets/);
    assert.deepEqual(calls[5].params, ["ns-1", "golden_replay", 100]);
    assert.match(calls[6].sql, /INSERT INTO data_movement_jobs/);
    assert.match(calls[6].sql, /ON CONFLICT\(job_id\) DO UPDATE/);
    assert.match(calls[9].sql, /WHERE tenant_id = \$1 AND status = \$2 AND movement_type = \$3/);
    assert.deepEqual(calls[9].params, ["tenant-a", "completed", "analytics_etl", 5]);
    assert.deepEqual(calls[10].params, [100]);
});
test("AsyncBillingRepository writes billing entities and builds scoped cost queries", async () => {
    const cost = costEventRecord();
    const account = billingAccountRecord();
    const invoice = billingInvoiceRecord();
    const payment = billingPaymentSessionRecord();
    const usage = usageEventRecord();
    const quota = quotaCounterRecord();
    const ledger = ledgerEntryRecord();
    const entitlement = entitlementDecisionRecord();
    const { connection, calls } = createConnection({
        executeResults: [1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
        queryRows: [[cost], [cost]],
        queryOneRows: [{ total: 1.23 }, undefined, account, { count: 4 }, undefined],
    });
    const repo = new AsyncBillingRepository(connection);
    await repo.insertCostEvent(cost);
    assert.deepEqual(await repo.listCostEventsByTask("task-1", "tenant-a"), [cost]);
    assert.deepEqual(await repo.listCostEventsByTask("task-1"), [cost]);
    assert.equal(await repo.sumCostByTask("task-1", "tenant-a"), 1.23);
    assert.equal(await repo.sumCostByTask("task-1"), 0);
    await repo.upsertBillingAccount(account);
    await repo.insertBillingInvoice(invoice);
    assert.equal(await repo.updateBillingInvoiceStatus({ invoiceId: "inv-1", status: "paid", updatedAt: now, paidAt: now, externalInvoiceRef: "ext-1" }), 1);
    await repo.insertBillingPaymentSession(payment);
    assert.equal(await repo.updateBillingPaymentSessionStatus({ sessionId: "pay-1", status: "paid", updatedAt: now, settledAt: now }), 2);
    await repo.insertUsageEvent(usage);
    await repo.upsertQuotaCounter(quota);
    await repo.insertLedgerEntry(ledger);
    await repo.insertEntitlementDecision(entitlement);
    assert.equal(await repo.getBillingAccount("acct-1"), account);
    assert.equal(await repo.countActiveExecutionsByTenant("tenant-a"), 4);
    assert.equal(await repo.countQueuedTasksByTenant("tenant-a"), 0);
    assert.match(calls[0].sql, /INSERT INTO cost_events/);
    assert.match(calls[1].sql, /INNER JOIN tasks t ON t\.id = c\.task_id/);
    assert.deepEqual(calls[1].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[2].sql, /INNER JOIN tasks/);
    assert.match(calls[3].sql, /COALESCE\(SUM\(c\.cost_usd\), 0\)/);
    assert.deepEqual(calls[3].params, ["task-1", "tenant-a"]);
    assert.deepEqual(calls[4].params, ["task-1"]);
    assert.match(calls[5].sql, /INSERT INTO billing_accounts/);
    assert.match(calls[5].sql, /ON CONFLICT\(account_id\) DO UPDATE/);
    assert.match(calls[7].sql, /UPDATE billing_invoices/);
    assert.match(calls[9].sql, /UPDATE billing_payment_sessions/);
    assert.match(calls[11].sql, /INSERT INTO quota_counters/);
    assert.match(calls[11].sql, /ON CONFLICT\(account_id, metric_type, window_start, window_end\) DO UPDATE/);
    assert.match(calls[14].sql, /FROM billing_accounts/);
    assert.match(calls[15].sql, /WHERE t\.tenant_id = \$1 AND e\.status IN \('pending', 'in_progress'\)/);
    assert.match(calls[16].sql, /FROM tasks WHERE tenant_id = \$1 AND status = 'queued'/);
});
test("AsyncMemoryRepository writes memories, builds layered recall filters, and summarizes quality", async () => {
    const activeMemory = memoryRecord();
    const expiredMemory = memoryRecord({
        id: "memory-2",
        memoryLayer: "layer_5",
        scope: "workspace",
        classification: "note",
        sourceTrustLevel: "external",
        qualityScore: 0.4,
        hitCount: 0,
        createdAt: "2026-04-15T10:00:00.000Z",
        lastAccessedAt: null,
        expiresAt: "2026-04-16T09:00:00.000Z",
        contentHash: "hash-2",
    });
    const revokedMemory = memoryRecord({
        id: "memory-3",
        memoryLayer: "layer_7",
        classification: "decision",
        qualityScore: 0.7,
        hitCount: 2,
        createdAt: "2026-04-14T10:00:00.000Z",
        revokedAt: "2026-04-16T08:00:00.000Z",
        revocationReason: "superseded",
        contentHash: "hash-3",
    });
    const { connection, calls } = createConnection({
        executeResults: [1, 2, 3],
        queryRows: [[activeMemory, expiredMemory, revokedMemory], [activeMemory, expiredMemory, revokedMemory]],
        queryOneRows: [activeMemory, undefined, activeMemory],
    });
    const repo = new AsyncMemoryRepository(connection);
    await repo.insertMemory(activeMemory);
    assert.deepEqual(await repo.listMemories({
        taskId: "task-1",
        agentId: "agent-1",
        memoryLayers: ["layer_3", "layer_5"],
        classifications: ["fact"],
        sourceTrustLevels: ["trusted"],
        limit: 1,
        evaluatedAt: now,
    }), [activeMemory]);
    assert.equal(await repo.getMemory("memory-1"), activeMemory);
    assert.equal(await repo.getMemory("missing-memory"), null);
    assert.equal(await repo.recordMemoryAccess("memory-1", now), 2);
    assert.equal(await repo.revokeMemory("memory-1", now, "superseded"), 3);
    assert.equal(await repo.findMemoryByContentHash("hash-1", "task"), activeMemory);
    const report = await repo.getMemoryQualityReport({ evaluatedAt: now });
    assert.equal(report.totalCount, 3);
    assert.equal(report.activeCount, 1);
    assert.equal(report.expiredCount, 1);
    assert.equal(report.revokedCount, 1);
    assert.equal(report.recalledCount, 2);
    assert.equal(report.neverRecalledCount, 1);
    assert.equal(report.averageQualityScore, (0.9 + 0.4 + 0.7) / 3);
    assert.match(calls[0].sql, /INSERT INTO memories/);
    assert.match(calls[1].sql, /WHERE task_id = \$1 AND agent_id = \$2 AND memory_layer IN \(\$3, \$4\)/);
    assert.deepEqual(calls[1].params, ["task-1", "agent-1", "layer_3", "layer_5", "fact", "trusted"]);
    assert.match(calls[4].sql, /SET hit_count = hit_count \+ 1/);
    assert.deepEqual(calls[4].params, [now, "memory-1"]);
    assert.match(calls[5].sql, /SET revoked_at = \$1,\s+revocation_reason = \$2/);
    assert.deepEqual(calls[5].params, [now, "superseded", "memory-1"]);
    assert.match(calls[6].sql, /WHERE content_hash = \$1 AND scope = \$2 AND status = 'active'/);
});
test("AsyncSecretRepository upserts registry and lease records and lists audits by secret ref", async () => {
    const registry = secretRegistryRecord();
    const usageAudit = secretUsageAuditRecord();
    const rotationEvent = secretRotationEventRecord();
    const lease = secretLeaseRecord();
    const { connection, calls } = createConnection({
        executeResults: [1, 1, 1, 1],
        queryRows: [[registry], [usageAudit], [rotationEvent], [lease]],
        queryOneRows: [registry, undefined, lease],
    });
    const repo = new AsyncSecretRepository(connection);
    await repo.upsertSecretRegistryRecord(registry);
    await repo.insertSecretUsageAudit(usageAudit);
    await repo.insertSecretRotationEvent(rotationEvent);
    await repo.upsertSecretLeaseRecord(lease);
    assert.equal(await repo.getSecretRegistryRecord("secret://provider/openai"), registry);
    assert.equal(await repo.getSecretRegistryRecord("missing-secret"), null);
    assert.deepEqual(await repo.listSecretRegistryRecords(), [registry]);
    assert.deepEqual(await repo.listSecretUsageAuditsBySecretRef("secret://provider/openai"), [usageAudit]);
    assert.deepEqual(await repo.listSecretRotationEventsBySecretRef("secret://provider/openai"), [rotationEvent]);
    assert.equal(await repo.getSecretLeaseRecord("lease-secret-1"), lease);
    assert.deepEqual(await repo.listSecretLeasesBySecretRef("secret://provider/openai"), [lease]);
    assert.match(calls[0].sql, /INSERT INTO secret_registry/);
    assert.match(calls[0].sql, /ON CONFLICT\(secret_ref\) DO UPDATE SET/);
    assert.match(calls[3].sql, /INSERT INTO secret_leases/);
    assert.match(calls[3].sql, /ON CONFLICT\(lease_id\) DO UPDATE SET/);
    assert.match(calls[4].sql, /FROM secret_registry\s+WHERE secret_ref = \$1/);
    assert.match(calls[6].sql, /FROM secret_registry\s+ORDER BY secret_ref ASC/);
    assert.deepEqual(calls[7].params, ["secret://provider/openai"]);
    assert.match(calls[8].sql, /ORDER BY occurred_at DESC, event_id DESC/);
    assert.match(calls[10].sql, /ORDER BY issued_at DESC, lease_id DESC/);
});
test("AsyncReleaseRepository writes release evidence and sanitizes list limits", async () => {
    const bundle = releaseBundleRecord();
    const releaseExecution = releaseExecutionReportRecord();
    const deploymentExecution = deploymentExecutionReportRecord();
    const promotion = environmentPromotionHistoryRecord();
    const capabilityReport = enterpriseCapabilityReportRecord();
    const handoff = incidentHandoffRecord();
    const governanceReport = enterpriseGovernanceReportRecord();
    const { connection, calls } = createConnection({
        executeResults: [1, 1, 1, 1, 1, 1, 1],
        queryRows: [[bundle], [bundle], [capabilityReport], [handoff], [governanceReport]],
        queryOneRows: [bundle, undefined],
    });
    const repo = new AsyncReleaseRepository(connection);
    await repo.insertReleaseBundleRecord(bundle);
    await repo.insertReleaseExecutionReportRecord(releaseExecution);
    await repo.insertDeploymentExecutionReportRecord(deploymentExecution);
    await repo.insertEnvironmentPromotionHistoryRecord(promotion);
    assert.equal(await repo.getReleaseBundleRecord("bundle-release-1"), bundle);
    assert.equal(await repo.getReleaseBundleRecord("missing-bundle"), null);
    assert.deepEqual(await repo.listReleaseBundleRecords({ environment: "staging", limit: 9.9 }), [bundle]);
    assert.deepEqual(await repo.listReleaseBundleRecords(), [bundle]);
    await repo.insertEnterpriseCapabilityReport(capabilityReport);
    await repo.insertIncidentHandoffRecord(handoff);
    await repo.insertEnterpriseGovernanceReport(governanceReport);
    assert.deepEqual(await repo.listEnterpriseCapabilityReports(0), [capabilityReport]);
    assert.deepEqual(await repo.listIncidentHandoffRecords(Number.NaN), [handoff]);
    assert.deepEqual(await repo.listEnterpriseGovernanceReports(5.8), [governanceReport]);
    assert.match(calls[0].sql, /INSERT INTO release_bundles/);
    assert.match(calls[1].sql, /INSERT INTO release_execution_reports/);
    assert.match(calls[2].sql, /INSERT INTO deployment_execution_reports/);
    assert.match(calls[3].sql, /INSERT INTO environment_promotion_history/);
    assert.match(calls[4].sql, /FROM release_bundles\s+WHERE bundle_id = \$1\s+LIMIT 1/);
    assert.match(calls[6].sql, /WHERE environment IS \$1 ORDER BY exported_at DESC, bundle_id DESC LIMIT \$2/);
    assert.deepEqual(calls[6].params, ["staging", 9]);
    assert.match(calls[7].sql, /ORDER BY exported_at DESC, bundle_id DESC LIMIT \$1/);
    assert.deepEqual(calls[7].params, [50]);
    assert.match(calls[8].sql, /INSERT INTO enterprise_capability_reports/);
    assert.match(calls[9].sql, /INSERT INTO incident_handoff_records/);
    assert.match(calls[10].sql, /INSERT INTO enterprise_governance_reports/);
    assert.deepEqual(calls[11].params, [1]);
    assert.deepEqual(calls[12].params, [20]);
    assert.deepEqual(calls[13].params, [5]);
});
test("AsyncExecutionRepository handles scoped lists, status filters, and empty counts", async () => {
    const execution = executionRecord();
    const precheck = {
        id: "precheck-1",
        executionId: "execution-1",
        allowed: 1,
        reasonCode: "ok",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 60000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
    };
    const deadLetter = {
        id: "dead-1",
        taskId: "task-1",
        executionId: "execution-1",
        finalReasonCode: "agent_failed",
        retryCount: 2,
        lastErrorMessage: "boom",
        movedAt: now,
    };
    const { connection, calls } = createConnection({
        queryRows: [[execution], [execution], [execution], [deadLetter]],
        queryOneRows: [execution, { count: 2 }, precheck, deadLetter],
    });
    const repo = new AsyncExecutionRepository(connection);
    assert.equal(await repo.getExecution("execution-1"), execution);
    assert.deepEqual(await repo.listExecutionsByTask("task-1", "tenant-a"), [execution]);
    assert.deepEqual(await repo.listExecutionsByTask("task-1"), [execution]);
    assert.deepEqual(await repo.listExecutionsByStatuses([]), []);
    assert.deepEqual(await repo.listExecutionsByStatuses(["executing", "prechecking"], 10), [execution]);
    assert.equal(await repo.countActiveExecutions(), 2);
    assert.equal(await repo.getExecutionPrecheck("execution-1"), precheck);
    assert.equal(await repo.getDeadLetterByExecutionId("execution-1"), deadLetter);
    assert.deepEqual(await repo.listDeadLettersByTask("task-1"), [deadLetter]);
    assert.match(calls[1].sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
    assert.deepEqual(calls[1].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[2].sql, /INNER JOIN tasks/);
    assert.match(calls[3].sql, /status IN \(\$1,\$2\).*LIMIT 10/);
    assert.deepEqual(calls[3].params, ["executing", "prechecking"]);
});
test("AsyncApprovalRepository writes approvals, takeover sessions, and operator actions", async () => {
    const { connection, calls } = createConnection({ executeResults: [1, 2, 3, 4, 5] });
    const repo = new AsyncApprovalRepository(connection);
    const takeover = {
        id: "takeover-1",
        taskId: "task-1",
        executionId: "execution-1",
        operatorId: "operator-1",
        status: "open",
        reasonCode: "manual",
        startedAt: now,
        closedAt: null,
    };
    const action = {
        id: "action-1",
        takeoverSessionId: "takeover-1",
        taskId: "task-1",
        executionId: "execution-1",
        operatorId: "operator-1",
        actionType: "complete_task",
        reasonCode: "manual",
        actionPayloadJson: "{}",
        beforeStateJson: "{}",
        afterStateJson: "{}",
        createdAt: now,
    };
    await repo.insertApproval(approvalRecord());
    await repo.updateApprovalDecision({
        approvalId: "approval-1",
        status: "approved",
        responseJson: '{"approved":true}',
        respondedAt: now,
    });
    await repo.insertTakeoverSession(takeover);
    await repo.closeTakeoverSession("takeover-1", now);
    await repo.insertOperatorAction(action);
    assert.match(calls[0].sql, /INSERT INTO approvals/);
    assert.deepEqual(calls[1].params, ["approved", '{"approved":true}', now, "approval-1"]);
    assert.match(calls[2].sql, /INSERT INTO takeover_sessions/);
    assert.match(calls[3].sql, /UPDATE takeover_sessions SET status = 'closed'/);
    assert.match(calls[4].sql, /INSERT INTO operator_actions/);
});
test("AsyncApprovalRepository builds tenant-scoped and unscoped approval queries", async () => {
    const approval = approvalRecord();
    const takeover = {
        id: "takeover-1",
        taskId: "task-1",
        executionId: "execution-1",
        operatorId: "operator-1",
        status: "open",
        reasonCode: "manual",
        startedAt: now,
        closedAt: null,
    };
    const action = {
        id: "action-1",
        takeoverSessionId: "takeover-1",
        taskId: "task-1",
        executionId: "execution-1",
        operatorId: "operator-1",
        actionType: "complete_task",
        reasonCode: "manual",
        actionPayloadJson: "{}",
        beforeStateJson: "{}",
        afterStateJson: "{}",
        createdAt: now,
    };
    const { connection, calls } = createConnection({
        queryRows: [[approval], [approval], [approval], [takeover], [takeover], [action], [action]],
        queryOneRows: [approval, undefined, takeover, undefined],
    });
    const repo = new AsyncApprovalRepository(connection);
    assert.deepEqual(await repo.listApprovalsByTask("task-1", "tenant-a"), [approval]);
    assert.deepEqual(await repo.listApprovalsByTask("task-1"), [approval]);
    assert.equal(await repo.getApproval("approval-1", "tenant-a"), approval);
    assert.equal(await repo.getApproval("missing-approval"), null);
    assert.deepEqual(await repo.listApprovalsByStatus("requested"), [approval]);
    assert.deepEqual(await repo.listTakeoverSessionsByTask("task-1", "tenant-a"), [takeover]);
    assert.deepEqual(await repo.listTakeoverSessionsByTask("task-1"), [takeover]);
    assert.equal(await repo.getTakeoverSession("takeover-1", "tenant-a"), takeover);
    assert.equal(await repo.getTakeoverSession("missing-takeover"), null);
    assert.deepEqual(await repo.listOperatorActionsByTask("task-1", "tenant-a"), [action]);
    assert.deepEqual(await repo.listOperatorActionsByTask("task-1"), [action]);
    assert.match(calls[0].sql, /INNER JOIN tasks t ON t\.id = a\.task_id/);
    assert.deepEqual(calls[0].params, ["task-1", "tenant-a"]);
    assert.doesNotMatch(calls[1].sql, /INNER JOIN tasks/);
    assert.match(calls[2].sql, /WHERE a\.id = \$1\s+AND t\.tenant_id = \$2/);
    assert.match(calls[5].sql, /INNER JOIN tasks t ON t\.id = x\.task_id/);
    assert.match(calls[9].sql, /INNER JOIN tasks t ON t\.id = o\.task_id/);
});
//# sourceMappingURL=async-repositories.test.js.map