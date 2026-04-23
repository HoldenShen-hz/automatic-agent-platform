import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DiagnosticsExportService } from "../../../../../src/platform/shared/observability/diagnostics-export-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
function createStoreMock(inserted) {
    return {
        artifact: {
            insertArtifact(record) {
                inserted.push(record);
            },
        },
    };
}
function createDiagnosticsServiceMock() {
    return {
        buildMinimalReproBundle(taskId) {
            return {
                taskId,
                sensitivityWarning: "review before sharing",
                taskInputJson: "{\"prompt\":\"hello\"}",
                workflowState: null,
                taskResult: null,
                relevantMessages: [],
                toolUsage: [],
                sanitizedArtifacts: [],
                fileLocks: [],
                configSubset: {
                    configVersion: "v1",
                    promptBundleVersion: "v1",
                    enabledExtensions: [],
                },
                providerStatus: {
                    health: "healthy",
                    successRate: 1,
                    recentCalls: 2,
                },
                dispatchDecisions: [],
            };
        },
        buildIncidentTimelineReport(taskId) {
            return {
                taskId,
                traceSummary: {
                    traceId: "trace-1",
                    correlationId: "corr-1",
                    primarySpanId: null,
                    parentSpanId: null,
                    spanCount: 1,
                },
                window: {
                    startedAt: "2026-04-16T10:00:00.000Z",
                    endedAt: "2026-04-16T10:05:00.000Z",
                    durationMs: 300000,
                },
                summary: {
                    totalEntries: 1,
                    eventCount: 1,
                    dispatchCount: 0,
                    stepOutputCount: 0,
                    approvalCount: 0,
                    artifactCount: 0,
                    logCount: 0,
                    remoteLogCount: 0,
                    messageCount: 0,
                    compactionCount: 0,
                    highestSeverity: "warning",
                },
                warnings: {
                    totalEvents: 1,
                    totalUniqueWarnings: 1,
                    suppressedDuplicateCount: 0,
                    highestSeverity: "warning",
                    escalationTargets: ["operator"],
                    entries: [
                        {
                            code: "dispatch.blocked",
                            category: "runtime",
                            severity: "warning",
                            escalation: "operator",
                            count: 1,
                            suppressedCount: 0,
                        },
                    ],
                },
                candidateRootCauses: ["remote worker unavailable"],
                entries: [
                    {
                        id: "entry-1",
                        source: "event",
                        occurredAt: "2026-04-16T10:01:00.000Z",
                        title: "dispatch:blocked",
                        summary: "Dispatch blocked by remote capacity",
                        severity: "warn",
                        data: {},
                    },
                ],
            };
        },
    };
}
test("DiagnosticsExportService exports a minimal repro bundle and indexes the artifact", () => {
    const workspace = createTempWorkspace("aa-diagnostics-export-");
    const artifactRoot = join(workspace, "artifacts");
    const inserted = [];
    try {
        const service = new DiagnosticsExportService(createDiagnosticsServiceMock(), createStoreMock(inserted), { rootDir: artifactRoot });
        const result = service.exportMinimalReproBundle("task-1");
        assert.equal(result.bundle.taskId, "task-1");
        assert.equal(inserted.length, 1);
        assert.ok(existsSync(result.artifact.uri));
        const persisted = JSON.parse(readFileSync(result.artifact.uri, "utf8"));
        assert.equal(persisted.bundle.taskId, "task-1");
        assert.equal(typeof persisted.exportedAt, "string");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("DiagnosticsExportService exports incident timeline as both json and markdown artifacts", () => {
    const workspace = createTempWorkspace("aa-diagnostics-export-");
    const artifactRoot = join(workspace, "artifacts");
    const inserted = [];
    try {
        const service = new DiagnosticsExportService(createDiagnosticsServiceMock(), createStoreMock(inserted), { rootDir: artifactRoot });
        const result = service.exportIncidentTimeline("task-2");
        assert.equal(result.report.taskId, "task-2");
        assert.equal(inserted.length, 2);
        assert.ok(existsSync(result.jsonArtifact.uri));
        assert.ok(existsSync(result.markdownArtifact.uri));
        const jsonArtifact = JSON.parse(readFileSync(result.jsonArtifact.uri, "utf8"));
        const markdownArtifact = readFileSync(result.markdownArtifact.uri, "utf8");
        assert.equal((jsonArtifact.report.taskId), "task-2");
        assert.match(markdownArtifact, /# Incident Timeline: task-2/);
        assert.match(markdownArtifact, /remote worker unavailable/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("DiagnosticsExportService exports one stalled execution artifact per package", () => {
    const workspace = createTempWorkspace("aa-diagnostics-export-");
    const artifactRoot = join(workspace, "artifacts");
    const inserted = [];
    try {
        const service = new DiagnosticsExportService(createDiagnosticsServiceMock(), createStoreMock(inserted), { rootDir: artifactRoot });
        const result = service.exportStalledExecutionEscalations([
            {
                executionId: "exec-1",
                taskId: "task-3",
                agentId: "agent-1",
                status: "running",
                staleKind: "missing_heartbeat",
                recommendedAction: "lease_reclaim",
                suggestedOperatorAction: "reclaim_lease_and_requeue",
                generatedAt: "2026-04-16T10:10:00.000Z",
                traceId: "trace-3",
                correlationId: "corr-3",
                currentStepId: "step-1",
                runtimeInstanceId: "runtime-3",
                lastProgressAt: "2026-04-16T10:00:00.000Z",
                lastHeartbeatAt: "2026-04-16T10:05:00.000Z",
                dispatchOutcome: "dispatched",
                healthStatus: "warn",
                warnings: {
                    totalEvents: 1,
                    totalUniqueWarnings: 1,
                    suppressedDuplicateCount: 0,
                    highestSeverity: "warning",
                    escalationTargets: ["operator"],
                    entries: [],
                },
                incident: {
                    totalEntries: 2,
                    highestSeverity: "warning",
                    candidateRootCauses: ["worker stalled"],
                    startedAt: "2026-04-16T09:00:00.000Z",
                    endedAt: "2026-04-16T10:10:00.000Z",
                },
            },
        ]);
        assert.equal(result.packages.length, 1);
        assert.equal(result.artifacts.length, 1);
        assert.equal(inserted.length, 1);
        assert.ok(existsSync(result.artifacts[0].uri));
        const persisted = JSON.parse(readFileSync(result.artifacts[0].uri, "utf8"));
        assert.equal((persisted.package.executionId), "exec-1");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=diagnostics-export-service.test.js.map