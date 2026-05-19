import assert from "node:assert/strict";
import test from "node:test";
import { DomainEvalFrameworkService } from "../../../../src/domains/domain-eval-framework-service.js";
function createTestFramework(domainId) {
    return {
        frameworkId: `framework_${domainId}`,
        domainId,
        version: "1.0.0",
        evaluators: [
            { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.8, blocking: true },
            { evaluatorId: "eval_latency", metric: "latency_ms", threshold: 200, blocking: false },
            { evaluatorId: "eval_cost", metric: "cost_usd", threshold: 1.0, blocking: false },
        ],
        releaseGates: {
            minFewShotCount: 5,
            minRegressionCaseCount: 10,
            requirePromptInjectionCoverage: true,
        },
        fewShotExamples: [
            { id: "ex1", input: "test", expectedOutput: "result", category: "basic" },
        ],
        onlineMetrics: ["error_rate", "throughput"],
    };
}
function createMinimalFramework(domainId) {
    return {
        frameworkId: `minimal_${domainId}`,
        domainId,
        version: "1.0.0",
        evaluators: [],
        releaseGates: {
            minFewShotCount: 0,
            minRegressionCaseCount: 0,
            requirePromptInjectionCoverage: false,
        },
        fewShotExamples: [],
        onlineMetrics: [],
    };
}
test("DomainEvalFrameworkService.register stores framework by domainId", () => {
    const service = new DomainEvalFrameworkService();
    const framework = createTestFramework("test_domain");
    service.register(framework);
    const retrieved = service.getFramework("test_domain");
    assert.ok(retrieved != null);
    assert.equal(retrieved?.domainId, "test_domain");
});
test("DomainEvalFrameworkService.getFramework returns null for unknown domain", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getFramework("nonexistent");
    assert.equal(result, null);
});
test("DomainEvalFrameworkService.registerQualityAxis adds axis to domain", () => {
    const service = new DomainEvalFrameworkService();
    const axis = {
        axisId: "axis_quality",
        name: "quality",
        description: "Quality metric",
        weight: 0.5,
        unit: "percentage",
        targetValue: 90,
        criticalThreshold: 85,
    };
    service.registerQualityAxis("test_domain", axis);
    const axes = service.getQualityAxes("test_domain");
    assert.equal(axes.length, 1);
    assert.equal(axes[0]?.axisId, "axis_quality");
});
test("DomainEvalFrameworkService.registerQualityAxis updates existing axis", () => {
    const service = new DomainEvalFrameworkService();
    const axis1 = {
        axisId: "axis_update",
        name: "quality",
        description: "Original",
        weight: 0.5,
        unit: "percentage",
        targetValue: 90,
    };
    const axis2 = {
        axisId: "axis_update",
        name: "quality",
        description: "Updated",
        weight: 0.6,
        unit: "percentage",
        targetValue: 95,
    };
    service.registerQualityAxis("test_domain", axis1);
    service.registerQualityAxis("test_domain", axis2);
    const axes = service.getQualityAxes("test_domain");
    assert.equal(axes.length, 1);
    assert.equal(axes[0]?.description, "Updated");
    assert.equal(axes[0]?.targetValue, 95);
});
test("DomainEvalFrameworkService.getQualityAxes returns empty array for unknown domain", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getQualityAxes("unknown");
    assert.deepEqual(result, []);
});
test("DomainEvalFrameworkService.registerAutomatedCheck adds check to domain", () => {
    const service = new DomainEvalFrameworkService();
    const check = {
        checkId: "check_safety",
        name: "Safety Check",
        metric: "safety_score",
        threshold: 0.95,
        enabled: true,
        executionMode: "realtime",
    };
    service.registerAutomatedCheck("test_domain", check);
    const checks = service.getAutomatedChecks("test_domain");
    assert.equal(checks.length, 1);
    assert.equal(checks[0]?.checkId, "check_safety");
});
test("DomainEvalFrameworkService.getAutomatedChecks returns empty for unknown domain", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getAutomatedChecks("unknown");
    assert.deepEqual(result, []);
});
test("DomainEvalFrameworkService.registerRubric adds rubric to domain", () => {
    const service = new DomainEvalFrameworkService();
    const rubric = {
        rubricId: "rubric_v1",
        name: "Quality Rubric",
        version: "1.0.0",
        criteria: [
            { criterionId: "crit_1", name: "Accuracy", description: "Test accuracy", scoreRange: { min: 0, max: 100 }, weight: 1 },
        ],
        instructions: "Evaluate quality",
    };
    service.registerRubric("test_domain", rubric);
    const rubrics = service.getRubrics("test_domain");
    assert.equal(rubrics.length, 1);
    assert.equal(rubrics[0]?.rubricId, "rubric_v1");
});
test("DomainEvalFrameworkService.getLatestRubric returns highest version", () => {
    const service = new DomainEvalFrameworkService();
    service.registerRubric("test_domain", {
        rubricId: "rubric_v1",
        name: "Rubric",
        version: "1.0.0",
        criteria: [],
        instructions: "Test",
    });
    service.registerRubric("test_domain", {
        rubricId: "rubric_v2",
        name: "Rubric",
        version: "2.0.0",
        criteria: [],
        instructions: "Test",
    });
    service.registerRubric("test_domain", {
        rubricId: "rubric_v1_5",
        name: "Rubric",
        version: "1.5.0",
        criteria: [],
        instructions: "Test",
    });
    const latest = service.getLatestRubric("test_domain");
    assert.ok(latest != null);
    assert.equal(latest?.version, "2.0.0");
});
test("DomainEvalFrameworkService.getLatestRubric returns null when no rubrics", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getLatestRubric("unknown");
    assert.equal(result, null);
});
test("DomainEvalFrameworkService.registerRegressionDataset stores dataset", () => {
    const service = new DomainEvalFrameworkService();
    const dataset = {
        datasetId: "dataset_1",
        domainId: "test_domain",
        name: "Regression Dataset",
        version: "1.0.0",
        cases: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
    };
    service.registerRegressionDataset(dataset);
    const retrieved = service.getRegressionDataset("dataset_1");
    assert.ok(retrieved != null);
    assert.equal(retrieved?.datasetId, "dataset_1");
});
test("DomainEvalFrameworkService.getRegressionDataset returns null for unknown", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getRegressionDataset("unknown");
    assert.equal(result, null);
});
test("DomainEvalFrameworkService.getRegressionDatasetsByDomain returns domain datasets", () => {
    const service = new DomainEvalFrameworkService();
    service.registerRegressionDataset({
        datasetId: "dataset_1",
        domainId: "coding",
        name: "Coding Cases",
        version: "1.0.0",
        cases: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
    });
    service.registerRegressionDataset({
        datasetId: "dataset_2",
        domainId: "data",
        name: "Data Cases",
        version: "1.0.0",
        cases: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
    });
    service.registerRegressionDataset({
        datasetId: "dataset_3",
        domainId: "coding",
        name: "More Coding Cases",
        version: "1.0.0",
        cases: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
    });
    const codingDatasets = service.getRegressionDatasetsByDomain("coding");
    assert.equal(codingDatasets.length, 2);
    assert.ok(codingDatasets.every((d) => d.domainId === "coding"));
});
test("DomainEvalFrameworkService.getRegressionDatasetsByDomain returns empty for unknown domain", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.getRegressionDatasetsByDomain("unknown");
    assert.deepEqual(result, []);
});
test("DomainEvalFrameworkService.assessQuality computes weighted quality score", () => {
    const service = new DomainEvalFrameworkService();
    service.register(createTestFramework("test_domain"));
    service.registerQualityAxis("test_domain", {
        axisId: "axis_quality",
        name: "quality_score",
        description: "Quality axis",
        weight: 0.5,
        unit: "percentage",
        targetValue: 80,
    });
    service.registerQualityAxis("test_domain", {
        axisId: "axis_speed",
        name: "speed_score",
        description: "Speed axis",
        weight: 0.5,
        unit: "percentage",
        targetValue: 70,
    });
    const assessment = service.assessQuality("test_domain", {
        quality_score: 85,
        speed_score: 75,
    });
    assert.ok(assessment.assessmentId.startsWith("quality_assessment_"));
    assert.equal(assessment.domainId, "test_domain");
    assert.ok(assessment.overallScore > 0);
    assert.equal(assessment.axisResults.length, 5); // 2 axes + 3 framework evaluators
});
test("DomainEvalFrameworkService.assessQuality throws for unknown domain", () => {
    const service = new DomainEvalFrameworkService();
    assert.throws(() => service.assessQuality("unknown", {}), /framework_not_found/);
});
test("DomainEvalFrameworkService.assessQuality considers blocking evaluators", () => {
    const service = new DomainEvalFrameworkService();
    const framework = createTestFramework("test_blocking");
    framework.evaluators = [
        { evaluatorId: "blocking_eval", metric: "critical_metric", threshold: 0.9, blocking: true },
    ];
    service.register(framework);
    // All metrics pass - should pass
    let assessment = service.assessQuality("test_blocking", { critical_metric: 0.95 });
    assert.equal(assessment.overallPassed, true);
    // Blocking metric fails - should fail
    assessment = service.assessQuality("test_blocking", { critical_metric: 0.5 });
    assert.equal(assessment.overallPassed, false);
});
test("DomainEvalFrameworkService.createRegressionDataset creates and stores dataset", () => {
    const service = new DomainEvalFrameworkService();
    const cases = [
        {
            caseId: "case_1",
            name: "Test Case",
            domainId: "coding",
            input: { key: "value" },
            expectedOutput: { result: "expected" },
            expectedClass: "pass",
            metadata: {},
        },
    ];
    const dataset = service.createRegressionDataset("coding", "New Dataset", cases);
    assert.ok(dataset.datasetId.startsWith("regression_dataset_"));
    assert.equal(dataset.domainId, "coding");
    assert.equal(dataset.name, "New Dataset");
    assert.equal(dataset.cases.length, 1);
    const retrieved = service.getRegressionDataset(dataset.datasetId);
    assert.ok(retrieved != null);
});
test("DomainEvalFrameworkService.addRegressionCase adds case to dataset", () => {
    const service = new DomainEvalFrameworkService();
    const dataset = service.createRegressionDataset("coding", "Test Dataset", []);
    const newCase = {
        caseId: "case_new",
        name: "New Case",
        domainId: "coding",
        input: {},
        expectedOutput: {},
        expectedClass: "pass",
        metadata: {},
    };
    const result = service.addRegressionCase(dataset.datasetId, newCase);
    assert.equal(result, true);
    const updated = service.getRegressionDataset(dataset.datasetId);
    assert.equal(updated?.cases.length, 1);
});
test("DomainEvalFrameworkService.addRegressionCase returns false for unknown dataset", () => {
    const service = new DomainEvalFrameworkService();
    const newCase = {
        caseId: "case_1",
        name: "Test",
        domainId: "coding",
        input: {},
        expectedOutput: {},
        expectedClass: "pass",
        metadata: {},
    };
    const result = service.addRegressionCase("unknown_dataset", newCase);
    assert.equal(result, false);
});
test("DomainEvalFrameworkService.removeRegressionCase removes case from dataset", () => {
    const service = new DomainEvalFrameworkService();
    const dataset = service.createRegressionDataset("coding", "Test Dataset", [
        {
            caseId: "case_to_remove",
            name: "To Remove",
            domainId: "coding",
            input: {},
            expectedOutput: {},
            expectedClass: "pass",
            metadata: {},
        },
    ]);
    const result = service.removeRegressionCase(dataset.datasetId, "case_to_remove");
    assert.equal(result, true);
    const updated = service.getRegressionDataset(dataset.datasetId);
    assert.equal(updated?.cases.length, 0);
});
test("DomainEvalFrameworkService.removeRegressionCase returns false for unknown case", () => {
    const service = new DomainEvalFrameworkService();
    const dataset = service.createRegressionDataset("coding", "Test Dataset", []);
    const result = service.removeRegressionCase(dataset.datasetId, "nonexistent_case");
    assert.equal(result, false);
});
test("DomainEvalFrameworkService.removeRegressionCase returns false for unknown dataset", () => {
    const service = new DomainEvalFrameworkService();
    const result = service.removeRegressionCase("unknown_dataset", "case_1");
    assert.equal(result, false);
});
test("DomainEvalFrameworkService.assessQuality with no axes or evaluators returns zero score", () => {
    const service = new DomainEvalFrameworkService();
    const minimal = createMinimalFramework("empty_domain");
    service.register(minimal);
    const assessment = service.assessQuality("empty_domain", {});
    assert.equal(assessment.overallScore, 0);
    assert.equal(assessment.axisResults.length, 0);
});
test("DomainEvalFrameworkService.assessQuality delta calculation is correct", () => {
    const service = new DomainEvalFrameworkService();
    const framework = createTestFramework("delta_test");
    framework.evaluators = [
        { evaluatorId: "delta_eval", metric: "delta_metric", threshold: 80, blocking: false },
    ];
    service.register(framework);
    const assessment = service.assessQuality("delta_test", { delta_metric: 90 });
    const deltaResult = assessment.axisResults.find((r) => r.name === "delta_metric");
    assert.ok(deltaResult);
    assert.equal(deltaResult.delta, 10); // 90 - 80 = 10
});
//# sourceMappingURL=domain-eval-framework-service.test.js.map