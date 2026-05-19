import assert from "node:assert/strict";
import test from "node:test";
import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { CrossProviderJudgeService } from "../../../../../src/platform/prompt-engine/eval/cross-provider-judge-service.js";
function createHarness() {
    const judgeService = new EvalDatasetJudgeService();
    judgeService.registerDataset({
        datasetId: "dataset-cross-provider",
        name: "Cross Provider",
        version: "1.0.0",
        stage: "assess",
        createdBy: "quality",
        cases: [
            {
                caseId: "case-1",
                input: { question: "status" },
                expectedOutput: "ok",
                tags: [],
                priority: "critical",
                qualityCriteria: [
                    {
                        criterionId: "judge",
                        type: "llm_judge",
                        config: {},
                        weight: 1,
                        threshold: 0.8,
                    },
                ],
            },
        ],
    });
    judgeService.activateDataset("dataset-cross-provider");
    judgeService.registerJudge({
        judgeId: "judge-anthropic",
        provider: "anthropic",
        providerFamily: "anthropic",
        modelId: "claude-judge",
        maxCostUsd: 0.01,
    });
    return new CrossProviderJudgeService(judgeService);
}
test("CrossProviderJudgeService selects a different provider family for llm judge", () => {
    const service = createHarness();
    const selection = service.selectJudge({
        candidateProvider: "openai",
        candidateProviderFamily: "openai",
    });
    assert.equal(selection.selectedJudge?.judgeId, "judge-anthropic");
    assert.equal(selection.alternativeJudges.length, 1);
});
test("CrossProviderJudgeService evaluates dataset with automatically selected judge", () => {
    const service = createHarness();
    const report = service.evaluateWithCrossProviderJudge({
        datasetId: "dataset-cross-provider",
        candidateProvider: "openai",
        candidateProviderFamily: "openai",
        candidateModel: "gpt-test",
        results: [
            {
                caseId: "case-1",
                output: "ok",
                criterionSignals: { judge: 0.9 },
            },
        ],
    });
    assert.equal(report.gateDecision, "promote");
    assert.equal(report.judgeId, "judge-anthropic");
});
//# sourceMappingURL=cross-provider-judge-service.test.js.map