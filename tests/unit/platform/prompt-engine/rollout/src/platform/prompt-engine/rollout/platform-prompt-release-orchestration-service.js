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
        // R14-21: When autoActivate is requested, gateDecision must be "promote" for activation to proceed.
        // If gateDecision is not "promote", autoActivate is ignored and the rollout remains in its current state.
        // R16-14 FIX: §17.3 - domain_owner_approval required for canary_20+, rollback_plan_present required for stable
        let rollout = createdRollout;
        if (input.autoActivate === true && createdRollout.status === "canary_5" && evaluationReport.gateDecision === "promote") {
            // Canary_5 requires domain_owner_approval per §17.3
            if (input.domainOwnerApproval !== true) {
                // Cannot auto-activate, stay at canary_5
            }
            else {
                rollout = this.rollouts.activateRollout(createdRollout.rolloutId);
                // After canary_5 succeeds, check if we can proceed to canary_20
                // Canary_20 requires domain_owner_approval and rollback_plan_present
                if (input.domainOwnerApproval === true && input.rollbackPlanPresent === true) {
                    rollout = this.rollouts.activateRollout(rollout.rolloutId);
                }
            }
        }
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
