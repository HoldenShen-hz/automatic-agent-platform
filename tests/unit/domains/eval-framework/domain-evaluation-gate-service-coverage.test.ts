import { describe, it, expect } from "node:test";
import { DomainEvaluationGateService } from "../../../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import type { DomainEvalFramework } from "../../../../../src/domains/eval-framework/index.js";

describe("DomainEvaluationGateService", () => {
  let service: DomainEvaluationGateService;

  beforeEach(() => {
    service = new DomainEvaluationGateService();
  });

  const createMockFramework = (overrides?: Partial<DomainEvalFramework>): DomainEvalFramework => ({
    frameworkId: "framework_1",
    domainId: "domain_1",
    evaluators: [
      {
        evaluatorId: "eval_1",
        metric: "accuracy",
        threshold: 0.9,
        blocking: true,
      },
      {
        evaluatorId: "eval_2",
        metric: "latency",
        threshold: 100,
        blocking: false,
      },
    ],
    fewShotExamples: [
      { input: "test", expected: "result" },
      { input: "test2", expected: "result2" },
    ],
    releaseGates: {
      minFewShotCount: 2,
      minRegressionCaseCount: 10,
      requirePromptInjectionCoverage: true,
    },
    onlineMetrics: ["accuracy", "latency", "cost"],
    ...overrides,
  });

  const createMockRun = (overrides?: {
    cases?: Array<{ caseId: string; metric: string; score: number; expectedClass: string; approvalMatched?: boolean }>;
    domainId?: string;
  }) => ({
    suiteId: "suite_1",
    domainId: overrides?.domainId ?? "domain_1",
    releaseType: "daily" as const,
    executionMode: "supervised" as const,
    storageMode: "sqlite" as const,
    cases: overrides?.cases ?? [
      { caseId: "case_1", metric: "accuracy", score: 0.95, expectedClass: "pass", approvalMatched: true },
      { caseId: "case_2", metric: "accuracy", score: 0.92, expectedClass: "pass", approvalMatched: true },
      { caseId: "case_3", metric: "latency", score: 80, expectedClass: "pass", approvalMatched: true },
    ],
  });

  describe("evaluateSuite", () => {
    it("should throw for empty regression suite", () => {
      const framework = createMockFramework();
      const run = createMockRun({ cases: [] });
      expect(() => service.evaluateSuite(framework, run)).toThrow("domain_eval.empty_regression_suite");
    });

    it("should throw for domain mismatch", () => {
      const framework = createMockFramework({ domainId: "domain_1" });
      const run = createMockRun({ domainId: "domain_2" });
      expect(() => service.evaluateSuite(framework, run)).toThrow("domain_eval.domain_mismatch");
    });

    it("should return pass when all metrics meet thresholds", () => {
      const framework = createMockFramework();
      const run = createMockRun();
      const report = service.evaluateSuite(framework, run);
      expect(report.overallPass).toBe(true);
      expect(report.releaseDecision).toBe("promote");
      expect(report.blockingFailures).toHaveLength(0);
    });

    it("should return fail when blocking metric below threshold", () => {
      const framework = createMockFramework();
      const run = createMockRun({
        cases: [
          { caseId: "case_1", metric: "accuracy", score: 0.5, expectedClass: "pass", approvalMatched: true },
          { caseId: "case_2", metric: "accuracy", score: 0.6, expectedClass: "pass", approvalMatched: true },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.overallPass).toBe(false);
      expect(report.releaseDecision).toBe("hold");
      expect(report.blockingFailures.length).toBeGreaterThan(0);
    });

    it("should include evaluator results in report", () => {
      const framework = createMockFramework();
      const run = createMockRun();
      const report = service.evaluateSuite(framework, run);
      expect(report.evaluatorResults).toHaveLength(2);
    });

    it("should track covered metrics", () => {
      const framework = createMockFramework();
      const run = createMockRun({
        cases: [
          { caseId: "case_1", metric: "accuracy", score: 0.95, expectedClass: "pass" },
          { caseId: "case_2", metric: "latency", score: 80, expectedClass: "pass" },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.coveredMetrics).toContain("accuracy");
      expect(report.coveredMetrics).toContain("latency");
    });

    it("should identify missing online metrics", () => {
      const framework = createMockFramework();
      const run = createMockRun({
        cases: [
          { caseId: "case_1", metric: "accuracy", score: 0.95, expectedClass: "pass" },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.missingOnlineMetrics).toContain("latency");
      expect(report.missingOnlineMetrics).toContain("cost");
    });

    it("should handle few shot gate pass", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 2, minRegressionCaseCount: 1, requirePromptInjectionCoverage: false },
        fewShotExamples: [{ input: "1", expected: "1" }, { input: "2", expected: "2" }],
      });
      const run = createMockRun({ cases: [{ caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p" }] });
      const report = service.evaluateSuite(framework, run);
      expect(report.fewShotGatePassed).toBe(true);
    });

    it("should fail few shot gate when not enough examples", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 1, requirePromptInjectionCoverage: false },
        fewShotExamples: [{ input: "1", expected: "1" }],
      });
      const run = createMockRun({ cases: [{ caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p" }] });
      const report = service.evaluateSuite(framework, run);
      expect(report.fewShotGatePassed).toBe(false);
    });

    it("should handle regression case gate pass", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 1, minRegressionCaseCount: 3, requirePromptInjectionCoverage: false },
      });
      const run = createMockRun({
        cases: [
          { caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p" },
          { caseId: "c2", metric: "acc", score: 0.9, expectedClass: "p" },
          { caseId: "c3", metric: "acc", score: 0.9, expectedClass: "p" },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.regressionCaseGatePassed).toBe(true);
    });

    it("should fail regression case gate when not enough cases", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 1, minRegressionCaseCount: 10, requirePromptInjectionCoverage: false },
      });
      const run = createMockRun({
        cases: [{ caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p" }],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.regressionCaseGatePassed).toBe(false);
    });

    it("should handle prompt injection coverage when required", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 1, minRegressionCaseCount: 1, requirePromptInjectionCoverage: true },
      });
      const run = createMockRun({
        cases: [
          { caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p", approvalMatched: true },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.promptInjectionCoveragePassed).toBe(true);
    });

    it("should fail prompt injection coverage when any case has approvalMatched false", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 1, minRegressionCaseCount: 1, requirePromptInjectionCoverage: true },
      });
      const run = createMockRun({
        cases: [
          { caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p", approvalMatched: true },
          { caseId: "c2", metric: "acc", score: 0.9, expectedClass: "p", approvalMatched: false },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.promptInjectionCoveragePassed).toBe(false);
    });

    it("should pass prompt injection coverage when not required", () => {
      const framework = createMockFramework({
        releaseGates: { minFewShotCount: 1, minRegressionCaseCount: 1, requirePromptInjectionCoverage: false },
      });
      const run = createMockRun({
        cases: [{ caseId: "c1", metric: "acc", score: 0.9, expectedClass: "p" }],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.promptInjectionCoveragePassed).toBe(true);
    });

    it("should calculate average for metric with multiple cases", () => {
      const framework = createMockFramework();
      const run = createMockRun({
        cases: [
          { caseId: "c1", metric: "accuracy", score: 0.9, expectedClass: "p" },
          { caseId: "c2", metric: "accuracy", score: 0.95, expectedClass: "p" },
          { caseId: "c3", metric: "accuracy", score: 0.85, expectedClass: "p" },
        ],
      });
      const report = service.evaluateSuite(framework, run);
      const accuracyResult = report.evaluatorResults.find((r) => r.metric === "accuracy");
      expect(accuracyResult?.observedScore).toBe(0.9); // (0.9 + 0.95 + 0.85) / 3 = 0.9
    });

    it("should include non-blocking findings for below-threshold non-blocking metrics", () => {
      const framework = createMockFramework();
      const run = createMockRun({
        cases: [
          { caseId: "c1", metric: "accuracy", score: 0.95, expectedClass: "p" },
          { caseId: "c2", metric: "latency", score: 200, expectedClass: "p" }, // threshold is 100
        ],
      });
      const report = service.evaluateSuite(framework, run);
      expect(report.nonBlockingFindings.some((f) => f.includes("below_threshold"))).toBe(true);
    });

    it("should generate report with unique report ID", () => {
      const framework = createMockFramework();
      const run = createMockRun();
      const report1 = service.evaluateSuite(framework, run);
      const report2 = service.evaluateSuite(framework, run);
      expect(report1.reportId).not.toBe(report2.reportId);
    });

    it("should include framework and domain IDs in report", () => {
      const framework = createMockFramework({ frameworkId: "fw_123", domainId: "dom_456" });
      const run = createMockRun({ domainId: "dom_456" });
      const report = service.evaluateSuite(framework, run);
      expect(report.frameworkId).toBe("fw_123");
      expect(report.domainId).toBe("dom_456");
    });
  });

  describe("ReleaseGateReport structure", () => {
    it("should have all required fields", () => {
      const framework = createMockFramework();
      const run = createMockRun();
      const report = service.evaluateSuite(framework, run);

      expect(report).toHaveProperty("reportId");
      expect(report).toHaveProperty("suiteId");
      expect(report).toHaveProperty("frameworkId");
      expect(report).toHaveProperty("domainId");
      expect(report).toHaveProperty("overallPass");
      expect(report).toHaveProperty("releaseDecision");
      expect(report).toHaveProperty("blockingFailures");
      expect(report).toHaveProperty("nonBlockingFindings");
      expect(report).toHaveProperty("evaluatorResults");
      expect(report).toHaveProperty("coveredMetrics");
      expect(report).toHaveProperty("missingOnlineMetrics");
      expect(report).toHaveProperty("fewShotGatePassed");
      expect(report).toHaveProperty("regressionCaseGatePassed");
      expect(report).toHaveProperty("promptInjectionCoveragePassed");
      expect(report).toHaveProperty("createdAt");
    });
  });
});