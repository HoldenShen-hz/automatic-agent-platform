import { ValidationError } from "../../contracts/errors.js";
export class PlatformPromptReleaseOrchestrationService {
    templates;
    datasets;
    rollouts;
    constructor(templates, datasets, rollouts) {
        this.templates = templates;
        this.datasets = datasets;
        this.rollouts = rollouts;
    }
    createRelease(input) {
        const template = this.templates.registerTemplate(input.template);
        const dataset = this.datasets.getDataset(input.datasetId);
        if (dataset == null) {
            throw new ValidationError(`platform_prompt_release.dataset_not_found:${input.datasetId}`, `Evaluation dataset ${input.datasetId} was not found.`);
        }
        const requiresJudge = dataset.cases.some((item) => item.qualityCriteria.some((criterion) => criterion.type === "llm_judge"));
        const judge = requiresJudge
            ? this.resolveJudge({
                explicitJudgeId: input.judgeId ?? null,
                candidateProvider: input.candidateProvider,
                candidateProviderFamily: input.candidateProviderFamily,
            })
            : null;
        const evaluationReport = this.datasets.evaluateDataset({
            datasetId: input.datasetId,
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
            candidateModel: input.candidateModel,
            results: input.results,
            judgeId: judge?.judgeId ?? null,
            phase: input.phase,
            baseline: input.baseline,
            gatePolicy: input.gatePolicy,
        });
        const createdRollout = this.rollouts.createRollout({
            template,
            mode: input.mode,
            owner: input.owner,
            regressionSuiteId: evaluationReport.runId,
            regressionPassed: evaluationReport.gateDecision === "promote",
            domainBlockCompatible: input.domainBlockCompatible,
        });
        const rollout = input.autoActivate === true && createdRollout.status === "ready"
            ? this.rollouts.activateRollout(createdRollout.rolloutId)
            : createdRollout;
        return {
            template,
            evaluationReport,
            judge,
            rollout,
        };
    }
    resolveJudge(input) {
        if (input.explicitJudgeId != null) {
            const judge = this.datasets.getJudge(input.explicitJudgeId);
            if (judge == null) {
                throw new ValidationError(`platform_prompt_release.judge_not_found:${input.explicitJudgeId}`, `Judge profile ${input.explicitJudgeId} was not found.`);
            }
            return judge;
        }
        return this.datasets.suggestJudges({
            candidateProvider: input.candidateProvider,
            candidateProviderFamily: input.candidateProviderFamily,
            requiredCapability: "llm_judge",
        })[0] ?? null;
    }
}
//# sourceMappingURL=platform-prompt-release-orchestration-service.js.map