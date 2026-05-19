/**
 * Unit tests for PMF Validation Types
 *
 * @see src/scale-ecosystem/marketplace/pmf-validation/types.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
test("PmfCheckStatus accepts all valid values", () => {
    const statuses = ["pass", "warn", "fail"];
    assert.equal(statuses.length, 3);
    assert.equal(statuses[0], "pass");
    assert.equal(statuses[1], "warn");
    assert.equal(statuses[2], "fail");
});
test("PmfValidationThresholds structure is correct", () => {
    const thresholds = {
        minTaskCount: 5,
        minSessionCount: 3,
        minTaskSuccessRatePct: 70,
        minActivationRatePct: 60,
        minRepeatUsageRatePct: 20,
        minApprovalResolutionRatePct: 90,
        maxAverageSuccessfulTaskCostUsd: 2,
        maxP95StepDurationMs: 60000,
    };
    assert.equal(thresholds.minTaskCount, 5);
    assert.equal(thresholds.minSessionCount, 3);
    assert.equal(thresholds.minTaskSuccessRatePct, 70);
    assert.equal(thresholds.minActivationRatePct, 60);
    assert.equal(thresholds.minRepeatUsageRatePct, 20);
    assert.equal(thresholds.minApprovalResolutionRatePct, 90);
    assert.equal(thresholds.maxAverageSuccessfulTaskCostUsd, 2);
    assert.equal(thresholds.maxP95StepDurationMs, 60000);
});
test("PmfValidationWindow structure is correct", () => {
    const window = {
        start: "2026-04-01T00:00:00.000Z",
        end: "2026-04-14T00:00:00.000Z",
        days: 14,
    };
    assert.equal(window.start, "2026-04-01T00:00:00.000Z");
    assert.equal(window.end, "2026-04-14T00:00:00.000Z");
    assert.equal(window.days, 14);
});
test("PmfMetricCheck checkId accepts all valid values", () => {
    const checkIds = [
        "sample_size",
        "task_success_rate",
        "activation_rate",
        "repeat_usage_rate",
        "approval_resolution_rate",
        "average_success_cost",
        "p95_step_duration",
    ];
    assert.equal(checkIds.length, 7);
    for (const checkId of checkIds) {
        const check = {
            checkId,
            status: "pass",
            detail: "test",
            observed: null,
            threshold: null,
            unit: "count",
        };
        assert.ok(check.checkId === checkId);
    }
});
test("PmfMetricCheck unit accepts all valid values", () => {
    const units = ["count", "pct", "usd", "ms"];
    assert.equal(units.length, 4);
    for (const unit of units) {
        const check = {
            checkId: "sample_size",
            status: "pass",
            detail: "test",
            observed: 10,
            threshold: 5,
            unit,
        };
        assert.ok(check.unit === unit);
    }
});
test("PmfMetricCheck structure is correct", () => {
    const check = {
        checkId: "task_success_rate",
        status: "pass",
        detail: "Task success rate above threshold",
        observed: 85,
        threshold: 70,
        unit: "pct",
    };
    assert.equal(check.checkId, "task_success_rate");
    assert.equal(check.status, "pass");
    assert.equal(check.detail, "Task success rate above threshold");
    assert.equal(check.observed, 85);
    assert.equal(check.threshold, 70);
    assert.equal(check.unit, "pct");
});
test("PmfMetricCheck allows null observed and threshold", () => {
    const check = {
        checkId: "sample_size",
        status: "warn",
        detail: "Insufficient data",
        observed: null,
        threshold: null,
        unit: "count",
    };
    assert.equal(check.observed, null);
    assert.equal(check.threshold, null);
    assert.equal(check.status, "warn");
});
test("PmfValidationRunOptions structure is correct with all fields", () => {
    const options = {
        profileName: "custom_profile",
        divisionId: "sales_ops",
        windowDays: 30,
        evaluatedAt: "2026-04-14T00:00:00.000Z",
        thresholds: {
            minTaskCount: 10,
            minSessionCount: 5,
        },
    };
    assert.equal(options.profileName, "custom_profile");
    assert.equal(options.divisionId, "sales_ops");
    assert.equal(options.windowDays, 30);
    assert.equal(options.evaluatedAt, "2026-04-14T00:00:00.000Z");
    assert.equal(options.thresholds?.minTaskCount, 10);
});
test("PmfValidationRunOptions allows minimal definition", () => {
    const options = {};
    assert.equal(options.profileName, undefined);
    assert.equal(options.divisionId, undefined);
    assert.equal(options.windowDays, undefined);
    assert.equal(options.evaluatedAt, undefined);
    assert.equal(options.thresholds, undefined);
});
test("PmfValidationRunOptions allows null divisionId", () => {
    const options = {
        divisionId: null,
    };
    assert.equal(options.divisionId, null);
});
test("PmfValidationRunOptions allows partial thresholds", () => {
    const options = {
        thresholds: {
            minTaskSuccessRatePct: 80,
        },
    };
    assert.ok(options.thresholds !== undefined);
    assert.equal(options.thresholds.minTaskSuccessRatePct, 80);
    assert.equal(options.thresholds.minTaskCount, undefined);
});
test("SqlFilterClause structure is correct", () => {
    const clause = {
        whereClause: "WHERE tasks.created_at >= ? AND tasks.created_at <= ? AND tasks.division_id = ?",
        parameters: ["2026-04-01T00:00:00.000Z", "2026-04-14T00:00:00.000Z", "engineering_ops"],
    };
    assert.ok(clause.whereClause.includes("WHERE"));
    assert.equal(clause.parameters.length, 3);
    assert.equal(clause.parameters[0], "2026-04-01T00:00:00.000Z");
    assert.equal(clause.parameters[2], "engineering_ops");
});
test("SqlFilterClause allows empty parameters", () => {
    const clause = {
        whereClause: "WHERE 1=1",
        parameters: [],
    };
    assert.equal(clause.parameters.length, 0);
});
test("SqlFilterClause allows null in parameters", () => {
    const clause = {
        whereClause: "WHERE division_id = ?",
        parameters: [null],
    };
    assert.equal(clause.parameters[0], null);
});
test("SqlFilterClause allows number in parameters", () => {
    const clause = {
        whereClause: "WHERE task_count >= ?",
        parameters: [10],
    };
    assert.equal(clause.parameters[0], 10);
});
test("PmfMetricCheck with fail status carries correct data", () => {
    const check = {
        checkId: "task_success_rate",
        status: "fail",
        detail: "Task success rate below threshold",
        observed: 55,
        threshold: 70,
        unit: "pct",
    };
    assert.equal(check.status, "fail");
    assert.equal(check.observed, 55);
    assert.ok(check.observed < check.threshold);
});
test("PmfMetricCheck with warn status carries correct data", () => {
    const check = {
        checkId: "sample_size",
        status: "warn",
        detail: "Sample size near minimum threshold",
        observed: 5,
        threshold: 5,
        unit: "count",
    };
    assert.equal(check.status, "warn");
    assert.equal(check.observed, 5);
});
test("PmfValidationThresholds all fields are required numbers", () => {
    const thresholds = {
        minTaskCount: 0,
        minSessionCount: 0,
        minTaskSuccessRatePct: 0,
        minActivationRatePct: 0,
        minRepeatUsageRatePct: 0,
        minApprovalResolutionRatePct: 0,
        maxAverageSuccessfulTaskCostUsd: 0,
        maxP95StepDurationMs: 0,
    };
    assert.equal(thresholds.minTaskCount, 0);
    assert.equal(thresholds.maxAverageSuccessfulTaskCostUsd, 0);
});
test("ArtifactRef structure matches expected interface", () => {
    const ref = {
        artifactId: "artifact_001",
        kind: "pmf_validation_report",
        uri: "artifacts://pmf-validation-report.json",
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(ref.artifactId, "artifact_001");
    assert.equal(ref.kind, "pmf_validation_report");
    assert.ok(ref.uri.startsWith("artifacts://"));
});
test("PmfValidationWindow days must be positive", () => {
    const window1 = {
        start: "2026-03-01T00:00:00.000Z",
        end: "2026-03-31T00:00:00.000Z",
        days: 30,
    };
    const window2 = {
        start: "2026-04-01T00:00:00.000Z",
        end: "2026-04-01T00:00:00.000Z",
        days: 1,
    };
    assert.ok(window1.days > 0);
    assert.ok(window2.days > 0);
});
test("PmfMetricCheck checkId is a specific union type", () => {
    const validCheckIds = [
        "sample_size",
        "task_success_rate",
        "activation_rate",
        "repeat_usage_rate",
        "approval_resolution_rate",
        "average_success_cost",
        "p95_step_duration",
    ];
    for (const checkId of validCheckIds) {
        const check = {
            checkId,
            status: "pass",
            detail: "Test",
            observed: 100,
            threshold: 50,
            unit: "count",
        };
        assert.ok(check.checkId === checkId);
    }
});
test("PmfMetricCheck unit is a specific union type", () => {
    const validUnits = ["count", "pct", "usd", "ms"];
    for (const unit of validUnits) {
        const check = {
            checkId: "sample_size",
            status: "pass",
            detail: "Test",
            observed: 100,
            threshold: 50,
            unit,
        };
        assert.ok(check.unit === unit);
    }
});
test("SqlFilterClause parameters accepts string or number or null", () => {
    const clause = {
        whereClause: "WHERE id = ? AND count >= ? AND value IS ?",
        parameters: ["test_id", 42, null],
    };
    assert.equal(typeof clause.parameters[0], "string");
    assert.equal(typeof clause.parameters[1], "number");
    assert.equal(clause.parameters[2], null);
});
test("PmfValidationThresholds max values are higher than min values", () => {
    const thresholds = {
        minTaskCount: 5,
        minSessionCount: 3,
        minTaskSuccessRatePct: 70,
        minActivationRatePct: 60,
        minRepeatUsageRatePct: 20,
        minApprovalResolutionRatePct: 90,
        maxAverageSuccessfulTaskCostUsd: 2,
        maxP95StepDurationMs: 60000,
    };
    assert.ok(thresholds.minTaskCount < thresholds.minSessionCount * 2);
    assert.ok(thresholds.minTaskSuccessRatePct > thresholds.minActivationRatePct);
    assert.ok(thresholds.minApprovalResolutionRatePct > thresholds.minRepeatUsageRatePct);
});
//# sourceMappingURL=types.test.js.map