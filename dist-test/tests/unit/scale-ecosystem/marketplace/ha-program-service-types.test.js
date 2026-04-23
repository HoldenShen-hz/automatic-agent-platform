import assert from "node:assert/strict";
import test from "node:test";
test("HaProgramInput structure is correct", () => {
    const input = {
        environment: "prod",
        generatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.environment, "prod");
    assert.equal(input.generatedAt, "2026-04-14T00:00:00.000Z");
});
test("HaProgramInput allows minimal definition", () => {
    const input = {
        environment: "staging",
    };
    assert.equal(input.environment, "staging");
    assert.equal(input.generatedAt, undefined);
});
test("HaProgramComponent structure is correct", () => {
    const component = {
        componentId: "postgres",
        currentMode: "single_node",
        targetMode: "distributed_ha",
        ready: true,
        blockers: [],
    };
    assert.equal(component.componentId, "postgres");
    assert.equal(component.currentMode, "single_node");
    assert.equal(component.targetMode, "distributed_ha");
    assert.equal(component.ready, true);
    assert.equal(component.blockers.length, 0);
});
test("HaProgramComponent allows componentId values", () => {
    const componentIds = [
        "coordinator",
        "postgres",
        "redis_queue",
        "distributed_lock",
    ];
    for (const id of componentIds) {
        const component = {
            componentId: id,
            currentMode: "test",
            targetMode: "test",
            ready: false,
            blockers: ["test_blocker"],
        };
        assert.ok(component.componentId === id);
    }
});
test("HaProgramComponent allows blockers when not ready", () => {
    const component = {
        componentId: "redis_queue",
        currentMode: "standalone",
        targetMode: "cluster_mode",
        ready: false,
        blockers: ["missing_failover_config", "no_quorum_setup"],
    };
    assert.equal(component.ready, false);
    assert.equal(component.blockers.length, 2);
    assert.ok(component.blockers.includes("missing_failover_config"));
});
test("HaProgramReport structure is correct", () => {
    const report = {
        reportId: "ha_report_123",
        generatedAt: "2026-04-14T00:00:00.000Z",
        environment: "prod",
        overallStatus: "pass",
        activeWorkerCount: 50,
        activeLeaseCount: 120,
        components: [],
        rolloutPhases: ["phase_1", "phase_2", "phase_3"],
    };
    assert.equal(report.reportId, "ha_report_123");
    assert.equal(report.environment, "prod");
    assert.equal(report.overallStatus, "pass");
    assert.equal(report.activeWorkerCount, 50);
    assert.equal(report.rolloutPhases.length, 3);
});
test("HaProgramReport overallStatus accepts all valid values", () => {
    const statuses = ["warning", "fail", "pass"];
    for (const status of statuses) {
        const report = {
            reportId: "ha_test",
            generatedAt: "2026-04-14T00:00:00.000Z",
            environment: "dev",
            overallStatus: status,
            activeWorkerCount: 0,
            activeLeaseCount: 0,
            components: [],
            rolloutPhases: [],
        };
        assert.ok(report.overallStatus === status);
    }
});
test("HaProgramExportResult structure is correct", () => {
    const result = {
        report: {
            reportId: "ha_export",
            generatedAt: "2026-04-14T00:00:00.000Z",
            environment: "prod",
            overallStatus: "pass",
            activeWorkerCount: 25,
            activeLeaseCount: 60,
            components: [],
            rolloutPhases: ["phase_1"],
        },
        jsonArtifact: {
            artifactId: "art_ha_json",
            kind: "file",
            name: "ha-report.json",
            sizeBytes: 2048,
            uri: "file:///tmp/ha/report.json",
            createdAt: "2026-04-14T00:00:00.000Z",
        },
        markdownArtifact: {
            artifactId: "art_ha_md",
            kind: "file",
            name: "ha-report.md",
            sizeBytes: 1024,
            uri: "file:///tmp/ha/report.md",
            createdAt: "2026-04-14T00:00:00.000Z",
        },
    };
    assert.equal(result.report.reportId, "ha_export");
    assert.equal(result.jsonArtifact.artifactId, "art_ha_json");
    assert.equal(result.markdownArtifact.artifactId, "art_ha_md");
});
test("HaProgramServiceOptions structure is correct", () => {
    const options = {
        artifactStoreOptions: {
            rootDir: "/var/ha/artifacts",
        },
    };
    assert.ok(options.artifactStoreOptions !== undefined);
    assert.equal(options.artifactStoreOptions?.rootDir, "/var/ha/artifacts");
});
test("HaProgramServiceOptions allows empty options", () => {
    const options = {};
    assert.equal(options.artifactStoreOptions, undefined);
});
//# sourceMappingURL=ha-program-service-types.test.js.map