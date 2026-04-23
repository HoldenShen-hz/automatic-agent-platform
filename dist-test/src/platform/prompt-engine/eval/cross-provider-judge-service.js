export class CrossProviderJudgeService {
    judgeService;
    defaultStrategy;
    constructor(judgeService, defaultStrategy = "cheapest") {
        this.judgeService = judgeService;
        this.defaultStrategy = defaultStrategy;
    }
    selectJudge(input) {
        const strategy = input.strategy ?? this.defaultStrategy;
        const alternatives = this.judgeService.suggestJudges({
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
            requiredCapability: "llm_judge",
        });
        const selectedJudge = selectByStrategy(alternatives, strategy);
        return {
            selectedJudge,
            alternativeJudges: alternatives,
            selectionStrategy: strategy,
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
        };
    }
    evaluateWithCrossProviderJudge(input) {
        const selection = this.selectJudge({
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
        });
        return this.judgeService.evaluateDataset({
            ...input,
            judgeId: input.judgeId ?? selection.selectedJudge?.judgeId ?? null,
        });
    }
    evaluateWithPipeline(input) {
        const { evaluation, pipeline } = input;
        const results = [];
        if (pipeline.primaryJudgeId) {
            const judge = this.judgeService.getJudge(pipeline.primaryJudgeId);
            if (judge && judge.status === "ready") {
                const report = this.judgeService.evaluateDataset({
                    ...evaluation,
                    judgeId: pipeline.primaryJudgeId,
                });
                results.push({
                    judgeId: pipeline.primaryJudgeId,
                    provider: judge.provider,
                    report,
                });
            }
        }
        for (const judgeId of pipeline.fallbackJudgeIds) {
            if (judgeId === pipeline.primaryJudgeId)
                continue;
            const judge = this.judgeService.getJudge(judgeId);
            if (judge && judge.status === "ready") {
                const report = this.judgeService.evaluateDataset({
                    ...evaluation,
                    judgeId,
                });
                results.push({
                    judgeId,
                    provider: judge.provider,
                    report,
                });
            }
        }
        return buildConsensusResult(results, pipeline.consensusThreshold);
    }
    suggestMultipleJudges(input) {
        const maxJudges = input.maxJudges ?? 3;
        const judges = this.judgeService.suggestJudges({
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
            requiredCapability: input.requiredCapability,
        });
        return judges.slice(0, maxJudges);
    }
    getProviderDiversityScore(judges) {
        const providerFamilies = new Set(judges.map((j) => j.providerFamily.toLowerCase()));
        return Number((providerFamilies.size / Math.max(judges.length, 1)).toFixed(2));
    }
}
function selectByStrategy(judges, strategy) {
    if (judges.length === 0)
        return null;
    switch (strategy) {
        case "cheapest":
            return [...judges].sort((a, b) => a.maxCostUsd - b.maxCostUsd)[0] ?? null;
        case "most_capable":
            return [...judges].sort((a, b) => b.capabilities.length - a.capabilities.length)[0] ?? null;
        case "provider_diverse":
            return selectProviderDiverse(judges);
        case "fastest":
        default:
            return judges[0] ?? null;
    }
}
function selectProviderDiverse(judges) {
    const byFamily = new Map();
    for (const judge of judges) {
        const family = judge.providerFamily.toLowerCase();
        const existing = byFamily.get(family) ?? [];
        existing.push(judge);
        byFamily.set(family, existing);
    }
    if (byFamily.size <= 1) {
        return judges[0] ?? null;
    }
    const representatives = [];
    for (const familyJudges of byFamily.values()) {
        const first = familyJudges[0];
        if (first !== undefined) {
            representatives.push(first);
        }
    }
    return representatives.sort((a, b) => a.maxCostUsd - b.maxCostUsd)[0] ?? null;
}
function buildConsensusResult(results, threshold) {
    if (results.length === 0) {
        return {
            consensusDecision: "hold",
            individualResults: [],
            agreementScore: 0,
            blockingFindings: ["no_judges_available"],
        };
    }
    const promoteCount = results.filter((r) => r.report.gateDecision === "promote").length;
    const holdCount = results.filter((r) => r.report.gateDecision === "hold").length;
    const rollbackCount = results.filter((r) => r.report.gateDecision === "rollback").length;
    const agreementScore = Number((promoteCount / results.length).toFixed(2));
    let consensusDecision;
    if (agreementScore >= threshold) {
        consensusDecision = "promote";
    }
    else if (promoteCount + holdCount > rollbackCount) {
        consensusDecision = "hold";
    }
    else {
        consensusDecision = "rollback";
    }
    const allBlockingFindings = results.flatMap((r) => r.report.blockingFindings);
    return {
        consensusDecision,
        individualResults: results,
        agreementScore,
        blockingFindings: [...new Set(allBlockingFindings)],
    };
}
//# sourceMappingURL=cross-provider-judge-service.js.map