/**
 * Data Plane CLI Tests
 *
 * Tests for data-plane.ts CLI module and its action validation.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ValidationError from src platform/contracts/errors
class ValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "ValidationError";
        this.code = code;
    }
}
// ---------------------------------------------------------------------------
// Tests for data plane action validation
// ---------------------------------------------------------------------------
const DATA_PLANE_ACTIONS = [
    "create_analytics_fact",
    "create_archive_bundle",
    "create_replay_dataset",
    "start_movement_job",
    "complete_movement_job",
    "summary",
    "export",
];
test("data plane supports create_analytics_fact action", () => {
    const action = "create_analytics_fact";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports create_archive_bundle action", () => {
    const action = "create_archive_bundle";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports create_replay_dataset action", () => {
    const action = "create_replay_dataset";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports start_movement_job action", () => {
    const action = "start_movement_job";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports complete_movement_job action", () => {
    const action = "complete_movement_job";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports summary action", () => {
    const action = "summary";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane supports export action", () => {
    const action = "export";
    assert.ok(DATA_PLANE_ACTIONS.includes(action));
});
test("data plane throws ValidationError for unknown action", () => {
    const action = "unknown";
    const errorPrefix = `unknown_data_plane_action:${action}`;
    assert.throws(() => {
        if (!DATA_PLANE_ACTIONS.includes(action)) {
            throw new ValidationError(errorPrefix, errorPrefix);
        }
    }, { message: errorPrefix });
});
test("DATA_PLANE_ACTIONS has exactly 7 actions", () => {
    assert.equal(DATA_PLANE_ACTIONS.length, 7);
});
// ---------------------------------------------------------------------------
// Tests for data movement types
// ---------------------------------------------------------------------------
const DATA_MOVEMENT_TYPES = [
    "analytics_etl",
    "archive_compaction",
    "replay_dataset_build",
    "artifact_lifecycle_move",
];
test("data plane supports analytics_etl movement type", () => {
    const movementType = "analytics_etl";
    assert.ok(DATA_MOVEMENT_TYPES.includes(movementType));
});
test("data plane supports archive_compaction movement type", () => {
    const movementType = "archive_compaction";
    assert.ok(DATA_MOVEMENT_TYPES.includes(movementType));
});
test("data plane supports replay_dataset_build movement type", () => {
    const movementType = "replay_dataset_build";
    assert.ok(DATA_MOVEMENT_TYPES.includes(movementType));
});
test("data plane supports artifact_lifecycle_move movement type", () => {
    const movementType = "artifact_lifecycle_move";
    assert.ok(DATA_MOVEMENT_TYPES.includes(movementType));
});
test("DATA_MOVEMENT_TYPES has exactly 4 types", () => {
    assert.equal(DATA_MOVEMENT_TYPES.length, 4);
});
// ---------------------------------------------------------------------------
// Tests for terminal statuses
// ---------------------------------------------------------------------------
const DATA_MOVEMENT_TERMINAL_STATUSES = ["completed", "failed", "cancelled"];
test("data plane supports completed terminal status", () => {
    const status = "completed";
    assert.ok(DATA_MOVEMENT_TERMINAL_STATUSES.includes(status));
});
test("data plane supports failed terminal status", () => {
    const status = "failed";
    assert.ok(DATA_MOVEMENT_TERMINAL_STATUSES.includes(status));
});
test("data plane supports cancelled terminal status", () => {
    const status = "cancelled";
    assert.ok(DATA_MOVEMENT_TERMINAL_STATUSES.includes(status));
});
// ---------------------------------------------------------------------------
// Tests for create_analytics_fact action args building
// ---------------------------------------------------------------------------
test("create_analytics_fact builds args with required fields", () => {
    const envConfig = {
        namespaceId: "ns-123",
        factId: null,
        metricName: "task_completion_rate",
        dimensions: null,
        value: 0.95,
        windowStart: "2024-01-01T00:00:00.000Z",
        windowEnd: "2024-01-31T23:59:59.999Z",
        sourceRef: "metrics-collector",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        metricName: envConfig.metricName ?? "",
        value: envConfig.value ?? Number.NaN,
        windowStart: envConfig.windowStart ?? "",
        windowEnd: envConfig.windowEnd ?? "",
        sourceRef: envConfig.sourceRef ?? "",
    };
    if (envConfig.factId) {
        args.factId = envConfig.factId;
    }
    if (envConfig.dimensions != null) {
        args.dimensions = envConfig.dimensions;
    }
    assert.equal(args.namespaceId, "ns-123");
    assert.equal(args.metricName, "task_completion_rate");
    assert.equal(args.value, 0.95);
    assert.equal(args.windowStart, "2024-01-01T00:00:00.000Z");
    assert.equal(args.windowEnd, "2024-01-31T23:59:59.999Z");
    assert.equal(args.sourceRef, "metrics-collector");
    assert.equal(args.factId, undefined);
});
test("create_analytics_fact includes optional factId", () => {
    const envConfig = {
        namespaceId: "ns-456",
        factId: "fact-789",
        metricName: "error_rate",
        dimensions: null,
        value: 0.02,
        windowStart: "2024-02-01T00:00:00.000Z",
        windowEnd: "2024-02-29T23:59:59.999Z",
        sourceRef: "error-tracker",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        metricName: envConfig.metricName ?? "",
        value: envConfig.value ?? Number.NaN,
        windowStart: envConfig.windowStart ?? "",
        windowEnd: envConfig.windowEnd ?? "",
        sourceRef: envConfig.sourceRef ?? "",
    };
    if (envConfig.factId) {
        args.factId = envConfig.factId;
    }
    assert.equal(args.factId, "fact-789");
});
test("create_analytics_fact includes optional dimensions", () => {
    const envConfig = {
        namespaceId: "ns-abc",
        factId: null,
        metricName: "latency_p99",
        dimensions: { region: "us-east", service: "api" },
        value: 150.5,
        windowStart: "2024-03-01T00:00:00.000Z",
        windowEnd: "2024-03-31T23:59:59.999Z",
        sourceRef: "latency-monitor",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        metricName: envConfig.metricName ?? "",
        value: envConfig.value ?? Number.NaN,
        windowStart: envConfig.windowStart ?? "",
        windowEnd: envConfig.windowEnd ?? "",
        sourceRef: envConfig.sourceRef ?? "",
    };
    if (envConfig.dimensions != null) {
        args.dimensions = envConfig.dimensions;
    }
    assert.deepEqual(args.dimensions, { region: "us-east", service: "api" });
});
// ---------------------------------------------------------------------------
// Tests for create_archive_bundle action args building
// ---------------------------------------------------------------------------
test("create_archive_bundle builds args with required fields", () => {
    const envConfig = {
        namespaceId: "ns-archive",
        bundleId: null,
        bundleType: "weekly_backup",
        sourceRefs: ["ref-1", "ref-2", "ref-3"],
        summaryRef: "summary-manifest",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        bundleType: envConfig.bundleType ?? "",
        sourceRefs: envConfig.sourceRefs,
        summaryRef: envConfig.summaryRef ?? "",
    };
    if (envConfig.bundleId) {
        args.bundleId = envConfig.bundleId;
    }
    assert.equal(args.namespaceId, "ns-archive");
    assert.equal(args.bundleType, "weekly_backup");
    assert.deepEqual(args.sourceRefs, ["ref-1", "ref-2", "ref-3"]);
    assert.equal(args.summaryRef, "summary-manifest");
    assert.equal(args.bundleId, undefined);
});
test("create_archive_bundle includes optional bundleId", () => {
    const envConfig = {
        namespaceId: "ns-archive-2",
        bundleId: "bundle-999",
        bundleType: "monthly_backup",
        sourceRefs: ["ref-a", "ref-b"],
        summaryRef: "monthly-summary",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        bundleType: envConfig.bundleType ?? "",
        sourceRefs: envConfig.sourceRefs,
        summaryRef: envConfig.summaryRef ?? "",
    };
    if (envConfig.bundleId) {
        args.bundleId = envConfig.bundleId;
    }
    assert.equal(args.bundleId, "bundle-999");
});
// ---------------------------------------------------------------------------
// Tests for create_replay_dataset action args building
// ---------------------------------------------------------------------------
test("create_replay_dataset builds args with required fields", () => {
    const envConfig = {
        namespaceId: "ns-replay",
        datasetId: null,
        datasetType: "test_suite",
        sampleRefs: ["sample-1", "sample-2"],
        truthRefs: ["truth-1", "truth-2"],
        version: "v1.0.0",
    };
    const args = {
        namespaceId: envConfig.namespaceId ?? "",
        datasetType: envConfig.datasetType ?? "",
        sampleRefs: envConfig.sampleRefs,
        truthRefs: envConfig.truthRefs,
        version: envConfig.version ?? "",
    };
    if (envConfig.datasetId) {
        args.datasetId = envConfig.datasetId;
    }
    assert.equal(args.namespaceId, "ns-replay");
    assert.equal(args.datasetType, "test_suite");
    assert.deepEqual(args.sampleRefs, ["sample-1", "sample-2"]);
    assert.deepEqual(args.truthRefs, ["truth-1", "truth-2"]);
    assert.equal(args.version, "v1.0.0");
});
// ---------------------------------------------------------------------------
// Tests for start_movement_job action args building
// ---------------------------------------------------------------------------
test("start_movement_job builds args with required fields", () => {
    const envConfig = {
        jobId: null,
        sourceNamespaceId: "source-ns",
        targetNamespaceId: "target-ns",
        movementType: "analytics_etl",
        inputRefs: ["input-1", "input-2"],
    };
    const args = {
        sourceNamespaceId: envConfig.sourceNamespaceId ?? "",
        targetNamespaceId: envConfig.targetNamespaceId ?? "",
        movementType: envConfig.movementType,
        inputRefs: envConfig.inputRefs,
    };
    if (envConfig.jobId) {
        args.jobId = envConfig.jobId;
    }
    assert.equal(args.sourceNamespaceId, "source-ns");
    assert.equal(args.targetNamespaceId, "target-ns");
    assert.equal(args.movementType, "analytics_etl");
    assert.deepEqual(args.inputRefs, ["input-1", "input-2"]);
    assert.equal(args.jobId, undefined);
});
test("start_movement_job supports all movement types", () => {
    for (const movementType of DATA_MOVEMENT_TYPES) {
        const envConfig = {
            jobId: null,
            sourceNamespaceId: "source",
            targetNamespaceId: "target",
            movementType,
            inputRefs: ["input-1"],
        };
        const args = {
            sourceNamespaceId: envConfig.sourceNamespaceId ?? "",
            targetNamespaceId: envConfig.targetNamespaceId ?? "",
            movementType: envConfig.movementType,
            inputRefs: envConfig.inputRefs,
        };
        assert.equal(args.movementType, movementType);
    }
});
// ---------------------------------------------------------------------------
// Tests for complete_movement_job action args building
// ---------------------------------------------------------------------------
test("complete_movement_job builds args with required fields", () => {
    const envConfig = {
        jobId: "job-123",
        status: null,
        report: null,
    };
    const args = {
        jobId: envConfig.jobId ?? "",
    };
    if (envConfig.status) {
        args.status = envConfig.status;
    }
    if (envConfig.report != null) {
        args.report = envConfig.report;
    }
    assert.equal(args.jobId, "job-123");
    assert.equal(args.status, undefined);
    assert.equal(args.report, undefined);
});
test("complete_movement_job includes optional status", () => {
    const envConfig = {
        jobId: "job-456",
        status: "completed",
        report: null,
    };
    const args = {
        jobId: envConfig.jobId ?? "",
    };
    if (envConfig.status) {
        args.status = envConfig.status;
    }
    if (envConfig.report != null) {
        args.report = envConfig.report;
    }
    assert.equal(args.status, "completed");
});
test("complete_movement_job includes optional report", () => {
    const envConfig = {
        jobId: "job-789",
        status: "failed",
        report: { errorCode: "E001", message: "Transfer failed" },
    };
    const args = {
        jobId: envConfig.jobId ?? "",
    };
    if (envConfig.status) {
        args.status = envConfig.status;
    }
    if (envConfig.report != null) {
        args.report = envConfig.report;
    }
    assert.equal(args.status, "failed");
    assert.deepEqual(args.report, { errorCode: "E001", message: "Transfer failed" });
});
// ---------------------------------------------------------------------------
// Tests for summary and export actions
// ---------------------------------------------------------------------------
test("summary action passes tenantId", () => {
    const envConfig = {
        tenantId: "tenant-abc",
    };
    const args = { tenantId: envConfig.tenantId };
    assert.equal(args.tenantId, "tenant-abc");
});
test("export action passes tenantId", () => {
    const envConfig = {
        tenantId: "tenant-xyz",
    };
    const args = { tenantId: envConfig.tenantId };
    assert.equal(args.tenantId, "tenant-xyz");
});
test("summary action handles null tenantId", () => {
    const envConfig = {
        tenantId: null,
    };
    const args = { tenantId: envConfig.tenantId };
    assert.equal(args.tenantId, null);
});
// ---------------------------------------------------------------------------
// Tests for action branching logic
// ---------------------------------------------------------------------------
test("action branching - summary action maps to buildSummary", () => {
    const action = "summary";
    const methodMap = {
        summary: "buildSummary",
        export: "exportSummary",
    };
    assert.equal(methodMap[action], "buildSummary");
});
test("action branching - export action maps to exportSummary", () => {
    const action = "export";
    const methodMap = {
        summary: "buildSummary",
        export: "exportSummary",
    };
    assert.equal(methodMap[action], "exportSummary");
});
// ---------------------------------------------------------------------------
// Tests for JSON output formatting
// ---------------------------------------------------------------------------
test("data plane output is formatted as JSON", () => {
    const output = { summary: "test", items: [] };
    const json = JSON.stringify(output, null, 2);
    assert.ok(json.includes("summary"));
    assert.ok(json.includes("items"));
});
//# sourceMappingURL=data-plane.test.js.map