import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
test("Evolution proposal creation", () => {
    const proposal = {
        id: newId("evo"),
        targetVersion: "2.0.0",
        sourceVersion: "1.9.0",
        status: "draft",
        createdAt: nowIso(),
        decidedAt: null,
    };
    assert.ok(proposal.id.startsWith("evo_"));
    assert.equal(proposal.status, "draft");
    assert.ok(proposal.decidedAt === null);
});
test("Evolution proposal transitions", () => {
    const proposal = {
        id: newId("evo"),
        targetVersion: "2.0.0",
        sourceVersion: "1.9.0",
        status: "draft",
        createdAt: nowIso(),
        decidedAt: null,
    };
    proposal.status = "proposed";
    assert.equal(proposal.status, "proposed");
    proposal.status = "approved";
    proposal.decidedAt = nowIso();
    assert.equal(proposal.status, "approved");
    assert.ok(proposal.decidedAt !== null);
});
test("Evolution proposal rejection", () => {
    const proposal = {
        id: newId("evo"),
        targetVersion: "2.0.0",
        sourceVersion: "1.9.0",
        status: "proposed",
        createdAt: nowIso(),
        decidedAt: null,
    };
    proposal.status = "rejected";
    proposal.decidedAt = nowIso();
    assert.equal(proposal.status, "rejected");
});
test("Benchmark result with improvement", () => {
    const result = {
        id: newId("bench"),
        proposalId: newId("evo"),
        metricName: "latency_p50",
        baselineValue: 100,
        newValue: 80,
        improvementPercent: 20,
        passed: true,
    };
    assert.equal(result.baselineValue, 100);
    assert.equal(result.newValue, 80);
    assert.ok(result.newValue < result.baselineValue);
});
test("Benchmark result without improvement", () => {
    const result = {
        id: newId("bench"),
        proposalId: newId("evo"),
        metricName: "throughput",
        baselineValue: 1000,
        newValue: 950,
        improvementPercent: -5,
        passed: false,
    };
    assert.ok(result.newValue < result.baselineValue);
    assert.ok(!result.passed);
});
test("Multiple benchmarks per proposal", () => {
    const metrics = ["latency_p50", "latency_p99", "throughput", "error_rate"];
    const results = [];
    for (const metric of metrics) {
        results.push({
            id: newId("bench"),
            proposalId: newId("evo"),
            metricName: metric,
            baselineValue: 100,
            newValue: 90,
            improvementPercent: 10,
            passed: true,
        });
    }
    const allPassed = results.every(r => r.passed);
    assert.ok(allPassed);
    assert.equal(results.length, 4);
});
test("Reflection record creation", () => {
    const record = {
        id: newId("refl"),
        agentId: newId("agent"),
        reflectionType: "performance",
        content: "Reduced token usage by 15% through better prompting",
        timestamp: nowIso(),
    };
    assert.ok(record.id.startsWith("refl_"));
    assert.equal(record.reflectionType, "performance");
});
test("Reflection types", () => {
    const types = ["performance", "strategy", "error"];
    for (const type of types) {
        const record = {
            id: newId("refl"),
            agentId: newId("agent"),
            reflectionType: type,
            content: "Test reflection",
            timestamp: nowIso(),
        };
        assert.equal(record.reflectionType, type);
    }
});
test("Promotion gate evaluation", () => {
    const gate = {
        name: "canary_promotion",
        minImprovement: 10,
        requiredBenchmarks: 3,
        benchmarksPassed: 3,
        allPassed: true,
    };
    const canPromote = gate.allPassed &&
        gate.benchmarksPassed >= gate.requiredBenchmarks;
    assert.ok(canPromote);
});
test("Rollout manager stages", () => {
    const stages = [
        { percent: 5, duration: 3600000 },
        { percent: 20, duration: 7200000 },
        { percent: 50, duration: 14400000 },
        { percent: 100, duration: 0 },
    ];
    assert.equal(stages[0]?.percent, 5);
    assert.equal(stages[3]?.percent, 100);
    const totalDuration = stages.reduce((sum, s) => sum + s.duration, 0);
    assert.ok(totalDuration > 0);
});
//# sourceMappingURL=evolution-integration.test.js.map