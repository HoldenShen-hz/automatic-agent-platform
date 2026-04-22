import { META_MODEL_QUESTION_IDS, type DomainMetaModel, type MetaModelAnswer } from "./types.js";

export interface MetaModelSeedInput {
  readonly domainId: string;
  readonly displayName: string;
  readonly ownerOrgNodeId: string;
  readonly taskTypes: readonly string[];
  readonly tags: readonly string[];
  readonly riskLevel: "medium" | "high" | "critical";
}

function buildAnswer(input: MetaModelSeedInput, questionId: typeof META_MODEL_QUESTION_IDS[number]): MetaModelAnswer {
  const domainLabel = input.displayName;
  const baseEvidence = [`domain:${input.domainId}`, `owner:${input.ownerOrgNodeId}`];

  switch (questionId) {
    case "Q1_primary_user":
      return { questionId, title: "Primary User", answer: `${domainLabel} operators and domain owners.`, evidenceRefs: baseEvidence, status: "complete" };
    case "Q2_primary_outcomes":
      return { questionId, title: "Primary Outcomes", answer: `Deliver governed ${domainLabel.toLowerCase()} outcomes with measurable quality gates.`, evidenceRefs: baseEvidence, status: "complete" };
    case "Q3_core_inputs":
      return { questionId, title: "Core Inputs", answer: `Inputs include ${input.taskTypes.join(", ")} tasks, policy context, and domain evidence.`, evidenceRefs: [...baseEvidence, "inputs:baseline"], status: "complete" };
    case "Q4_authoritative_sources":
      return { questionId, title: "Authoritative Sources", answer: `Authoritative sources are the domain knowledge namespace and governed internal systems for ${domainLabel}.`, evidenceRefs: [...baseEvidence, "knowledge:namespace"], status: "complete" };
    case "Q5_decision_scope":
      return { questionId, title: "Decision Scope", answer: `${domainLabel} may prepare plans and bounded execution steps under explicit rollout and approval policy.`, evidenceRefs: [...baseEvidence, "policy:governance"], status: "complete" };
    case "Q6_risk_hotspots":
      return { questionId, title: "Risk Hotspots", answer: `Primary hotspots are ${input.riskLevel} risk actions, policy breaches, and unsafe side effects.`, evidenceRefs: [...baseEvidence, "risk:profile"], status: "complete" };
    case "Q7_required_tools":
      return { questionId, title: "Required Tools", answer: `Baseline tools include read, summarize, and domain-specific adapters governed by rollout policy.`, evidenceRefs: [...baseEvidence, "tools:baseline"], status: "complete" };
    case "Q8_workflow_shape":
      return { questionId, title: "Workflow Shape", answer: "The domain follows a governed intake, execution, evaluation, and release workflow shape.", evidenceRefs: [...baseEvidence, "workflow:baseline"], status: "complete" };
    case "Q9_eval_metrics":
      return { questionId, title: "Eval Metrics", answer: "Quality, safety, cost, and latency metrics must pass before promotion.", evidenceRefs: [...baseEvidence, "eval:framework"], status: "complete" };
    case "Q10_human_governance":
      return { questionId, title: "Human Governance", answer: "Human approval is required for high-risk rollout, release, and exception handling paths.", evidenceRefs: [...baseEvidence, "approval:path"], status: "complete" };
    case "Q11_latency_sla":
      return { questionId, title: "Latency SLA", answer: `Latency target is calibrated to domain risk and task urgency for ${domainLabel}.`, evidenceRefs: [...baseEvidence, "sla:baseline"], status: "complete" };
    case "Q12_pre_launch_certs":
      return { questionId, title: "Pre-launch Certifications", answer: "Pre-launch evidence includes risk profile, eval framework, prompt library, workflow baseline, and rollout plan.", evidenceRefs: [...baseEvidence, "certs:baseline"], status: "complete" };
  }
}

export function seedDomainMetaModel(input: MetaModelSeedInput): DomainMetaModel {
  return {
    domainId: input.domainId,
    displayName: input.displayName,
    version: "v1",
    answers: META_MODEL_QUESTION_IDS.map((questionId) => buildAnswer(input, questionId)),
  };
}

export function seedDomainMetaModels(inputs: readonly MetaModelSeedInput[]): readonly DomainMetaModel[] {
  return inputs.map((input) => seedDomainMetaModel(input));
}
