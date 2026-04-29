import { ValidationError } from "../../contracts/errors.js";
import type {
  EvalCaseSubmission,
  EvalDatasetBaselineMetrics,
  EvalDatasetGatePolicy,
  EvalDatasetJudgeService,
  EvalDatasetRunReport,
  EvalRunPhase,
  JudgeProfileRecord,
} from "../eval/eval-dataset-judge-service.js";
import type {
  PromptTemplateRegistrationInput,
  PromptTemplateRecord,
  PromptTemplateRegistryService,
} from "../registry/index.js";
import type {
  PromptRolloutMode,
  PromptRolloutRecord,
  PromptRolloutService,
} from "./index.js";

export interface PlatformPromptReleaseInput {
  template: PromptTemplateRegistrationInput;
  datasetId: string;
  candidateProvider: string;
  candidateProviderFamily?: string | undefined;
  candidateModel: string;
  owner: string;
  mode: PromptRolloutMode;
  domainBlockCompatible: boolean;
  results: readonly EvalCaseSubmission[];
  judgeId?: string | null | undefined;
  phase?: EvalRunPhase | undefined;
  baseline?: EvalDatasetBaselineMetrics | undefined;
  gatePolicy?: EvalDatasetGatePolicy | undefined;
  autoActivate?: boolean | undefined;
  /** §17.3: Domain owner approval is required before release to canary_20 or higher */
  domainOwnerApproval?: boolean | null;
  /** §17.3: Rollback plan must be present for release to stable */
  rollbackPlanPresent?: boolean | null;
}

export interface PlatformPromptReleaseResult {
  template: PromptTemplateRecord;
  evaluationReport: EvalDatasetRunReport;
  judge: JudgeProfileRecord | null;
  rollout: PromptRolloutRecord;
}

export class PlatformPromptReleaseOrchestrationService {
  public constructor(
    private readonly templates: PromptTemplateRegistryService,
    private readonly datasets: EvalDatasetJudgeService,
    private readonly rollouts: PromptRolloutService,
  ) {}

  public createRelease(input: PlatformPromptReleaseInput): PlatformPromptReleaseResult {
    const template = this.templates.registerTemplate(input.template);
    const dataset = this.datasets.getDataset(input.datasetId);
    if (dataset == null) {
      throw new ValidationError(
        `platform_prompt_release.dataset_not_found:${input.datasetId}`,
        `Evaluation dataset ${input.datasetId} was not found.`,
      );
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
      } else {
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

  private resolveJudge(input: {
    explicitJudgeId: string | null;
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
  }): JudgeProfileRecord | null {
    if (input.explicitJudgeId != null) {
      const judge = this.datasets.getJudge(input.explicitJudgeId);
      if (judge == null) {
        throw new ValidationError(
          `platform_prompt_release.judge_not_found:${input.explicitJudgeId}`,
          `Judge profile ${input.explicitJudgeId} was not found.`,
        );
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
